"use client";

import { CREDIT_PACK } from "@fauve/agent";
import { useState, useTransition } from "react";
import { buyCredits } from "@/app/abonnement/actions";

// « 1 Reel de plus »: a credit pack paid once (Stripe Checkout), her credits there on her return.

export function PackButton({ next, primary = false, className = "" }: { next: string; primary?: boolean; className?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await buyCredits(next);
            if (res?.error) setError(res.error);
          })
        }
        className={`btn ${primary ? "btn-primary" : "btn-secondary"} h-12 text-[15px] disabled:opacity-50`}
      >
        {pending ? "Un instant…" : `${CREDIT_PACK.label} : ${CREDIT_PACK.credits} crédits pour ${CREDIT_PACK.priceEur} €`}
      </button>
      {error ? <p className="text-[13px] font-semibold text-peach-ink">{error}</p> : null}
    </div>
  );
}
