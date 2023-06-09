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
	// https://www.hyperion-bt.org/helios-book/lang/builtins/list.html
	// https://www.hyperion-bt.org/helios-book/lang/builtins/scriptcontext.html?#get_cont_outputs
	currentInput: []TxOutput = context.get_cont_outputs();
	inputValue: Value = currentInput.head.value;

    redeemer.switch {
        Cancel => {
            // Check that the owner signed the transaction
            tx.is_signed_by(datum.creator).trace("VS1: ")
        },
        Claim => {
		// https://www.hyperion-bt.org/helios-book/lang/builtins/value.html?highlight=value#contains_policy
		inputValue.contains_policy(datum.collateral).trace("VS2: ")
        }
    }
}
