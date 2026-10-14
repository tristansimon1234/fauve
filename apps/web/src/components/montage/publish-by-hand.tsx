"use client";

import { useState, useTransition } from "react";
import { setPublishByHand } from "@/app/(app)/publications/[id]/cover-actions";

// Instagram's music can't be added by another app: either Simone publishes the
// Reel as it is, or at its time she sends it on WhatsApp with its caption and the
// manager publishes it from Instagram with the music (and passage) she wants.
// The Reel is then found on her account and measured like the others.

export function PublishByHand({
  postId,
  initial,
  handedOffAt,
  downloadUrl,
  caption,
}: {
  postId: string;
  initial: boolean;
  /** When the Reel was handed over (formatted), if it was. */
  handedOffAt: string | null;
  /** The rendered video, as a download. */
  downloadUrl: string | null;
  caption: string;
}) {
  const [byHand, setByHand] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [, start] = useTransition();

  const choose = (next: boolean) => {
    if (next === byHand) return;
    setByHand(next);
    setState("saving");
    start(async () => {
      const result = await setPublishByHand(postId, next);
      if (!result.ok) setByHand(!next);
      setState(result.ok ? "idle" : "error");
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-label="Musique" className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">Musique</h2>
        <span className="text-[12px] text-muted" aria-live="polite">
          {state === "saving" ? "Enregistrement…" : state === "error" ? "Pas enregistré, réessaie" : ""}
        </span>
      </div>
      <div role="radiogroup" aria-label="Qui publie ce Reel" className="grid grid-cols-2 gap-1 rounded-[12px] bg-soft p-1">
        {[
          { on: false, label: "Simone publie", hint: "sans musique" },
          { on: true, label: "Je publie moi-même", hint: "avec ma musique" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={byHand === o.on}
            onClick={() => choose(o.on)}
            className={`flex flex-col rounded-[9px] px-2 py-2 leading-tight transition-colors ${byHand === o.on ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            <span className="text-[12px] font-bold">{o.label}</span>
            <span className="text-[11px] font-semibold opacity-70">{o.hint}</span>
          </button>
        ))}
      </div>
      {byHand ? (
        <>
          <p className="text-[12px] leading-snug text-muted">
            {handedOffAt
              ? `Envoyé ${handedOffAt}. Publie-le depuis Instagram avec ta musique : je le retrouverai tout seul sur ton compte.`
              : "À l’heure prévue, je t’envoie la vidéo et la légende sur WhatsApp. Tu l’enregistres, tu ajoutes ta musique dans Instagram (+ › Reel) et tu publies. Je retrouve ensuite le Reel sur ton compte pour suivre ses résultats."}
          </p>
          <div className="flex flex-wrap gap-2">
            {downloadUrl && (
              <a href={downloadUrl} className="btn btn-primary h-9 px-4 text-[13px]">
                Télécharger la vidéo
              </a>
            )}
            {caption && (
              <button type="button" onClick={copy} className="h-9 rounded-full bg-soft px-4 text-[13px] font-bold">
                {copied ? "Légende copiée" : "Copier la légende"}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-[12px] leading-snug text-muted">
          Instagram ne laisse pas une autre appli ajouter sa musique. Pour en mettre une, choisis « Je publie moi-même ».
        </p>
      )}
    </section>
  );
}
