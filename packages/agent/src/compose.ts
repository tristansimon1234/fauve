import { shotAt, subjectPlace, type MediaFacts } from "./finish.ts";
import { endCardSeconds, planTimeline, REEL_FPS, sceneWords, type ComposeEnd, type ComposeText } from "./motion.ts";
import { SUBTITLE_ROW } from "./retouch.ts";
import { isClipSegment, type EditPlan, type PlanLayer } from "./schemas.ts";

// A free collage (Tristan: « je voulais un truc libre pas des options »): no fixed rule
// decides how her shots sit on the paper. One animation over the whole Reel, written by
// the motion designer, composes them (full frame, as prints, cut out, several at once…)
// as it imagines this Reel, or as she asked; the engine lays the paper under it and the
// Reel's texts over it. The fixed collage (every shot a taped print) only plays when its
// code cannot run.

// The same holds for any Reel whose shots are not full frame one after the other (a split
// screen, a shot in a frame…): its composition lays them, and the plain montage plays when its
// code cannot run.

/** The brief of a composition when the editor wrote none: a collage's, or another form's. */
export function compositionBrief(plan: Pick<EditPlan, "texts"> & Partial<Pick<EditPlan, "template">>): string {
  const hook = plan.texts.find((t) => t.style === "hook")?.text;
  const around = hook ? `, autour de son accroche « ${hook} »` : "";
  return plan.template === "collage"
    ? `Le collage de tout le Reel, fait main${around} : ses plans composés à ta façon, chaque moment autrement, jusqu'à la dernière image.`
    : `Tout le Reel composé${around} : ses plans posés à ta façon, dans la forme que demande ce Reel, chaque moment autrement, jusqu'à la dernière image.`;
}

/**
 * A plan's animations over several shots, with its composition first: in a collage, the editor's
 * animation over the whole Reel becomes it, else one is added; in another Reel, the one the editor
 * marked (fromEditorPlan), over [0, duration]. Any other Reel has none.
 */
export function composedLayers(plan: Pick<EditPlan, "template" | "texts" | "layers">, duration: number): PlanLayer[] {
  const layers = plan.layers ?? [];
  // An older ambiance has none (it would cover the shots it plays).
  if (plan.template !== "collage" && (plan.template !== "libre" || !layers.some((l) => l.compose))) return layers.filter((l) => !l.compose);
  const spans = (l: PlanLayer) => l.from <= 0.5 && l.to >= duration - 0.5;
  const chosen = layers.find((l) => l.compose) ?? layers.find(spans);
  const others = layers.filter((l) => l !== chosen).map(({ compose: _compose, ...l }) => l);
  return [{ ...(chosen ?? { motion: { brief: compositionBrief(plan) } }), from: 0, to: duration, compose: true }, ...others].slice(0, 3);
}

/** A plan composed by its own animation, a collage or another form (its texts and subtitles keep their usual rows). */
export const isComposed = (plan: Pick<EditPlan, "layers">) => Boolean(plan.layers?.some((l) => l.compose));

/**
 * The shots a plan's composition lays, as its code reads them (shots[0], shots[1]…): the clip of each of her shots that
 * starts before the composition ends, in the montage's order (buildReelProps lists them the same way); null without one.
 */
export function composedShots(plan: Pick<EditPlan, "segments" | "layers" | "transitions">): string[] | null {
  const layer = plan.layers?.find((l) => l.compose);
  if (!layer) return null;
  const spans = planTimeline(plan).segments;
  return plan.segments.flatMap((s, i) => (isClipSegment(s) && (spans[i]?.start ?? 0) < layer.to - 0.01 ? [s.clip_id] : []));
}

/**
 * A composition's code names her shots by their index (« the lamp of shots[2] »): it fits a plan only when it lays the
 * same clips in the same order (each one trimmed as the plan wants: its code reads each shot's moment and length).
 * A shot split, added, removed or moved changes what each index shows: the code no longer fits (Novembre, version
 * cocon: three shots re-cut into five, the lamp lit on the candle). A plan without composition fits nothing.
 */
