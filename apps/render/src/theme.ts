import type { MotionTemplate, ReelSignature } from "./types";

// One visual system, four temperaments (collage draws its own texts, Collage.tsx). Sizes are for a 1080-wide frame.
// Modern and native-looking: texts are big and few, set where a creator would put them in
// the Instagram or TikTok app (the hook in the upper third, a statement in the apps' white
// box, a line lower down), every shot gets the same light grade, and the camera keeps moving
// a little. A clean bold sentence with its key word in the brand colour; bold capitals with
// the key word on a straight block only for the fast ambiance; never italic, never tilted,
// never a chip per word (they read as a flyer).
export type Theme = {
  hook: {
    family: "display" | "body";
    weight: number;
    italic: boolean;
    size: number;
    uppercase: boolean;
    letterSpacing: number;
    lineHeight: number;
    stagger: number; // frames between words
    enter: "rise" | "pop" | "fade";
    /**
     * How a stressed word stands out: on a box in the brand colour, in italic, in the brand
     * colour, in the display font's italic (a serif accent in a sans hook: one or two words,
     * never the whole line), or circled by a stroke drawn by hand (« marker »).
     */
    stress: "box" | "italic" | "color" | "serif" | "marker";
    /** Where its lines align (a business whose site sets its titles flush left). */
    align?: "center" | "left";
  };
  /** The statement (« band »): words on a box hugging each line, like the text tool of the apps, or an outlined frame. */
  band: { family: "display" | "body"; weight: number; size: number; uppercase: boolean; letterSpacing: number; radius: number; box: "white" | "accent" | "dark" | "light" | "outline"; tilt: number };
  /** box: on a dark box (the apps' native text style); else bare with a soft shadow. */
  caption: { weight: number; size: number; box?: boolean };
  /** The word being said: on a pill in the brand colour, in the brand colour, in the display font's italic, or underlined by hand. */
  subtitle: { weight: number; size: number; uppercase: boolean; highlight: "color" | "pill" | "serif" | "marker" };
  /** Slow push-in / pull-out amplitude (scale at the end of the shot). */
  zoomTo: number;
  /** A tighter crop held on a shot (jump cut on the beat). */
  punch: number;
  spring: { damping: number; stiffness: number; mass: number };
  exitFrames: number;
  /** One light grade on every shot, so footage filmed at different moments looks like one film. */
  grade: string;
  /** Darker corners (0–1): depth, and texts read better. */
  vignette: number;
};

/** Where each text sits by default (top edge of its box, share of the height). Mirror of TEXT_ROWS in packages/agent/src/retouch.ts. */
export const TEXT_Y = { hook: 0.2, band: 0.47, caption: 0.62 } as const;

