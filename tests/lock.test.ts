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

import {lockAda} from './src/lock.ts';

describe("lock ADA to be exchanged for an nft", async () => {

	beforeEach(async (context) => { 
		let optimize = false;

		// compile script
		const script = await fs.readFile('./src/onchain.hl', 'utf8'); 
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
	it ("lenny locks 10 ada to exchange for an nft", async ({network, lenny, boris, program, testAsset}) => {

		let optimize = false;
		const adaQty = 10 ;

		const compiledProgram = program.compile(optimize); 
		const validatorHash = compiledProgram.validatorHash;
		const validatorAddress = Address.fromValidatorHash(validatorHash); 

		const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
		const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));

		const emulatorDate = Number(networkParams.slotToTime(0n)); 
		const ownerPkh = lenny.pubKeyHash;

		const lovelaceAmt = new Value(BigInt(Number(adaQty) * 1000000)); 

		const datum = new ListData([new ByteArrayData(ownerPkh.bytes),
					    new ByteArrayData(testAsset.mintingPolicies[0].bytes)]);
					    // ByteArrayData.fromString(testAsset.mintingPolicies[0].hex)]);

		const inlineDatum = Datum.inline(datum);

		const inputUtxos = await lenny.utxos;

		// Construct the NFT that we will want to send as an output
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

		const nftTokenName = ByteArrayData.fromString("Vesting Key").toHex();
		const tokens: [number[], bigint][] = [[hexToBytes(nftTokenName), BigInt(1)]];

		// Create an empty Redeemer because we must always send a Redeemer with
		// a plutus script transaction even if we don't actually use it.
		const mintRedeemer = new ConstrData(0, []);

		const lockedVal = new Value(lovelaceAmt.lovelace, new Assets([[mintProgram.mintingPolicyHash, tokens]]));
		
		const tx = new Tx()
			.addInputs(inputUtxos)
			.attachScript(mintProgram)
			.mintTokens(
				mintProgram.mintingPolicyHash,
				tokens,
				mintRedeemer
			)
			.addOutput(new TxOutput(validatorAddress, lockedVal, inlineDatum));

		await tx.finalize(networkParams, lenny.address);
		const txId = await network.submitTx(tx);

		network.tick(BigInt(10));

		//lenny utxos changed
		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('14749655');
		//??? 
		expect(tx.dump().body.outputs[0].datum.inlineSchema.list[1].bytes).toBe('16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c');
		expect((await network.getUtxos(validatorAddress))[0].origOutput.datum.data.list[1].toHex()).toBe('16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c');	
		
	})

	it ("tests lockAda tx import", async ({network, lenny, boris, program, testAsset}) => {
		const optimize = false;
		const adaQty = 10 ;
		await lockAda(network!, lenny!, boris!, program, testAsset, adaQty)

		expect((await lenny.utxos)[0].value.dump().lovelace).toBe('14749655');

	})
})
