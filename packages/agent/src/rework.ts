import type { GestureMoment } from "./critic.ts";
import { planTimeline } from "./motion.ts";
import { isClipSegment, isMotionSegment, type EditPlan } from "./schemas.ts";

// An animation a correction rewrites looks at its earlier render first, as a motion designer looks
// at their render before fixing it (Opus in the chat, on Tristan's fingers: « le premier essai
// mettait le texte trop gros et coupé », fixed before delivering). Written blind, the « -20 % »
// that had to grow between his fingers came back the same size after a correction.

/** The most images of its earlier render an animation reworked looks at. */
export const MAX_EARLIER_FRAMES = 6;

/** The most images of the Reel an animation sees before it is written: across the whole Reel, and across its own moment. */
export const CANVAS_REEL_FRAMES = 16;
export const CANVAS_MOMENT_FRAMES = 10;

type Span = { from: number; to: number; code?: string };

/** Each animation's span on its Reel's clock, by the motion designer's id (s<i>: a scene, l<i>: a layer). */
function animationSpans(plan: EditPlan): Map<string, Span> {
  const timeline = planTimeline(plan);
  const spans = new Map<string, Span>();
  plan.segments.forEach((s, i) => {
    const at = timeline.segments[i];
    if (isMotionSegment(s) && at) spans.set(`s${i}`, { from: at.start, to: at.start + at.length, code: s.motion.code });
  });
  (plan.layers ?? []).forEach((l, i) => spans.set(`l${i}`, { from: l.from, to: Math.min(l.to, timeline.duration), code: l.motion.code }));
  return spans;
}

/**
 * For each animation a correction rewrites (`ids`: the motion designer's ids in the new plan),
 * the earlier animation it reworks (the one of the version corrected that covered most of its
 * time, its code kept) and the instants of that version to look at: its start, the gestures that
 * played under it (`gestures`, on the earlier version's clock), its middle and its end. Each
 * instant is told on the animation's own frames.
 */
export function earlierLooks(
  previous: EditPlan,
  plan: EditPlan,
  ids: string[],
  gestures: GestureMoment[] = [],
): Map<string, { code: string; times: { t: number; label: string }[] }> {
  const before = [...animationSpans(previous).values()].filter((a): a is Span & { code: string } => Boolean(a.code));
  const now = animationSpans(plan);
  const looks = new Map<string, { code: string; times: { t: number; label: string }[] }>();
  const round = (t: number) => Math.round(t * 100) / 100;
  for (const id of ids) {
    const span = now.get(id);
    if (!span) continue;
    const overlap = (a: Span) => Math.max(0, Math.min(a.to, span.to) - Math.max(a.from, span.from));
    const match = before.map((a) => ({ a, shared: overlap(a) })).sort((x, y) => y.shared - x.shared)[0];
    if (!match || match.shared < 0.4 * Math.min(span.to - span.from, match.a.to - match.a.from)) continue;
    const { from, to, code } = match.a;
    const first = { t: round(from + Math.min(0.2, (to - from) / 4)), label: "its start" };
    const last = { t: round(Math.max(from, to - 0.35)), label: "its end" };
    const inside = [
      ...gestures.filter((g) => g.t > first.t + 0.2 && g.t < last.t - 0.2).map((g) => ({ t: round(g.t), label: `during a gesture: ${g.what}` })),
      { t: round((from + to) / 2), label: "its middle" },
    ]
      .sort((x, y) => x.t - y.t)
      .filter((x, k, list) => k === 0 || x.t - list[k - 1]!.t >= 0.25);
    // Its start and its end, and in between the gestures and its middle, spread when there are too many.
    const room = MAX_EARLIER_FRAMES - 2;
    const kept = inside.length <= room ? inside : Array.from({ length: room }, (_, k) => inside[Math.round((k * (inside.length - 1)) / (room - 1))]!);
    const times = [first, ...kept, last]
      .filter((x, k, list) => k === 0 || x.t - list[k - 1]!.t >= 0.15)
      .map((x) => ({ t: x.t, label: `frame ${Math.max(0, Math.round((x.t - from) * 30))} of your animation (${x.label})` }));
    looks.set(id, { code, times });
  }
  return looks;
}

/**
 * What the motion designer sees of its Reel before writing each animation (`ids`), the Reel drawn without the animations
 * being written (Tristan: « il devrait voir la vidéo complètement »; written blind, a florist's chat card hid her smile):
 * an image a second across the whole Reel (spread when it is longer), then, closer together, across the animation's own
 * moment, told on its own frames; the moment of another animation being written says so. A composition of the whole
 * Reel sees the Reel only, each image saying which of its shots shows (numbered as it knows them).
 */
export function canvasMoments(plan: EditPlan, ids: string[]): Map<string, { t: number; label: string }[]> {
  const spans = animationSpans(plan);
  const timeline = planTimeline(plan);
  const round = (t: number) => Math.round(t * 100) / 100;
  const at = (t: number) => `${t.toFixed(1)} s`;
  const count = Math.min(CANVAS_REEL_FRAMES, Math.max(1, Math.floor(timeline.duration)));
  const across = Array.from({ length: count }, (_, k) => round(((k + 0.5) * timeline.duration) / count));
  // The shot that shows at an instant, by its rank among her shots (a composition's shots[i]).
  const shotAt = (t: number) => {
    let rank = -1;
    for (const [i, s] of plan.segments.entries()) {
      if (isClipSegment(s)) rank += 1;
      const span = timeline.segments[i]!;
      if (t >= span.start && t < span.start + span.length) return isClipSegment(s) ? rank : null;
    }
    return null;
  };
  const looks = new Map<string, { t: number; label: string }[]>();
  for (const id of ids) {
    const span = spans.get(id);
    if (!span || span.to - span.from < 0.3) continue;
    if (id.startsWith("l") && plan.layers?.[Number(id.slice(1))]?.compose) {
      looks.set(
        id,
        across.map((t) => {
          const shot = shotAt(t);
          return { t, label: shot === null ? at(t) : `${at(t)} · shot ${shot}` };
        }),
      );
      continue;
    }
    const { from, to } = span;
    const length = to - from;
    // Its own moment, an image every 0.3 s or so, its edges a little in.
    const own = Math.min(CANVAS_MOMENT_FRAMES, Math.max(2, Math.round(length / 0.3)));
    const mine = Array.from({ length: own }, (_, k) => round(from + 0.1 + (k * (length - 0.2)) / (own - 1)));
    const another = (t: number) => ids.some((other) => other !== id && spans.has(other) && t >= spans.get(other)!.from && t < spans.get(other)!.to);
    looks.set(
      id,
      [
        ...across.filter((t) => t < from || t >= to).map((t) => ({ t, label: another(t) ? `${at(t)} · another animation of the Reel will play here` : at(t) })),
        ...mine.map((t) => ({ t, label: `${at(t)} · frame ${Math.max(0, Math.round((t - from) * 30))} of your animation` })),
      ].sort((a, b) => a.t - b.t),
    );
  }
  return looks;
}
