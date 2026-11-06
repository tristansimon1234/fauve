// The work Fauve does in the background (studio_jobs): its steps, as the
// manager reads them in the app's progress pill and as Fauve reports them.

import { DEFAULT_EFFORT, EFFORTS, type Effort } from "./effort.ts";

export type JobKind = "montage" | "text_layer" | "elements" | "carousel" | "effect_words" | "rerender";

export const JOB_STEPS: Record<JobKind, { stage: string; label: string }[]> = {
  montage: [
    { stage: "design", label: "Montage" },
    { stage: "effects", label: "Effet" },
    { stage: "alternative", label: "2e version" },
    { stage: "render", label: "Rendu" },
    { stage: "review", label: "Relecture" },
    { stage: "fix", label: "Correction" },
  ],
  text_layer: [
    { stage: "design", label: "Dessin" },
    { stage: "review", label: "Relecture" },
    { stage: "fix", label: "Correction" },
    { stage: "render", label: "Images finales" },
  ],
  elements: [
    { stage: "design", label: "Dessin" },
    { stage: "review", label: "Relecture" },
    { stage: "fix", label: "Correction" },
    { stage: "render", label: "Images finales" },
  ],
  // The test render of each round is the delivered one: no separate render step.
  carousel: [
    { stage: "design", label: "Composition" },
    { stage: "review", label: "Relecture" },
    { stage: "fix", label: "Correction" },
  ],
  // Her words on an effect: its own script draws it again, then the music goes on it.
  effect_words: [{ stage: "render", label: "Tes mots sur l’effet" }],
  // A video made again from the chat (its music, its voice, its text styles): only its render.
  rerender: [{ stage: "render", label: "Nouvelle version" }],
};

/**
 * A montage's steps as its level runs them (Tristan, the pill still read « Relecture » on a
 * Rapide Reel): a 2nd version only in Max, the review and its correction only when the level
 * reviews, the effect only for an effect.
 */
export function montageJobSteps(o: { effort: Effort | null; kind: "montage" | "correction"; effect: boolean }): { stage: string; label: string }[] {
  const level = EFFORTS[o.effort ?? DEFAULT_EFFORT];
  return JOB_STEPS.montage
    .filter((s) => s.stage !== "effects" || o.effect)
    .filter((s) => s.stage !== "alternative" || (level.versions > 1 && o.kind === "montage"))
    .filter((s) => (s.stage !== "review" && s.stage !== "fix") || level.review)
    .map((s) => (s.stage === "design" && o.kind === "correction" ? { ...s, label: "Correction" } : s));
}

/**
 * Whether a video made again (a re-render: an end card, a veil, a style, its music) is delivered once rendered. Only the
 * latest version of a Reel reaches her (Tristan, 6 November: an end card and a veil asked a minute apart rendered side by
 * side, and two identical « Ton montage … est prêt » came a second apart): never when a newer version of its plan was
 * made while it rendered (`current` false: the newer one renders and delivers itself), when its job was stopped, when a
 * montage runs on the same Reel (it delivers its own version, made from this one), or when another re-render of the
 * same Reel started after it (it holds this change and the next).
 */
export function rerenderDelivers(o: {
  current: boolean;
  mine: { id: string; startedAt: string; finished: boolean } | null;
  /** The other jobs running on the same post. */
  running: { id: string; kind: JobKind; startedAt: string }[];
}): boolean {
  if (!o.current || o.mine?.finished) return false;
  const others = o.running.filter((j) => j.id !== o.mine?.id);
  if (others.some((j) => j.kind === "montage")) return false;
  const since = o.mine ? Date.parse(o.mine.startedAt) : -Infinity;
  return !others.some((j) => j.kind === "rerender" && Date.parse(j.startedAt) >= since);
}

export const JOB_KIND_LABELS: Record<JobKind, string> = {
  montage: "Montage vidéo",
  text_layer: "Texte sur photo",
  elements: "Composants",
  carousel: "Carrousel",
  effect_words: "Texte de l’effet",
  rerender: "Vidéo refaite",
};

/** No news for this long: the work most likely died (a step never takes this long). */
export const JOB_STALE_MINUTES = 12;

export function jobStepLabel(kind: JobKind, stage: string): string {
  // A montage waiting its turn in the queue of a rush (brakes.ts): not one of its steps.
  if (stage === "waiting") return "En file";
  return JOB_STEPS[kind].find((s) => s.stage === stage)?.label ?? stage;
}
