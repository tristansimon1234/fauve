import { shiftMusicShape } from "./music-shape.ts";
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
 * when it can), the texts, the logo, the animations, its sounds and its music's shape come that much later, and a
 * composition over the whole Reel starts then, its first image held meanwhile (hold_first). The editor's plans get
 * their lead from the tempo grid instead (beat_at in snapToTempo).
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
  // A shot laid beside another starts on its own moment: that much later too (one beside the first shot shows its first image when the composition starts).
  const moved = rest.map((s) => (isClipSegment(s) && s.beside ? { ...s, beside: { at: round(s.beside.at + lead) } } : s));
  return {
    ...plan,
    duration: round(plan.duration + lead),
    beat_at: lead,
    segments: [longer, ...moved] as EditPlan["segments"],
    texts: plan.texts.map(later),
    images: plan.images.map(later),
    ...(plan.layers ? { layers: plan.layers.map((l) => ({ ...later(l), ...(l.compose && l.from <= 0 ? { hold_first: true } : {}) })) } : {}),
    ...laterAudio(plan, lead),
  };
}

/** A plan's sounds and its music's shape `lead` seconds later (a plan held on its first image). */
export function laterAudio(audio: Pick<EditPlan, "sounds" | "music_shape">, lead: number): Pick<EditPlan, "sounds" | "music_shape"> {
  return {
    ...(audio.sounds ? { sounds: audio.sounds.map((s) => ({ ...s, at: round(s.at + lead) })) } : {}),
    ...(audio.music_shape ? { music_shape: shiftMusicShape(audio.music_shape, lead) } : {}),
  };
}

/**
 * What the delivery says of a Reel left silent for her to add its sound in Instagram (the sound she gave, or the one of
 * the Reel she copies): one short sentence, the button under it opening its page, where « Utiliser l'audio » is shown
 * step by step with the link to its Reel (Tristan, 6 November: the delivery carried the whole how-to, against « un user
 * aura la flemme de tout lire »). On a Business account, Instagram may not offer it: « mets ta musique » in the same sentence.
 */
export function addedSoundLine(sound: { business: boolean | null; followed?: boolean }): string {
  const what = sound.followed ? "le son que tu m'as donné" : "le son du Reel que tu recopies";
  return `Sans musique : ajoute ${what} en la publiant, sa page montre comment${sound.business ? " (sinon, dis-moi « mets ta musique »)" : ""}.`;
}
