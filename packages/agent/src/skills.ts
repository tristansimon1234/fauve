import { z } from "zod";
import type { ReelLook } from "./looks.ts";
import { REEL_FPS } from "./motion.ts";
import { readMusicShape, type MusicShape } from "./music-shape.ts";
import type { EditPlan, PlanSegment, SfxCue } from "./schemas.ts";
import { soundSeconds } from "./sfx.ts";
import { laterAudio } from "./sound-follow.ts";

// Montage skills (Tristan: « edith pourrait choisir d'adapter ces modèles comme une librairie de "skills de montage" »,
// « sur Edits d'Insta tu as des modèles où le texte est préposé et les photos et vidéos n'ont qu'à être changées »):
// one of Edith's models coded once for the whole Reel, like an Edits or CapCut template. Its shots are slots timed on
// its music, its texts are placed (where, how big, how they appear, when), its signature moment and its ending are in
// its code. Using it is filling it: which of her files plays in each slot, from where, and her words in its text slots,
// written by one small call (Sonnet), the plan built here by code; the engine plays its composition as it is, checked
// like any composition, with no editor nor motion designer. A request it does not serve goes to the editor, whose
// motion designer starts from its code and changes only what her request needs. The skills themselves (their timeline
// and their code) are in skills/, server side only (@fauve/agent/skills).

/** One of its texts: what the filler writes in it and where its code finds it among the Reel's texts (by role, in order). */
export type SkillText = {
  slot: string;
  role: "hook" | "band" | "caption";
  /** What it says, for the filler (in French, as Tristan reads it too). */
  want: string;
  /** The most characters it holds where its code lays it. */
  max: number;
  required: boolean;
};

/** One of its shots for n shots: its span (seconds from the start) and what it wants (for the filler). */
export type SkillShot = { start: number; end: number; want: string };

/**
 * One of its sounds, its original's own as its fiche measures them (a key click on each typed letter, a whoosh up to the
 * drop, a shutter on each flash): what it is (a short generic description in English, the sound library's key with its
 * length: « light click », « camera shutter »), when its loudest moment lands (s, on the Reel's clock: a whoosh that builds
 * starts before), its length (0,5 to 3 s), how loud (dB from the Reel's level of sound effects, −24 to +6; its peak capped).
 */
export type SkillSound = { at: number; sound: string; seconds?: number; gain?: number };

export type SkillTimeline = {
  /** The Reel's length (s). */
  duration: number;
  shots: SkillShot[];
  /** When each of its texts shows (s), by slot. */
  texts: Record<string, { from: number; to: number }>;
  /** What its code reads besides the Reel's texts and shots (its sections, in frames): given as the composition's slot texts. */
  marks: Record<string, number>;
  /**
   * Its sounds, played on their own moments as the model plays them (plan.sounds, `skill`: never moved onto a cut, all
   * kept one frame apart at least, unless her sound effects are off); made once by the sound library and mixed after the render.
   */
  sounds?: SkillSound[];
  /**
   * How its music is shaped, on the Reel's clock from its beats (music-shape.ts): where it stops dead and comes back on a
   * downbeat, where it plays muffled and when it opens, where it ends (cut dead, or faded), or no music at all (`none`).
   * Applied by the mix to whatever music the Reel gets (plan.music_shape).
   */
  music?: MusicShape;
};

/**
 * A setting of a skill that her words can ask (Tristan: « on peut se dire qu'il faut plus de cases ? »), like the
 * variants of an Edits or CapCut template: the filler picks a choice only when her request asks for what it does, its
 * code reads it by name (setting(name, default)) and its timeline gets it (options.settings). Its first choice is the
 * default, the original's.
 */
export type SkillSetting = {
  /** Read by its code and its timeline (« cases »). */
  name: string;
  /** What it changes, in French, for the filler and Edith. */
  want: string;
  /** Its values, the default first: each one's value and what it looks like, in French. */
  choices: { value: string; says: string }[];
};

/**
 * Something in one of its shots its code lights up, cuts out or follows (her sign, her windows, her lamps: Tristan,
 * « enseigne, fenêtre, image qui a de quoi faire un effet stylé »): the filler names it as the eye sees it in the file it
 * casts there, from what that file shows; its code writes it « @slot » where it names an object (Subject object,
 * SubjectParts…), replaced by that name, or left as is when nothing in her shot fits (no object then: the code does
 * without).
 */
export type SkillObject = {
  slot: string;
  /** The shot it is in (its index in the timeline's shots): the filler names it from the file cast there. */
  shot: number;
  /** What to look for there, in French for the filler: what can carry the effect, by kind. */
  want: string;
};

