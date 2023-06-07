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

import {lockAda} from './src/lockAda.ts';

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
	it ("tests lockAda tx", async ({network, lenny, boris, program, mph}) => {

		let optimize = false;
		const benAddr = boris.address;
		const adaQty = 10 ;
		const duration = 10000000;

		const compiledProgram = program.compile(optimize); 
		const validatorHash = compiledProgram.validatorHash;
		const validatorAddress = Address.fromValidatorHash(validatorHash); 

		const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
		const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));

		const emulatorDate = Number(networkParams.slotToTime(0n)); 
		const deadline = new Date(emulatorDate + duration);
		const ownerPkh = lenny.pubKeyHash;

		// here need to be mph, which I need to add to BeforeEach
		const benPkh = boris.pubKeyHash;

		const lovelaceAmt = Number(adaQty) * 1000000;
		const adaAmountVal = new Value(BigInt(lovelaceAmt));

		const datum = new ListData([new ByteArrayData(ownerPkh.bytes),
					    new ByteArrayData(mph)]);
		const inlineDatum = Datum.inline(datum);

		const inputUtxos = await lenny.utxos;

		const tx = new Tx();

		tx.addInputs(inputUtxos);

		const mintScript =`minting nft

		const TX_ID: ByteArray = #` + inputUtxos[0].txId.hex + `
		const txId: TxId = TxId::new(TX_ID)
		const outputId: TxOutputId = TxOutputId::new(txId, ` + inputUtxos[0].utxoIdx + `)

		enum Redeemer {
			Init
		}

		func main(_, ctx: ScriptContext) -> Bool {
			tx: Tx = ctx.tx;
			mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

			assetclass: AssetClass = AssetClass::new(
			mph,
			"Vesting Key".encode_utf8()
			);
			value_minted: Value = tx.minted;

			// Validator logic starts
			(value_minted == Value::new(assetclass, 1)).trace("NFT1: ") &&
			tx.inputs.any((input: TxInput) -> Bool {
						(input.output_id == outputId).trace("NFT2: ")
						}
			)
		}`

		const mintProgram = Program.new(mintScript).compile(optimize);

		tx.attachScript(mintProgram);

		// Construct the NFT that we will want to send as an output
		const nftTokenName = ByteArrayData.fromString("Vesting Key").toHex();
		const tokens: [number[], bigint][] = [[hexToBytes(nftTokenName), BigInt(1)]];

		// Create an empty Redeemer because we must always send a Redeemer with
		// a plutus script transaction even if we don't actually use it.
		const mintRedeemer = new ConstrData(0, []);

		// Indicate the minting we want to include as part of this transaction
		tx.mintTokens(
			mintProgram.mintingPolicyHash,
			tokens,
			mintRedeemer
		)

		const lockedVal = new Value(adaAmountVal.lovelace, new Assets([[mintProgram.mintingPolicyHash, tokens]]));
		
		// Add the destination address and the amount of Ada to lock including a datum
		tx.addOutput(new TxOutput(validatorAddress, lockedVal, inlineDatum));


		await tx.finalize(networkParams, lenny.address);
		const txId = await network.submitTx(tx);

		network.tick(BigInt(10));

		//lenny utxos changed
		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('14750843');
		expect(mintProgram.mintingPolicyHash.hex).toBe('702cd6229f16532ca9735f65037092d099b0ff78a741c82db0847bbf');	
		
		// validator address holds Vesting Key
		expect(Object.keys((await network.getUtxos(validatorAddress))[0].value.dump().assets)[0]).toEqual(mintProgram.mintingPolicyHash.hex);

	})

	it.skip ("tests lockAda tx import", async ({network, lenny, boris, validatorHash}) => {
		const adaQty = 10 ;
		const duration = 10000000;
		await lockAda(network!, lenny!, boris!, validatorHash, adaQty, duration)

		const validatorAddress = Address.fromValidatorHash(validatorHash); 
		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('5000000');
		expect((await lenny.utxos)[1].value.dump().lovelace).toBe('9755287');
		expect(Object.keys((await network.getUtxos(validatorAddress))[0].value.dump().assets)[0]).toBe('702cd6229f16532ca9735f65037092d099b0ff78a741c82db0847bbf');
	})
})
