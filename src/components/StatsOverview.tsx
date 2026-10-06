"use client";

import { formatEther } from "ethers";
import { LoanData, LoanStatus } from "../lib/contract";

export function StatsOverview({ loans }: { loans: LoanData[] }) {
  const count = (...s: LoanStatus[]) => loans.filter((l) => s.includes(l.status)).length;
  const eth = (wei: bigint) => Number(formatEther(wei)).toFixed(3);

  const requested = loans.reduce((acc, l) => acc + l.principal, BigInt(0));
  const returned = loans
    .filter((l) => l.status === LoanStatus.Repaid)
    .reduce((acc, l) => acc + l.repayment, BigInt(0));

  const repaid = count(LoanStatus.Repaid);
  const defaulted = count(LoanStatus.Defaulted);
  const takenOut = count(LoanStatus.Withdrawn) + repaid + defaulted; // loans where the borrower took the money
  const defaultRate = takenOut > 0 ? Math.round((defaulted / takenOut) * 100) : 0;

  const stats = [
    ["Loans", loans.length, `${eth(requested)} ETH requested`],
    ["Active", count(LoanStatus.Funded, LoanStatus.Withdrawn), "Escrowed or awaiting repayment"],
    ["Repaid", repaid, `${eth(returned)} ETH returned`],
    ["Defaulted", defaulted, `${defaultRate}% of loans taken out`],
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
      {stats.map(([name, value, sub]) => (
        <div key={name} className="bg-white px-5 py-4">
          <dt className="text-sm text-slate-500">{name}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd>
          <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
        </div>
      ))}
    </dl>
  );
}