export function sameComposedShots(a: Pick<EditPlan, "segments" | "layers" | "transitions">, b: Pick<EditPlan, "segments" | "layers" | "transitions">): boolean {
  const x = composedShots(a);
  const y = composedShots(b);
  return Boolean(x && y && x.length === y.length && x.every((id, i) => id === y[i]));
}

/**
 * A composition's code that names one of her shots by its number (shots[2], <Footage shot={0} />, Subject shot: 2):
 * what it does on that shot belongs to the clip it was written for. One that only reads them as they come (shots[cur],
 * shots.map) lays any shots: a correction that changes them keeps it as it is (keepComposition).
 */
export const namesShotsByIndex = (js: string | undefined) => Boolean(js && /\bshots\s*\[\s*\d+\s*\]|\bshot\s*[:=]\s*\{?\s*\d+\s*\}?\s*[,}\s]/.test(js));

/** The version corrected had a composition whose code names her shots by number, and the new plan lays other shots under it. */
export function composedShotsMoved(plan: EditPlan, previous: EditPlan | null): boolean {
  const earlier = previous?.layers?.find((l) => l.compose && l.motion.js);
  return Boolean(earlier && previous && !plan.skill && isComposed(plan) && namesShotsByIndex(earlier.motion.js) && !sameComposedShots(plan, previous));
}

/**
 * A plan whose composition carries code written for other shots (a correction that kept the earlier version's code,
 * its brief unchanged, while the editor re-cut the Reel): that code is taken off, so the composition is written again
 * for the new shots, never played over them (Tristan: « à mon avis la tâche est un effet mal appliqué »). Its code is
 * known to fit when it says the shots it was written for (`laid`), or when it is the code of the version corrected,
 * whose shots it laid. Code that never names a shot by its number, and a model's composition (a montage skill), read
 * any number of shots: left alone.
 */
export function withoutStaleComposition(plan: EditPlan, previous: EditPlan | null): EditPlan {
  if (plan.skill || !plan.layers?.some((l) => l.compose && l.motion.js)) return plan;
  const now = composedShots(plan) ?? [];
  const fits = (motion: PlanLayer["motion"]) => {
    if (!namesShotsByIndex(motion.js)) return true;
    if (motion.laid) return motion.laid.length === now.length && motion.laid.every((id, i) => id === now[i]);
    const earlier = previous?.layers?.find((l) => l.compose && l.motion.js);
    // Code that is not the earlier version's: written for this plan.
    if (!earlier || earlier.motion.js !== motion.js) return true;
    return sameComposedShots(plan, previous!);
  };
  let changed = false;
  const layers = plan.layers.map((l) => {
    if (!l.compose || !l.motion.js || fits(l.motion)) return l;
    changed = true;
    const { code: _code, js: _js, laid: _laid, template_id: _id, sounds: _sounds, photos: _photos, fonts: _fonts, subtitle_y: _row, writes_spoken: _spoken, ...motion } = l.motion;
    return { ...l, motion };
  });
  return changed ? { ...plan, layers } : plan;
}

/** One of her shots as the composition's designer reads it: when it plays (frames from the start), what it is and shows. */
export type CompositionShot = {
  shot: number;
  from: number;
  to: number;
  kind: "video" | "photo";
  shows: string;
  format: "portrait" | "landscape" | "square";
  subject_at?: "left" | "centre" | "right";
  faces?: boolean;
  /** A photo whose subject cuts out cleanly (Cutout can lift it). */
  cut_out?: boolean;
};

const formatOf = (aspect: number | undefined): CompositionShot["format"] => (!aspect ? "portrait" : aspect > 1.1 ? "landscape" : aspect < 0.9 ? "portrait" : "square");
const SIDES = { gauche: "left", centre: "centre", droite: "right" } as const;

/**
 * The shots a collage's composition lays, in the order of the montage (its shots[i]):
 * videos and photos only (an animation of the plan plays above the composition).
 * `shows`: what each photo shows (its reading); `cutouts`: the photos cut out cleanly.
 */
