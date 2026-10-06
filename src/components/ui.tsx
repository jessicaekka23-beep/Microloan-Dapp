import type { ReactNode } from "react";
import type { Tone } from "../lib/contract";

// Shared look. Cool greys + one blue accent; loan status keeps its own colours.
// Accent is blue. Change `primary` below to re-colour the buttons.
export const btn = {
  base: "inline-flex items-center justify-center rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40",
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};

export const input =
  "block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

export const panel = "rounded-xl bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-100";

const DOT: Record<Tone, string> = {
  pending: "bg-amber-500",
  active: "bg-blue-500",
  good: "bg-emerald-600",
  bad: "bg-red-600",
  muted: "bg-slate-400",
};

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
      <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{children}</div>
  );
}

export function Segmented<T extends string>(props: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {props.options.map((o) => (
        <button
          key={o.id}
          onClick={() => props.onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            props.value === o.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Small "?" badge with a hover tooltip
export function Help({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-blue-500 text-[10px] font-semibold leading-none text-blue-600"
    >
      ?
    </span>
  );
}