export type MontageSkill = {
  /** The house model it plays (house-models.ts). */
  key: string;
  /** Raised whenever its code or its timeline changes: a correction of a Reel made with an older version still plays it. */
  version: number;
  /** Its tempo (60 to 140): its cuts fall on its beats, its music is composed at it. */
  bpm: number;
  /** Its shots: at least, at most (passages of her files; a video can give several, from moments that look different). */
  shots: [number, number];
  /** Her distinct files: below the first, Edith asks her first whether she has more; past the second, the best are kept. */
  files: [number, number];
  /** How it goes, in a sentence for the filler (French). */
  how: string;
  texts: SkillText[];
  /** Whether its code draws an ending card (an offer, an announcement) when the Reel has one. */
  end: boolean;
  /**
   * For n shots: its length, each shot's span and want, its texts' moments and its code's marks, its sounds and its
   * music's shape; `bpm`, at another tempo than its own (a longer or shorter Reel, a music's tempo): every length it
   * counts in beats follows it; `words`, her words by slot when they are written (the plan's): what its sounds follow
   * (a key click on each letter of her name as its code types it), never its lengths.
   */
  timeline(n: number, options: { end: boolean; bpm?: number; settings?: Record<string, string>; words?: Record<string, string> }): SkillTimeline;
  /** The tempos it plays at (default: from 0,7 to 1,2 times its own, within 60 to 140). */
  tempo?: [number, number];
  /** What her words can change in it, as a template's variants (its grid, its pace, its order, its colour). */
  settings?: SkillSetting[];
  /** What it lights up or cuts out in her shots (her sign, her windows), named by the filler from what each file shows. */
  objects?: SkillObject[];
  /** What the filler needs measured on her files before it casts them (read once per file, then kept): its slots want a real whip, a covered lens, colour, a gesture. */
  reads?: SkillReads;
  /**
   * The most shots it takes for a length she asks for, past `shots[1]` (the most it takes from her files alone): a model
   * whose middle can repeat (more full frames after a title, more of the place's life, more of the day) reaches 30 s at
   * its own tempo, like a verse added to a song, its opening and its ending as they are (Tristan: « si un modèle fait
   * 10 secondes mais qu'elle veut un Reel de 30 ? »). Its timeline takes any count up to it.
   */
  long?: number;
  /** Its composition over the whole Reel: plain JS defining function Scene (h = React.createElement, no JSX), the kit's scope. */
  code: string;
  /** Google Fonts families its code brings besides the Reel's two. */
  fonts?: string[];
  /**
   * What its code does itself, taken out of its model's finish (laid over the whole Reel, its composition too): « Montage
   * sport noir et blanc » draws its own black and white with its red over it, so its finish keeps only its contrast,
   * grain and vignette (saturation 0), else its red came out grey; « Quart de tour, deux tons » draws its two tones and
   * its colour shots, so none of its model's exposure, saturation or split toning stays (split 0).
   */
  finish?: Partial<Pick<ReelLook, "exposure" | "saturation" | "contrast" | "warmth" | "split" | "grain" | "vignette" | "fade">>;
};

/** One of her files, as a skill uses it. */
export type SkillFile = {
  id: string;
  photo: boolean;
  /** A video's length (s); a photo: 0. */
  seconds: number;
  /** What it shows (its reading). */
  shows?: string;
  /** A video's passages worth showing, best first. */
  moments?: { start: number; end: number; what?: string }[];
  /**
   * Its shape (width / height), when known: the filler sees whether it is vertical, horizontal or square, so a slot laid
   * in a box of another shape (a tall half of a split screen) gets a file of its shape, or a passage with its subject in
   * the middle (« Écran partagé titré »: a 16:9 video keeps 38 % of its width in a 2:3 half).
   */
  aspect?: number;
  /**
   * What was measured on it (video_read.py, her tracks), when a model asks or it was read before: its camera's fast moves
   * (« Ville en coups de fouet »: a whip slot gets her real whip), the moments something passes before its lens (« Une
   * journée chez toi »: its cut hidden there), how colourful it is (« Quart de tour, deux tons »: its slots in colour), what
   * the hands and heads in it do (« Silhouette »: her head lowered, raised); in seconds of the file, words in French.
   */
  measured?: {
    moves?: { start: number; end: number; what: string }[];
    covered?: { start: number; end: number; what: string }[];
    gestures?: { start: number; end: number; what: string }[];
    colour?: { score: number; words: string; best?: { start: number; end: number } };
  };
};

/** What a model's filler wants measured on her files before it fills (her camera's fast moves, her lens covered, her colours, her gestures). */
export type SkillReads = ("moves" | "covered" | "colour" | "gestures")[];

/** A fast move of her camera in the filler's words (French). */
export function moveWords(m: { kind: string; towards: string; speed: number; from: number; to: number }): string {
  const way = { left: "vers la gauche", right: "vers la droite", up: "vers le haut", down: "vers le bas", in: "en avant", out: "en arrière" }[m.towards] ?? "";
  const pace = `${Math.round(m.speed * 100)} % de l'image par image`;
  const length = `${Math.round((m.to - m.from) * 10) / 10} s`.replace(".", ",");
  switch (m.kind) {
    case "whip":
      return `un fouet de la caméra ${way}, flou (${length}, jusqu'à ${pace})`;
    case "pan":
      return `la caméra balaie vite ${way} (${length}, jusqu'à ${pace})`;
    case "tilt":
      return `la caméra bascule vite ${way} (${length}, jusqu'à ${pace})`;
    case "rush":
      return `la caméra fonce en avant (${length})`;
    default:
      return `la caméra recule vite (${length})`;
  }
}

