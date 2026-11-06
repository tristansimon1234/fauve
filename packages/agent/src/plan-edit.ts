import { ownRequestWords } from "./request-log.ts";
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


/** How dark the veil under a model's words is (« voile », « overlay »): her pictures stay seen, its words read. */
export const SCRIM = 0.45;

/**
 * A Reel whose texts a composition draws itself (one of Edith's models, a composition that draws the whole picture): a
 * look set on its texts would only show in its fallback, in the engine's font; its words are read better by a veil on
 * her pictures under them (withScrim), never by a box.
 */
export function drawsItsTexts(plan: Pick<EditPlan, "layers" | "skill">): boolean {
  return Boolean(plan.skill) || Boolean(plan.layers?.some((l) => l.compose && l.motion.draws_texts));
}

/**
 * Her words read better on a model (« voile », « overlay », « fond sombre derrière le texte », « on voit pas bien le
 * texte »: Tristan, 6 November): a soft dark veil on her pictures while its words show, at `strength`, on the composition
 * that draws them; its lettering, sizes and design kept. Unchanged when no composition draws the Reel's texts.
 */
export function withScrim(plan: EditPlan, strength = SCRIM): EditPlan {
  if (!plan.layers?.some((l) => l.compose)) return plan;
  const dark = Math.round(Math.max(0.15, Math.min(0.7, strength)) * 100) / 100;
  return { ...plan, layers: plan.layers.map((l) => (l.compose ? { ...l, scrim: dark } : l)) };
}

/**
 * The veil of a Reel made on a model (skills.ts): the one its version before had (a correction keeps it), else one when
 * her request asks for her words to read better (asksLegibility, on her own words and Edith's brief: ownRequestWords);
 * none otherwise.
 */
export function scrimFor(previous: Pick<EditPlan, "layers"> | null | undefined, request: string | null | undefined): number | undefined {
  const kept = previous?.layers?.find((l) => l.compose)?.scrim;
  if (kept) return kept;
  return asksLegibility(ownRequestWords(request)) ? SCRIM : undefined;
}

/**
 * Her words ask for her texts to read better on their pictures (Tristan, 6 November: « on voit pas bien le texte au debut
 * il faut peut etre un overlay »; Edith: « un voile sombre »): a veil, an overlay, a dark ground behind the text, a text
 * she cannot read. On a model: a veil on her pictures under its words (withScrim), its lettering kept.
 */
export function asksLegibility(text: string | null | undefined): boolean {
  const words = (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`-]/g, " ");
  return LEGIBLE.test(words);
}

const LEGIBLE = new RegExp(
  [
    String.raw`\bvoiles?\b(?! (?:de mariee|de bateau|du bateau))`,
    String.raw`\boverlays?\b`,
    // A dark ground behind her words (never an end card « sur fond noir »).
    String.raw`\b(?:fond|degrade|ombre|bande|calque|filtre)s? (?:plus )?(?:sombres?|noirs?|fonces?) (?:derriere|sous|pour|sur|a) (?:le |les |du |des |ce |ces |mes |tes )?(?:texte|textes|mots?|ecrit|lire)\b`,
    String.raw`\b(?:texte|textes|mots?) (?:sur|avec) (?:un )?(?:fond|degrade) (?:plus )?(?:sombres?|noirs?|fonces?)\b`,
    String.raw`\bassombri\w*`,
    String.raw`\b(?:on|j|tu|je) (?:ne |n )?(?:voit|vois|lit|lis|arrive)(?: pas| plus| mal| rien)\b[^.!?\n]{0,40}\b(?:texte|textes|mots?|ecrit|lire)\b`,
    String.raw`\b(?:texte|textes|mots?)\b[^.!?\n]{0,30}(?:illisibles?|pas lisibles?|peu lisibles?|mal lisibles?|ne (?:se )?(?:voi|li)\w*)`,
    String.raw`\b(?:plus|mieux) lisibles?\b`,
    String.raw`\billisibles?\b`,
    String.raw`\b(?:se voit|se lit|ressort) (?:pas|mal)\b`,
  ].join("|"),
);
