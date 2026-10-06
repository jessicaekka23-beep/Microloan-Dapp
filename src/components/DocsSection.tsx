"use client";

import { panel } from "./ui";

const STEPS = [
  ["Request", "Borrower", "Sets the amount, the total to repay (amount plus a flat fee) and a due date."],
  ["Fund", "Lender", "Sends exactly the requested amount. The contract holds it in escrow."],
  ["Withdraw", "Borrower", "Takes the escrowed ETH into their wallet, any time before the due date."],
  ["Repay", "Borrower", "Sends the exact repayment by the due date. The contract pays the lender."],
  ["Default", "Anyone", "If the due date passes with no repayment, anyone can record the default."],
];

const EXITS = [
  ["Cancelled", "Before anyone funds it, the borrower can cancel their own request."],
  ["Refunded", "If the borrower never withdraws before the due date, the lender reclaims the escrowed ETH."],
];

const RULES = [
  ["Payout safety", "State is updated before any ETH is sent, and a reentrancy guard covers every payout."],
  ["Exact amounts", "Funding and repaying revert unless the amount matches the loan terms exactly."],
  ["No self-funding", "A borrower can't fund their own request."],
  ["Admin limits", "The owner can pause new requests and funding and cap the amount, but can never touch escrow or block repaying, withdrawing, defaulting or refunding."],
];

function Terms({ title, items }: { title: string; items: string[][] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 space-y-3">
        {items.map(([name, text]) => (
          <div key={name}>
            <dt className="text-sm font-medium text-slate-800">{name}</dt>
            <dd className="text-sm leading-relaxed text-slate-500">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DocsSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-slate-900">How it works</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Every rule lives in the smart contract on Sepolia and every step emits an event, so the full history is
          public. Testnet only, no real money.
        </p>
      </div>

      <ol className={`${panel} divide-y divide-slate-200`}>
        {STEPS.map(([title, role, text], i) => (
          <li key={title} className="flex gap-4 px-5 py-4">
            <span className="w-5 text-sm tabular-nums text-slate-400">{i + 1}</span>
            <div>
              <div className="text-sm font-medium text-slate-900">
                {title} <span className="font-normal text-slate-500">by {role.toLowerCase()}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-8 md:grid-cols-2">
        <Terms title="Other ways a loan can end" items={EXITS} />
        <Terms title="Safety rules" items={RULES} />
      </div>
    </div>
  );
}
