import type { MotionTemplate, ReelSignature } from "./types";

// One visual system. A Reel has no ambiance any more (« libre »): one native look set the
// business's way (its signature), its motion from its own tempo. The four temperaments below
// are the Reels made before (collage draws its own texts, Collage.tsx). Sizes are for a 1080-wide frame.
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

/** The tempo of a « libre » Reel that has none (mirror of TEMPLATE_BPM.libre in packages/agent/src/tempo.ts). */
export const LIBRE_TEMPO = 100;

/**
 * A lively entrance that lands without bouncing: at damping 14 (12 for the collage) each word of a
 * lively hook overshot and wobbled, one frame after the other, and the line looked like it shook
 * (Tristan: « des textes qui vibrent »). Close to critical, it stays quick and settles at once.
 */
const LANDS = { damping: 20, stiffness: 260, mass: 0.6 };

export const THEMES: Record<MotionTemplate, Theme> = {
  doux: {
    hook: { family: "body", weight: 700, italic: false, size: 100, uppercase: false, letterSpacing: -1.5, lineHeight: 1.06, stagger: 1, enter: "rise", stress: "color" },
    band: { family: "body", weight: 700, size: 62, uppercase: false, letterSpacing: -0.5, radius: 14, box: "white", tilt: 0 },
    caption: { weight: 700, size: 60 },
    subtitle: { weight: 800, size: 54, uppercase: false, highlight: "pill" },
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
    subtitle: { weight: 800, size: 56, uppercase: false, highlight: "pill" },
    zoomTo: 1.09,
    punch: 1.15,
    spring: LANDS,
    exitFrames: 4,
    grade: "contrast(1.1) saturate(1.1) brightness(1.01) sepia(0.04)",
    vignette: 0.14,
  },
  chic: {
    hook: { family: "body", weight: 600, italic: false, size: 94, uppercase: false, letterSpacing: -1.5, lineHeight: 1.06, stagger: 2, enter: "rise", stress: "color" },
    band: { family: "body", weight: 500, size: 48, uppercase: true, letterSpacing: 6, radius: 0, box: "outline", tilt: 0 },
    caption: { weight: 600, size: 56 },
    subtitle: { weight: 700, size: 50, uppercase: false, highlight: "pill" },
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
    subtitle: { weight: 800, size: 50, uppercase: false, highlight: "pill" },
    zoomTo: 1.05,
    punch: 1.12,
    spring: LANDS,
    exitFrames: 6,
    grade: "saturate(1.05) sepia(0.05) contrast(1.02)",
    vignette: 0,
  },
  libre: liveTheme(LIBRE_TEMPO),
};

/**
 * A Reel's motion from its own tempo, on one native look (a clean bold sentence, its key
 * word in the brand colour, a statement in the apps' white box; the business's signature
 * sets its case, fonts, stress and light): a calm Reel (76 BPM) has its words rise one after
 * the other and a camera that barely moves, a fast one (120) has them pop in and lands its
 * zooms harder.
 */
export function liveTheme(tempo: number): Theme {
  const e = Math.min(1, Math.max(0, (tempo - 76) / 44));
  const mix = (calm: number, lively: number) => calm + (lively - calm) * e;
  const lively = e >= 0.55;
  return {
    hook: { family: "body", weight: 700, italic: false, size: Math.round(mix(96, 112)), uppercase: false, letterSpacing: -1.5, lineHeight: 1.06, stagger: e < 0.3 ? 2 : 1, enter: lively ? "pop" : "rise", stress: "color" },
    band: { family: "body", weight: 700, size: Math.round(mix(60, 64)), uppercase: false, letterSpacing: -0.5, radius: 14, box: "white", tilt: 0 },
    caption: { weight: lively ? 800 : 700, size: 60 },
    subtitle: { weight: 800, size: Math.round(mix(52, 56)), uppercase: false, highlight: "pill" },
    zoomTo: Math.round(mix(1.05, 1.09) * 1000) / 1000,
    punch: Math.round(mix(1.1, 1.15) * 1000) / 1000,
    spring: lively ? LANDS : e < 0.3 ? { damping: 200, stiffness: 160, mass: 0.9 } : { damping: 200, stiffness: 220, mass: 0.7 },
    exitFrames: Math.round(mix(6, 4)),
    grade: "brightness(1.02) contrast(1.06) saturate(1.06) sepia(0.05)",
    vignette: Math.round(mix(0.1, 0.14) * 100) / 100,
  };
}

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
 * The Reel's theme set the business's way: its titles (font, case, weight, alignment,
 * spacing), how its key words stand out, the box under a statement and the light of its
 * pictures. Its tempo (an older Reel: its ambiance) keeps the sizes, rhythm, springs and entrances.
 */
export function themeFor(template: MotionTemplate, signature: ReelSignature | undefined, tempo?: number): Theme {
  const base = template === "libre" ? liveTheme(tempo ?? LIBRE_TEMPO) : THEMES[template];
  if (!signature) return base;
  const t = signature.titles;
  const upper = t.case === "upper";
  const tracking = (size: number) => (t.tracking === "wide" ? size * (upper ? 0.06 : 0.03) : t.tracking === "tight" ? -size * 0.025 : 0);
  return {
    ...base,
    hook: {
      ...base.hook,
      family: t.font,
      // A hook over video is never thin: « regular » on its site reads as the clean bold of native texts, bold and black go heavier.
      weight: t.weight === "black" ? 900 : t.weight === "bold" ? 800 : 700,
      uppercase: upper,
      // Its spacing is its choice (tight, normal, wide); lower case only ever takes a little air.
      letterSpacing: upper ? tracking(base.hook.size) : base.hook.size * (t.tracking === "tight" ? -0.03 : t.tracking === "wide" ? 0.01 : -0.01),
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
    // A stroke drawn by hand under every word said was the same animation all over the Reel: the word said takes its colour,
    // the stroke stays on the hook's key word.
    subtitle: {
      ...base.subtitle,
      size: upper ? Math.round(base.subtitle.size * 0.9) : base.subtitle.size,
      uppercase: upper,
      highlight: signature.stress === "block" ? "pill" : signature.stress === "marker" ? "color" : signature.stress,
    },
    grade: GRADES[signature.grade] ?? base.grade,
  };
}
