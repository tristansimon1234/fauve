import { isClipSegment, MAX_OVERLAYS, segmentSpans, type EditPlan, type PlanOverlay } from "./schemas.ts";

// Manual edits of a montage (the scene editor): every change keeps the plan
// valid and the overlay texts attached to the scene they were on, since texts
// are timed against the whole video.

export type Segment = EditPlan["segments"][number];
export type SegmentKind = "clip" | "scene" | "motion";

export function segmentKind(segment: Segment): SegmentKind {
  return isClipSegment(segment) ? "clip" : "scene" in segment ? "scene" : "motion";
}

/** Start and end of each segment, in seconds from the start of the video (a shot laid beside the others at its own moment). */
export function timeline(plan: Pick<EditPlan, "segments">): { start: number; end: number }[] {
  return segmentSpans(plan.segments).spans.map(({ start, length }) => ({ start, end: start + length }));
}

/**
 * The moment that shows each scene in a strip of thumbnails (« Ta publication », its
 * editor): its middle, when its text or its animation is in. Same order as the segments.
 */
export function sceneTimes(plan: Pick<EditPlan, "segments">): number[] {
  return timeline(plan).map(({ start, end }) => Math.round(((start + end) / 2) * 100) / 100);
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
  // What she added on a scene moves with it, like a text (one over the whole Reel keeps its span, clipped to the new end).
  // Where the video ends (its last image, a shot laid beside the others included).
  const duration = round(segmentSpans(segments).end);
  const overlays = plan.overlays?.flatMap((o): PlanOverlay[] => {
    const whole = o.from <= 0.05 && o.to >= segmentSpans(plan.segments).end - 0.05;
    if (whole) return [{ ...o, to: round(Math.max(o.from + 0.3, duration)) }];
    const from = segmentAt(plan, o.from);
    const at = origin.indexOf(from);
    if (at === -1) return [];
    const offset = after[at]!.start - before[from]!.start;
    const start = round(Math.max(0, o.from + offset));
    const end = round(Math.min(duration, o.to + offset));
    return end - start >= 0.3 ? [{ ...o, from: start, to: end }] : [];
  });
  return { ...plan, segments, texts, duration: Math.max(3, duration), ...(plan.overlays ? { overlays } : {}) };
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

/** How long an end card she adds plays, after the Reel's last image (its last shot held under the card). */
export const ADDED_END_SECONDS = 1.6;

/**
 * Her end card: its words changed when the Reel has one; else added, the Reel going on by ADDED_END_SECONDS after its
 * last image (the last shot held, a photo still, a video on its last frame), the card playing there. Over a Reel drawn
 * by one composition, the composition stops where the card starts and the engine draws the card on black.
 */
export function withEndCard(plan: EditPlan, card: { title: string; subtitle?: string }): EditPlan {
  const end = { title: card.title.trim().slice(0, 40), ...(card.subtitle?.trim() ? { subtitle: card.subtitle.trim().slice(0, 60) } : {}) };
  if (!end.title) return plan;
  if (plan.end_card) return { ...plan, end_card: { ...plan.end_card, ...end, ...(end.subtitle ? {} : { subtitle: undefined }) } };
  const index = plan.segments.length - 1;
  const last = plan.segments[index]!;
  const longer: Segment = isClipSegment(last)
    ? { ...last, out: round(last.out + ADDED_END_SECONDS * (last.speed ?? 1)) }
    : { ...last, duration: Math.min("scene" in last ? 6 : 8, round(last.duration + ADDED_END_SECONDS)) };
  return { ...updateSegment(plan, index, longer), end_card: end };
}

/** Her end card taken out: the time added for it goes with it. */
export function withoutEndCard(plan: EditPlan): EditPlan {
  if (!plan.end_card) return plan;
  const { end_card: _gone, ...rest } = plan;
  return rest as EditPlan;
}

/** An element she adds (a text, a photo), clipped to the Reel; at most MAX_OVERLAYS. */
export function addOverlay(plan: EditPlan, overlay: PlanOverlay): EditPlan {
  const from = round(Math.max(0, Math.min(plan.duration - 0.3, overlay.from)));
  const to = round(Math.max(from + 0.3, Math.min(plan.duration, overlay.to)));
  return { ...plan, overlays: [...(plan.overlays ?? []), { ...overlay, from, to }].slice(-MAX_OVERLAYS) };
}

export function updateOverlay(plan: EditPlan, index: number, patch: Partial<PlanOverlay>): EditPlan {
  return { ...plan, overlays: (plan.overlays ?? []).map((o, i) => (i === index ? { ...o, ...patch } : o)) };
}

export function removeOverlay(plan: EditPlan, index: number): EditPlan {
  const overlays = (plan.overlays ?? []).filter((_, i) => i !== index);
  return { ...plan, overlays };
}

/**
 * Where a scene she adds can go: anywhere in a montage; after the composition in a Reel drawn by one (its shots are
 * laid by its code: one put in the middle would not be seen).
 */
export function insertableFrom(plan: EditPlan): number {
  const compose = plan.layers?.find((l) => l.compose);
  if (!compose) return 0;
  const spans = timeline(plan);
  const first = spans.findIndex((s) => s.start >= compose.to - 0.05);
  return first === -1 ? plan.segments.length : first;
}

