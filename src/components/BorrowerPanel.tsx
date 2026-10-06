"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatEther, parseEther } from "ethers";
import { LoanData, LoanAction, isClosed } from "../lib/contract";
import { LoanList } from "./LoanRow";
import { btn, Help, input, Notice, panel, Segmented } from "./ui";

interface Props {
  account: string | null;
  loans: LoanData[];
  paused: boolean;
  maxPrincipal: bigint | null; // null = no cap / unknown
  onCreate: (principalWei: bigint, repaymentWei: bigint, dueDate: bigint) => Promise<boolean>;
  onAction: (action: LoanAction, loan: LoanData) => Promise<boolean>;
}

type Filter = "all" | "active" | "closed";

const DURATIONS = [
  { label: "5 minutes (demo)", short: "5 minutes", seconds: 5 * 60 },
  { label: "7 days", short: "7 days", seconds: 7 * 86400 },
  { label: "14 days", short: "14 days", seconds: 14 * 86400 },
  { label: "30 days", short: "30 days", seconds: 30 * 86400 },
];

// One form row: label (+ optional help) on the left, control on the right
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[8.5rem_1fr]">
      <div className="flex items-center gap-2 text-sm text-slate-800">
        {label}
        {help && <Help text={help} />}
      </div>
      {children}
    </div>
  );
}

function EthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3">
      <input className={input} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
      <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">Ξ</span>
        ETH
      </span>
    </div>
  );
}

function SummaryRow(props: { label: string; help?: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={`flex items-center gap-2 ${props.highlight ? "font-semibold text-blue-600" : "text-slate-800"}`}>
        {props.label}
        {props.help && <Help text={props.help} />}
      </dt>
      <dd className={`tabular-nums ${props.highlight ? "text-base font-semibold text-blue-600" : "text-slate-800"}`}>
        {props.children}
      </dd>
    </div>
  );
}

export function BorrowerPanel({ account, loans, paused, maxPrincipal, onCreate, onAction }: Props) {
  const [principal, setPrincipal] = useState("0.01");
  const [fee, setFee] = useState("0.001");
  const [duration, setDuration] = useState(DURATIONS[1].seconds);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  // Parse in wei (bigint) so repayment is always exactly principal + fee
  const amounts = useMemo(() => {
    try {
      return { p: parseEther(principal || "0"), f: parseEther(fee || "0") };
    } catch {
      return null;
    }
  }, [principal, fee]);

  const problem = useMemo(() => {
    if (!amounts) return "Enter valid numbers for the amount and fee.";
    if (amounts.p <= BigInt(0)) return "The amount must be greater than 0.";
    if (amounts.f < BigInt(0)) return "The fee can't be negative.";
    if (maxPrincipal && amounts.p > maxPrincipal)
      return `The amount is above the ${formatEther(maxPrincipal)} ETH limit.`;
    return null;
  }, [amounts, maxPrincipal]);

  const valid = problem ? null : amounts; // non-null only when the form is submittable
  const total = valid ? valid.p + valid.f : null;
  const feePct = valid && valid.p > BigInt(0) ? Number((valid.f * BigInt(10000)) / valid.p) / 100 : 0;
  const term = DURATIONS.find((d) => d.seconds === duration)?.short ?? "";

  const myLoans = loans
    .filter((l) => account && l.borrower.toLowerCase() === account.toLowerCase())
    .sort((a, b) => b.id - a.id);
  const shown = myLoans.filter((l) =>
    filter === "all" ? true : filter === "closed" ? isClosed(l.status) : !isClosed(l.status)
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !total) return;

    setSubmitting(true);
    try {
      const dueDate = BigInt(Math.floor(Date.now() / 1000) + duration);
      if (await onCreate(valid.p, total, dueDate)) {
        setPrincipal("0.01");
        setFee("0.001");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <form onSubmit={submit} className={`${panel} p-6 sm:p-8`}>
        {paused && (
          <div className="mb-6">
            <Notice>The contract is paused. New requests are disabled, but you can still repay and withdraw.</Notice>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* Inputs */}
          <div className="space-y-5">
            <Field label="Amount" help="How much ETH you want to borrow. A lender sends exactly this amount.">
              <EthInput value={principal} onChange={setPrincipal} />
            </Field>
            <Field label="Fee" help="A flat fee, in ETH, that you pay the lender on top of the amount.">
              <EthInput value={fee} onChange={setFee} />
            </Field>
            <Field label="Term" help="How long you have to repay once the request is made.">
              <select className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d.seconds} value={d.seconds}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Summary */}
          <dl className="space-y-4 rounded-lg bg-slate-50 p-6 text-sm">
            <SummaryRow label="You receive">{valid ? `${formatEther(valid.p)} ETH` : "–"}</SummaryRow>
            <SummaryRow
              label="You repay"
              highlight
              help="The amount plus the fee. It must be paid in one go, by the due date."
            >
              {total !== null ? `${formatEther(total)} ETH` : "–"}
            </SummaryRow>
            <SummaryRow label="Fee" highlight help="The flat fee as a percentage of the amount.">
              {valid ? `${feePct}%` : "–"}
            </SummaryRow>
            <SummaryRow label="Fee in ETH">{valid ? `${formatEther(valid.f)} ETH` : "–"}</SummaryRow>
            <SummaryRow label="Term">{term}</SummaryRow>
            {maxPrincipal && <SummaryRow label="Limit per loan">{formatEther(maxPrincipal)} ETH</SummaryRow>}
          </dl>
        </div>

        {problem && <p className="mt-6 text-center text-sm text-red-600">{problem}</p>}

        <div className="mt-8 flex justify-center">
          <button
            type="submit"
            disabled={!account || submitting || paused || !valid}
            className={`${btn.base} ${btn.primary} w-full py-3 text-base sm:w-64`}
          >
            {!account ? "Connect wallet to continue" : submitting ? "Confirm in wallet…" : "Request loan"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">My loans</h2>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: `All (${myLoans.length})` },
              { id: "active", label: "Active" },
              { id: "closed", label: "Closed" },
            ]}
          />
        </div>
        <LoanList
          loans={shown}
          account={account}
          paused={paused}
          onAction={onAction}
          empty={
            myLoans.length > 0
              ? "No loans match this filter."
              : account
              ? "You haven't requested a loan yet. Use the form above to start."
              : "Connect your wallet to see your loans."
          }
        />
      </section>
    </div>
  );
}