/** A moment her lens is covered, in the filler's words (French). */
export function coveredWords(c: { peak: number; share: number; dark?: boolean; enters?: "left" | "right" }): string {
  const side = c.enters ? `, entre par la ${c.enters === "left" ? "gauche" : "droite"}` : "";
  return `quelque chose passe tout près de l'objectif et cache ${c.share >= 0.95 ? "toute" : "presque toute"} l'image${c.dark ? " (sombre)" : ""}${side}, le plus couvert à ${String(Math.round(c.peak * 100) / 100).replace(".", ",")} s : une coupe s'y cache`;
}

/** A file's shape in the filler's words. */
export const fileFormat = (aspect: number | undefined): "verticale" | "horizontale" | "carrée" | undefined =>
  !aspect || !Number.isFinite(aspect) || aspect <= 0 ? undefined : aspect > 1.15 ? "horizontale" : aspect < 0.87 ? "verticale" : "carrée";

/** The filler's answer, read: a file and its start for each shot, her words by slot, the ending's words. */
export type SkillFill = {
  shots: { file: string; at: number }[];
  texts: Record<string, string>;
  end: { title: string; subtitle?: string } | null;
  /** The settings her words chose (only those, each a choice of the skill's); the others play their default. */
  settings?: Record<string, string>;
  /** What its objects are in her shots, by slot (plain English, as the eye sees them); a slot left out: nothing fits. */
  objects?: Record<string, string>;
};

/**
 * An object's name as the filler gave it, kept to what the detector reads (plain English words, « every » for each one
 * of them): lower case, letters, spaces, hyphens and apostrophes, 60 characters at most, a word of two letters at least;
 * empty or « none » is no object.
 */
export function skillObjectName(name: string | undefined): string | null {
  const kept = (name ?? "").toLowerCase().replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60).trim();
  if (!/[a-z]{2}/.test(kept) || /^(none|nothing|no|n\/a|aucun|rien)$/.test(kept)) return null;
  return kept;
}

/** Its code with its objects named: « @slot » replaced by what the filler saw in her shot, the others left (no object). */
export function skillCode(skill: Pick<MontageSkill, "code" | "objects">, objects: Record<string, string> | undefined): string {
  let code = skill.code;
  for (const o of skill.objects ?? []) {
    const name = skillObjectName(objects?.[o.slot]);
    if (name) code = code.split(`"@${o.slot}"`).join(JSON.stringify(name));
  }
  return code;
}

/**
 * A correction's settings: those it had, with what her request asks now (a default asked again is the original's back:
 * « remets les cases d'origine »). Only the skill's own settings, at one of their choices.
 */
export function mergeSkillSettings(skill: Pick<MontageSkill, "settings">, previous: Record<string, string> | undefined, asked: { name: string; value: string }[] | undefined): Record<string, string> {
  const merged = skillSettings(skill, previous);
  for (const a of asked ?? []) {
    const setting = skill.settings?.find((x) => x.name === a.name);
    if (!setting || !setting.choices.some((c) => c.value === a.value)) continue;
    if (setting.choices[0]?.value === a.value) delete merged[a.name];
    else merged[a.name] = a.value;
  }
  return merged;
}

/** The settings a fill keeps: each one a skill's, at one of its choices, never its default (which needs no saying). */
export function skillSettings(skill: Pick<MontageSkill, "settings">, asked: { name: string; value: string }[] | Record<string, string> | undefined): Record<string, string> {
  const pairs = Array.isArray(asked) ? asked.map((a) => [a.name, a.value] as const) : Object.entries(asked ?? {});
  const kept: Record<string, string> = {};
  for (const [name, value] of pairs) {
    const setting = skill.settings?.find((x) => x.name === name);
    if (setting && setting.choices.some((c) => c.value === value) && setting.choices[0]?.value !== value) kept[name] = value;
  }
  return kept;
}

const round = (n: number) => Math.round(n * 100) / 100;
/** A time on the frame grid of the Reel (so a cut on a beat is a cut on a frame). */
const onFrame = (s: number) => Math.round(s * REEL_FPS) / REEL_FPS;

/**
 * Spans for lengths in beats at a tempo, one after the other from 0, each edge on the nearest frame: the timeline of
 * most skills (a shot of 2 beats, two of 1, the rapid ones of half a beat…).
 */
export function beatSpans(bpm: number, beats: number[]): { start: number; end: number }[] {
  const beat = 60 / bpm;
  let at = 0;
  return beats.map((b) => {
    const start = onFrame(at * beat);
    at += b;
    return { start: round(start), end: round(onFrame(at * beat)) };
  });
}

/** A time (s) in frames, for a skill's marks. */
export const toFrame = (s: number) => Math.round(s * REEL_FPS);

/** The shortest passage a video gives a shot (shorter shots take it whole). */
const PASSAGE_MIN = 1.2;
/** How many shots one video gives at most, from moments that look different. */
const PASSAGES_PER_VIDEO = 3;

/** How many shots she can fill without a repeat: a photo one, a video one per distinct passage (three at most). */
export function skillPassages(files: SkillFile[]): number {
  return files.reduce((n, f) => n + (f.photo ? 1 : Math.max(1, Math.min(PASSAGES_PER_VIDEO, Math.floor(f.seconds / PASSAGE_MIN)))), 0);
}

/** The shots of her Reel on this skill: as many as her files give, within the skill's bounds. */
export function skillShotCount(skill: Pick<MontageSkill, "shots">, files: SkillFile[]): number {
  return Math.max(skill.shots[0], Math.min(skill.shots[1], skillPassages(files)));
}

