"use client";

import { PLANS, reelsPerMonth, TRIAL_DAYS, type PlanId } from "@fauve/agent";
import { useState, useTransition } from "react";
import { startCheckout } from "@/app/abonnement/actions";
import { CheckIcon } from "./icons";

// The two offers, Pro chosen by default, and the one button that opens Stripe.

const ORDER: PlanId[] = ["pro", "essentiel"];

export function PlanChoice({ next }: { next: string }) {
  const [plan, setPlan] = useState<PlanId>("pro");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ton offre">
        {ORDER.map((id) => {
          const on = plan === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlan(id)}
              className={`flex items-center gap-3 rounded-[16px] border-[1.5px] px-4 py-3 text-left ${on ? "border-violet bg-violet-tint" : "border-line bg-white hover:border-lilac"}`}
            >
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? "border-violet bg-violet text-white" : "border-line"}`}>
                {on ? <CheckIcon size={12} /> : null}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-bold">
                  {PLANS[id].label}
                  {id === "pro" ? <span className="ml-2 rounded-full bg-violet px-2 py-0.5 text-[10px] font-extrabold text-white">conseillé</span> : null}
                </span>
                <span className="text-[13px] text-muted">
                  {PLANS[id].postsPerWeek} publications soignées par semaine, environ {reelsPerMonth(id)} Reels par mois
                </span>
              </span>
              <span className="text-[15px] font-extrabold tabular-nums">{PLANS[id].priceEur} €</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await startCheckout(plan, next);
            if (res?.error) setError(res.error);
          })
        }
        className="btn btn-primary h-12 text-[15px] disabled:opacity-50"
      >
        {pending ? "Un instant…" : `Débloquer : ${TRIAL_DAYS} jours offerts`}
      </button>
      {error ? <p className="text-[13px] font-semibold text-peach-ink">{error}</p> : null}
    </div>
  );
}
