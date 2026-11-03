"use client";

import { useEffect, useRef, useState } from "react";
import { faceStyle } from "./faces";
import { fr } from "./fr";

// What Edith knows how to do, shown as it is done: a list of techniques, each name set in the face of its Reel, and
// beside it the Reel that uses it, held in place while the list scrolls by (on a phone, each Reel under its name).
// The one in the middle of the screen is the one playing.

export type Technique = { name: string; face: string; line: string; video: string; poster: string; trade: string };

function Clip({ t, on, className = "" }: { t: Technique; on: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (on && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.play().catch(() => {});
    else v.pause();
  }, [on]);
  return (
    <div className={`relative aspect-[9/16] overflow-hidden border border-ink bg-ink ${className}`}>
      <video ref={video} src={t.video} poster={t.poster} muted loop playsInline preload="none" aria-label={t.trade} className="absolute inset-0 size-full object-cover" />
      <span className="mono-label absolute bottom-2.5 left-2.5 bg-ink/70 px-1.5 py-0.5 text-white">{t.trade}</span>
    </div>
  );
}

export function Techniques({ items }: { items: Technique[] }) {
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const r of rows.current) if (r) io.observe(r);
    return () => io.disconnect();
  }, []);
  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
      <ol className="flex flex-col border-t border-ink">
        {items.map((t, i) => (
          <li
            key={t.name}
            ref={(el) => {
              rows.current[i] = el;
            }}
            data-index={i}
            className="grid grid-cols-[44px_1fr] items-baseline gap-x-3 border-b border-ink/20 py-6 lg:py-9"
          >
            <span className="font-mono text-[12px] text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex min-w-0 flex-col gap-2">
              <span className="text-[clamp(34px,4.6vw,68px)] leading-[0.95] transition-opacity duration-300" style={{ opacity: active === i ? 1 : 0.28 }}>
                <span style={faceStyle(t.face)}>{fr(t.name)}</span>
              </span>
              <span className="max-w-[460px] text-[16px] leading-relaxed text-muted">{fr(t.line)}</span>
              <Clip t={t} on={active === i} className="mt-3 w-[62%] max-w-[280px] lg:hidden" />
            </span>
          </li>
        ))}
      </ol>
      <div className="hidden lg:block">
        <div className="sticky top-[12vh] mx-auto w-full max-w-[380px]">
          <div className="relative">
            {items.map((t, i) => (
              <div key={t.name} className="transition-opacity duration-300" style={{ position: i ? "absolute" : "relative", inset: 0, opacity: active === i ? 1 : 0, pointerEvents: active === i ? "auto" : "none" }}>
                <Clip t={t} on={active === i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
