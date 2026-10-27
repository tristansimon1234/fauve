import type { ClipAnalysis } from "./schemas.ts";

/**
 * A shaky phone video is steadied once, right after Gemini has read it and before
 * anything is tracked or cut on it (ffmpeg's vid.stab, two passes, in the cut-out
 * sandbox): the tracks, the face boxes and every render then see the same steady
 * picture. Only when a good part of it shakes: a camera move that is meant stays.
 */
export const STABILIZE_MIN_SHARE = 0.3;
/** Longer videos are left as they are: about 2 s of work per second of video. */
export const STABILIZE_MAX_SECONDS = 60;

/** The part of the clip (0 to 1) whose shots Gemini read as shaky. */
export function shakyShare(analysis: Pick<ClipAnalysis, "duration" | "shots">): number {
  if (!(analysis.duration > 0)) return 0;
  const shaky = analysis.shots.reduce((sum, s) => sum + (s.quality.shaky ? Math.max(0, Math.min(s.end, analysis.duration) - s.start) : 0), 0);
  return Math.min(1, shaky / analysis.duration);
}

export function needsStabilizing(analysis: Pick<ClipAnalysis, "duration" | "shots">): boolean {
  return analysis.duration <= STABILIZE_MAX_SECONDS && shakyShare(analysis) >= STABILIZE_MIN_SHARE;
}