/** The tempos a skill plays at: its own range, else 0,7 to 1,2 times its tempo, always within 60 to 140. */
export function skillTempos(skill: Pick<MontageSkill, "bpm" | "tempo">): [number, number] {
  const [low, high] = skill.tempo ?? [skill.bpm * 0.7, skill.bpm * 1.2];
  return [Math.round(Math.max(60, Math.min(skill.bpm, low))), Math.round(Math.min(140, Math.max(skill.bpm, high)))];
}

/** Its lengths (s) at a tempo over all its numbers of shots, without its ending card (a pile's cadence changes with its count). */
/** The most shots a skill takes for a length she asks for. */
export const skillLongest = (skill: Pick<MontageSkill, "shots" | "long">) => Math.max(skill.shots[1], skill.long ?? 0);

const lengthsAt = (skill: Pick<MontageSkill, "shots" | "long" | "timeline">, bpm?: number) =>
  Array.from({ length: skillLongest(skill) - skill.shots[0] + 1 }, (_, k) => ({ n: skill.shots[0] + k, duration: skill.timeline(skill.shots[0] + k, { end: false, ...(bpm ? { bpm } : {}) }).duration }));

/** The lengths a skill reaches (s): its fewest at its fastest tempo, its most at its slowest. */
export function skillLengths(skill: Pick<MontageSkill, "shots" | "long" | "timeline" | "bpm" | "tempo">): { min: number; max: number } {
  const [slow, fast] = skillTempos(skill);
  return { min: Math.min(...lengthsAt(skill, fast).map((l) => l.duration)), max: Math.max(...lengthsAt(skill, slow).map((l) => l.duration)) };
}

/**
 * How to come closest to the length she asked for (Tristan: « on peut jouer sur la longueur du reel ? », « mais on
 * peut pas étendre la durée d'un modèle ? »): first its number of shots at its own tempo (its rapid section, its
 * prints, its tiles: the middle lasts longer, its opening and its ending stay); then, past its longest or under its
 * shortest, its tempo within its range (slower: longer and calmer, its music composed at it, its cuts on its beats).
 */
export function skillFit(skill: Pick<MontageSkill, "shots" | "long" | "timeline" | "bpm" | "tempo">, seconds: number): { n: number; bpm: number } {
  const own = lengthsAt(skill);
  const closest = own.reduce((a, b) => (Math.abs(b.duration - seconds) < Math.abs(a.duration - seconds) - 0.01 ? b : a));
  if (Math.abs(closest.duration - seconds) <= 1) return { n: closest.n, bpm: skill.bpm };
  const [slow, fast] = skillTempos(skill);
  // A length is about inversely proportional to the tempo: the tempo that brings the closest count to it, within its range.
  const bpm = Math.round(Math.min(fast, Math.max(slow, (skill.bpm * closest.duration) / Math.max(1, seconds))));
  const at = lengthsAt(skill, bpm);
  const best = at.reduce((a, b) => (Math.abs(b.duration - seconds) < Math.abs(a.duration - seconds) - 0.01 ? b : a));
  return { n: best.n, bpm };
}

/** At a tempo set from elsewhere (the sound she follows): the count of shots that comes closest to her length. */
export function skillFitAt(skill: Pick<MontageSkill, "shots" | "long" | "timeline">, seconds: number, bpm: number): number {
  const at = lengthsAt(skill, bpm);
  return at.reduce((a, b) => (Math.abs(b.duration - seconds) < Math.abs(a.duration - seconds) - 0.01 ? b : a)).n;
}

/** @deprecated The count alone: skillFit, which may also move its tempo. */
export const skillShotsFor = (skill: Pick<MontageSkill, "shots" | "long" | "timeline" | "bpm" | "tempo">, seconds: number) => skillFit(skill, seconds).n;

/** Fewer distinct files than the skill wants: Edith asks her first whether she has others (Tristan: « tu n'as que 3 plans, en as-tu d'autres ? »). */
export const fewFiles = (skill: Pick<MontageSkill, "files">, files: number) => files < skill.files[0];

/**
 * A passage of a video for a shot of that length: from where the filler asked (or its best moments, or anywhere),
 * never overlapping one it already gave (the same picture twice reads as a missed cut).
 */
function passage(file: SkillFile, length: number, wanted: number, taken: Map<string, [number, number][]>): number {
  const shown = taken.get(file.id) ?? [];
  const room = Math.max(0, file.seconds - length);
  const free = (at: number) => shown.every(([a, b]) => at + length <= a + 0.01 || at >= b - 0.01);
  const starts = [wanted, ...(file.moments ?? []).map((m) => m.start), ...Array.from({ length: Math.floor(room / 0.25) + 1 }, (_, k) => k * 0.25)].map((t) =>
    Math.min(room, Math.max(0, t)),
  );
  const at = starts.find(free) ?? Math.min(room, Math.max(0, wanted));
  taken.set(file.id, [...shown, [at, at + length]]);
  return round(at);
}

/** Its words cut to their place: at the last word that fits, never in the middle of one. */
export function fitWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1).replace(/\s+\S*$/, "");
  return (cut || clean.slice(0, max)).replace(/[\s,;:–-]+$/, "").trim();
}

