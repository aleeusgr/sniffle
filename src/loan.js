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

    redeemer.switch {
        Cancel => {
            tx.is_signed_by(datum.creator).trace("VS1: ")
        },
        Claim => {
		true
        }
    }
}
