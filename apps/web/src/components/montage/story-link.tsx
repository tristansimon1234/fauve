"use client";

import { useState, useTransition } from "react";
import { setPublishByHand } from "@/app/(app)/publications/[id]/cover-actions";

// Who publishes a story. Simone, without a link (Instagram's API takes no sticker
// on a story), or the manager herself with the link sticker: at its time she gets
// the story and her booking link on WhatsApp, shares it to her story from there
// (Partager › Instagram › Story), adds the sticker and pastes the link. Meant for
// the stories that should bring bookings: free spots, something new, an offer.

export function StoryLink({ postId, initial, handedOffAt, bookingUrl }: { postId: string; initial: boolean; handedOffAt: string | null; bookingUrl: string | null }) {
  const [byHand, setByHand] = useState(initial);
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

  return (
    <section aria-label="Lien de la story" className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">Lien</h2>
        <span className="text-[12px] text-muted" aria-live="polite">
          {state === "saving" ? "Enregistrement…" : state === "error" ? "Pas enregistré, réessaie" : ""}
        </span>
      </div>
      <div role="radiogroup" aria-label="Qui publie cette story" className="grid grid-cols-2 gap-1 rounded-[12px] bg-soft p-1">
        {[
          { on: false, label: "Simone publie", hint: "sans lien" },
          { on: true, label: "Avec un lien", hint: "tu la partages depuis WhatsApp" },
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
      <p className="text-[12px] leading-snug text-muted">
        {byHand
          ? handedOffAt
            ? `Envoyée ${handedOffAt} sur WhatsApp. Partage-la en story avec le sticker Lien : je la retrouverai toute seule sur ton compte.`
            : `À l’heure prévue, je t’envoie la story et ${bookingUrl ? "ton lien de réservation" : "un rappel du lien"} sur WhatsApp. Tu appuies sur Partager › Instagram › Story, tu ajoutes le sticker Lien et tu colles le lien : quelques secondes.`
          : "Instagram ne laisse aucune appli poser un sticker lien. Pour une story qui doit faire réserver (places libres, nouveauté, offre), choisis « Avec un lien »."}
      </p>
      {byHand && !bookingUrl && <p className="text-[12px] font-semibold text-coral-ink">Je ne connais pas encore ton lien de réservation : donne-le à Simone pour qu’il arrive avec la story.</p>}
    </section>
  );
}
