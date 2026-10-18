import type { GestureMoment } from "./critic.ts";
import { planTimeline } from "./motion.ts";
import { isMotionSegment, type EditPlan } from "./schemas.ts";

// An animation a correction rewrites looks at its earlier render first, as a motion designer looks
// at their render before fixing it (Opus in the chat, on Tristan's fingers: « le premier essai
// mettait le texte trop gros et coupé », fixed before delivering). Written blind, the « -20 % »
// that had to grow between his fingers came back the same size after a correction.

/** The most images of its earlier render an animation reworked looks at. */
export const MAX_EARLIER_FRAMES = 6;

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
    const first = { t: round(from + Math.min(0.2, (to - from) / 4)), label: "son début" };
    const last = { t: round(Math.max(from, to - 0.35)), label: "sa fin" };
    const inside = [
      ...gestures.filter((g) => g.t > first.t + 0.2 && g.t < last.t - 0.2).map((g) => ({ t: round(g.t), label: `pendant un geste : ${g.what}` })),
      { t: round((from + to) / 2), label: "son milieu" },
    ]
      .sort((x, y) => x.t - y.t)
      .filter((x, k, list) => k === 0 || x.t - list[k - 1]!.t >= 0.25);
    // Its start and its end, and in between the gestures and its middle, spread when there are too many.
    const room = MAX_EARLIER_FRAMES - 2;
    const kept = inside.length <= room ? inside : Array.from({ length: room }, (_, k) => inside[Math.round((k * (inside.length - 1)) / (room - 1))]!);
    const times = [first, ...kept, last]
      .filter((x, k, list) => k === 0 || x.t - list[k - 1]!.t >= 0.15)
      .map((x) => ({ t: x.t, label: `image ${Math.max(0, Math.round((x.t - from) * 30))} de ton animation (${x.label})` }));
    looks.set(id, { code, times });
  }
  return looks;
}
