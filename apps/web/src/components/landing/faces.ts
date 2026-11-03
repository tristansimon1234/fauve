import type { CSSProperties } from "react";

// The faces of the Reels on the landing (their families are loaded by app/landing-fonts.ts behind CSS variables):
// what the kinetic words and the scroll sentence switch between.

/** A face of the Reels as CSS: its family (the page's serif for Instrument), and how it is set. */
export type Face = { family: string; weight?: number; italic?: boolean; upper?: boolean; tracking?: string; scale?: number };

export const FACES: Record<string, Face> = {
  anton: { family: "var(--lf-anton)", upper: true, tracking: "-0.01em", scale: 1.05 },
  serif: { family: "var(--font-instrument)", italic: true, tracking: "-0.03em", scale: 1.12 },
  pixel: { family: "var(--lf-pixel)", weight: 600, tracking: "-0.02em", scale: 0.92 },
  marker: { family: "var(--lf-marker)", tracking: "-0.01em", scale: 0.92 },
  bodoni: { family: "var(--lf-bodoni)", weight: 700, italic: true, tracking: "-0.04em", scale: 1 },
  unbounded: { family: "var(--lf-unbounded)", weight: 800, tracking: "-0.05em", scale: 0.82 },
  dela: { family: "var(--lf-dela)", tracking: "-0.03em", scale: 0.85 },
  fraunces: { family: "var(--lf-fraunces)", weight: 300, italic: true, tracking: "-0.03em", scale: 1.05 },
  mono: { family: "var(--lf-spacemono)", tracking: "-0.06em", scale: 0.86 },
  caveat: { family: "var(--lf-caveat)", weight: 600, scale: 1.18 },
  archivo: { family: "var(--lf-archivo)", upper: true, tracking: "-0.04em", scale: 0.86 },
  syne: { family: "var(--lf-syne)", weight: 800, tracking: "-0.04em", scale: 0.95 },
  bricolage: { family: "var(--lf-bricolage)", weight: 800, tracking: "-0.05em", scale: 1 },
  grotesk: { family: "var(--font-grotesk)", weight: 600, tracking: "-0.06em", scale: 1 },
};

/** A face as inline style, at a base size in em (each face's scale evens their visual size). */
export function faceStyle(key: string): CSSProperties {
  const f = FACES[key] ?? FACES.grotesk!;
  return {
    fontFamily: f.family,
    fontWeight: f.weight ?? 400,
    fontStyle: f.italic ? "italic" : "normal",
    textTransform: f.upper ? "uppercase" : "none",
    letterSpacing: f.tracking ?? "normal",
    fontSize: `${f.scale ?? 1}em`,
  };
}
