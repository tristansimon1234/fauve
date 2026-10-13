// Mirror of ReelProps in packages/agent/src/motion.ts (the web app builds them).
// This package is shipped alone to the render sandbox, so it cannot import it.

export type MotionTemplate = "doux" | "dynamique" | "chic";

export type Scene = {
  kind: "title" | "list" | "quote" | "number";
  title: string;
  kicker?: string;
  items?: string[];
  background: "accent" | "ink" | "cream";
};

export type ReelProps = {
  template: MotionTemplate;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  fadeFrames: number;
  segments: (
    | { type: "clip"; src: string; startFrom: number; startAt: number; durationInFrames: number; zoom: boolean }
    | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number }
    | { type: "motion"; js: string; fallback: Scene; texts: Record<string, string>; startAt: number; durationInFrames: number }
  )[];
  texts: {
    text: string;
    style: "hook" | "band" | "caption";
    emphasis: string[];
    from: number;
    durationInFrames: number;
    /** Manual placement (scene editor): top edge as a share of the height, size factor, dark background. */
    y?: number;
    x?: number;
    scale?: number;
    backdrop?: boolean;
  }[];
  words: { w: string; from: number; to: number }[];
  brand: { name: string; accent: string; accentInk: string; displayFont: string; bodyFont: string; logoUrl: string | null };
  endCard: { title: string; subtitle: string | null; from: number } | null;
};
