import { EFFORTS, type Effort } from "./effort.ts";
import { MAX_FREE_SCENES } from "./editor.ts";
import { PLANS } from "./plans.ts";

// Credits: what a studio is charged for the costly work. A montage is charged on what it
// really cost (Tristan: « le calcul des crédits devrait se faire en fonction de la complexité
// passée, pas un truc fixe ») in credits that keep the margin (meteredCredits, margin.ts),
// between a floor and a ceiling said at launch; the other jobs keep a fixed price list.
// A credit is worth the plan spread over the month's credits (margin.ts): each
// job's price keeps at least half of that as margin, checked by the tests.

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
  /** A variant of a delivered montage: same cut, another style and hook (render only). */
  variant: 1,
  /** A new text layer for photos, designed as code from an example (Opus, checks and a critic). Reusing one is free. */
  textLayer: 4,
  /** A change to one component of the studio's bank (a new version): a round of Opus. */
  elementEdit: 2,
  /** A whole carousel composed by the carousel designer (Opus, a test render of every slide, a critic, one correction). */
  carousel: 9,
  /** Fauve watching the rendered video before it goes out (Soigné, Max). */
  review: 1,
  /** A correction the critic asks for: the editor again, a render, a new look. */
  fixRound: 3,
  /** A second version to compare (Max): the editor again and a render. */
  alternative: 3,
  /** An image from the image model: a real photo improved, or an ambiance image. */
  image: 1,
  /** New words for her trade on the page Tendances, past the free ones of the month (TREND_FREE_CHANGES): a whole new search, about $0.03. */
  trends: 1,
} as const;

/** Each month the balance goes back up to the plan's credits (unused credits do not pile up beyond it); this is Pro's. */
export const MONTHLY_CREDITS = PLANS.pro.credits;

export type QuoteLine = { label: string; credits: number };
export type MontageQuote = {
  lines: QuoteLine[];
  /** The price shown: the work and the new animated scenes allowed (a scene not made is not charged). */
  base: number;
  /** The most it can cost: every correction the review may ask for, too. */
  max: number;
  maxNewScenes: number;
  /** Corrections the critic may ask for (each one charged only if made). */
  fixRounds: number;
};

/** Versions made at a level: a correction is always one. */
export function effortVersions(effort: Effort, correction: boolean): 1 | 2 {
  return correction ? 1 : EFFORTS[effort].versions;
}

/** The least a montage or a correction is charged, whatever it cost (Tristan: « top » to 5 to 25 for a Reel). */
export const MONTAGE_FLOOR = { montage: 5, correction: 2 } as const;
/** The most, said at launch: by level of care for a new Reel (two versions and corrections cost more), and for a correction. */
export const MONTAGE_CEILING: Record<Effort | "correction", number> = { rapide: 25, soigne: 30, max: 40, correction: 15 };

/**
 * Price of a montage or a correction at a level of care (Rapide by default), before it runs: what it
 * will really cost, between its floor (`base`) and its ceiling (`max`); the charge is meteredCredits.
 */
export function quoteMontage(input: { correction: boolean; maxNewScenes?: number; effort?: Effort }): MontageQuote {
  // Callers pass the animations of the plan; without them, two (8 at most).
  const maxNewScenes = Math.max(0, Math.min(MAX_FREE_SCENES, input.maxNewScenes ?? 2));
  const level = EFFORTS[input.effort ?? "rapide"];
  const base = input.correction ? MONTAGE_FLOOR.correction : MONTAGE_FLOOR.montage;
  const lines: QuoteLine[] = [{ label: input.correction ? "Correction, selon ce qu’elle demande vraiment" : "Montage, selon ce qu’il demande vraiment", credits: base }];
  return { lines, base, max: MONTAGE_CEILING[input.correction ? "correction" : (input.effort ?? "rapide")], maxNewScenes, fixRounds: level.fixRounds };
}

/** Price of a variant: no AI work, only the render. */
export function quoteVariant(): MontageQuote {
  const lines = [{ label: "Variante (autre style, autre accroche)", credits: CREDIT_PRICES.variant }];
  return { lines, base: CREDIT_PRICES.variant, max: CREDIT_PRICES.variant, maxNewScenes: 0, fixRounds: 0 };
}

/** The quote's line for its made-to-measure animations. */
const scenesLabel = (n: number) => (n > 1 ? `${n} animations sur mesure` : "1 animation sur mesure");
const SCENES_LINE = /^\d+ animations? sur mesure$/;

/** New animated scenes already counted in a quote's price (older quotes counted none). */
export function scenesInQuote(lines: QuoteLine[] | null | undefined): number {
  return (lines ?? []).filter((l) => SCENES_LINE.test(l.label)).reduce((sum, l) => sum + Math.round(l.credits / CREDIT_PRICES.newScene), 0);
}

/**
 * What a montage priced from the old list (launched before montages were metered) is charged once
 * delivered: the work, the new scenes really made (the quoted ones not made come off) and the
 * corrections, never above the quote.
 */
export function montageCharge(quote: Pick<MontageQuote, "base" | "max" | "lines">, newScenes: number, fixRounds = 0): number {
  const work = quote.base - scenesInQuote(quote.lines) * CREDIT_PRICES.newScene;
  return Math.min(quote.max, work + Math.max(0, newScenes) * CREDIT_PRICES.newScene + Math.max(0, fixRounds) * CREDIT_PRICES.fixRound);
}
