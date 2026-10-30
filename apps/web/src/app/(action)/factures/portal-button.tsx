"use client";

import { useState, useTransition } from "react";
import { openPortal } from "@/app/abonnement/actions";

/** « Gérer mon abonnement » on her phone (the app's Réglages are for a computer): Stripe's portal, back to her invoices. */
export function PortalButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await openPortal("/factures");
            if (res?.error) setError(res.error);
          })
        }
        className="h-11 rounded-full bg-white/12 px-5 text-[15px] font-bold disabled:opacity-50"
      >
        {pending ? "Un instant…" : "Gérer mon abonnement"}
      </button>
      <p className="text-center text-[12.5px] text-white/55">Ta carte, ton offre, ou l’arrêter.</p>
      {error ? <p className="text-center text-[13px] font-semibold text-peach">{error}</p> : null}
    </div>
  );
}
