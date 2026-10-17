import { shotAt, subjectPlace, type MediaFacts } from "./finish.ts";
import { planTimeline, REEL_FPS } from "./motion.ts";
import { MESSAGE_ROW, SUBTITLE_ROW, TEXT_ROWS } from "./retouch.ts";
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

/** A text of the Reel over the composition: when (frames), the rows it takes (px of the 1920-high frame), its words. */
export type TextBand = { de: number; a: number; y_haut: number; y_bas: number; texte: string };

/** Where the Reel's texts sit over the composition and when: no face goes there meanwhile. */
export function textBands(plan: EditPlan): TextBand[] {
  const px = (share: number) => Math.round(share * 1920);
  const bands = plan.texts.map((t) => {
    const row = t.items?.length ? MESSAGE_ROW : TEXT_ROWS[t.style];
    const top = t.y ?? row.y;
    return { de: Math.round(t.from * REEL_FPS), a: Math.round(t.to * REEL_FPS), y_haut: px(top), y_bas: px(Math.min(0.8, top + row.h * (t.scale ?? 1))), texte: t.text };
  });
  if (plan.subtitles) {
    const y = plan.subtitle_y ?? SUBTITLE_ROW.y;
    bands.push({ de: 0, a: Math.round(plan.duration * REEL_FPS), y_haut: px(y - 0.01), y_bas: px(y + SUBTITLE_ROW.h * 1.6), texte: "sous-titres (quand quelqu'un parle)" });
  }
  return bands;
}
