type RpcError = {
  code?: string | number;
  reason?: string;
  shortMessage?: string;
  message?: string;
  revert?: { args?: unknown[] };
};

const REVERT_TEXT: Record<string, string> = {
  "Wrong loan status": "This loan can't be changed in its current state — the list has been refreshed.",
  "Loan cannot be defaulted": "This loan isn't eligible to be marked as defaulted.",
  "Loan is not past due date": "This loan isn't past its due date yet.",
  "Loan is not requested": "This loan has already been funded.",
  "Loan is not funded": "This loan hasn't been funded yet.",
  "Loan is not withdrawn": "The borrower hasn't withdrawn this loan yet.",
  "Only borrower": "Only the borrower can do that.",
  "Borrower cannot fund own loan": "You can't fund your own loan — switch to the other account.",
  "Send exact principal": "The funding amount must match the loan's principal exactly.",
  "Send exact repayment": "The repayment amount must match the loan's terms exactly.",
  "Invalid loan ID": "That loan doesn't exist.",
  "Principal must be positive": "Enter a principal above zero.",
  "Repayment below principal": "Repayment must be at least the principal.",
  "Due date must be in the future": "Pick a due date in the future.",
  "Reentrant call": "That transaction was already in progress.",
};

/**
 * Turns ethers/MetaMask errors into one short sentence.
 * The raw RPC error contains revert data, the transaction object and the whole call stack,
 * which is far too noisy to show in the UI.
 */
export function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Something went wrong.";
  const err = error as RpcError;

  if (err.code === "ACTION_REJECTED" || err.code === 4001) return "Request cancelled in MetaMask.";

  // ethers stores a revert string in both `reason` and `revert.args[0]`.
  const revertArg = err.revert?.args?.[0];
  const raw = typeof revertArg === "string" ? revertArg : (err.reason ?? err.shortMessage ?? "");
  const reason = raw
    .replace(/^execution reverted:?\s*/i, "")
    .replace(/\s*\(action=.*$/i, "")
    .replace(/^"|"$/g, "")
    .trim();

  if (reason && REVERT_TEXT[reason]) return REVERT_TEXT[reason];

  if (err.code === "INSUFFICIENT_FUNDS") return "Not enough Sepolia ETH to cover this transaction and its gas.";
  if (err.code === "CALL_EXCEPTION") {
    return reason ? `The contract rejected this: ${truncate(reason)}.` : "The contract rejected this transaction.";
  }

  const fallback = (err.shortMessage ?? err.message ?? "").split("\n")[0].trim();
  return fallback ? truncate(fallback) : "Something went wrong.";
}

function truncate(text: string): string {
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}
