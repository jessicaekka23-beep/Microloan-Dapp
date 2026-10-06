"use client";

import { useState, type ReactNode } from "react";
import { formatEther, ZeroAddress } from "ethers";
import { LoanData, LoanStatus, LoanAction, getStatusInfo, isClosed } from "../lib/contract";
import { btn, panel, StatusDot } from "./ui";

interface RowProps {
  loan: LoanData;
  account: string | null;
  paused?: boolean; // contract paused: new funding is blocked, everything else still works
  onAction: (action: LoanAction, loan: LoanData) => Promise<boolean>;
}

type Variant = "primary" | "secondary" | "danger";

const short = (a: string) => (a === ZeroAddress ? "none yet" : `${a.slice(0, 6)}…${a.slice(-4)}`);

function timeLeft(due: number): string {
  const s = due - Math.floor(Date.now() / 1000);
  if (s <= 0) return "Overdue";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `Due in ${d}d ${h}h`;
  if (h > 0) return `Due in ${h}h ${m}m`;
  return `Due in ${Math.max(m, 1)}m`;
}

const CLOSED_NOTE: Partial<Record<LoanStatus, string>> = {
  [LoanStatus.Repaid]: "Settled. The lender was paid.",
  [LoanStatus.Defaulted]: "Not repaid by the due date.",
  [LoanStatus.Cancelled]: "Cancelled by the borrower.",
  [LoanStatus.Refunded]: "Escrow returned to the lender.",
};

function Note({ children }: { children: ReactNode }) {
  return <span className="text-xs text-slate-500 md:text-right">{children}</span>;
}

function LoanRow({ loan, account, paused = false, onAction }: RowProps) {
  const [busy, setBusy] = useState<LoanAction | null>(null);

  const me = account?.toLowerCase();
  const isBorrower = !!me && me === loan.borrower.toLowerCase();
  const isLender = !!me && me === loan.lender.toLowerCase();
  const due = Number(loan.dueDate);
  const pastDue = Date.now() / 1000 > due;
  const closed = isClosed(loan.status);
  const status = getStatusInfo(loan.status);

  const fee = loan.repayment - loan.principal;
  const yieldPct = loan.principal > BigInt(0) ? Number((fee * BigInt(10000)) / loan.principal) / 100 : 0;

  const run = async (action: LoanAction) => {
    setBusy(action);
    try {
      await onAction(action, loan);
    } finally {
      setBusy(null);
    }
  };

  const button = (action: LoanAction, label: string, variant: Variant, extraDisabled = false) => (
    <button
      onClick={() => run(action)}
      disabled={busy !== null || !account || extraDisabled}
      className={`${btn.base} ${btn[variant]}`}
    >
      {busy === action ? "Confirm in wallet…" : label}
    </button>
  );

  let footer: ReactNode;
  switch (loan.status) {
    case LoanStatus.Requested:
      footer = isBorrower ? (
        <>
          <Note>Waiting for a lender</Note>
          {button("cancel", "Cancel request", "secondary")}
        </>
      ) : (
        button("fund", paused ? "Funding paused" : `Fund ${formatEther(loan.principal)} ETH`, "primary", paused)
      );
      break;

    case LoanStatus.Funded:
      if (isBorrower && !pastDue) {
        footer = button("withdraw", `Withdraw ${formatEther(loan.principal)} ETH`, "primary");
      } else if (isLender && pastDue) {
        footer = button("reclaim", "Reclaim your ETH", "primary");
      } else {
        footer = (
          <Note>{pastDue ? "Past due. The lender can reclaim the escrow." : "Escrowed until the borrower withdraws"}</Note>
        );
      }
      break;

    case LoanStatus.Withdrawn:
      if (pastDue) {
        footer = button("default", "Mark as defaulted", "danger");
      } else if (isBorrower) {
        footer = button("repay", `Repay ${formatEther(loan.repayment)} ETH`, "primary");
      } else {
        footer = <Note>Awaiting repayment</Note>;
      }
      break;

    default:
      footer = <Note>{CLOSED_NOTE[loan.status]}</Note>;
  }

  return (
    <li className="grid gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-[2.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] md:items-center">
      <span className="text-sm tabular-nums text-slate-400">#{loan.id}</span>

      <div>
        <div className="text-base font-medium tabular-nums text-slate-900">{formatEther(loan.principal)} ETH</div>
        <div className="text-xs tabular-nums text-slate-500">
          Repays {formatEther(loan.repayment)} ETH (+{yieldPct}%)
        </div>
      </div>

      <div className="space-y-0.5">
        <StatusDot tone={status.tone} label={status.label} />
        <div
          className={`text-xs ${pastDue && !closed ? "font-medium text-red-600" : "text-slate-500"}`}
          title={new Date(due * 1000).toLocaleString()}
        >
          {closed ? new Date(due * 1000).toLocaleDateString() : timeLeft(due)}
        </div>
      </div>

      <div className="space-y-0.5 text-xs text-slate-500">
        <div>
          Borrower <span className="font-mono text-slate-800">{short(loan.borrower)}</span>
          {isBorrower && " (you)"}
        </div>
        <div>
          Lender <span className="font-mono text-slate-800">{short(loan.lender)}</span>
          {isLender && " (you)"}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 md:items-end">{footer}</div>
    </li>
  );
}

export function LoanList(props: {
  loans: LoanData[];
  account: string | null;
  paused: boolean;
  empty: string;
  onAction: RowProps["onAction"];
}) {
  if (props.loans.length === 0) {
    return <div className={`${panel} px-5 py-12 text-center text-sm text-slate-500`}>{props.empty}</div>;
  }
  return (
    <ul className={`${panel} divide-y divide-slate-200`}>
      {props.loans.map((l) => (
        <LoanRow key={l.id} loan={l} account={props.account} paused={props.paused} onAction={props.onAction} />
      ))}
    </ul>
  );
}
