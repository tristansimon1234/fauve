"use client";

import type { ReelProps, SlideElement } from "@fauve/agent";
import { Thumbnail } from "@remotion/player";
import { ElementAlone } from "@render/Elements";
import type { ReelProps as RenderReelProps } from "@render/types";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// One component of the bank drawn on its own, live (the render's own code), on a
// soft taupe backdrop so white and dark texts both read. Drawn once the card
// scrolls into view: a bank can hold dozens.

export type ElementLook = Pick<SlideElement, "js" | "texts" | "fonts" | "base" | "accent">;

export const ELEMENT_BACKDROP = "linear-gradient(135deg, #b9aea4 0%, #5d544e 100%)";

export function ElementThumb({
  element,
  brand,
  ratio = 1,
  scale,
  className = "",
  eager = false,
}: {
  element: ElementLook;
  brand: ReelProps["brand"];
  /** Width / height of the card. */
  ratio?: number;
  scale?: number;
  className?: string;
  eager?: boolean;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    const el = box.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setVisible(true), { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);
  const height = Math.round(1080 / ratio);
  return (
    <div ref={box} className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: `${ratio}`, background: ELEMENT_BACKDROP }}>
      {mounted && visible ? (
        <Thumbnail
          component={ElementAlone}
          inputProps={{ element, brand: brand as RenderReelProps["brand"], ...(scale ? { scale } : {}) }}
          compositionWidth={1080}
          compositionHeight={height}
          durationInFrames={1}
          fps={30}
          frameToDisplay={0}
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
    </div>
  );
}
