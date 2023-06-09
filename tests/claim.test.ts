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

		const testAsset = new Assets();
			testAsset.addComponent(
			MintingPolicyHash.fromHex( '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c' ),
			Array.from(new TextEncoder().encode('Test Asset Name')), BigInt(1)
		);

		// Add additional Token to the wallet
		network.createUtxo(boris, minAda, testAsset);

		network.tick(BigInt(10));

		context.lenny = lenny;
		context.boris = boris;
		context.network = network;
		context.program = program;
		context.testAsset = testAsset;
		// https://www.hyperion-bt.org/helios-book/api/reference/assets.html
		// https://www.hyperion-bt.org/helios-book/api/reference/mintingpolicyhash.html
	})

	it ("checks the initial state of the Emulator", async ({network, lenny, boris}) => {
		expect(lenny.address.toHex().length).toBe(58)
		expect(Object.keys((await boris.utxos)[1].value.dump().assets)[0]).toBe('16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c');

	})

	// https://blog.logrocket.com/understanding-exclamation-mark-typescript/
	it ("tests lockAda tx import", async ({network, lenny, boris, program, testAsset}) => {
		const adaQty = 10 ;
		await lockAda(network!, lenny!, boris!, program, testAsset, adaQty)
		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('14749655');

		const optimize = false;
		const compiledProgram = program.compile(optimize); 
                const validatorHash = compiledProgram.validatorHash;
                const validatorAddress = Address.fromValidatorHash(validatorHash); 
                const validatorUtxos = await network.getUtxos(validatorAddress)

                expect(validatorUtxos[0].value.lovelace).toBe(10000000n);

		const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
                const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));
		const initTime = new Date(Number(networkParams.slotToTime(0n)));
                const exprTime = new Date(Number(networkParams.slotToTime(100n)));

                const valRedeemer = new ConstrData(1, []);

                const borisUtxos = await boris.utxos;
                const changeAddr = await boris.address;
                const colUtxo = borisUtxos[0];
                const nftUtxo = borisUtxos[1];
                const sprUtxo = borisUtxos[2];

	})
})
