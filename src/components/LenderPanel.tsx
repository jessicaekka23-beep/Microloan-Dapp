"use client";

import { useState } from "react";
import { formatEther } from "ethers";
import { LoanData, LoanStatus, LoanAction } from "../lib/contract";
import { LoanList } from "./LoanRow";
import { Notice, Segmented } from "./ui";

interface Props {
  account: string | null;
  loans: LoanData[];
  paused: boolean;
  onAction: (action: LoanAction, loan: LoanData) => Promise<boolean>;
}

type Tab = "market" | "portfolio";

const sum = (items: LoanData[], value: (l: LoanData) => bigint) =>
  items.reduce((acc, l) => acc + value(l), BigInt(0));

export function LenderPanel({ account, loans, paused, onAction }: Props) {
  const [tab, setTab] = useState<Tab>("market");
  const me = account?.toLowerCase();

  // Open requests, excluding the user's own (the contract forbids funding your own loan)
  const open = loans
    .filter((l) => l.status === LoanStatus.Requested && l.borrower.toLowerCase() !== me)
    .sort((a, b) => b.id - a.id);
  const portfolio = loans.filter((l) => !!me && l.lender.toLowerCase() === me).sort((a, b) => b.id - a.id);

  const outOnLoan = sum(
    portfolio.filter((l) => l.status === LoanStatus.Funded || l.status === LoanStatus.Withdrawn),
    (l) => l.principal
  );
  const earned = sum(
    portfolio.filter((l) => l.status === LoanStatus.Repaid),
    (l) => l.repayment - l.principal
  );
  const lost = sum(
    portfolio.filter((l) => l.status === LoanStatus.Defaulted),
    (l) => l.principal
  );

  const figures = [
    ["Out on loan", outOnLoan, "text-slate-900"],
    ["Earned", earned, "text-emerald-700"],
    ["Lost to defaults", lost, "text-red-700"],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Fund a loan</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Send the exact amount requested. Your ETH stays in escrow until the borrower withdraws it.
          </p>
        </div>

        {portfolio.length > 0 && (
          <dl className="flex gap-8">
            {figures.map(([name, value, color]) => (
              <div key={name}>
                <dt className="text-xs text-slate-500">{name}</dt>
                <dd className={`text-sm font-medium tabular-nums ${color}`}>{formatEther(value)} ETH</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {paused && <Notice>The contract is paused. New funding is disabled.</Notice>}

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { id: "market", label: `Open requests (${open.length})` },
          { id: "portfolio", label: `My portfolio (${portfolio.length})` },
        ]}
      />

      <LoanList
        loans={tab === "market" ? open : portfolio}
        account={account}
        paused={paused}
        onAction={onAction}
        empty={
          tab === "market"
            ? "No open requests from other borrowers right now."
            : account
            ? "You haven't funded a loan yet. Browse the open requests to get started."
            : "Connect your wallet to see your portfolio."
        }
      />
    </div>
  );
}
