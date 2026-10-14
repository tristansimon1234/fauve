"use client";

import { MUSIC_LABELS, MUSIC_STYLES, type MusicSpec, type MusicStyle } from "@fauve/agent";
import { useState, useTransition } from "react";
import { setPublishByHand, setSoundtrack } from "@/app/(app)/publications/[id]/cover-actions";

// The sound of a Reel. Simone's own soundtrack (synthesized for this cut, the
// cuts on its beat, sound effects on cuts and texts): a style or none, played in
// the preview and put in the video. And who publishes: Simone, or the manager
// herself from Instagram with one of its sounds (Instagram's music can't be added
// by another app): at its time she gets the video and its caption on WhatsApp,
// and the Reel is then found on her account and measured like the others.

type Choice = MusicStyle | "off";

export function PublishByHand({
  postId,
  initial,
  handedOffAt,
  downloadUrl,
  caption,
  music,
}: {
  postId: string;
  initial: boolean;
  /** When the Reel was handed over (formatted), if it was. */
  handedOffAt: string | null;
  /** The rendered video, as a download. */
  downloadUrl: string | null;
  caption: string;
  /** The montage's soundtrack; undefined when there is no montage yet. */
  music?: MusicSpec | null;
}) {
  const [byHand, setByHand] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "remaking" | "error">("idle");
  const [choice, setChoice] = useState<Choice>(!music || music.muted ? "off" : music.style);
  const [sfx, setSfx] = useState(music?.sfx ?? true);
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

  const sound = (next: Choice, effects: boolean) => {
    const before = { choice, sfx };
    setChoice(next);
    setSfx(effects);
    setState("saving");
    start(async () => {
      const result = await setSoundtrack(postId, { style: next, sfx: effects });
      if (!result.ok) {
        setChoice(before.choice);
        setSfx(before.sfx);
      }
      setState(result.ok ? "remaking" : "error");
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
          {state === "saving" ? "Enregistrement…" : state === "remaking" ? "La vidéo se refait (1 min)" : state === "error" ? "Pas enregistré, réessaie" : ""}
        </span>
      </div>

      {music !== undefined && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-muted">La bande-son de Simone, faite pour ce montage</span>
          <div role="radiogroup" aria-label="Bande-son" className="grid grid-cols-4 gap-1 rounded-[12px] bg-soft p-1">
            {(["off", ...MUSIC_STYLES] as Choice[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={choice === c}
                onClick={() => choice !== c && sound(c, sfx)}
                className={`rounded-[9px] px-1 py-2 text-[12px] font-bold transition-colors ${choice === c ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {c === "off" ? "Aucune" : MUSIC_LABELS[c]}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 px-1">
            <span className="text-[12px] font-semibold text-muted">Effets sonores (whoosh aux coupes, pop sur les textes)</span>
            <input type="checkbox" checked={sfx} onChange={(e) => sound(choice, e.target.checked)} className="size-4 accent-violet" />
          </label>
          <p className="text-[12px] leading-snug text-muted">Les coupes tombent sur le rythme. Écoute-la dans l’aperçu ; libre de droits, rien à faire de ton côté.</p>
        </div>
      )}

      <span className="text-[12px] font-semibold text-muted">Qui publie</span>
      <div role="radiogroup" aria-label="Qui publie ce Reel" className="grid grid-cols-2 gap-1 rounded-[12px] bg-soft p-1">
        {[
          { on: false, label: "Simone publie", hint: "avec la bande-son ci-dessus" },
          { on: true, label: "Je publie moi-même", hint: "avec un son d’Instagram" },
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
      {byHand && (
        <>
          <p className="text-[12px] leading-snug text-muted">
            {handedOffAt
              ? `Envoyé ${handedOffAt}. Publie-le depuis Instagram avec ton son : je le retrouverai tout seul sur ton compte.`
              : "À l’heure prévue, je t’envoie la vidéo et la légende sur WhatsApp. Tu l’enregistres, tu choisis un son dans Instagram (+ › Reel) et tu publies. Je retrouve ensuite le Reel sur ton compte pour suivre ses résultats."}
            {choice !== "off" ? " Astuce : choisis « Aucune » plus haut si tu mets un son d’Instagram." : ""}
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
      )}
    </section>
  );
}
