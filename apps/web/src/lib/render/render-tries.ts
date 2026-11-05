import type { ReelProps } from "@fauve/agent";

// How a Reel is rendered in its sandbox (sandbox.ts): one render per sandbox, then, if Remotion fails, a second and
// more patient try in the same place, on the files already copied, only when its step still has the time for it.
// Pure (no server import), so that node --test reads it.
//
// Bench of 4 November 2026 (four montages launched at once): two first tries shared fauve-render-paris, each with its
// twelve videos re-encoded at once (24 ffmpeg on 4 vCPUs, up to 212 s each), then four tabs and a 1.5 GB frame cache
// each; 14 s apart, one compositor died (EPIPE) and the other found no frame in a complete file. Their second tries
// copied and re-encoded everything again (3 min 45 s) and finished half a minute after their step's 800 s.

/** Each render sandbox takes one Reel's render at a time (the light Chrome jobs have their own places, two each). */
export const RENDERS_PER_SANDBOX = 1;

/**
 * The longest a render may hold its place: longer than the longest step (800 s), so that the place of a render
 * still running is never given to another; a function killed mid-render frees it when this ends.
 */
export const RENDER_LEASE_MS = 14 * 60_000;

export type RenderTry = { concurrency: number; frameTimeoutMs: number; cacheBytes: number };

/** A render with its sandbox to itself: four tabs, a frame of her video waits 60 s at most, a 1.5 GB frame cache. */
export const FIRST_TRY: RenderTry = { concurrency: 4, frameTimeoutMs: 60_000, cacheBytes: 1_500_000_000 };

/**
 * The second try, and a render that runs without a place of its own (all were taken past its wait): two tabs, two
 * minutes for a frame, a 1 GB frame cache. Two of them side by side passed in the sandbox where two first tries had
 * just failed (4 November, 21:35 to 21:39).
 */
export const PATIENT_TRY: RenderTry = { concurrency: 2, frameTimeoutMs: 120_000, cacheBytes: 1_000_000_000 };

/** Remotion's options for a try. */
export function remotionFlags(t: RenderTry): string {
  return `--concurrency=${t.concurrency} --timeout=${t.frameTimeoutMs} --offthreadvideo-cache-size-in-bytes=${t.cacheBytes}`;
}

/** What a step still does after its render: the music composed and mixed, the upload, the strip of scenes. */
export const AFTER_RENDER_MS = 2 * 60_000;

/** A second try needs at least this to render (a 15 s Reel, two tabs): with less, it is not started. */
export const SECOND_TRY_MIN_MS = 2 * 60_000;

/**
 * The seconds a render command may run, so that it ends before its step does (`timeout`): its step's time left
 * minus what comes after it, at least 1 (0 would mean no limit). Null outside a step (timeLeft() is Infinity).
 */
export function renderBoundSeconds(timeLeftMs: number): number | null {
  if (!Number.isFinite(timeLeftMs)) return null;
  return Math.max(1, Math.floor((timeLeftMs - AFTER_RENDER_MS) / 1000));
}

/** Whether a second try still fits in its step (always outside a step). */
export function secondTryFits(timeLeftMs: number): boolean {
  return timeLeftMs - AFTER_RENDER_MS >= SECOND_TRY_MIN_MS;
}

/**
 * The second try's props: the first try's, its files already in the sandbox, without a composition that lays the
 * shots (a collage's that broke the render gives way to the printed collage) nor the animation that draws a copied
 * Reel's texts (the engine draws them again), nor the pale grounds a model's composition painted under a voice's
 * subtitles (white again over her footage).
 */
export function withoutCompositions(props: ReelProps): ReelProps {
  const layers = props.layers?.filter((l) => !l.compose && !l.drawsTexts);
  const rest = { ...props, layers: layers?.length ? layers : undefined };
  delete rest.subtitlePale;
  return rest;
}
