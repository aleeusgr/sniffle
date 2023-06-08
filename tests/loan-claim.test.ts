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

		const mph = '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c';

		const testAsset = new Assets();
			testAsset.addComponent(
			MintingPolicyHash.fromHex( mph ),
			Array.from(new TextEncoder().encode('Test Asset Name')), BigInt(1)
		);

		// Add additional Token to the wallet
		network.createUtxo(boris, minAda, testAsset);
		network.createUtxo(boris, BigInt(10**8));

		network.tick(BigInt(10));

		context.lenny = lenny;
		context.boris = boris;
		context.network = network;
		context.program = program;
		context.mph = mph;
	})

	it ("checks the initial state of the Emulator", async ({network, lenny, boris, mph}) => {
		expect(lenny.address.toHex().length).toBe(58)
		expect(Object.keys((await boris.utxos)[1].value.dump().assets)[0]).toBe(mph);

	})

	it ("creates a claim transaction", async ({network, lenny, boris, program, mph}) => {
		const optimize = false;
		const adaQty = 10 ;
		await lockAda(network!, lenny!, boris!, program, adaQty, mph)
		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('14750843');
		
		const compiledScript = program.compile(optimize);
		const validatorHash = compiledScript.validatorHash;
		const validatorAddress = Address.fromValidatorHash(validatorHash);

		const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
		const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));

		const valRedeemer = new ConstrData(1, []); // 1 stands for 2nd item: claim

		const valUtxo = (await network.getUtxos(validatorAddress))[0]
		expect(Object.keys(valUtxo.value.dump().assets)[0]).toEqual('702cd6229f16532ca9735f65037092d099b0ff78a741c82db0847bbf')

		const borisAddress = await boris.address;
		const borisUtxos = await boris.utxos;
		const colatUtxo = borisUtxos[0];
		const nftUtxo   = borisUtxos[1];
		const spareUtxo = borisUtxos[2];
		expect(colatUtxo.value.lovelace).toBe(10000000n);
		expect(nftUtxo.value.assets.mintingPolicies[0].hex).toBe(mph);
		expect(spareUtxo.value.lovelace).toBe(100000000n);

		const emulatorDate = Number(await networkParams.slotToTime(0n)); 
		const earlierTime = new Date(emulatorDate);
		const laterTime = new Date(emulatorDate + 3 * 60 * 60 * 1000);

		const tx = new Tx()
			.addInput(valUtxo, valRedeemer)
			.addInput(nftUtxo)
			.addOutput(new TxOutput(borisAddress, valUtxo.value))
			.addOutput(new TxOutput(validatorAddress, nftUtxo.value))
			.validFrom(earlierTime)
			.validTo(laterTime)
			.addSigner(borisAddress.pubKeyHash)
			.attachScript(compiledScript)
			.addCollateral(colatUtxo)

		const oracle = tx.dump().body;

		await tx.finalize(networkParams, borisAddress, [spareUtxo]);
		expect(oracle).toBe();
	})
})
