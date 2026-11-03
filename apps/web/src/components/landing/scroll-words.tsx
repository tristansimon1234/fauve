"use client";

import { useEffect, useRef, useState } from "react";
import { faceStyle } from "./faces";

// A sentence that writes itself as the page scrolls, word after word, each group in another face of the Reels, with
// small moving pictures slipped between the words (lot 6 bis: « beaucoup d'images, des typos qui changent »). Words
// not reached yet wait, faint; all of it is there at once without JavaScript or when the device asks for less motion.

export type Token = { text: string; face?: string } | { video: string; poster: string; alt: string };

export function ScrollWords({ tokens, className = "" }: { tokens: Token[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [shown, setShown] = useState(tokens.length);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // From when its top reaches 85 % of the screen to when its bottom reaches 55 %.
      const p = (vh * 0.85 - r.top) / Math.max(1, r.height + vh * 0.3);
      setShown(Math.max(0, Math.min(tokens.length, Math.round(p * tokens.length))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tokens.length]);
  return (
    <p ref={ref} className={className}>
      {tokens.map((t, i) => {
        const on = i < shown;
        if ("video" in t) {
          return (
            <span
              key={i}
              className="mx-[0.12em] inline-block h-[0.82em] w-[0.6em] translate-y-[0.1em] overflow-hidden align-baseline transition-[opacity,transform] duration-500 ease-[var(--ease-fauve)]"
              style={{ opacity: on ? 1 : 0.1, transform: on ? "translateY(0.1em) scale(1)" : "translateY(0.1em) scale(0.6)" }}
            >
              <video src={t.video} poster={t.poster} muted loop playsInline autoPlay preload="none" aria-label={t.alt} className="size-full object-cover" />
            </span>
          );
        }
        return (
          <span key={i} className="transition-opacity duration-500" style={{ opacity: on ? 1 : 0.12, ...(t.face ? faceStyle(t.face) : {}) }}>
            {t.text}{" "}
          </span>
        );
      })}
    </p>
  );
}
