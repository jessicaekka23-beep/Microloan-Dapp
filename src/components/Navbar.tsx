"use client";

import { CONTRACT_ADDRESS } from "../lib/contract";
import { btn } from "./ui";

interface Props {
  account: string | null;
  balance: string;
  isSepolia: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function Navbar({ account, balance, isSepolia, onConnect, onSwitchNetwork }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <span className="text-base font-semibold tracking-tight text-slate-900">
          Artisan<span className="text-blue-600">Loan</span>
        </span>

        <div className="flex items-center gap-4 text-sm">
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hidden font-mono text-xs text-slate-500 underline-offset-4 hover:text-blue-700 hover:underline md:inline"
            title="View the contract on Etherscan"
          >
            Contract {short(CONTRACT_ADDRESS)}
          </a>

          {!account ? (
            <button onClick={onConnect} className={`${btn.base} ${btn.primary}`}>
              Connect wallet
            </button>
          ) : (
            <>
              {isSepolia ? (
                <span className="hidden items-center gap-2 text-slate-600 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Sepolia
                </span>
              ) : (
                <button onClick={onSwitchNetwork} className={`${btn.base} ${btn.danger}`}>
                  Switch to Sepolia
                </button>
              )}
              <span className="hidden tabular-nums text-slate-600 md:inline">{balance} ETH</span>
              <span
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-800"
                title={account}
              >
                {short(account)}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
