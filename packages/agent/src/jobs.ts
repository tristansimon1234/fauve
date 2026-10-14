// The work Fauve does in the background (studio_jobs): its steps, as the
// manager reads them in the app's progress pill and as Fauve reports them.

export type JobKind = "montage" | "text_layer" | "elements";

export const JOB_STEPS: Record<JobKind, { stage: string; label: string }[]> = {
  montage: [
    { stage: "design", label: "Montage" },
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
};

export const JOB_KIND_LABELS: Record<JobKind, string> = { montage: "Montage vidéo", text_layer: "Texte sur photo", elements: "Composants" };

/** No news for this long: the work most likely died (a step never takes this long). */
export const JOB_STALE_MINUTES = 12;

export function jobStepLabel(kind: JobKind, stage: string): string {
  return JOB_STEPS[kind].find((s) => s.stage === stage)?.label ?? stage;
}
