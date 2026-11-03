import { HOUSE_MEASURES } from "./house-measures.ts";

// The frames of Edith's models (Tristan: « et les 31 modèles comment ça il voit pas ? »): each model was written from
// a reference Reel he sent, kept in the media bucket (house/originals/<key>.mp4: the 720 px, 30 i/s copy the reading
// takes, never shown nor served), and the agents that remake a model see its frames the way they see a Reel she sends:
// sheets of ten frames each, made once by /api/admin/house-sheets with the same recipe (sheetSpan, five by two, 320 px
// on the long side), kept in house/sheets/<key>/ and named on the model's inspiration row (houseStyle).

/** The most sheets of a Reel's frames (ten each), for a Reel she sends as for one of Edith's models. */
export const MODEL_SHEETS = 12;

/** Each sheet's span in seconds: a twelfth of the Reel, two seconds at least (printed with three decimals, as by the sandbox). */
export const sheetSpan = (duration: number): number => Math.round(Math.max(2, duration / MODEL_SHEETS) * 1000) / 1000;

/** Where a model's original is kept. */
export const houseOriginalPath = (key: string): string => `house/originals/${key}.mp4`;

/** Where its sheets are kept, in order. */
export const houseSheetPath = (key: string, index: number): string => `house/sheets/${key}/${String(index).padStart(2, "0")}.jpg`;

/**
 * The passage of its original a model is made from, when not the whole Reel (seconds, and the part of the image): the
 * façade that builds itself is the first 9.4 s of the Reel whose name is then pressed in paper (« gaufre », the whole
 * Reel); the Nike edit plays in the left part of a tutorial whose host talks on the right (its first 12 s); the creator
 * talks for a minute and the model keeps his first 31 s.
 */
export const HOUSE_PASSAGES: Record<string, { to: number; crop?: { width: number; height: number; x: number; y: number } }> = {
  facade: { to: 9.4 },
  nike: { to: 12, crop: { width: 324, height: 540, x: 0, y: 0 } },
  createur: { to: 31 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A model's sheets as named on its inspiration row: their span on its original and their path; none without its measures. */
export function houseSheets(key: string): { from: number; to: number; path: string }[] {
  const duration = HOUSE_MEASURES[key]?.duration ?? 0;
  if (!(duration > 0)) return [];
  const span = sheetSpan(duration);
  return Array.from({ length: MODEL_SHEETS }, (_, i) => ({ from: round2(i * span), to: round2(Math.min(duration, (i + 1) * span)), path: houseSheetPath(key, i) })).filter((s) => s.from < duration);
}
