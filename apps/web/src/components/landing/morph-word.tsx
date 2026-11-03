"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { faceStyle } from "./faces";

// A word that keeps changing typeface (and now and then fills with a picture), the way the Reels on the page set
// their words: the site's signature (lot 6 bis, Tristan: « des typos qui changent »). Every version sits in the same
// grid cell, so the line never jumps while it changes; only the current one shows. Still on its first version when
// the device asks for less motion, and paused off screen.

export type MorphItem = { text: string; face: string; image?: string };

export function MorphWord({ items, every = 420, className = "", label }: { items: MorphItem[]; every?: number; className?: string; label?: string }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !timer) timer = setInterval(() => setI((n) => (n + 1) % items.length), every);
      if (!e?.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [items.length, every]);
  return (
    <span ref={ref} className={`inline-grid align-baseline ${className}`} aria-label={label ?? items[0]?.text}>
      {items.map((item, k) => {
        const fill: CSSProperties = item.image
          ? { backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
          : {};
        return (
          <span key={k} aria-hidden="true" className="whitespace-nowrap" style={{ gridArea: "1 / 1", visibility: k === i ? "visible" : "hidden", ...faceStyle(item.face), ...fill }}>
            {item.text}
          </span>
        );
      })}
    </span>
  );
}