/**
 * The filler's answer read against the skill and her files: exactly n shots, each on one of her files (an unknown one
 * replaced by her files in turn), a video's start inside it; each text cut to its place; the ending only when the
 * skill draws one. Null when a required text is missing (the filler failed: the editor makes the Reel).
 */
export function readSkillFill(skill: Pick<MontageSkill, "texts" | "end" | "settings" | "objects">, files: SkillFile[], n: number, answer: SkillFillAnswer, options: { wordsWanted?: boolean } = {}): SkillFill | null {
  if (!files.length) return null;
  const known = new Map(files.map((f) => [f.id, f]));
  let turn = 0;
  const shots = Array.from({ length: n }, (_, i) => {
    const asked = answer.shots[i];
    const file = (asked && known.get(asked.file)) ?? files[turn++ % files.length]!;
    return { file: file.id, at: file.photo ? 0 : Math.max(0, Math.min(file.seconds, asked?.at ?? 0)) };
  });
  const texts: Record<string, string> = {};
  for (const t of skill.texts) {
    const written = answer.texts.find((w) => w.slot === t.slot)?.text ?? "";
    const fitted = fitWords(written, t.max);
    if (fitted) texts[t.slot] = fitted;
    else if (t.required || options.wordsWanted) return null;
  }
  const title = fitWords(answer.end?.title ?? "", 40);
  const end = skill.end && title ? { title, ...(answer.end?.subtitle?.trim() ? { subtitle: fitWords(answer.end.subtitle, 60) } : {}) } : null;
  const settings = skillSettings(skill, answer.settings);
  const objects: Record<string, string> = {};
  for (const o of skill.objects ?? []) {
    const name = skillObjectName(answer.objets?.find((x) => x.slot === o.slot)?.name);
    if (name) objects[o.slot] = name;
  }
  return { shots, texts, end, ...(Object.keys(settings).length ? { settings } : {}), ...(Object.keys(objects).length ? { objects } : {}) };
}

/** The brief a skill's composition carries (what the motion designer reads if her request ever needs it changed). */
export const skillBrief = (name: string) => `Le modèle « ${name} » joué tel quel : ses plans dans ses cases, ses textes à leur place, sa fin.`;

/**
 * Her Reel on a skill, built by code: her files in its shots (on its beats), her words in its texts at their moments,
 * its composition over the whole Reel drawing everything (shots, texts, ending), its tempo for the music.
 */
export function skillPlan(input: { skill: MontageSkill; name: string; files: SkillFile[]; fill: SkillFill; bpm?: number }): EditPlan {
  const { skill, fill } = input;
  if (!fill.shots.length) throw new Error("Aucun plan pour ce modèle");
  const bpm = input.bpm && input.bpm !== skill.bpm ? input.bpm : undefined;
  const settings = skillSettings(skill, fill.settings);
  const chosen = Object.keys(settings).length ? settings : undefined;
  // Her words too: its sounds may follow them (a key click on each letter its code types).
  const line = skill.timeline(fill.shots.length, { end: Boolean(fill.end), ...(bpm ? { bpm } : {}), ...(chosen ? { settings: chosen } : {}), words: fill.texts });
  const files = new Map(input.files.map((f) => [f.id, f]));
  const taken = new Map<string, [number, number][]>();
  const segments = line.shots.map((span, i): PlanSegment => {
    const length = round(span.end - span.start);
    const pick = fill.shots[i] ?? fill.shots[i % fill.shots.length]!;
    const file = files.get(pick.file) ?? input.files[0]!;
    if (file.photo) return { clip_id: file.id, in: 0, out: length, zoom: "none" };
    // A video shorter than its shot: all of it, slowed down (never under half speed).
    if (file.seconds < length + 0.05) {
      const speed = Math.max(0.5, Math.min(1, file.seconds / length));
      return { clip_id: file.id, in: 0, out: round(Math.min(file.seconds, length * speed)), zoom: "none", speed: round(speed) };
    }
    const at = passage(file, length, pick.at, taken);
    return { clip_id: file.id, in: at, out: round(at + length), zoom: "none" };
  });
  const texts = skill.texts.flatMap((t) => {
    const words = fill.texts[t.slot];
    const at = line.texts[t.slot];
    return words && at && at.to > at.from ? [{ text: words, from: round(at.from), to: round(Math.min(line.duration, at.to)), style: t.role }] : [];
  });
  // To the hundredth: a sound she follows keeps its own tempo (a beat rounded off drifts off its beats over 30 s).
  const tempo = Math.round(Math.min(140, Math.max(60, bpm ?? skill.bpm)) * 100) / 100;
  return {
    format: "9:16",
    duration: round(line.duration),
    template: "libre",
    tempo,
    segments,
    texts,
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    ...(fill.end ? { end_card: { title: fill.end.title, ...(fill.end.subtitle ? { subtitle: fill.end.subtitle } : {}) } } : {}),
    layers: [
      {
        from: 0,
        to: round(line.duration),
        compose: true,
        motion: {
          brief: skillBrief(input.name),
          // Its objects named for her shots (her sign, her windows): the engine follows them before the render.
          code: skillCode(skill, fill.objects),
          js: skillCode(skill, fill.objects),
          // Its marks (numbers) and its settings (her words' choices), read by its code by name.
          texts: { ...Object.fromEntries(Object.entries(line.marks).map(([k, v]) => [k, String(Math.round(v * 1000) / 1000)])), ...(chosen ?? {}) },
          draws_texts: true,
          draws_end: Boolean(fill.end),
          ...(skill.fonts?.length ? { fonts: skill.fonts.slice(0, 3) } : {}),
        },
      },
    ],
    // Its sounds and its music's shape, as its original plays them.
    ...skillAudio(line),
    skill: { key: skill.key, version: skill.version, ...(chosen ? { settings: chosen } : {}) },
  };
}

