"use client";

import { useEffect, useRef, useState } from "react";
import { fr } from "./fr";

// The carousels on the site: each one swipes by itself while on screen, slide after slide, as someone would in the
// feed; a tap moves it on. Still on its cover when the device asks for less motion.

export type Deck = { key: string; trade: string; title: string; slides: string[] };

function DeckView({ deck, delay }: { deck: Deck; delay: number }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let start: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !timer && !start) {
        start = setTimeout(() => {
          start = null;
          timer = setInterval(() => setI((n) => (n + 1) % deck.slides.length), 1700);
        }, delay);
      }
      if (!e?.isIntersecting) {
        if (start) clearTimeout(start);
        if (timer) clearInterval(timer);
        start = null;
        timer = null;
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      if (start) clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [deck.slides.length, delay]);
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div ref={ref} className="relative aspect-[4/5] overflow-hidden border border-ink bg-soft">
        <button type="button" onClick={() => setI((n) => (n + 1) % deck.slides.length)} aria-label={`${deck.title}, image suivante`} className="absolute inset-0 block size-full cursor-pointer">
          <div className="flex h-full transition-transform duration-500 ease-[var(--ease-fauve)]" style={{ width: `${deck.slides.length * 100}%`, transform: `translateX(-${(i * 100) / deck.slides.length}%)` }}>
            {deck.slides.map((src, k) => (
              // eslint-disable-next-line @next/next/no-img-element -- small static slides, sized by their frame
              <img key={src} src={src} alt={k === 0 ? deck.title : ""} loading="lazy" className="h-full object-cover" style={{ width: `${100 / deck.slides.length}%` }} />
            ))}
          </div>
        </button>
        <span className="mono-label pointer-events-none absolute top-2.5 right-2.5 bg-ink/70 px-1.5 py-0.5 text-white tabular-nums">
          {i + 1}/{deck.slides.length}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {deck.slides.map((_, k) => (
          <span key={k} className={`h-[2px] flex-1 transition-colors duration-300 ${k === i ? "bg-ink" : "bg-ink/15"}`} />
        ))}
      </div>
      <figcaption className="flex flex-col gap-0.5">
        <span className="mono-label">{deck.trade}</span>
        <span className="text-[15px] text-muted">{fr(deck.title)}</span>
      </figcaption>
    </figure>
  );
}

export function CarouselDecks({ decks }: { decks: Deck[] }) {
  return (
    <div className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {decks.map((d, k) => (
        <DeckView key={d.key} deck={d} delay={k * 550} />
      ))}
    </div>
  );
}
