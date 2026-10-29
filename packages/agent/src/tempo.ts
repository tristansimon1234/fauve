import { FADE, usesFades } from "./render.ts";

const REEL_FPS = 30;
import { isClipSegment, isMotionSegment, segmentSeconds, type EditPlan, type MotionTemplate } from "./schemas.ts";

// The rhythm of a Reel: its tempo, chosen by the editor for this Reel (`plan.tempo`;
// before, each ambiance had one), and the cuts land on its beats (the music is then
// composed at that tempo, over those cuts). Deterministic: the editor chooses the shots
// and their rough lengths, this puts them on the grid. Over her voice, the cuts follow
// her phrases instead: no grid.

/** Beats per minute of each template: the Reels made before a Reel had its own tempo (« libre » without one). */
export const TEMPLATE_BPM: Record<MotionTemplate, number> = { doux: 84, chic: 76, dynamique: 120, collage: 108, libre: 100 };

/** Seconds per beat of a template, null for a template without a tempo. */
export function beatOf(template: string): number | null {
  const bpm = TEMPLATE_BPM[template as MotionTemplate];
  return bpm ? 60 / bpm : null;
}

/** A Reel's beats per minute: its own tempo, else its template's (null for a template without one). */
export function planBpm(plan: Pick<EditPlan, "template" | "tempo">): number | null {
  return plan.tempo ?? TEMPLATE_BPM[plan.template as MotionTemplate] ?? null;
}

/** Seconds per beat of a Reel: its own tempo, else its template's. */
export function planBeat(plan: Pick<EditPlan, "template" | "tempo">): number | null {
  const bpm = planBpm(plan);
  return bpm ? 60 / bpm : null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Shortest scene (the schema's minimum) and longest, by kind. */
const SCENE_MIN = 1;
const SCENE_MAX = 6;
const MOTION_MAX = 8;

/**
 * The plan with every cut on a beat: each segment lasts a whole number of beats
 * (plus the crossfade it overlaps, so the cuts stay on the grid), a clip never past
 * its end; the texts start and end on beats too, 1.5 s at least. Unchanged over
 * her voice or for a template without a tempo. A `fixed` shot (someone speaking, cut between
 * two words) keeps its length: the grid goes on from where it ends, and the next cut lands back on a beat.
 */
export function snapToTempo(plan: EditPlan, clipDurations: Record<string, number>, fixed?: (s: EditPlan["segments"][number]) => boolean): EditPlan {
  const beat = planBeat(plan);
  if (!beat || plan.voice || !plan.segments.length) return plan;
  // Worked in frames, as the composition plays it (a crossfade overlaps whole frames).
  const frames = (t: number) => Math.round(t * REEL_FPS);
  const fade = usesFades(plan) ? frames(FADE) : 0;
  const last = plan.segments.length - 1;
  let beats = 0; // beats before the current segment's cut (a fraction after a fixed shot)
  const segments = plan.segments.map((s, i) => {
    // The last segment's length moves no cut, but its end still lands on a beat.
    const extra = i === last ? 0 : fade;
    if (fixed?.(s)) {
      beats += (segmentSeconds(s) - extra / REEL_FPS) / beat;
      return s;
    }
    const scene = !isClipSegment(s);
    const minBeats = scene ? Math.ceil(SCENE_MIN / beat) : 1;
    // A shot at another speed lasts its clip time divided by the speed.
    const speed = isClipSegment(s) ? (s.speed ?? 1) : 1;
    const maxLen = isClipSegment(s)
      ? ((clipDurations[s.clip_id] ?? s.out) - s.in) / speed
      : isMotionSegment(s)
        ? MOTION_MAX
        : SCENE_MAX;
    const lengthOf = (n: number) => (frames((beats + n) * beat) - frames(beats * beat) + extra) / REEL_FPS;
    // Back on the grid after a fixed shot: its end on the nearest beat (whole beats otherwise, as before).
    const offGrid = beats - Math.floor(beats + 1e-9);
    let n = Math.max(minBeats, Math.round(beats + (segmentSeconds(s) - extra / REEL_FPS) / beat) - beats);
    if (offGrid > 1e-9 && n < minBeats + 1e-9) n = Math.ceil(beats + minBeats) - beats;
    while (n - 1 >= minBeats - 1e-9 && lengthOf(n) > maxLen + 0.001) n--;
    const length = round(lengthOf(n));
    if (length > maxLen + 0.001) {
      // Too short to hold even one beat: kept as it is, the grid goes on from where it ends.
      beats += Math.round((segmentSeconds(s) - extra / REEL_FPS) / beat);
      return s;
    }
    beats += n;
    return isClipSegment(s) ? { ...s, out: round(s.in + length * speed) } : { ...s, duration: length };
  });
  const onBeat = (t: number) => round(Math.round(t / beat) * beat);
  const texts = plan.texts.map((t) => {
    const from = onBeat(t.from);
    let to = onBeat(t.to);
    while (to - from < 1.5) to = round(to + beat);
    return { ...t, from, to };
  });
  return { ...plan, segments, texts };
}
