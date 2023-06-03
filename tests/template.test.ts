import { describe, expect, it, expectTypeOf, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs';
import {
  Address,
  Assets,
  ByteArrayData,
  ConstrData,
  Datum,
  hexToBytes,
  IntData,
  ListData,
  NetworkEmulator,
  NetworkParams,
  Program, 
  Tx,
  TxOutput,
  Value,
} from "@hyperionbt/helios";
import {lockAda} from './src/lockAda.ts';

describe("a template", async () => {

	// https://vitest.dev/guide/test-context.html
	beforeEach(async (context) => { 
		let optimize = false;

		// compile script
		const script = await fs.readFile('./src/vesting.js', 'utf8'); 
		const program = Program.new(script);
		const compiledProgram = program.compile(optimize); 
	 
		context.program = program;

		// instantiate the Emulator
		const minAda = BigInt(2000000);  // minimum lovelace needed to send an NFT
		const network = new NetworkEmulator();

		const alice = network.createWallet(BigInt(20000000));
		network.createUtxo(alice, BigInt(5000000));
		const bob = network.createWallet(BigInt(10000000));
		network.tick(BigInt(10));

		context.alice = alice;
		context.bob = bob;
		context.network = network;

	})

	it ("docs the tx ingridients", async ({network, alice, program}) => {
		// https://www.hyperion-bt.org/helios-book/api/reference/address.html?highlight=Address#address
		const aliceUtxos = await network.getUtxos(alice.address);
		// todo
		expect(alice.address.toHex().length).toBe(58)
		// todo
		expect(aliceUtxos[1].value.dump().lovelace).toBe('5000000')
		// todo
		expect(program.name).toBe('vesting');
	})

	it ("adds new code", async ({network, alice, validatorHash}) => {
		expect().toBe();
	})
})
