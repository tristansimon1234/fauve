import type { ClipAnalysis } from "./schemas.ts";

/**
 * Her bank of shots: a good video is kept after use (or after 7 days unused)
 * so Edith can cut a Reel from it later without asking her to film again.
 * The result of a Reel depends mostly on the living footage she sends.
 */
export const BANK_DAYS = 180;
/** At most this many videos in a studio's bank, the most recent ones. */
export const BANK_MAX = 40;

/**
 * A video worth keeping: a clean shot (not blurred, dark or shaky) of at least
 * 1.5 s that moves or would hook, in a clip whose light is not poor.
 */
export function bankWorthy(analysis: Pick<ClipAnalysis, "lighting" | "shots">): boolean {
  if (analysis.lighting === "poor") return false;
  return analysis.shots.some(
    (shot) =>
      shot.end - shot.start >= 1.5 &&
      !shot.quality.blurry &&
      !shot.quality.dark &&
      !shot.quality.shaky &&
      (shot.hook_score >= 3 || shot.energy >= 3),
  );
}