export function compositionShots(plan: EditPlan, facts: MediaFacts, shows: Record<string, string> = {}, cutouts: Set<string> = new Set()): CompositionShot[] {
  const timeline = planTimeline(plan);
  const shots: CompositionShot[] = [];
  plan.segments.forEach((s, i) => {
    if (!isClipSegment(s)) return;
    const at = timeline.segments[i]!;
    const span = { from: Math.round(at.start * REEL_FPS), to: Math.round((at.start + at.length) * REEL_FPS) };
    const photo = facts.photos[s.clip_id];
    if (photo) {
      shots.push({
        shot: shots.length,
        ...span,
        kind: "photo",
        shows: (shows[s.clip_id] ?? photo.detection.notes ?? "a photo of the business").slice(0, 200),
        format: formatOf(photo.width / photo.height),
        ...(photo.detection.regions.some((r) => r.kind === "face") ? { faces: true } : {}),
        ...(cutouts.has(s.clip_id) ? { cut_out: true } : {}),
      });
      return;
    }
    const analysis = facts.clips[s.clip_id];
    const shot = analysis ? shotAt(analysis, (s.in + s.out) / 2) : undefined;
    const place = subjectPlace(shot?.subject_box);
    shots.push({
      shot: shots.length,
      ...span,
      kind: "video",
      shows: (shot ? `${shot.description} (${shot.subject})` : (analysis?.summary ?? "a video of the business")).slice(0, 200),
      format: analysis?.orientation === "landscape" ? "landscape" : analysis?.orientation === "square" ? "square" : "portrait",
      ...(place ? { subject_at: SIDES[place] } : {}),
      ...(shot?.faces_visible ? { faces: true } : {}),
    });
  });
  return shots;
}

/**
 * What a collage's composition draws besides her shots (Tristan, on the paper, the cut words and the
 * tape the engine laid around them: « tout ça n'est pas assez libre ») : the Reel's texts, each one at
 * its moment (frames from the start), as its code gets them (reelTexts), and its end (an offer, an
 * announcement). Subtitles stay the engine's: the band they take, when a voice speaks.
 */
export type CompositionTexts = { texts: ComposeText[]; end: ComposeEnd | null; subtitles: { y_top: number; y_bottom: number } | null };
export function compositionTexts(plan: EditPlan): CompositionTexts {
  const frames = (s: number) => Math.round(s * REEL_FPS);
  const px = (share: number) => Math.round(share * 1920);
  // Where the render sets them: the row a composition chose (a skill timed on her voice sets its own), else the plan's.
  const y = plan.layers?.find((l) => l.compose)?.motion.subtitle_y ?? plan.subtitle_y ?? SUBTITLE_ROW.y;
  // The engine's screens (a title card) are the composition's to draw too, at their moment (buildReelProps does the same).
  const timeline = planTimeline(plan).segments;
  const screens = plan.segments.flatMap((s, i) => {
    const at = timeline[i];
    if (!("scene" in s) || !at) return [];
    return sceneWords(s.scene).map((w) => ({ text: w.text, role: w.role, from: frames(at.start), to: frames(at.start + at.length), emphasis: [] as string[] }));
  });
  return {
    texts: [
      ...plan.texts.map((t) => ({
        text: t.text,
        role: t.style,
        from: frames(t.from),
        to: frames(t.to),
        emphasis: t.emphasis ?? [],
        ...(t.items?.length ? { items: t.items } : {}),
        // A font its filler picked for what its words evoke: the check lays it out in it, as the render does.
        ...(t.font ? { font: t.font } : {}),
      })),
      ...screens,
    ].sort((a, b) => a.from - b.from),
    end: plan.end_card ? { title: plan.end_card.title, subtitle: plan.end_card.subtitle ?? null, from: Math.max(0, frames(plan.duration - endCardSeconds(plan))) } : null,
    subtitles: plan.subtitles ? { y_top: px(y - 0.01), y_bottom: px(y + SUBTITLE_ROW.h * 1.6) } : null,
  };
}
