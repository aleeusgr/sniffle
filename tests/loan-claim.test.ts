import { describe, expect, it, expectTypeOf, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs';
import {
	hexToBytes,
	Address,
	Assets,
	ByteArrayData,
	ConstrData,
	Datum,
	IntData,
	ListData,
	MintingPolicyHash,
	NetworkEmulator,
	NetworkParams,
	Program,
	Tx,
	TxOutput,
	Value
} from "@hyperionbt/helios";

import {lockAda} from './src/lock-loan.ts';

describe("lock ADA to be exchanged for an nft", async () => {

	beforeEach(async (context) => { 
		let optimize = false;

		// compile script
		const script = await fs.readFile('./src/loan.js', 'utf8'); 
		const program = Program.new(script); 

		// instantiate the Emulator
		const minAda = BigInt(2000000);  // minimum lovelace needed to send an NFT
		const network = new NetworkEmulator();

		const lenny = network.createWallet(BigInt(20000000));
		network.createUtxo(lenny, BigInt(5000000));

		const boris = network.createWallet(BigInt(10000000));

		const mphHex = '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c';

		const testAsset = new Assets();
			testAsset.addComponent(
			MintingPolicyHash.fromHex( mphHex ),
			Array.from(new TextEncoder().encode('Test Asset Name')), BigInt(1)
		);

		// Add additional Token to the wallet
		network.createUtxo(boris, minAda, testAsset);
		network.createUtxo(boris, BigInt(10**8)); // spare utxo for fees

		network.tick(BigInt(10));

		context.lenny = lenny;
		context.boris = boris;
		context.network = network;
		context.program = program;
		context.mphHex = mphHex;
	})

	it ("checks the initial state of the Emulator", async ({network, lenny, boris, mphHex}) => {
		expect(lenny.address.toHex().length).toBe(58)
		expect(Object.keys((await boris.utxos)[1].value.dump().assets)[0]).toBe(mphHex);

	})

	it ("locks ADA and tries to unlock as nft holder", async ({network, lenny, boris, program, mphHex}) => {
		const adaQty = 10 ;
		await lockAda(network!, lenny!, boris!, program, adaQty, mphHex)
		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('14750843');

		const optimize = false;
		const compiledProgram = program.compile(optimize); 
		const validatorHash = compiledProgram.validatorHash;
		const validatorAddress = Address.fromValidatorHash(validatorHash); 
		const validatorUtxos = await network.getUtxos(validatorAddress)
		expect(validatorUtxos[0].value.lovelace).toBe(10000000n);

		const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
		const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));
		const emulatorDate = Number(networkParams.slotToTime(0n)); 
		const earlierTime = new Date(emulatorDate);
                const laterTime = new Date(emulatorDate + 3 * 60 * 60 * 1000);

		const borisUtxos = await boris.utxos;
		const changeAddr = await boris.address;
		const colUtxo = borisUtxos[0];
		const nftUtxo = borisUtxos[1];
		const sprUtxo = borisUtxos[2];

		const valRedeemer = new ConstrData(1, []);

		const tx = new Tx()
			.addInputs([nftUtxo])
			.addInputs(validatorUtxos, valRedeemer)
			.addOutput(new TxOutput(changeAddr, validatorUtxos[0].value))
			.addOutput(new TxOutput(validatorAddress, nftUtxo.value))
			.validFrom(earlierTime)
			.validTo(laterTime)
			.addSigner(changeAddr.pubKeyHash)
			.attachScript(compiledProgram)
			.addCollateral(colUtxo);

		const oracle = tx.dump().body;
		expect(oracle.collateral[0].origOutput.value.lovelace).toBe('10000000');
		expect(oracle.outputs[0].address.bech32).toBe(await boris.address.toBech32());
		expect(oracle.outputs[0].value.lovelace).toBe((adaQty*10**6).toString());
		expect(oracle.outputs[1].address.bech32).toBe(validatorAddress.toBech32());
		expect(Object.keys(oracle.outputs[1].value.assets)[0]).toBe(mphHex);
		expect(oracle.scriptDataHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
		await tx.finalize(networkParams, changeAddr);

	})
})
