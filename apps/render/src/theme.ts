import type { MotionTemplate } from "./types";

// One visual system, four temperaments (collage draws its own texts, Collage.tsx). Sizes are for a 1080-wide frame.
// Modern and native-looking: texts are big and few, set where a creator would put them in
// the Instagram or TikTok app (the hook in the upper third, a statement on a box, a line
// lower down), every shot gets the same light grade, and the camera keeps moving a little.
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
     * colour, or in the display font's italic (a serif accent in a sans hook: one or two words, never the whole line).
     */
    stress: "box" | "italic" | "color" | "serif";
  };
  /** The statement (« band »): words on a box hugging each line, like the text tool of the apps, or an outlined frame. */
  band: { family: "display" | "body"; weight: number; size: number; uppercase: boolean; letterSpacing: number; radius: number; box: "white" | "accent" | "outline"; tilt: number };
  /** box: on a dark box (the apps' native text style); else bare with a soft shadow. */
  caption: { weight: number; size: number; box?: boolean };
  subtitle: { weight: number; size: number; uppercase: boolean; highlight: "color" | "pill" };
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
    hook: { family: "body", weight: 700, italic: false, size: 112, uppercase: false, letterSpacing: -2, lineHeight: 1.02, stagger: 2, enter: "rise", stress: "serif" },
    band: { family: "body", weight: 600, size: 72, uppercase: false, letterSpacing: -0.5, radius: 18, box: "white", tilt: 0 },
    caption: { weight: 700, size: 62 },
    subtitle: { weight: 700, size: 60, uppercase: false, highlight: "color" },
    zoomTo: 1.07,
    punch: 1.12,
    spring: { damping: 200, stiffness: 220, mass: 0.7 },
    exitFrames: 5,
    grade: "brightness(1.03) contrast(1.04) saturate(1.04) sepia(0.06)",
    vignette: 0.1,
  },
  dynamique: {
    hook: { family: "display", weight: 900, italic: false, size: 118, uppercase: true, letterSpacing: -1, lineHeight: 0.94, stagger: 2, enter: "pop", stress: "box" },
    band: { family: "display", weight: 800, size: 84, uppercase: true, letterSpacing: 0, radius: 12, box: "accent", tilt: 0 },
    caption: { weight: 800, size: 62, box: true },
    subtitle: { weight: 800, size: 66, uppercase: true, highlight: "color" },
    zoomTo: 1.09,
    punch: 1.15,
    spring: { damping: 14, stiffness: 210, mass: 0.6 },
    exitFrames: 4,
    grade: "contrast(1.1) saturate(1.1) brightness(1.01) sepia(0.04)",
    vignette: 0.14,
  },
  chic: {
    hook: { family: "display", weight: 400, italic: false, size: 104, uppercase: false, letterSpacing: -0.5, lineHeight: 1.04, stagger: 3, enter: "rise", stress: "italic" },
    band: { family: "body", weight: 500, size: 48, uppercase: true, letterSpacing: 6, radius: 0, box: "outline", tilt: 0 },
    caption: { weight: 600, size: 56 },
    subtitle: { weight: 600, size: 54, uppercase: false, highlight: "color" },
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
    subtitle: { weight: 800, size: 58, uppercase: false, highlight: "color" },
    zoomTo: 1.05,
    punch: 1.12,
    spring: { damping: 12, stiffness: 210, mass: 0.6 },
    exitFrames: 6,
    grade: "saturate(1.05) sepia(0.05) contrast(1.02)",
    vignette: 0,
  },
};