export const THEMES: Record<MotionTemplate, Theme> = {
  doux: {
    hook: { family: "body", weight: 700, italic: false, size: 100, uppercase: false, letterSpacing: -1.5, lineHeight: 1.06, stagger: 1, enter: "rise", stress: "color" },
    band: { family: "body", weight: 700, size: 62, uppercase: false, letterSpacing: -0.5, radius: 14, box: "white", tilt: 0 },
    caption: { weight: 700, size: 60 },
    subtitle: { weight: 800, size: 66, uppercase: false, highlight: "pill" },
    zoomTo: 1.07,
    punch: 1.12,
    spring: { damping: 200, stiffness: 220, mass: 0.7 },
    exitFrames: 5,
    grade: "brightness(1.03) contrast(1.04) saturate(1.04) sepia(0.06)",
    vignette: 0.1,
  },
  dynamique: {
    hook: { family: "display", weight: 900, italic: false, size: 112, uppercase: true, letterSpacing: -1, lineHeight: 0.98, stagger: 1, enter: "pop", stress: "box" },
    band: { family: "body", weight: 700, size: 64, uppercase: false, letterSpacing: -0.5, radius: 14, box: "white", tilt: 0 },
    caption: { weight: 800, size: 60 },
    subtitle: { weight: 800, size: 70, uppercase: false, highlight: "pill" },
    zoomTo: 1.09,
    punch: 1.15,
    spring: { damping: 14, stiffness: 210, mass: 0.6 },
    exitFrames: 4,
    grade: "contrast(1.1) saturate(1.1) brightness(1.01) sepia(0.04)",
    vignette: 0.14,
  },
  chic: {
    hook: { family: "body", weight: 600, italic: false, size: 94, uppercase: false, letterSpacing: -1.5, lineHeight: 1.06, stagger: 2, enter: "rise", stress: "color" },
    band: { family: "body", weight: 500, size: 48, uppercase: true, letterSpacing: 6, radius: 0, box: "outline", tilt: 0 },
    caption: { weight: 600, size: 56 },
    subtitle: { weight: 700, size: 62, uppercase: false, highlight: "pill" },
    zoomTo: 1.05,
    punch: 1.1,
    spring: { damping: 200, stiffness: 160, mass: 0.9 },
    exitFrames: 6,
    grade: "contrast(1.06) saturate(0.92) brightness(1.02)",
    vignette: 0.14,
  },
  collage: {
    hook: { family: "display", weight: 800, italic: false, size: 92, uppercase: true, letterSpacing: -0.5, lineHeight: 1.05, stagger: 3, enter: "pop", stress: "box" },
    band: { family: "body", weight: 700, size: 44, uppercase: true, letterSpacing: 1, radius: 0, box: "accent", tilt: -2.5 },
    caption: { weight: 600, size: 40 },
    subtitle: { weight: 800, size: 62, uppercase: false, highlight: "pill" },
    zoomTo: 1.05,
    punch: 1.12,
    spring: { damping: 12, stiffness: 210, mass: 0.6 },
    exitFrames: 6,
    grade: "saturate(1.05) sepia(0.05) contrast(1.02)",
    vignette: 0,
  },
};

/**
 * The light of a business's pictures, on every shot instead of the ambiance's: sober CSS
 * grades, never a filter you notice (natural keeps the ambiance's own).
 */
const GRADES: Record<ReelSignature["grade"], string | null> = {
  natural: null,
  warm: "brightness(1.03) contrast(1.04) saturate(1.06) sepia(0.12)",
  bright: "brightness(1.07) contrast(1.02) saturate(1.03)",
  flash: "contrast(1.13) saturate(1.1) brightness(1.03)",
  film: "contrast(0.96) saturate(0.86) sepia(0.14) brightness(1.03)",
  moody: "contrast(1.12) brightness(0.94) saturate(0.95)",
  cool: "contrast(1.05) saturate(0.94) brightness(1.02) hue-rotate(-6deg)",
};

/**
 * The ambiance's theme set the business's way: its titles (font, case, weight, alignment,
 * spacing), how its key words stand out, the box under a statement and the light of its
 * pictures. The ambiance keeps its sizes, rhythm, springs and entrances.
 */
export function themeFor(template: MotionTemplate, signature: ReelSignature | undefined): Theme {
  const base = THEMES[template];
  if (!signature) return base;
  const t = signature.titles;
  const upper = t.case === "upper";
  const tracking = (size: number) => (t.tracking === "wide" ? size * (upper ? 0.06 : 0.03) : t.tracking === "tight" ? -size * 0.025 : 0);
  return {
    ...base,
    hook: {
      ...base.hook,
      family: t.font,
      weight: t.weight === "black" ? 900 : t.weight === "bold" ? 700 : 500,
      uppercase: upper,
      letterSpacing: tracking(base.hook.size),
      // Capitals set tight read as one block; spaced ones need air between the lines.
      lineHeight: upper ? Math.min(base.hook.lineHeight, 1.0) : Math.max(base.hook.lineHeight, 1.04),
      stress: signature.stress === "block" ? "box" : signature.stress,
      align: t.align,
    },
    band: {
      ...base.band,
      box: signature.band,
      uppercase: upper && signature.band !== "white",
      letterSpacing: upper ? tracking(base.band.size) : base.band.letterSpacing,
      radius: signature.band === "outline" ? 0 : base.band.radius,
      tilt: 0,
    },
    // Subtitles in its case, the word said standing out its way (a block is the pill); capitals read larger, so a touch smaller.
    subtitle: {
      ...base.subtitle,
      size: upper ? Math.round(base.subtitle.size * 0.9) : base.subtitle.size,
      uppercase: upper,
      highlight: signature.stress === "block" ? "pill" : signature.stress,
    },
    grade: GRADES[signature.grade] ?? base.grade,
  };
}
