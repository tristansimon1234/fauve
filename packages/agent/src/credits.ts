import { MAX_FREE_SCENES } from "./editor.ts";

// Credits: what a studio is charged for the costly work, shown to the manager
// before it runs. A fixed price list (not metered tokens) keeps the quote
// predictable; the charge after the work is the real one, never above the quote.
// 1 credit ≈ €0.04 of AI and render cost.

export const CREDIT_PRICES = {
  /** The editor (Opus) writing the edit plan of a new montage. */
  montage: 2,
  /** Each clip watched for the montage (Gemini analysis). */
  clip: 1,
  /** A correction of an existing montage (the editor again). */
  correction: 2,
  /** A new animated scene coded by the motion designer (Opus). */
  newScene: 3,
  /** A scene reused from the library: free. */
  reusedScene: 0,
  /** Rendering the video. */
  render: 1,
  /** Fauve reading the moodboard. */
  moodboard: 1,
} as const;

/** Each month the balance goes back up to this (unused credits do not pile up beyond it). */
export const MONTHLY_CREDITS = 150;

export type QuoteLine = { label: string; credits: number };
export type MontageQuote = {
  lines: QuoteLine[];
  /** What it costs without any new animated scene. */
  base: number;
  /** The most it can cost: every allowed new scene created. */
  max: number;
  maxNewScenes: number;
};

/** Price of a montage or a correction, before it runs. */
export function quoteMontage(input: { clips: number; correction: boolean; maxNewScenes?: number }): MontageQuote {
  const clips = Math.max(0, Math.min(10, Math.round(input.clips)));
  const maxNewScenes = Math.max(0, Math.min(MAX_FREE_SCENES, input.maxNewScenes ?? MAX_FREE_SCENES));
  const lines: QuoteLine[] = input.correction
    ? [{ label: "Correction du montage", credits: CREDIT_PRICES.correction }]
    : [{ label: "Montage", credits: CREDIT_PRICES.montage }];
  if (!input.correction && clips) lines.push({ label: `${clips} clip${clips > 1 ? "s" : ""} analysé${clips > 1 ? "s" : ""}`, credits: clips * CREDIT_PRICES.clip });
  lines.push({ label: "Rendu vidéo", credits: CREDIT_PRICES.render });
  const base = lines.reduce((sum, l) => sum + l.credits, 0);
  return { lines, base, max: base + maxNewScenes * CREDIT_PRICES.newScene, maxNewScenes };
}

/** What is actually charged once the montage is delivered: the real scenes, never above the quote. */
export function montageCharge(quote: Pick<MontageQuote, "base" | "max">, newScenes: number): number {
  return Math.min(quote.max, quote.base + Math.max(0, newScenes) * CREDIT_PRICES.newScene);
}
