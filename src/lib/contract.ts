export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x3d43510D4e1E5408d463Ff8E57e4EABA1657f934";

export const SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const SEPOLIA_CHAIN_ID = 11155111;

// Human-readable ABI (ethers v6 reads this directly). Matches MicroLoan.sol.
export const MICRO_LOAN_ABI = [
  // reads
  "function loanCount() view returns (uint256)",
  "function getLoan(uint256 id) view returns (address borrower, address lender, uint256 principal, uint256 repayment, uint64 dueDate, uint8 status)",
  "function paused() view returns (bool)",
  "function maxPrincipal() view returns (uint256)",
  // borrower
  "function requestLoan(uint256 principal, uint256 repayment, uint64 dueDate) returns (uint256)",
  "function cancelRequest(uint256 id)",
  "function withdrawToBorrower(uint256 id)",
  "function repay(uint256 id) payable",
  // lender
  "function fund(uint256 id) payable",
  "function reclaimFunding(uint256 id)",
  // anyone
  "function markDefault(uint256 id)",
];

// Same order as `enum Status` in MicroLoan.sol. Do not reorder.
export enum LoanStatus {
  Requested,
  Funded,
  Withdrawn,
  Repaid,
  Defaulted,
  Cancelled,
  Refunded,
}

export interface LoanData {
  id: number;
  borrower: string;
  lender: string;
  principal: bigint;
  repayment: bigint;
  dueDate: bigint;
  status: LoanStatus;
}

export type LoanAction = "fund" | "withdraw" | "repay" | "default" | "cancel" | "reclaim";

export type Tone = "pending" | "active" | "good" | "bad" | "muted";

const STATUS_INFO: Record<LoanStatus, { label: string; tone: Tone }> = {
  [LoanStatus.Requested]: { label: "Requested", tone: "pending" },
  [LoanStatus.Funded]: { label: "Funded", tone: "active" },
  [LoanStatus.Withdrawn]: { label: "Withdrawn", tone: "active" },
  [LoanStatus.Repaid]: { label: "Repaid", tone: "good" },
  [LoanStatus.Defaulted]: { label: "Defaulted", tone: "bad" },
  [LoanStatus.Cancelled]: { label: "Cancelled", tone: "muted" },
  [LoanStatus.Refunded]: { label: "Refunded", tone: "muted" },
};

export const getStatusInfo = (s: LoanStatus): { label: string; tone: Tone } =>
  STATUS_INFO[s] ?? { label: "Unknown", tone: "muted" };

// Loans that are finished and need no further action
export const isClosed = (s: LoanStatus) =>
  s === LoanStatus.Repaid ||
  s === LoanStatus.Defaulted ||
  s === LoanStatus.Cancelled ||
  s === LoanStatus.Refunded;

export function formatTxError(err: any): string {
  const msg: string =
    err?.reason || err?.shortMessage || err?.info?.error?.message || err?.message || "Transaction failed";
  if (/user rejected/i.test(msg)) return "Transaction cancelled.";
  if (/insufficient funds/i.test(msg)) return "Not enough Sepolia ETH for this transaction.";
  return msg.length > 120 ? `${msg.slice(0, 120)}…` : msg;
}
