"use client";

import { useRef, useState } from "react";
import { Contract } from "ethers";
import { useWeb3 } from "../hooks/useWeb3";
import { Navbar } from "../components/Navbar";
import { StatsOverview } from "../components/StatsOverview";
import { BorrowerPanel } from "../components/BorrowerPanel";
import { LenderPanel } from "../components/LenderPanel";
import { DocsSection } from "../components/DocsSection";
import { btn } from "../components/ui";
import {
  CONTRACT_ADDRESS,
  MICRO_LOAN_ABI,
  LoanAction,
  LoanData,
  formatTxError,
} from "../lib/contract";

type Tab = "borrower" | "lender" | "docs";
const TABS: { id: Tab; label: string }[] = [
  { id: "borrower", label: "Borrow" },
  { id: "lender", label: "Lend" },
  { id: "docs", label: "How it works" },
];

export default function Home() {
  const w = useWeb3();
  const [tab, setTab] = useState<Tab>("borrower");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = (ok: boolean, text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ ok, text });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  // Every transaction goes through here: guard, send, wait, refresh, report errors once.
  const runTx = async (call: (c: Contract) => Promise<any>, successText: string): Promise<boolean> => {
    if (!w.signer) {
      notify(false, "Connect your wallet first.");
      return false;
    }
    if (!w.isSepolia) {
      notify(false, "Switch your wallet to Sepolia.");
      return false;
    }

    try {
      const tx = await call(new Contract(CONTRACT_ADDRESS, MICRO_LOAN_ABI, w.signer));
      notify(true, "Transaction sent. Waiting for confirmation…");
      await tx.wait();
      await Promise.all([w.fetchLoans(), w.refreshWallet()]);
      notify(true, successText);
      return true;
    } catch (e) {
      notify(false, formatTxError(e));
      return false;
    }
  };

  const onCreate = (principal: bigint, repayment: bigint, dueDate: bigint) =>
    runTx((c) => c.requestLoan(principal, repayment, dueDate), "Loan requested.");

  const onAction = (action: LoanAction, loan: LoanData) => {
    const id = loan.id;
    switch (action) {
      case "fund":
        return runTx((c) => c.fund(id, { value: loan.principal }), `Loan #${id} funded.`);
      case "withdraw":
        return runTx((c) => c.withdrawToBorrower(id), `Loan #${id} withdrawn to your wallet.`);
      case "repay":
        return runTx((c) => c.repay(id, { value: loan.repayment }), `Loan #${id} repaid.`);
      case "default":
        return runTx((c) => c.markDefault(id), `Loan #${id} marked as defaulted.`);
      case "cancel":
        return runTx((c) => c.cancelRequest(id), `Loan #${id} cancelled.`);
      case "reclaim":
        return runTx((c) => c.reclaimFunding(id), `Loan #${id} refunded to you.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      <Navbar
        account={w.account}
        balance={w.balance}
        isSepolia={w.isSepolia}
        onConnect={w.connect}
        onSwitchNetwork={w.switchNetwork}
      />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Small loans for artisans</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Borrow and lend directly. A smart contract holds the money in escrow and enforces the terms.
            </p>
          </div>
          <button onClick={w.fetchLoans} disabled={w.loading} className={`${btn.base} ${btn.secondary} shrink-0`}>
            {w.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {w.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{w.error}</div>
        )}

        <StatsOverview loans={w.loans} />

        <div className="flex gap-6 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "borrower" && (
          <BorrowerPanel
            account={w.account}
            loans={w.loans}
            paused={w.paused}
            maxPrincipal={w.maxPrincipal}
            onCreate={onCreate}
            onAction={onAction}
          />
        )}
        {tab === "lender" && (
          <LenderPanel account={w.account} loans={w.loans} paused={w.paused} onAction={onAction} />
        )}
        {tab === "docs" && <DocsSection />}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Blockchain Technology class project. Sepolia testnet only, no real money.
      </footer>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-md px-4 py-3 text-sm text-white shadow-lg ${
            toast.ok ? "bg-slate-900" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
