import { shotAt, subjectPlace, type MediaFacts } from "./finish.ts";
import { END_CARD_SECONDS } from "./editor.ts";
import { planTimeline, REEL_FPS, type ComposeEnd, type ComposeText } from "./motion.ts";
import { SUBTITLE_ROW } from "./retouch.ts";
import { isClipSegment, type EditPlan, type PlanLayer } from "./schemas.ts";

// A free collage (Tristan: « je voulais un truc libre pas des options »): no fixed rule
// decides how her shots sit on the paper. One animation over the whole Reel, written by
// the motion designer, composes them (full frame, as prints, cut out, several at once…)
// as it imagines this Reel, or as she asked; the engine lays the paper under it and the
// Reel's texts over it. The fixed collage (every shot a taped print) only plays when its
// code cannot run.

/** The brief of a collage's composition when the editor wrote none. */
export function compositionBrief(plan: Pick<EditPlan, "texts">): string {
  const hook = plan.texts.find((t) => t.style === "hook")?.text;
  return `Le collage de tout le Reel, fait main${hook ? `, autour de son accroche « ${hook} »` : ""} : ses plans composés à ta façon, chaque moment autrement, jusqu'à la dernière image.`;
}

/**
 * A plan's animations over several shots, with a collage's composition first: the editor's
 * animation over the whole Reel becomes it, else one is added, over [0, duration]. Another
 * ambiance has none (it would cover the shots it plays).
 */
export function composedLayers(plan: Pick<EditPlan, "template" | "texts" | "layers">, duration: number): PlanLayer[] {
  const layers = plan.layers ?? [];
  if (plan.template !== "collage") return layers.filter((l) => !l.compose);
  const spans = (l: PlanLayer) => l.from <= 0.5 && l.to >= duration - 0.5;
  const chosen = layers.find((l) => l.compose) ?? layers.find(spans);
  const others = layers.filter((l) => l !== chosen).map(({ compose: _compose, ...l }) => l);
  return [{ ...(chosen ?? { motion: { brief: compositionBrief(plan) } }), from: 0, to: duration, compose: true }, ...others].slice(0, 3);
}

/** A plan whose collage is composed by its own animation (its texts and subtitles keep their usual rows). */
export const isComposed = (plan: Pick<EditPlan, "layers">) => Boolean(plan.layers?.some((l) => l.compose));

/** One of her shots as the composition's designer reads it: when it plays (frames from the start), what it is and shows. */
export type CompositionShot = {
  shot: number;
  de: number;
  a: number;
  type: "vidéo" | "photo";
  montre: string;
  format: "portrait" | "paysage" | "carré";
  sujet_a?: "gauche" | "centre" | "droite";
  visages?: boolean;
  /** A photo whose subject cuts out cleanly (Cutout can lift it). */
  detouree?: boolean;
};

const formatOf = (aspect: number | undefined): CompositionShot["format"] => (!aspect ? "portrait" : aspect > 1.1 ? "paysage" : aspect < 0.9 ? "portrait" : "carré");

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
    const span = { de: Math.round(at.start * REEL_FPS), a: Math.round((at.start + at.length) * REEL_FPS) };
    const photo = facts.photos[s.clip_id];
    if (photo) {
      shots.push({
        shot: shots.length,
        ...span,
        type: "photo",
        montre: (shows[s.clip_id] ?? photo.detection.notes ?? "une photo du commerce").slice(0, 200),
        format: formatOf(photo.width / photo.height),
        ...(photo.detection.regions.some((r) => r.kind === "face") ? { visages: true } : {}),
        ...(cutouts.has(s.clip_id) ? { detouree: true } : {}),
      });
      return;
    }
    const analysis = facts.clips[s.clip_id];
    const shot = analysis ? shotAt(analysis, (s.in + s.out) / 2) : undefined;
    const place = subjectPlace(shot?.subject_box);
    shots.push({
      shot: shots.length,
      ...span,
      type: "vidéo",
      montre: (shot ? `${shot.description} (${shot.subject})` : (analysis?.summary ?? "une vidéo du commerce")).slice(0, 200),
      format: analysis?.orientation === "landscape" ? "paysage" : analysis?.orientation === "square" ? "carré" : "portrait",
      ...(place ? { sujet_a: place } : {}),
      ...(shot?.faces_visible ? { visages: true } : {}),
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
export type CompositionTexts = { texts: ComposeText[]; end: ComposeEnd | null; subtitles: { y_haut: number; y_bas: number } | null };
export function compositionTexts(plan: EditPlan): CompositionTexts {
  const frames = (s: number) => Math.round(s * REEL_FPS);
  const px = (share: number) => Math.round(share * 1920);
  const y = plan.subtitle_y ?? SUBTITLE_ROW.y;
  return {
    texts: plan.texts.map((t) => ({
      text: t.text,
      role: t.style,
      from: frames(t.from),
      to: frames(t.to),
      emphasis: t.emphasis ?? [],
      ...(t.items?.length ? { items: t.items } : {}),
    })),
    end: plan.end_card ? { title: plan.end_card.title, subtitle: plan.end_card.subtitle ?? null, from: Math.max(0, frames(plan.duration - END_CARD_SECONDS)) } : null,
    subtitles: plan.subtitles ? { y_haut: px(y - 0.01), y_bas: px(y + SUBTITLE_ROW.h * 1.6) } : null,
  };
}
