"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "./actions";

// « Supprimer mon compte » (Réglages › Mon compte): what goes, then SUPPRIMER typed to confirm
// (it cannot be undone). The privacy policy promises it.

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-[14px] font-semibold text-danger hover:underline">
        Supprimer mon compte
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-soft p-4">
      <p className="text-[14px] leading-snug">
        Ton compte, tes conversations, tes photos et vidéos, tes publications préparées, tes statistiques, tes connexions à Instagram et TikTok et ta voix clonée seront
        supprimés pour de bon, et ton abonnement arrêté. Les publications déjà en ligne restent sur Instagram et TikTok.
      </p>
      <label className="flex flex-col gap-1.5 text-[14px]">
        Écris SUPPRIMER pour confirmer
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="h-10 rounded-[12px] border border-line bg-white px-3 text-[14px] outline-none focus:border-violet"
        />
      </label>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || typed.trim().toUpperCase() !== "SUPPRIMER"}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await deleteMyAccount(typed).catch(() => ({ ok: false as const, error: "La suppression n’a pas abouti. Réessaie dans un instant." }));
              if (res && !res.ok) setError(res.error);
            })
          }
          className="btn h-10 bg-danger px-4 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Suppression…" : "Tout supprimer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn btn-secondary h-10 px-4 text-[14px]">
          Annuler
        </button>
      </div>
    </div>
  );
}
