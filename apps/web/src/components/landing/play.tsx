"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// A scene of the landing that plays when it comes on screen (see landing.css): the server
// sends its final picture (« idle », also kept when the device asks for less motion); in the
// browser it waits on its first picture below the screen (« ready »), plays once on screen
// (« on »), and a looping scene pauses when it leaves the screen (« off »).

export type PlayState = "idle" | "ready" | "on" | "off";

export function Play({
  children,
  className,
  style,
  loop = false,
  threshold = 0.35,
  onState,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** A looping scene: paused off screen, resumed on screen. */
  loop?: boolean;
  threshold?: number;
  onState?: (state: PlayState) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PlayState>("idle");
  const told = useRef(onState);
  useEffect(() => {
    told.current = onState;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const set = (next: PlayState) => {
      setState(next);
      told.current?.(next);
    };
    // Not (enough) on screen yet: its first picture, ready to play. Already in view: it plays from there.
    const waiting = setTimeout(() => {
      if (shownShare(el) < threshold) set("ready");
    }, 0);
    let played = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          played = true;
          set("on");
          if (!loop) io.disconnect();
        } else if (loop && played) {
          set("off");
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      clearTimeout(waiting);
      io.disconnect();
    };
  }, [loop, threshold]);

  return (
    <div ref={ref} data-play={state} className={className} style={style}>
      {children}
    </div>
  );
}

/** How much of an element is on screen, from 0 to 1. */
export function shownShare(el: Element) {
  const box = el.getBoundingClientRect();
  const seen = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
  return box.height > 0 ? Math.max(0, seen) / box.height : 0;
}
