"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TrashIcon } from "@/components/icons";

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * « Supprimer », then a confirmation in place (no browser dialog). On success it
 * goes to `redirectTo`, or refreshes the page.
 */
export function DeleteButton({
  action,
  label = "Supprimer",
  confirmText,
  redirectTo,
  compact = false,
  onDone,
}: {
  action: () => Promise<DeleteResult>;
  label?: string;
  confirmText: string;
  redirectTo?: string;
  /** Icon only (on a card); the confirmation still shows its text. */
  compact?: boolean;
  /** Called once deleted (e.g. to close a side panel). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setError(null);
      const res = await action().catch((): DeleteResult => ({ ok: false, error: "La suppression n’a pas abouti. Réessaie." }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      onDone?.();
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        className={
          compact
            ? "flex size-9 items-center justify-center rounded-full bg-white/90 text-danger shadow-sm hover:bg-white"
            : "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-semibold text-danger hover:border-danger/40"
        }
      >
        <TrashIcon size={compact ? 16 : 18} />
        {!compact && label}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={confirmText} className="flex flex-col gap-2 rounded-[16px] border border-line bg-white p-3 text-[13px] shadow-[0_8px_24px_rgba(28,21,48,0.12)]">
      <p className="leading-snug">{confirmText}</p>
      {error && <p className="font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="h-9 rounded-full bg-danger px-4 font-bold text-white disabled:opacity-60"
        >
          {pending ? "Suppression…" : "Oui, supprimer"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="h-9 rounded-full px-3 font-semibold text-muted hover:bg-soft">
          Annuler
        </button>
      </div>
    </div>
  );
}