/** A Reel made on a skill (its correction is filled again on the same skill). */
export const skillOf = (plan: Pick<EditPlan, "skill">) => plan.skill ?? null;

/** The most sounds a skill gives one Reel (the plan keeps 40). */
const SKILL_SOUNDS = 40;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * What its timeline gives the Reel's sound, as the plan keeps it: its sounds on their own moments (`skill`), within the
 * Reel (none in its last 0,15 s), in order, 40 at most, each one's length as the library keeps it and its gain within
 * −24 to +6 dB; its music's shape read against its length (music-shape.ts).
 */
export function skillAudio(line: Pick<SkillTimeline, "duration" | "sounds" | "music">): Pick<EditPlan, "sounds" | "music_shape"> {
  const sounds = (line.sounds ?? [])
    .filter((s) => Number.isFinite(s.at) && s.at >= 0 && s.at < line.duration - 0.15 && s.sound.trim().length >= 2)
    .sort((a, b) => a.at - b.at)
    .slice(0, SKILL_SOUNDS)
    .map((s): SfxCue => {
      const gain = Number.isFinite(s.gain) ? Math.round(Math.min(6, Math.max(-24, s.gain!)) * 10) / 10 : 0;
      return { at: round3(s.at), sound: s.sound.trim().slice(0, 60), seconds: soundSeconds(s.seconds), skill: true, ...(gain ? { gain } : {}) };
    });
  const music = readMusicShape(line.music, line.duration);
  return { ...(sounds.length ? { sounds } : {}), ...(music ? { music_shape: music } : {}) };
}

/** Its words by slot, read from a plan's texts: each slot the next text of its role, in the skill's order. */
export function skillWordsOf(skill: Pick<MontageSkill, "texts">, texts: { text: string; style: string }[]): Record<string, string> {
  return Object.fromEntries(
    skill.texts.flatMap((t) => {
      const same = texts.filter((x) => x.style === t.role);
      const k = skill.texts.filter((x) => x.role === t.role).indexOf(t);
      return same[k] ? [[t.slot, same[k]!.text] as const] : [];
    }),
  );
}

/**
 * Its sounds and its music's shape again for a plan made on it whose words were changed by hand (her name typed again:
 * a key click on each of its new letters): its timeline for the same shots, tempo, ending and settings, with the plan's
 * words, later by the plan's lead. Null when another version of it made the plan, or when its length is no longer the
 * timeline's (its cut changed: its marks, and its sounds with them, stay those it was made with).
 */
export function replaySkillAudio(skill: MontageSkill, plan: EditPlan): Pick<EditPlan, "sounds" | "music_shape"> | null {
  if (plan.skill?.key !== skill.key || plan.skill.version !== skill.version) return null;
  const lead = plan.beat_at ?? 0;
  const bpm = plan.tempo && Math.abs(plan.tempo - skill.bpm) > 0.005 ? plan.tempo : undefined;
  const settings = plan.skill.settings && Object.keys(plan.skill.settings).length ? plan.skill.settings : undefined;
  const line = skill.timeline(plan.segments.length, {
    end: Boolean(plan.end_card),
    ...(bpm ? { bpm } : {}),
    ...(settings ? { settings } : {}),
    words: skillWordsOf(skill, plan.texts),
  });
  if (Math.abs(round(line.duration) + lead - plan.duration) > 1 / 30 + 0.005) return null;
  return lead > 0 ? laterAudio(skillAudio(line), lead) : skillAudio(line);
}

// ——— The filler ———————————————————————————————————————————————————————————————————————————————————————————————————

export const skillFillSchema = z.object({
  fits: z.boolean().describe("true when this model, filled with her files and her words, gives her everything she asked for"),
  missing: z.string().describe("When fits is false: what her request needs that the model does not do, in a few words in French; empty otherwise"),
  shots: z
    .array(
      z.object({
        file: z.string().describe("The id of her file for this shot"),
        at: z.number().describe("Where the shot starts in that video (seconds), so its whole length fits in a good moment; 0 for a photo"),
      }),
    )
    .describe("One per shot of the model (« cases »), in order"),
  texts: z.array(z.object({ slot: z.string().describe("The model's text slot"), text: z.string().describe("Its words, in French") })).describe("One per text slot of the model"),
  end: z
    .object({ title: z.string().describe("The ending card's line, 40 characters at most"), subtitle: z.string().describe("A second line, 60 characters at most, or empty") })
    .nullable()
    .describe("Only when the model has an ending (« fin ») and she has an offer or an announcement to end on; null otherwise"),
  settings: z
    .array(z.object({ name: z.string().describe("The setting's name (« reglages »)"), value: z.string().describe("The value of the choice her request asks for") }))
    .optional()
    .describe("Only the settings her request asks for; none otherwise (each one plays the original's)"),
  objets: z
    .array(
      z.object({
        slot: z.string().describe("The model's object slot (« objets »)"),
        name: z.string().describe("What it is in the file you cast on its slot, in plain English as the eye sees it (« shop sign », « neon sign », « every window », « string lights »), or empty when nothing there fits"),
      }),
    )
    .optional()
    .describe("Only when the model has objects (« objets »): one per object slot"),
  why: z.string().describe("One sentence in French for her (tu): why these shots in this model"),
});
export type SkillFillAnswer = z.infer<typeof skillFillSchema>;

