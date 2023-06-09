spending loan

struct Datum {
    creator: PubKeyHash
}

enum Redeemer {
    Cancel
    Claim
}

func main(datum: Datum, redeemer: Redeemer, context: ScriptContext) -> Bool {
	tx: Tx = context.tx;
	// https://www.hyperion-bt.org/helios-book/lang/builtins/value.html?highlight=value#contains_policy
	

    redeemer.switch {
        Cancel => {
            // Check that the owner signed the transaction
            tx.is_signed_by(datum.creator).trace("VS1: ")
        },
        Claim => {
		true
        }
    }
}
