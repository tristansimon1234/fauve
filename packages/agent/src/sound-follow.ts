import { isClipSegment, type EditPlan } from "./schemas.ts";

// Following a sound she gives by a link (Tristan: « comment faire pour que Edith puisse caler un son sur une idée du
// user, « je veux caler sur la musique de Bad Bunny » ? »): the song cannot be in the video (its rights are Instagram's),
// so the Reel comes out silent, cut on its beats, and she adds it herself with « Utiliser l'audio » on that Reel, which
// plays it from the same start. Its tempo and its first beat are measured on the link (tempoOf, beatGrid).

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;

/** The tempo a Reel plays at to follow a sound: its own, halved or doubled, within 60 to 140, the closest to the one wanted. */
export function soundTempo(soundBpm: number, near: number): number {
  const options = [soundBpm / 2, soundBpm, soundBpm * 2].filter((b) => b >= 60 && b <= 140);
  if (!options.length) return round(Math.min(140, Math.max(60, soundBpm)), 2);
  const best = options.reduce((a, b) => (Math.abs(Math.log(b / near)) < Math.abs(Math.log(a / near)) ? b : a));
  return round(best, 2);
}

/** How long the Reel's first image is held before its cuts follow the sound (s): when its first beat falls, within one of the Reel's beats. */
export function soundLead(offset: number, bpm: number): number {
  const beat = 60 / bpm;
  const lead = ((offset % beat) + beat) % beat;
  // Under a frame, or a frame from a whole beat: none (a cut a frame early is not seen).
  return lead < 1 / 30 || beat - lead < 1 / 30 ? 0 : round(lead);
}

/**
 * A plan written from 0 (a montage skill's), held `lead` seconds on its first image, every later moment as late: its
 * cuts then fall on the beats of the sound she follows. The first shot lasts that much longer (its video from earlier
 * when it can), the texts, the logo and the animations come that much later, and a composition over the whole Reel
 * starts then, its first image held meanwhile (hold_first). The editor's plans get their lead from the tempo grid
 * instead (beat_at in snapToTempo).
 */
export function leadPlan(plan: EditPlan, lead: number): EditPlan {
  if (!(lead > 0) || !plan.segments.length || plan.beat_at) return plan;
  const [first, ...rest] = plan.segments;
  const longer = isClipSegment(first!)
    ? (() => {
        const speed = first.speed ?? 1;
        const back = Math.min(first.in, lead * speed);
        return { ...first, in: round(first.in - back), out: round(first.out + (lead * speed - back)) };
      })()
    : "duration" in first! && typeof first.duration === "number"
      ? { ...first, duration: round(first.duration + lead) }
      : first!;
  const later = <T extends { from: number; to: number }>(t: T): T => ({ ...t, from: round(t.from + lead), to: round(t.to + lead) });
  return {
    ...plan,
    duration: round(plan.duration + lead),
    beat_at: lead,
    segments: [longer, ...rest] as EditPlan["segments"],
    texts: plan.texts.map(later),
    images: plan.images.map(later),
    ...(plan.layers ? { layers: plan.layers.map((l) => ({ ...later(l), ...(l.compose && l.from <= 0 ? { hold_first: true } : {}) })) } : {}),
  };
}
