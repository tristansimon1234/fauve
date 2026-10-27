"use client";

import { PLAN_ORDER, PLANS, reelsPerMonth, weeklyPosts, type PlanId } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startCheckout, upgradePlan } from "@/app/abonnement/actions";
import { CheckIcon } from "./icons";

// The 3 offers, Découverte chosen by default, and the one button that opens Stripe; or, her credits
// run out (`upgradeFrom`), the offers above hers and a button that moves her subscription at once.

export function PlanChoice({ next, upgradeFrom }: { next: string; upgradeFrom?: PlanId }) {
  const router = useRouter();
  const offers = upgradeFrom ? PLAN_ORDER.filter((id) => PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(upgradeFrom)) : [...PLAN_ORDER];
  const [plan, setPlan] = useState<PlanId>(offers[0] ?? "pro");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ton offre">
        {offers.map((id) => {
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
                  {id === "decouverte" && !upgradeFrom ? <span className="ml-2 rounded-full bg-violet px-2 py-0.5 text-[10px] font-extrabold text-white">pour commencer</span> : null}
                </span>
                <span className="text-[13px] text-muted">
                  {id === "decouverte" ? weeklyPosts(id) : `${weeklyPosts(id)}, environ ${reelsPerMonth(id)} Reels par mois`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-[15px] font-extrabold tabular-nums">{PLANS[id].priceEur} €</span>
                <span className="text-[11px] text-muted">TTC / mois</span>
              </span>
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
            if (upgradeFrom) {
              const res = await upgradePlan(plan);
              if ("error" in res) setError(res.error);
              else router.push(next);
              return;
            }
            const res = await startCheckout(plan, next);
            if (res?.error) setError(res.error);
          })
        }
        className="btn btn-primary h-12 text-[15px] disabled:opacity-50"
      >
        {pending ? "Un instant…" : upgradeFrom ? `Passer à ${PLANS[plan].label}` : `Choisir ${PLANS[plan].label} : ${PLANS[plan].priceEur} € / mois`}
      </button>
      {error ? <p className="text-[13px] font-semibold text-peach-ink">{error}</p> : null}
    </div>
  );
}
