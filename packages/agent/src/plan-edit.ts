import { isClipSegment, segmentSeconds, type EditPlan } from "./schemas.ts";

// Manual edits of a montage (the scene editor): every change keeps the plan
// valid and the overlay texts attached to the scene they were on, since texts
// are timed against the whole video.

export type Segment = EditPlan["segments"][number];
export type SegmentKind = "clip" | "scene" | "motion";

export function segmentKind(segment: Segment): SegmentKind {
  return isClipSegment(segment) ? "clip" : "scene" in segment ? "scene" : "motion";
}

/** Start and end of each segment, in seconds from the start of the video. */
export function timeline(plan: Pick<EditPlan, "segments">): { start: number; end: number }[] {
  let t = 0;
  return plan.segments.map((s) => {
    const start = t;
    t += Math.max(0, segmentSeconds(s));
    return { start, end: t };
  });
}

/** The segment a moment of the video falls in (the last one for the very end). */
export function segmentAt(plan: Pick<EditPlan, "segments">, seconds: number): number {
  const spans = timeline(plan);
  const i = spans.findIndex((s) => seconds >= s.start && seconds < s.end);
  return i === -1 ? Math.max(0, spans.length - 1) : i;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Rebuilds a plan from new segments. `origin[i]` is the index segment i had in
 * `plan` (null if new); texts move with their segment and are dropped with it,
 * clipped to the segment's new length.
 */
function withSegments(plan: EditPlan, segments: Segment[], origin: (number | null)[]): EditPlan {
  const before = timeline(plan);
  const after = timeline({ segments });
  const texts = plan.texts.flatMap((text) => {
    const from = segmentAt(plan, text.from);
    const at = origin.indexOf(from);
    if (at === -1) return [];
    const offset = after[at]!.start - before[from]!.start;
    const start = round(Math.max(after[at]!.start, text.from + offset));
    const end = round(Math.min(after[at]!.end, text.to + offset));
    return end - start >= 0.3 ? [{ ...text, from: start, to: end }] : [];
  });
  const duration = round(after.at(-1)?.end ?? 0);
  return { ...plan, segments, texts, duration: Math.max(3, duration) };
}

/** Moves the segment at `from` to position `to`. */
export function moveSegment(plan: EditPlan, from: number, to: number): EditPlan {
  if (from === to || to < 0 || to >= plan.segments.length) return plan;
  const order = plan.segments.map((_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved!);
  return withSegments(
    plan,
    order.map((i) => plan.segments[i]!),
    order,
  );
}

/** Removes a segment (a plan keeps at least one). */
export function removeSegment(plan: EditPlan, index: number): EditPlan {
  if (plan.segments.length <= 1) return plan;
  const order = plan.segments.map((_, i) => i).filter((i) => i !== index);
  return withSegments(
    plan,
    order.map((i) => plan.segments[i]!),
    order,
  );
}

/** Replaces a segment (new text, trim, duration…), the rest following in time. */
export function updateSegment(plan: EditPlan, index: number, segment: Segment): EditPlan {
  const segments = plan.segments.map((s, i) => (i === index ? segment : s));
  return withSegments(
    plan,
    segments,
    segments.map((_, i) => i),
  );
}

/** Adds a segment at position `index` (0 = first), the following ones moving later with their texts. */
export function insertSegment(plan: EditPlan, index: number, segment: Segment): EditPlan {
  const at = Math.max(0, Math.min(index, plan.segments.length));
  const origin: (number | null)[] = plan.segments.map((_, i) => i);
  origin.splice(at, 0, null);
  const segments = [...plan.segments];
  segments.splice(at, 0, segment);
  return withSegments(plan, segments, origin);
}
