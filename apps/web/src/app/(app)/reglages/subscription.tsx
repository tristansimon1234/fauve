"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { openPortal } from "@/app/abonnement/actions";

/** « Gérer mon abonnement » (Stripe portal: offer, card, stop) or « Démarrer mon essai ». */
export function SubscriptionButton({ subscribed }: { subscribed: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!subscribed) {
    return (
      <Link href="/abonnement?next=/reglages" className="btn btn-primary h-10 self-start px-5 text-sm">
        Démarrer mon essai
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await openPortal();
            if (res?.error) setError(res.error);
          })
        }
        className="btn btn-secondary h-10 self-start px-5 text-sm disabled:opacity-50"
      >
        Gérer mon abonnement
      </button>
      {error ? <p className="text-[13px] font-semibold text-peach-ink">{error}</p> : null}
    </div>
  );
}
