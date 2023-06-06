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
    currentInput = context.get_current_input;
	//https://www.hyperion-bt.org/helios-book/lang/builtins/txinput.html#value

    redeemer.switch {
        Cancel => {
            // Check that the owner signed the transaction
            tx.is_signed_by(datum.creator).trace("VS2: ")
        },
        Claim => {

           tx.is_signed_by(datum.beneficiary).trace("VS4: ")
        }
    }
}
