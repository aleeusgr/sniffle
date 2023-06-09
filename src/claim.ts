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

// https://github.com/lley154/helios-examples/blob/704cf0a92cfe252b63ffb9fd36c92ffafc1d91f6/vesting/pages/index.tsx#LL157C1-L280C4
export const claimAda = async (
		network: NetworkEmulator,
		lenny : WalletEmulator,
		boris : WalletEmulator,
		program: Program,
		testAsset : Assets,
		) => {

		const optimize = false;
		const compiledProgram = program.compile(optimize); 
                const validatorHash = compiledProgram.validatorHash;
                const validatorAddress = Address.fromValidatorHash(validatorHash); 
                const validatorUtxos = await network.getUtxos(validatorAddress)

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

                const tx = new Tx()
                        .addInputs([nftUtxo])
                        .addInputs(validatorUtxos, valRedeemer)
                        .addOutput(new TxOutput(changeAddr, validatorUtxos[0].value))
                        .addOutput(new TxOutput(validatorAddress, nftUtxo.value))
                        .validFrom(initTime)
                        .validTo(exprTime)
                        .addSigner(changeAddr.pubKeyHash)
                        .attachScript(compiledProgram)
                        .addCollateral(colUtxo);
		await tx.finalize(networkParams, changeAddr, [sprUtxo]);

                const txId = await network.submitTx(tx);

                network.tick(BigInt(10));
		}