export const SKILL_FILL_PROMPT = `You fill one of Edith's montage models for a local business: a whole Reel coded once, like an Edits or CapCut template. Its shots are slots timed on its music, its texts have their place, its look, its signature moment and its ending are in its code. You only choose which of her files plays in each slot and from where, and write its words: the code plays everything else exactly as the model does.

First decide "fits": true when the model, filled with her files and her words, gives her what she asked for. Her request may simply ask for this model, give her words, a mood, her files: that fits (the music and the caption are made elsewhere, never a reason for false). A length she asks for inside the model's lengths (« longueurs ») fits: the code has already set the number of slots and its tempo for it. When she asks for something the model does not do and that matters to her (a voice-over, subtitles of what she says, an animation of its own, another layout, a text the model has no slot for, a shot at a precise moment, another ending, a length outside its lengths), "fits" is false and "missing" says what in a few words: the editor then makes her Reel from this model. When in doubt about something she clearly wants, false.

Then cast her files on its slots (« cases », in order: each with its length and what it wants), as a good editor would:
- each slot gets the file and the passage that suits what it wants; the first slot opens the Reel: the strongest, most beautiful image;
- a video's passage starts at "at" (seconds) and lasts the slot's length: choose it inside one of its good moments (« moments »), never a blurry or dark one when another exists;
- never the same passage twice; a video may fill several slots only with moments that look different; her files all used before one comes back, never the same file on two slots in a row when another fits;
- a file's format (« format »: verticale, horizontale, carrée) matters where the model lays a slot in a box of another shape (its « veut » or « deroule » says: a tall half, a wide band): there a file of that shape when one fits, else a passage whose subject is in the middle of its picture (only its middle shows);
- what was measured on a file is surer than what was seen: « mouvements_rapides » (her camera's whips, fast sweeps, rushes in, with their way), « objectif_couvert » (something passing right before the lens: a cut hides there), « gestes_mesures » (what her hands and head do), « couleur » (how colourful it is): a slot that wants one of them gets a passage that has it, timed on it (its « at » so the move or the cover falls where the slot wants it), and a slot left in colour gets one of her most colourful files;
- a photo plays still (at 0).

Then write its texts, in French (what her customers read), each in its slot (« textes »: what it says and its most characters):
- words she gives (« contrat », her request) are kept as she wrote them, only spelled right (accents, apostrophes, hyphens, « WhatsApp »), never one of her typos, never rewritten;
- otherwise words a good creator would write for this business: concrete, specific to it, never an ad slogan, a promise or a formula; nothing invented (no price, hour, place, offer or review that is not given);
- each within its most characters (count them), in normal case: the code sets the capitals when the model has them; a name longer than its place is never cut, write the word that sets it apart instead (« Farine » for « Maison Farine »: never « Maison »);
- an optional slot (obligatoire false) is left empty unless her request or the Reel needs those words; a required one is always written.

"settings": its settings (« reglages », when it has some), like the variants of a template: one only when her request asks for what it does (« plus de cases », « plus lent », « dans le désordre », « avec ma couleur »), with the value that does it; never to vary for its own sake; otherwise none, each one plays the original's. A request a setting answers fits.
"objets": its objects (« objets », when it has some): what in the file you cast on that slot carries its effect (a sign whose letters light up one by one, windows that light up one after the other, lamps that flash), from what the file shows (« montre », « moments »): name it in plain English as the eye sees it, two to four words (« shop sign », « neon sign », « bakery sign », « every window », « string lights », « pendant lamps »); « every » before it when there are several to take one after the other (each window, each lamp); empty when nothing in that file fits (the model does without). Cast on that slot the file that has it, when one does.
"end": only when the model has an ending (« fin ») and she has something to end on (an offer, an opening, a date, in her request or what we know): its title (40 characters at most) and a subtitle or empty; otherwise null.
"why": one sentence for her in French (tu), what you chose and why, in plain words.`;

