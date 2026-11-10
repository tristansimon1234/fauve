"use client";

import { IDEA_DOORS } from "@fauve/agent";
import { useEffect, useRef } from "react";
import type { IdeaCard } from "@/lib/house-ideas";

// « Ton idée » for a Reel on the Créer screen (Tristan, 10 November): three ways to make it. « Fais-moi confiance »
// (Edith chooses, the default), « Je sais ce que je veux » (her words, or a Reel she likes), « Regarde nos idées »
// (6 to 8 ideas of form for her trade and her files, each a looping preview, by its plain name).

export type Door = "trust" | "know" | "ideas";

const DOORS: { door: Door; title: string; hint: string }[] = [
  { door: "trust", title: IDEA_DOORS.trust, hint: "Je choisis la forme qui va le mieux à tes fichiers." },
  { door: "know", title: IDEA_DOORS.know, hint: "Ton idée en quelques mots, ou un Reel que tu aimes." },
  { door: "ideas", title: IDEA_DOORS.ideas, hint: "Quelques idées de forme pour tes fichiers, avec tes images et ta charte." },
];

export function IdeaDoors({ value, ideas, onPick }: { value: Door; ideas: boolean; onPick: (door: Door) => void }) {
  return (
    <div role="radiogroup" aria-label="Comment tu veux ce Reel" className="flex flex-col gap-2">
      {DOORS.filter((d) => d.door !== "ideas" || ideas).map((d) => {
        const on = value === d.door;
        return (
          <button
            key={d.door}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(d.door)}
            className={`fauve-press flex items-center gap-3 border-[1.5px] px-3.5 py-3 text-left transition-colors ${on ? "border-violet bg-violet-tint" : "border-line bg-white hover:border-violet/40"}`}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-extrabold">{d.title}</span>
              <span className="text-[13.5px] text-muted">{d.hint}</span>
            </span>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-violet" : "border-ink"}`}>
              {on && <span className="size-3 rounded-full bg-violet" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The ideas as a grid of their loops (played only while in view); a tap picks one. */
export function IdeaGrid({ cards, chosen, busy, onPick }: { cards: IdeaCard[]; chosen: string | null; busy: string | null; onPick: (card: IdeaCard) => void }) {
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = grid.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const video = e.target as HTMLVideoElement;
          if (e.isIntersecting) void video.play().catch(() => {});
          else video.pause();
        }
      },
      { threshold: 0.4 },
    );
    root.querySelectorAll("video").forEach((v) => seen.observe(v));
    return () => seen.disconnect();
  }, [cards]);
  return (
    <div ref={grid} role="radiogroup" aria-label={IDEA_DOORS.ideas} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {cards.map((card) => {
        const on = chosen === card.key;
        return (
          <button
            key={card.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(card)}
            className={`fauve-press flex flex-col gap-1.5 p-1 text-left ${on ? "bg-violet-tint ring-2 ring-violet" : "hover:bg-soft"}`}
          >
            <span className="relative block aspect-[9/16] w-full overflow-hidden bg-ink">
              <video src={card.video} poster={card.poster} muted loop playsInline preload="none" className="absolute inset-0 size-full object-cover" />
              {busy === card.key && <span className="absolute inset-0 bg-black/35" aria-hidden />}
            </span>
            <span className="px-1 pb-1 text-[13px] leading-tight font-bold">{card.name}</span>
          </button>
        );
      })}
    </div>
  );
}
