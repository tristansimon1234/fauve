"use client";

import { useEffect, useRef, useState } from "react";
import { VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { fr } from "./fr";

// The landing's work, side by side like a contact sheet (Tristan: « les reels présentés trop pub
// oriented »): three Reels as accounts people follow for pleasure post them, never an offer nor a
// « réserve ta table » card. Each with what it was made from: the brief, and the raw videos sent.
// Demo businesses, from free stock videos (Mixkit), drawn by Edith's Reel composition; the music
// is Edith's, and two of them are told by a voice of Edith's gallery (Victoria, Jules: ElevenLabs).
// Files in public/landing. Each plays muted while on screen; a tap gives it the sound.

export const WORK = [
  {
    id: "pilates",
    trade: "Studio de Pilates Reformer",
    brief: "Fais-moi vivre un premier cours. Rien qui fasse pub.",
    sent: "7 vidéos brutes",
    made: ["POV", "Voix off (Victoria)", "Coupes sur le temps"],
  },
  {
    id: "cafe",
    trade: "Café de spécialité",
    brief: "Le premier café du matin, avec un peu d’humour.",
    sent: "6 vidéos brutes",
    made: ["Une chute", "Un plan par temps", "Boîte de texte native"],
  },
  {
    id: "cave",
    trade: "Cave à manger",
    brief: "Donne envie de passer ce soir, sans « réservez maintenant ».",
    sent: "8 vidéos brutes",
    made: ["Voix off (Jules)", "Accroche dès la 1re image", "Grain pellicule"],
  },
] as const;

export function ReelWall() {
  const root = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [seen, setSeen] = useState<boolean[]>(WORK.map(() => false));
  const [sound, setSound] = useState<number | null>(null);

  // Each Reel plays while it is on screen (on a phone, the one scrolled to), muted until tapped.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        setSeen((was) => {
          const next = [...was];
          for (const e of entries) next[Number((e.target as HTMLElement).dataset.index)] = e.intersectionRatio >= 0.6;
          return next;
        });
      },
      { threshold: [0, 0.6, 1] },
    );
    root.current?.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    videos.current.forEach((v, i) => {
      if (!v) return;
      v.muted = sound !== i;
      if (seen[i]) v.play().catch(() => {});
      else v.pause();
    });
  }, [seen, sound]);

  const toggle = (i: number) => {
    const v = videos.current[i];
    setSound((s) => (s === i ? null : i));
    // Heard from its start, as in the feed.
    if (v && sound !== i) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };

  return (
    <div
      ref={root}
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 lg:gap-10 [&::-webkit-scrollbar]:hidden"
    >
      {WORK.map((w, i) => (
        <article key={w.id} data-index={i} className="flex w-[76vw] max-w-[340px] shrink-0 snap-center flex-col md:w-auto md:max-w-none">
          <button
            type="button"
            onClick={() => toggle(i)}
            aria-label={sound === i ? `Couper le son du Reel « ${w.trade} »` : `Écouter le Reel « ${w.trade} »`}
            aria-pressed={sound === i}
            className="group relative block aspect-[9/16] w-full overflow-hidden rounded-[22px] bg-ink text-left shadow-[0_40px_80px_-40px_rgba(28,21,48,.55)]"
          >
            <video
              ref={(el) => {
                videos.current[i] = el;
              }}
              src={`/landing/work-${w.id}.mp4`}
              poster={`/landing/work-${w.id}.webp`}
              muted
              loop
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
            <span className="absolute top-3.5 left-3.5 font-[family-name:var(--font-serif)] text-[19px] leading-none text-white/90 italic drop-shadow">N°{String(i + 1).padStart(2, "0")}</span>
            <span
              className={`absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors ${sound === i ? "bg-black/45" : "bg-white/20 group-hover:bg-white/30"}`}
            >
              {sound === i ? <VolumeIcon size={14} /> : <VolumeOffIcon size={14} />}
              {sound === i ? "Son" : "Écouter"}
            </span>
          </button>
          <div className="mt-5 flex flex-col gap-3">
            <span className="text-[12px] font-bold tracking-[0.14em] text-muted uppercase">{w.trade}</span>
            <p className="font-[family-name:var(--font-serif)] text-[23px] leading-[1.18] text-ink italic">{fr(`« ${w.brief} »`)}</p>
            <div className="flex items-center gap-3 border-t border-ink/10 pt-3">
              <span className="flex -space-x-2">
                {[0, 1, 2].map((k) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={k} src={`/landing/raw-${w.id}-${k}.webp`} alt="" loading="lazy" className="h-[38px] w-[30px] rounded-[6px] border-2 border-soft object-cover" />
                ))}
              </span>
              <span className="text-[13px] leading-snug text-muted">
                <span className="font-semibold text-ink">{w.sent}</span>, et une phrase
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {w.made.map((m) => (
                <li key={m} className="rounded-full border border-ink/10 px-2.5 py-1 text-[12px] font-semibold text-ink/75">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
