"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { fr } from "./fr";
import { WORK, workById, workMedia, type WorkId } from "./work";

// The site's Reels, side by side like a contact sheet (Tristan: « les reels présentés trop pub
// oriented »): Reels as accounts people follow for pleasure post them, never an offer nor a
// « réserve ta table » card. Each with what it was made from: the brief, and the raw videos sent.
// Demo businesses and creators (work.ts). Files in public/landing/reels. Each plays muted while on
// screen; a tap gives it the sound.

/** The wall's columns on a computer, by how many Reels it shows. */
const COLUMNS = ["", "md:grid-cols-1 md:max-w-[360px]", "md:grid-cols-2 md:max-w-[780px]", "md:grid-cols-3", "md:grid-cols-3 lg:grid-cols-4"];

/**
 * The landing's Reels, or only some of them, in that order (a trade's page shows those of its trade). `after`: a last
 * cell of the grid on a computer (the landing's call to start), left out of the phone's row.
 */
export function ReelWall({ only, after }: { only?: readonly WorkId[]; after?: ReactNode } = {}) {
  const work = only ? only.map(workById) : WORK;
  const columns = COLUMNS[Math.min(4, work.length)];
  const root = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [seen, setSeen] = useState<boolean[]>(work.map(() => false));
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
      className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 md:mx-0 md:grid ${columns} md:gap-6 md:gap-y-14 md:overflow-visible md:px-0 lg:gap-10 [&::-webkit-scrollbar]:hidden`}
    >
      {work.map((w, i) => (
        <article key={w.id} data-index={i} className="flex w-[76vw] max-w-[340px] shrink-0 snap-center flex-col md:w-auto md:max-w-none">
          <button
            type="button"
            onClick={() => toggle(i)}
            aria-label={sound === i ? `Couper le son du Reel « ${w.trade} »` : `Écouter le Reel « ${w.trade} »`}
            aria-pressed={sound === i}
            className="group relative block aspect-[9/16] w-full overflow-hidden bg-ink text-left border border-ink/15"
          >
            <video
              ref={(el) => {
                videos.current[i] = el;
              }}
              src={workMedia(w.id).video}
              poster={workMedia(w.id).poster}
              muted
              loop
              playsInline
              preload="none"
              className="size-full object-cover"
            />
            <span className="mono-label absolute top-3 left-3 text-white/90 drop-shadow">N° {String(i + 1).padStart(2, "0")}</span>
            <span
              className={`absolute right-3 bottom-3 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors ${sound === i ? "bg-black/45" : "bg-white/20 group-hover:bg-white/30"}`}
            >
              {sound === i ? <VolumeIcon size={14} /> : <VolumeOffIcon size={14} />}
              {sound === i ? "Son" : "Écouter"}
            </span>
          </button>
          <div className="mt-5 flex flex-col gap-3">
            <span className="mono-label text-muted">{w.trade} · {w.brand}</span>
            <p className="font-[family-name:var(--font-serif)] text-[23px] leading-[1.18] text-ink italic">{fr(`« ${w.brief} »`)}</p>
            <div className="flex items-center gap-3 border-t border-ink/10 pt-3">
              <span className="flex -space-x-2">
                {[0, 1, 2].map((k) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={k} src={`/landing/reels/raw-${w.id}-${k}.webp`} alt="" loading="lazy" className="h-[38px] w-[30px] border-2 border-soft object-cover" />
                ))}
              </span>
              <span className="text-[13px] leading-snug text-muted">
                <span className="font-semibold text-ink">{w.sent}</span>, et une phrase
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {w.made.map((m) => (
                <li key={m} className="border border-ink/20 px-2.5 py-1 text-[12px] font-medium text-ink/80">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
      {after}
    </div>
  );
}
