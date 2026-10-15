"use client";

import { useState, useTransition } from "react";
import { setMusic, setPublishByHand } from "@/app/(app)/publications/[id]/cover-actions";

// The sound of a Reel. Simone's music (composed by ElevenLabs for this cut, in
// the video): on, another one, or none. And who publishes: Simone, or the manager
// herself from Instagram with one of its sounds (Instagram's music can't be added
// by another app): at its time she gets the video and its caption on WhatsApp,
// and the Reel is then found on her account and measured like the others.

export function PublishByHand({
  postId,
  initial,
  handedOffAt,
  downloadUrl,
  caption,
  music,
}: {
  /** Simone's music: on or off, and whether a piece was made already; undefined without a montage or without the service. */
  music?: { on: boolean; made: boolean };
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
  const [musicOn, setMusicOn] = useState(music?.on ?? true);
  const [remaking, setRemaking] = useState(false);
  const [, start] = useTransition();

  const changeMusic = (mode: "on" | "off" | "another") => {
    const before = musicOn;
    if (mode !== "another") setMusicOn(mode === "on");
    setState("saving");
    start(async () => {
      const result = await setMusic(postId, mode);
      if (!result.ok) setMusicOn(before);
      setState(result.ok ? "idle" : "error");
      setRemaking(result.ok);
    });
  };

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
          {state === "saving" ? "Enregistrement…" : state === "error" ? "Pas enregistré, réessaie" : remaking ? "La vidéo se refait (1 à 2 min)" : ""}
        </span>
      </div>
      {music && (
        <div className="flex flex-col gap-2">
          <div role="radiogroup" aria-label="Musique de Simone" className="grid grid-cols-2 gap-1 rounded-[12px] bg-soft p-1">
            {[
              { on: true, label: "Musique de Simone", hint: "composée pour ce Reel" },
              { on: false, label: "Sans musique", hint: "Reel muet" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={musicOn === o.on}
                onClick={() => musicOn !== o.on && changeMusic(o.on ? "on" : "off")}
                className={`flex flex-col rounded-[9px] px-2 py-2 leading-tight transition-colors ${musicOn === o.on ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                <span className="text-[12px] font-bold">{o.label}</span>
                <span className="text-[11px] font-semibold opacity-70">{o.hint}</span>
              </button>
            ))}
          </div>
          {musicOn && (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[12px] leading-snug text-muted">
                {music.made ? "Faite sur mesure, calée sur tes images, libre de droits." : "Elle arrive avec la prochaine version de la vidéo."}
              </span>
              {music.made && (
                <button type="button" onClick={() => changeMusic("another")} className="shrink-0 text-[12px] font-bold text-violet">
                  Une autre
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div role="radiogroup" aria-label="Qui publie ce Reel" className="grid grid-cols-2 gap-1 rounded-[12px] bg-soft p-1">
        {[
          { on: false, label: "Simone publie", hint: musicOn && music ? "avec sa musique" : "telle quelle" },
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
      {byHand ? (
        <>
          <p className="text-[12px] leading-snug text-muted">
            {handedOffAt
              ? `Envoyé ${handedOffAt}. Publie-le depuis Instagram avec ta musique : je le retrouverai tout seul sur ton compte.`
              : "À l’heure prévue, je t’envoie la vidéo et la légende sur WhatsApp. Tu l’enregistres, tu ajoutes ta musique dans Instagram (+ › Reel) et tu publies. Je retrouve ensuite le Reel sur ton compte pour suivre ses résultats."}
            {music && musicOn ? " Pour un son d’Instagram, choisis « Sans musique » plus haut." : ""}
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
          Pour un son tendance d’Instagram, choisis « Je publie moi-même » : Instagram ne laisse pas une autre appli les ajouter.
        </p>
      )}
    </section>
  );
}
