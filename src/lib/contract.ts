import { BrowserProvider, Contract, type JsonRpcSigner } from "ethers";
import artifact from "./MicroLoan.json";

// Set in frontend/.env.local (see .env.example). Must be the Sepolia MicroLoan contract.
export const MICRO_LOAN_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x3d43510D4e1E5408d463Ff8E57e4EABA1657f934";
export const MICRO_LOAN_ABI = artifact.abi;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export async function getSepoliaSigner(): Promise<JsonRpcSigner> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask was not found. Install or enable the MetaMask extension.");
  }

  const provider = new BrowserProvider(window.ethereum as never);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error("Switch MetaMask to the Sepolia network, then try again.");
  }

  return provider.getSigner();
}

export function getMicroLoan(signer: JsonRpcSigner): Contract {
  if (!MICRO_LOAN_ADDRESS) {
    throw new Error("Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env.local.");
  }

  return new Contract(MICRO_LOAN_ADDRESS, MICRO_LOAN_ABI, signer);
}
