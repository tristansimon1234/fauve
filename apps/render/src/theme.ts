import type { MotionTemplate } from "./types";

// One visual system, three temperaments. Sizes are for a 1080-wide frame.
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
  };
  band: { weight: number; size: number; uppercase: boolean; letterSpacing: number; radius: number; outline: boolean; tilt: number };
  caption: { weight: number; size: number };
  subtitle: { weight: number; size: number; uppercase: boolean; highlight: "color" | "pill" };
  zoomTo: number;
  spring: { damping: number; stiffness: number; mass: number };
  exitFrames: number;
};

export const THEMES: Record<MotionTemplate, Theme> = {
  doux: {
    hook: { family: "display", weight: 400, italic: true, size: 116, uppercase: false, letterSpacing: -1, lineHeight: 1.02, stagger: 4, enter: "rise" },
    band: { weight: 600, size: 42, uppercase: false, letterSpacing: 0.2, radius: 999, outline: false, tilt: 0 },
    caption: { weight: 600, size: 46 },
    subtitle: { weight: 700, size: 54, uppercase: false, highlight: "color" },
    zoomTo: 1.06,
    spring: { damping: 200, stiffness: 90, mass: 1 },
    exitFrames: 10,
  },
  dynamique: {
    hook: { family: "display", weight: 800, italic: false, size: 104, uppercase: true, letterSpacing: -1, lineHeight: 0.98, stagger: 2, enter: "pop" },
    band: { weight: 800, size: 46, uppercase: true, letterSpacing: 0.5, radius: 10, outline: false, tilt: -2 },
    caption: { weight: 700, size: 48 },
    subtitle: { weight: 800, size: 62, uppercase: true, highlight: "pill" },
    zoomTo: 1.1,
    spring: { damping: 12, stiffness: 180, mass: 0.6 },
    exitFrames: 6,
  },
  chic: {
    hook: { family: "display", weight: 500, italic: false, size: 104, uppercase: false, letterSpacing: 0.5, lineHeight: 1.05, stagger: 6, enter: "fade" },
    band: { weight: 600, size: 30, uppercase: true, letterSpacing: 6, radius: 0, outline: true, tilt: 0 },
    caption: { weight: 500, size: 42 },
    subtitle: { weight: 600, size: 50, uppercase: false, highlight: "color" },
    zoomTo: 1.04,
    spring: { damping: 200, stiffness: 60, mass: 1 },
    exitFrames: 14,
  },
};
