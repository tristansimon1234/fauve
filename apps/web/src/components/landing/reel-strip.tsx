"use client";

import { useEffect, useRef, useState } from "react";
import { fr } from "./fr";

// The site's moving pictures (lot 6, Tristan: « le site devra être ultra visuel »): Reels side by side
// like a contact sheet, each one playing muted while it is on screen and resting on its poster
// otherwise (and when the device asks for less motion). Square frames, a hairline, a caption in mono
// capitals under each: the colour comes from the videos, the page stays paper and ink.

export type StripReel = { key: string; src: string; poster: string; label: string; note?: string };

/** Plays a video while at least half of it is on screen; still on its poster under reduced motion. */
function useOnScreen<T extends HTMLElement>(threshold = 0.5) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setOn(Boolean(e?.isIntersecting) && (e?.intersectionRatio ?? 0) >= threshold), { threshold: [0, threshold, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on] as const;
}

function Tile({ reel, index, size }: { reel: StripReel; index: number; size: "hero" | "wall" }) {
  const [ref, on] = useOnScreen<HTMLElement>();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (on) v.play().catch(() => {});
    else v.pause();
  }, [on]);
  return (
    <figure ref={ref} className={`flex shrink-0 flex-col gap-2.5 ${size === "hero" ? "w-[58vw] snap-start sm:w-[260px] lg:w-auto" : "min-w-0"}`}>
      <div className="relative aspect-[9/16] overflow-hidden border border-ink/15 bg-ink">
        <video
          ref={video}
          src={reel.src}
          poster={reel.poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label={reel.label}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <figcaption className="flex flex-col gap-0.5">
        <span className="flex items-baseline gap-2 font-mono text-[11px] font-medium tracking-[0.08em] uppercase">
          <span className="text-muted tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="truncate">{fr(reel.label)}</span>
        </span>
        {reel.note && <span className="text-[13px] leading-snug text-muted">{fr(reel.note)}</span>}
      </figcaption>
    </figure>
  );
}

/** A row of Reels across the whole width: scrolled sideways on a phone, all in view on a computer. */
export function ReelStrip({ reels }: { reels: StripReel[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:scroll-px-8 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-flow-col lg:auto-cols-fr lg:overflow-visible lg:px-0">
      {reels.map((r, i) => (
        <Tile key={r.key} reel={r} index={i} size="hero" />
      ))}
    </div>
  );
}

/** Edith's models in a grid: the first ones, then all of them on a tap. */
export function ModelWall({ reels, first = 12 }: { reels: StripReel[]; first?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? reels : reels.slice(0, first);
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shown.map((r, i) => (
          <Tile key={r.key} reel={r} index={i} size="wall" />
        ))}
      </div>
      {!all && reels.length > first && (
        <button type="button" onClick={() => setAll(true)} className="btn btn-secondary self-center">
          Voir les {reels.length} modèles
        </button>
      )}
    </div>
  );
}
