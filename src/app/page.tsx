"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatEther, parseEther } from "ethers";
import { getMicroLoan, getSepoliaSigner } from "../lib/contract";
import { errorMessage } from "../lib/errors";

const STATUS = ["Requested", "Funded", "Withdrawn", "Repaid", "Defaulted"];

type Loan = {
  id: number;
  borrower: string;
  lender: string;
  principal: string;
  repayment: string;
  dueDate: number;
  status: string;
};

function inputParts(date: Date): { day: string; time: string } {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const iso = local.toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function describeDue(day: string, time: string): string {
  if (!day) return "Pick a date to see when the loan falls due.";
  const due = new Date(`${day}T${time || "00:00"}`);
  if (Number.isNaN(due.getTime())) return "Pick a valid date and time.";

  const when = due.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (due.getTime() <= Date.now()) return `${when} — already in the past.`;

  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  return `${when} · ${days <= 1 ? "within a day" : `in ${days} days`}`;
}

type PricingMode = "flat" | "apr" | "custom";

const PRICING_MODES: { id: PricingMode; label: string }[] = [
  { id: "flat", label: "Flat fee %" },
  { id: "apr", label: "APR %" },
  { id: "custom", label: "Custom amount" },
];

/** 0.000001 ETH — keeps quoted totals exact and readable. */
const WEI_STEP = 10n ** 12n;

function parseAmount(value: string): bigint | null {
  try {
    const wei = parseEther(value.trim() === "" ? "0" : value);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}

function parseBps(value: string): bigint | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return BigInt(Math.round(n * 100));
}

function roundWei(wei: bigint): bigint {
  const remainder = wei % WEI_STEP;
  return remainder * 2n >= WEI_STEP ? wei + (WEI_STEP - remainder) : wei - remainder;
}

function eth(wei: bigint): string {
  return formatEther(wei);
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [principal, setPrincipal] = useState("0.01");
  const [repayment, setRepayment] = useState("0.011");
  const [mode, setMode] = useState<PricingMode>("flat");
  const [rate, setRate] = useState("10");
  // Filled after mount so the prerendered HTML and the browser agree on "now".
  const [dueDay, setDueDay] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const next = inputParts(new Date(Date.now() + 7 * 86_400_000));
    setDueDay(next.day);
    setDueTime(next.time);
  }, []);

  const refreshLoans = useCallback(async () => {
    const signer = await getSepoliaSigner();
    const contract = getMicroLoan(signer);
    const count = Number(await contract.getFunction("loanCount")());
    const items: Loan[] = [];

    for (let id = 0; id < count; id += 1) {
      const row = await contract.getFunction("getLoan")(id);
      const statusIndex = Number(row[5]);
      items.push({
        id,
        borrower: String(row[0]),
        lender: String(row[1]),
        principal: formatEther(row[2]),
        repayment: formatEther(row[3]),
        dueDate: Number(row[4]),
        status: STATUS[statusIndex] ?? "Unknown",
      });
    }

    setLoans(items.reverse());
    setWallet(await signer.getAddress());
  }, []);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage(`${label}: waiting for MetaMask…`);
    try {
      const result = await action();
      if (result && typeof result === "object" && "wait" in result) {
        await (result as { wait: () => Promise<unknown> }).wait();
      }
      setMessage(`${label}: confirmed.`);
      await refreshLoans();
    } catch (cause) {
      setMessage("");
      setError(errorMessage(cause));
      // The chain is the source of truth — resync the list so stale buttons disappear.
      // Only when already connected, so a rejected connection prompt isn't shown twice.
      if (wallet) {
        try {
          await refreshLoans();
        } catch {
          // Wallet disconnected; keep the original error visible.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function connectWallet() {
    await runAction("Connect wallet", async () => {
      const signer = await getSepoliaSigner();
      setWallet(await signer.getAddress());
      const contract = getMicroLoan(signer);
      const count = Number(await contract.getFunction("loanCount")());
      const items: Loan[] = [];
      for (let id = 0; id < count; id += 1) {
        const row = await contract.getFunction("getLoan")(id);
        items.push({
          id,
          borrower: String(row[0]),
          lender: String(row[1]),
          principal: formatEther(row[2]),
          repayment: formatEther(row[3]),
          dueDate: Number(row[4]),
          status: STATUS[Number(row[5])] ?? "Unknown",
        });
      }
      setLoans(items.reverse());
      return undefined;
    });
  }

  async function actOnLoan(loan: Loan, action: "fund" | "withdrawToBorrower" | "repay" | "markDefault") {
    await runAction(`${action} loan #${loan.id}`, async () => {
      const signer = await getSepoliaSigner();
      const contract = getMicroLoan(signer);
      if (action === "fund") {
        return contract.getFunction("fund")(loan.id, { value: parseEther(loan.principal) });
      }
      if (action === "repay") {
        return contract.getFunction("repay")(loan.id, { value: parseEther(loan.repayment) });
      }
      return contract.getFunction(action)(loan.id);
    });
  }

  const currentWallet = wallet.toLowerCase();

  const dueAt = dueDay ? new Date(`${dueDay}T${dueTime || "00:00"}`).getTime() : Number.NaN;
  const dueInFuture = Number.isFinite(dueAt) && dueAt > Date.now();
  const dueText = describeDue(dueDay, dueTime);

  const principalWei = parseAmount(principal);
  const rateBps = parseBps(rate);
  const customWei = parseAmount(repayment);
  const termSeconds = Number.isFinite(dueAt)
    ? BigInt(Math.max(0, Math.floor((dueAt - Date.now()) / 1000)))
    : 0n;
  const termDays = Math.max(0, Math.round(Number(termSeconds) / 86_400));

  let repaymentWei: bigint | null = null;
  if (principalWei !== null) {
    if (mode === "custom") {
      repaymentWei = customWei;
    } else if (rateBps !== null) {
      // Flat: one-off markup. APR: pro-rata simple interest over the actual term.
      const interest =
        mode === "flat"
          ? (principalWei * rateBps) / 10_000n
          : (principalWei * rateBps * termSeconds) / (10_000n * 365n * 86_400n);
      const total = roundWei(principalWei + interest);
      repaymentWei = total > principalWei ? total : principalWei;
    }
  }
  const interestWei =
    principalWei !== null && repaymentWei !== null ? repaymentWei - principalWei : null;
  const termsValid =
    principalWei !== null && repaymentWei !== null && repaymentWei >= principalWei;
  const feePct =
    principalWei !== null && principalWei > 0n && interestWei !== null
      ? Number((interestWei * 10_000n) / principalWei) / 100
      : 0;

  const termsText =
    principalWei === null
      ? "Enter a principal amount."
      : repaymentWei === null
        ? mode === "custom"
          ? "Enter the repayment amount."
          : "Enter a valid rate."
        : interestWei === null || interestWei === 0n
          ? "Interest-free: the borrower repays exactly the principal."
          : interestWei < 0n
            ? "Repayment is below principal — the contract will reject this."
            : mode === "apr"
              ? `Borrower pays ${eth(interestWei)} ETH interest (${rate}% APR over ${termDays} days ≈ ${feePct.toFixed(2)}% of principal).`
              : `Borrower repays ${eth(interestWei)} ETH above principal (${feePct.toFixed(2)}% flat fee).`;

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (principalWei === null || repaymentWei === null) return;
    const dueSeconds = Math.floor(dueAt / 1000);
    const amount = principalWei;
    const total = repaymentWei;
    await runAction("Create loan request", async () => {
      const signer = await getSepoliaSigner();
      return getMicroLoan(signer).getFunction("requestLoan")(amount, total, dueSeconds);
    });
  }

  function applyPreset(days: number) {
    const next = inputParts(new Date(Date.now() + days * 86_400_000));
    setDueDay(next.day);
    if (!dueTime) setDueTime(next.time);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-5 py-10 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold"><span className="text-indigo-700">Wei</span>Lend</h1>
          <p className="mt-1 text-slate-600">Sepolia testnet · test ETH only</p>
        </div>
        <button className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={connectWallet} disabled={busy}>
          {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect MetaMask"}
        </button>
      </header>

      {message && <p className="rounded-lg bg-blue-50 p-3 text-blue-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}

      <section className="rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Borrower · Request a loan</h2>
        <form className="space-y-5" onSubmit={createRequest}>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {PRICING_MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`flex-1 rounded-md px-3 py-2 font-medium ${mode === option.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                onClick={() => setMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Principal (ETH)
              <input className="rounded border p-2" type="number" min="0.000000000000000001" step="any" required value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </label>
            {mode === "custom" ? (
              <label className="grid gap-1 text-sm">Total repayment (ETH)
                <input className="rounded border p-2" type="number" min="0.000000000000000001" step="any" required value={repayment} onChange={(e) => setRepayment(e.target.value)} />
              </label>
            ) : (
              <label className="grid gap-1 text-sm">{mode === "flat" ? "Flat fee (%)" : "APR (% per year)"}
                <input className="rounded border p-2" type="number" min="0" step="0.01" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </label>
            )}
          </div>

          {mode !== "custom" && principalWei !== null && repaymentWei !== null && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-600">Principal</span><span>{eth(principalWei)} ETH</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-600">{mode === "flat" ? "Fee" : `Interest (${termDays} days)`}</span><span>{interestWei !== null && interestWei > 0n ? `${eth(interestWei)} ETH` : "0 ETH"}</span></div>
              <div className="mt-1 flex justify-between gap-4 border-t border-slate-200 pt-1 font-semibold"><span>Total repayment</span><span>{eth(repaymentWei)} ETH</span></div>
            </div>
          )}

          <p className={`text-xs ${termsValid ? "text-slate-500" : "text-amber-700"}`}>{termsText}</p>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Due date &amp; time</span>
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Due date" className="min-w-44 flex-1 rounded border p-2" type="date" required value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              <input aria-label="Due time" className="rounded border p-2" type="time" required value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              <div className="flex gap-1">
                {[7, 14, 30].map((days) => (
                  <button key={days} type="button" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50" onClick={() => applyPreset(days)}>
                    {days === 7 ? "1 week" : days === 14 ? "2 weeks" : "30 days"}
                  </button>
                ))}
              </div>
            </div>
            <p className={`text-xs ${dueInFuture ? "text-slate-500" : "text-amber-700"}`}>{dueText}</p>
          </div>

          <button className="w-full rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy || !wallet || !dueInFuture || !termsValid}>
            Create request
          </button>
        </form>
        {!wallet && <p className="mt-3 text-sm text-slate-500">Connect MetaMask first. Repayment must be at least the principal.</p>}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Loans</h2>
          <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={busy || !wallet} onClick={() => runAction("Refresh", refreshLoans)}>Refresh</button>
        </div>
        {loans.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-slate-600">No loans found. Connect MetaMask and refresh to load the on-chain list.</p>
        ) : loans.map((loan) => {
          const isBorrower = currentWallet === loan.borrower.toLowerCase();
          const isPastDue = Date.now() / 1000 >= loan.dueDate;
          return (
            <article className="space-y-3 rounded-xl border border-slate-200 p-5 shadow-sm" key={loan.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Loan #{loan.id} · {loan.status}</h3>
                <span className="text-sm text-slate-600">Due {new Date(loan.dueDate * 1000).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-700">Principal: {loan.principal} ETH · Repayment: {loan.repayment} ETH</p>
              <p className="break-all text-xs text-slate-500">Borrower: {loan.borrower}{loan.lender !== "0x0000000000000000000000000000000000000000" && ` · Lender: ${loan.lender}`}</p>
              <div className="flex flex-wrap gap-2">
                {loan.status === "Requested" && !isBorrower && <button className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !wallet} onClick={() => actOnLoan(loan, "fund")}>Fund loan</button>}
                {loan.status === "Funded" && isBorrower && <button className="rounded bg-indigo-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !wallet || isPastDue} onClick={() => actOnLoan(loan, "withdrawToBorrower")}>Withdraw</button>}
                {loan.status === "Withdrawn" && isBorrower && <button className="rounded bg-indigo-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !wallet || isPastDue} onClick={() => actOnLoan(loan, "repay")}>Repay</button>}
                {/* The deployed contract (0x3d43…) only accepts defaults on Withdrawn loans. */}
                {loan.status === "Withdrawn" && isPastDue && <button className="rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !wallet} onClick={() => actOnLoan(loan, "markDefault")}>Mark default</button>}
              </div>
            </article>
          );
        })}
      </section>

      <p className="text-xs text-slate-500">This demo uses Sepolia test ETH. A default after withdrawal records nonpayment; it does not recover the lender’s funds.</p>
    </main>
  );
}
