"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner, Contract, Provider, formatEther } from "ethers";
import {
  CONTRACT_ADDRESS,
  MICRO_LOAN_ABI,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_RPC_URL,
  LoanData,
  LoanStatus,
} from "../lib/contract";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const REFRESH_MS = 15_000;

export function useWeb3() {
  // wallet
  const [account, setAccount] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [walletProvider, setWalletProvider] = useState<BrowserProvider | null>(null);
  const [balance, setBalance] = useState("0");
  const [chainId, setChainId] = useState<number | null>(null);

  // contract data
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [paused, setPaused] = useState(false);
  const [maxPrincipal, setMaxPrincipal] = useState<bigint | null>(null); // null = unknown / no cap
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;

  const publicProvider = useMemo(
    () => new JsonRpcProvider(SEPOLIA_RPC_URL, SEPOLIA_CHAIN_ID, { staticNetwork: true }),
    []
  );

  // Read through the wallet's own node when it is on Sepolia, so the data is fresh right after
  // a transaction confirms. Otherwise (no wallet / wrong network) fall back to the public RPC.
  const reader: Provider = walletProvider && isSepolia ? walletProvider : publicProvider;

  // ───────────── Loans ─────────────

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const code = await reader.getCode(CONTRACT_ADDRESS);
        if (code === "0x") {
          setLoans([]);
          setError("No contract found at this address on Sepolia. Check NEXT_PUBLIC_CONTRACT_ADDRESS.");
          return;
        }

        const c = new Contract(CONTRACT_ADDRESS, MICRO_LOAN_ABI, reader);
        const count = Number(await c.loanCount());

        const [items, isPaused, max] = await Promise.all([
          Promise.all(Array.from({ length: count }, (_, i) => c.getLoan(i))),
          c.paused().catch(() => false), // older deployments don't have these two
          c.maxPrincipal().catch(() => null),
        ]);

        setLoans(
          items.map((l, i) => ({
            id: i,
            borrower: l[0],
            lender: l[1],
            principal: l[2],
            repayment: l[3],
            dueDate: l[4],
            status: Number(l[5]) as LoanStatus,
          }))
        );
        setPaused(Boolean(isPaused));
        setMaxPrincipal(max && max > BigInt(0) ? (max as bigint) : null);
        setError(null);
      } catch (e) {
        console.warn("Loan fetch failed:", e);
        if (!silent) setError("Could not read the contract. Check your connection and the contract address.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [reader]
  );

  // Exposed version: safe to use directly as an onClick handler
  const fetchLoans = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // ───────────── Wallet ─────────────

  const syncId = useRef(0); // ignore results of outdated overlapping syncs

  // Reads what MetaMask currently exposes (no popup)
  const syncWallet = useCallback(async () => {
    if (!window.ethereum) return;
    const id = ++syncId.current;

    const bp = new BrowserProvider(window.ethereum);
    const net = await bp.getNetwork();
    const accounts: string[] = await bp.send("eth_accounts", []);
    if (id !== syncId.current) return;

    setChainId(Number(net.chainId));

    if (accounts.length === 0) {
      setAccount(null);
      setSigner(null);
      setWalletProvider(null);
      setBalance("0");
      return;
    }

    const s = await bp.getSigner();
    const bal = await bp.getBalance(s.address);
    if (id !== syncId.current) return;

    setWalletProvider(bp);
    setSigner(s);
    setAccount(s.address);
    setBalance(Number(formatEther(bal)).toFixed(4));
  }, []);

  const connect = async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed.");
      return;
    }
    try {
      await new BrowserProvider(window.ethereum).send("eth_requestAccounts", []);
      await syncWallet();
    } catch (e) {
      console.warn("Connect cancelled:", e); // user closed the MetaMask popup
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        // Sepolia not added to this wallet yet
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addErr) {
          console.warn("Add network cancelled:", addErr);
        }
      } else {
        console.warn("Switch network cancelled:", e);
      }
    }
  };

  // Reconnect automatically on load, and follow MetaMask account / network changes
  useEffect(() => {
    const onChange = () => syncWallet().catch((e) => console.warn("Wallet sync failed:", e));
    onChange();
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", onChange);
    window.ethereum.on("chainChanged", onChange);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onChange);
      window.ethereum?.removeListener?.("chainChanged", onChange);
    };
  }, [syncWallet]);

  return {
    // wallet
    account,
    signer,
    balance,
    isSepolia,
    connect,
    switchNetwork,
    refreshWallet: syncWallet, // call after a tx so the balance updates
    // contract
    loans,
    paused,
    maxPrincipal,
    loading,
    error,
    fetchLoans,
  };
}
