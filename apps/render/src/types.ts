// Mirror of ReelProps in packages/agent/src/motion.ts (the web app builds them).
// This package is shipped alone to the render sandbox, so it cannot import it.

export type MotionTemplate = "doux" | "dynamique" | "chic";

export type ReelProps = {
  template: MotionTemplate;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  fadeFrames: number;
  segments: { src: string; startFrom: number; startAt: number; durationInFrames: number; zoom: boolean }[];
  texts: { text: string; style: "hook" | "band" | "caption"; emphasis: string[]; from: number; durationInFrames: number }[];
  words: { w: string; from: number; to: number }[];
  brand: { name: string; accent: string; accentInk: string; displayFont: string; bodyFont: string; logoUrl: string | null };
  endCard: { title: string; subtitle: string | null; from: number } | null;
};