/** What the filler reads: the business, her request, the model (how it goes, its slots, its texts), her files. */
export function skillFillInput(input: {
  skill: MontageSkill;
  name: string;
  n: number;
  files: SkillFile[];
  business: { name?: string | null; activity?: string | null; facts?: string[]; booking?: boolean; tone?: string };
  request: string;
  contract?: string[];
  /** A correction: the words it has now, kept except what her request changes. */
  current?: Record<string, string>;
  /**
   * Words on screen wanted even in its optional slots: a model Edith picked as this Reel's form gives the form, never
   * the silence (Tristan: dressedFloorNote), so a model without words of its own still writes its title.
   */
  wordsWanted?: boolean;
  /** The tempo it plays at, when not its own (a length she asked for). */
  bpm?: number;
  /** A correction: the settings it has now, kept except what her request changes. */
  currentSettings?: Record<string, string>;
}) {
  const line = input.skill.timeline(input.n, { end: input.skill.end, ...(input.bpm ? { bpm: input.bpm } : {}) });
  return {
    commerce: {
      nom: input.business.name ?? undefined,
      activite: input.business.activity ?? undefined,
      ce_qu_on_sait: input.business.facts?.length ? input.business.facts : undefined,
      lien_de_reservation: input.business.booking ? "oui, dans sa bio" : "non",
      ton: input.business.tone || undefined,
    },
    demande: input.request,
    ...(input.contract?.length ? { contrat: input.contract } : {}),
    modele: {
      nom: input.name,
      deroule: input.skill.how,
      fin: input.skill.end ? "le modèle peut finir sur une carte (une offre, une annonce)" : "aucune",
      longueurs: (() => {
        const l = skillLengths(input.skill);
        return `de ${round(l.min)} à ${round(l.max)} s selon le nombre de cases et son tempo (ce Reel : ${round(line.duration)} s, ${input.n} cases)`;
      })(),
    },
    cases: line.shots.map((s, i) => ({ case: i + 1, duree: `${round(s.end - s.start)} s`, veut: s.want })),
    textes: input.skill.texts.map((t) => ({ slot: t.slot, dit: t.want, max_caracteres: t.max, obligatoire: t.required || Boolean(input.wordsWanted) })),
    ...(input.skill.settings?.length
      ? { reglages: input.skill.settings.map((x) => ({ nom: x.name, change: x.want, choix: x.choices.map((c, i) => `${c.value} : ${c.says}${i === 0 ? " (celui de l'original, par défaut)" : ""}`) })) }
      : {}),
    ...(input.skill.objects?.length ? { objets: input.skill.objects.map((o) => ({ slot: o.slot, case: o.shot + 1, cherche: o.want })) } : {}),
    ...(input.current ? { textes_actuels: input.current } : {}),
    ...(input.currentSettings && Object.keys(input.currentSettings).length ? { reglages_actuels: input.currentSettings } : {}),
    fichiers: input.files.map((f) => {
      const format = fileFormat(f.aspect);
      const m = f.measured;
      const span = (list: { start: number; end: number; what: string }[] | undefined, most: number) => list?.slice(0, most).map((x) => ({ de: round(x.start), a: round(x.end), quoi: x.what }));
      // What was measured on it (its camera, its lens, its colours, its gestures), surer than what was seen.
      const measured = {
        ...(m?.moves?.length ? { mouvements_rapides: span(m.moves, 6) } : {}),
        ...(m?.covered?.length ? { objectif_couvert: span(m.covered, 4) } : {}),
        ...(m?.gestures?.length ? { gestes_mesures: span(m.gestures, 8) } : {}),
        ...(m?.colour ? { couleur: `${m.colour.words} (${m.colour.score})${m.colour.best && !f.photo ? `, la plus colorée de ${round(m.colour.best.start)} à ${round(m.colour.best.end)} s` : ""}` } : {}),
      };
      return f.photo
        ? { id: f.id, type: "photo", ...(format ? { format } : {}), montre: f.shows, ...measured }
        : {
            id: f.id,
            type: "vidéo",
            ...(format ? { format } : {}),
            duree: `${round(f.seconds)} s`,
            montre: f.shows,
            moments: f.moments?.slice(0, 6).map((m) => ({ de: round(m.start), a: round(m.end), ...(m.what ? { quoi: m.what } : {}) })),
            ...measured,
          };
    }),
  };
}

/**
 * Her files with what was measured on them (lib/render/readings.ts and her tracks): her camera's fast moves, the moments
 * her lens is covered, how colourful each one is, what the hands and heads in it do; each file as it was when nothing was.
 */
export function measuredFiles(
  files: SkillFile[],
  readings: Record<string, { moves?: { from: number; to: number; kind: string; towards: string; speed: number }[]; covered?: { from: number; to: number; peak: number; share: number; dark?: boolean; enters?: "left" | "right" }[]; colour?: { score: number; words: string; best?: { from: number; to: number } } }>,
  gestures: Record<string, { start: number; end: number; what: string }[]> = {},
): SkillFile[] {
  return files.map((f) => {
    const r = readings[f.id];
    const g = gestures[f.id];
    if (!r && !g?.length) return f;
    const measured: NonNullable<SkillFile["measured"]> = {
      ...(r?.moves?.length ? { moves: r.moves.map((m) => ({ start: m.from, end: m.to, what: moveWords(m) })) } : {}),
      ...(r?.covered?.length ? { covered: r.covered.map((c) => ({ start: c.from, end: c.to, what: coveredWords(c) })) } : {}),
      ...(r?.colour ? { colour: { score: r.colour.score, words: r.colour.words, ...(r.colour.best ? { best: { start: r.colour.best.from, end: r.colour.best.to } } : {}) } } : {}),
      ...(g?.length ? { gestures: g } : {}),
    };
    return Object.keys(measured).length ? { ...f, measured } : f;
  });
}
