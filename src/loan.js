spending vesting

struct Datum {
    creator: PubKeyHash
    collateral: MintingPolicyHash
}

enum Redeemer {
    Cancel
    Claim
}

func main(datum: Datum, redeemer: Redeemer, context: ScriptContext) -> Bool {
	tx: Tx = context.tx;
	currentInput: TxInput = context.get_current_input();
	inputValue: Value = currentInput.value;
	// https://www.hyperion-bt.org/helios-book/lang/builtins/value.html?highlight=value#contains_policy
	

    redeemer.switch {
        Cancel => {
            // Check that the owner signed the transaction
            tx.is_signed_by(datum.creator).trace("VS1: ")
        },
        Claim => {
		inputValue.contains_policy(datum.collateral).trace("VS2: ")
        }
    }
}
