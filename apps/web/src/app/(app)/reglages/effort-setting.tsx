"use client";

import { EFFORTS, type Effort } from "@fauve/agent";
import { useState, useTransition } from "react";
import { setMontageEffort } from "./actions";

const LEVELS: Effort[] = ["rapide", "soigne", "max"];

/** The default level of care of montages: three choices, saved at once. */
export function EffortSetting({ initial }: { initial: Effort }) {
  const [effort, setEffort] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const choose = (next: Effort) => {
    if (next === effort) return;
    const before = effort;
    setEffort(next);
    setError(null);
    start(async () => {
      const res = await setMontageEffort(next).catch(() => ({ ok: false as const, error: "Réessaie dans un instant." }));
      if (!res.ok) {
        setEffort(before);
        setError(res.error);
      }
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Niveau de soin par défaut" className="grid gap-2 sm:grid-cols-3">
        {LEVELS.map((e) => {
          const on = effort === e;
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => choose(e)}
              className={`flex flex-col gap-1 rounded-[16px] border p-3 text-left transition-colors ${
                on ? "border-violet bg-violet-soft" : "border-line bg-white hover:border-violet/40"
              }`}
            >
              <span className={`text-[14px] font-bold ${on ? "text-violet" : ""}`}>{EFFORTS[e].label}</span>
              <span className="text-[12px] leading-snug text-muted">{EFFORTS[e].pitch}</span>
              <span className="text-[12px] font-semibold text-muted">{EFFORTS[e].minutes} min</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-[13px] font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
