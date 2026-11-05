import { z } from "zod";
import { wordFont, wordFontsBrief } from "./font-pairs.ts";
import { planLook, type ReelLook } from "./looks.ts";
import { REEL_FPS } from "./motion.ts";
import { readMusicShape, type MusicShape } from "./music-shape.ts";
import type { ClipSegment, ClipSpeech, EditPlan, MotionDrawn, PlanSegment, SfxCue } from "./schemas.ts";
import { soundSeconds } from "./sfx.ts";
import { laterAudio } from "./sound-follow.ts";
import { speechCuts } from "./speech.ts";
import { followedFilter, followedLook, type FollowedStyle } from "./steal.ts";

// Montage skills (Tristan: « edith pourrait choisir d'adapter ces modèles comme une librairie de "skills de montage" »,
// « sur Edits d'Insta tu as des modèles où le texte est préposé et les photos et vidéos n'ont qu'à être changées »):
// one of Edith's models coded once for the whole Reel, like an Edits or CapCut template. Its shots are slots timed on
// its music, its texts are placed (where, how big, how they appear, when), its signature moment and its ending are in
// its code. Using it is filling it: which of her files plays in each slot, from where, and her words in its text slots,
// written by one small call (Sonnet), the plan built here by code; the engine plays its composition as it is, checked
// like any composition, with no editor nor motion designer. A request it does not serve goes to the editor, whose
// motion designer starts from its code and changes only what her request needs. The skills themselves (their timeline
// and their code) are in skills/, server side only (@fauve/agent/skills).
//
// A skill can also be timed on her voice (`voice`, SkillVoice: « Mot clé en grand », « Face caméra et références »): its
// Reel is her talking video cut by the engine (skillTalk), her other angles of the same take synced on their sound
// (takes.ts), its words chosen by the filler in what she says, each at the instant she says it (SkillSaid, given to its
// timeline as `said` and to its code as `spoken` and reelTexts). A text of it may take a font that evokes its word
// (`font`, WORD_FONTS of font-pairs.ts: reelTexts[i].font), or be written by the engine from what it knows (`fact`:
// her place's coordinates, geo.ts). Each is rendered locally by scripts/skill-render.mts (--talk, --said, --takes).

/** One of its texts: what the filler writes in it and where its code finds it among the Reel's texts (by role, in order). */
export type SkillText = {
  slot: string;
  role: "hook" | "band" | "caption";
  /** What it says, for the filler (in French, as Tristan reads it too). */
  want: string;
  /** The most characters it holds where its code lays it. */
  max: number;
  required: boolean;
  /**
   * Its words in a font that evokes them (« Mot clé en grand »: « une manuscrite pour « soin », une condensée pour « fort » »):
   * its filler picks one of WORD_FONTS (font-pairs.ts) for what its word says or names, beyond her two fonts; its code
   * finds it on its text (reelTexts[i].font, a Google Fonts family the render loads), absent when none fits (her fonts).
   */
  font?: boolean;
  /**
   * Written by the engine from what it knows, never by the filler (nothing invented): « coordinates », her place's
   * coordinates with four decimals (« 48.8772° N, 2.3394° E », geo.ts: her address geocoded once by OpenStreetMap). When
   * it is not known, the filler writes the slot as its `want` says (its fallback: her neighbourhood, her town).
   */
  fact?: "coordinates";
};

/**
 * One of its shots for n shots: its span (seconds from the start) and what it wants (for the filler). Its shots follow
 * one another from 0 (each starts where the one before it ends), except a shot `beside` another: two passages on the
 * same moment, each at its own speed (a split screen's two halves, « Écran partagé titré »; a half that cuts alone while
 * the other plays on, « Photos posées sur la table »). It plays from its own start, beside the shot on screen then, its
 * time counted once (the Reel lasts no longer for it); the filler casts it like any slot, told which slot it plays with
 * (`en_meme_temps_que`); its composition draws both (shots[i] keep the timeline's order: list it right after the shot it
 * plays beside; both have the same `from` when they start together). The plain montage, which plays when the
 * composition cannot, shows the main line alone. A skill timed on her voice may say which of her takes plays a shot
 * (`take`: 0 her main video, 1 her other angle synced on its sound, as SkillSaid.shots gives them by default) and
 * whether it is framed tighter (`punch`).
 */
export type SkillShot = { start: number; end: number; want: string; beside?: boolean; take?: number; punch?: boolean };

/** One of her words on the Reel's clock (s), her hesitations out: what a skill timed on her voice reads of what she says. */
export type SkillWord = { w: string; start: number; end: number };

/**
 * A skill timed on her voice (« Mot clé en grand », « Face caméra et références »: Tristan's creators talking to the
 * camera): its Reel is her talking video, cut by the engine as a creator cuts it (her « euh », false starts and long pauses
 * out, `speechCuts`; a new frame only between two ideas: her other take when two phones filmed her, else a tighter frame
 * held), and its words are hers, chosen by its filler in what she says (her words numbered, as Scribe timed them): the
 * hook, each idea's keyword and the moment it ends, the names of a list she says, each set at the instant she says it.
 * Its timeline and its code get her words with their times (SkillSaid; `spoken` in its code, each word in frames).
 */
export type SkillVoice = {
  /** What its hook is, in French for the filler (« ses deux ou trois premiers mots quand ils annoncent déjà quelque chose »). */
  hook: string;
  /** What carries each idea, in French (« le mot qui porte l'idée, dit tôt : SOINS, BRUSHING, PAINS »). */
  key: string;
  /** How many ideas it takes, at least and at most. */
  ideas: [number, number];
  /** A list she says inside an idea, in French (« ses produits, des étapes : chaque nom au moment où elle le dit »); none without. */
  items?: string;
  /** The most characters of its hook, of a keyword, of a name of its list, where its code sets them. */
  max: { hook: number; key: number; item?: number };
  /** Which of its words get a font that evokes them (WORD_FONTS), picked by its filler: its keywords, the names of its lists. */
  fonts?: ("key" | "item")[];
  /**
   * The engine's subtitles of what she says: « engine » (the default) keeps them under its composition, its own words over
   * them (the original keeps both layers); « own »: its code writes what she says itself and they step aside.
   */
  subtitles?: "engine" | "own";
  /** Where the engine's subtitles run under it (share of the height, 0.1 to 0.8: « sur sa poitrine », 0.75). */
  row?: number;
  /** False: one frame all along, never another take nor a tighter frame between two ideas. */
  angles?: boolean;
};

/**
 * Her talking video as the engine cut it for a skill timed on her voice (skillTalk): the pieces of it the Reel keeps, in
 * order (`in`, `out` on her video; `start`, `end` on the Reel's clock), her words kept on the Reel's clock, its length,
 * and her other angles of the same take (synced on their sound, takes.ts: each one's video, its offset, its time being
 * the main's + offset, and its length).
 */
export type SkillTalk = {
  clip: string;
  pieces: { in: number; out: number; start: number; end: number }[];
  words: SkillWord[];
  duration: number;
  takes: { clip: string; offset: number; seconds: number }[];
  /** Her main video's length (s): its last piece may run on past her last word, for an ending. */
  seconds: number;
};

/**
 * What the filler chose in what she says (word numbers in SkillTalk.words): her hook's first and last word and its text,
 * each idea's first and last word, its keyword (its number and how it is written on screen), the names of a list she
 * says in it (each one's word and text) and the font each one evokes (WORD_FONTS, when the skill asks for it).
 */
export type SkillPicks = {
  hook: { from: number; to: number; text: string } | null;
  ideas: { from: number; to: number; key: number; text: string; font?: string; items: { word: number; text: string; font?: string }[] }[];
};

/**
 * What a skill timed on her voice gets in its timeline (options.said), on the Reel's clock (s): her words, its length,
 * its hook (held from the first image until she says the word after it, a second at least), each idea (its words
 * from `from` to `to`, its keyword said at `at`, the names of its list each said at its own `at`) and its shots (her
 * talk's pieces, cut again where an idea ends inside one: each one's idea, and the angle the engine gives it, its other
 * take or a tighter frame for every other idea). Its texts' default moments are in `texts`, by the slots the engine
 * names them: « accroche » (role hook), « idee1 », « idee2 »… (each keyword, role band), « idee1_1 »… (each name of a
 * list, role caption); its timeline may move any of them (its `texts`), as it times its sounds and its music on them.
 */
export type SkillSaid = {
  words: SkillWord[];
  duration: number;
  hook: { text: string; words: [number, number]; from: number; to: number } | null;
  ideas: { text: string; font?: string; words: [number, number]; key: number; from: number; to: number; at: number; items: { text: string; font?: string; word: number; at: number }[] }[];
  shots: { start: number; end: number; idea: number; take: number; punch: boolean }[];
  texts: Record<string, { from: number; to: number }>;
};

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
  /**
   * The shots its code draws her cut out on (Subject, SubjectBox, SubjectOutline or SubjectParts without an object), by
   * their index in its shots, for this count: only those passages are cut out (on the rented card, or in the cut-out
   * sandbox; its cost logged as any cut-out), so a code that names its shots by a variable (« Titre qui se décode »: its
   * ending's three, n − 4, n − 2 and n − 1) no longer has every passage of the Reel cut out, up to 30 s. Leave it out
   * and they are read in its code: a shot written as a number, or every shot when written as a variable. Give it whenever
   * its code draws her: the plan keeps it (motion.drawn) and the engine reads it instead of guessing.
   */
  cutouts?: number[];
  /**
   * For this count, the shot each of its objects is on, by slot (a negative index counts from the end, −1 the last): its
   * sign on its front, which is always its last shot (« Mots aux quatre coins »), the place of its ending, which moves
   * with the count. Over its object's own `shot`. The filler names it from the file it casts on that shot, and only that
   * passage is followed.
   */
  objects?: Record<string, number>;
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
  /**
   * The shot it is in (its index in the timeline's shots; negative, counted from the end: −1 its last shot, whatever
   * the count), unless its timeline places it for this count (SkillTimeline.objects): the filler names it from the file
   * cast there, and the engine follows it on that passage only, even when its code writes the shot as a variable
   * (`SubjectParts(shots[n - 1], …)`).
   */
  shot: number;
  /** What to look for there, in French for the filler: what can carry the effect, by kind. */
  want: string;
};

/** The shot an object slot is on, for its timeline's count: the timeline's placing, else its own (negative from the end); null past its shots. */
export function skillObjectShot(object: Pick<SkillObject, "slot" | "shot">, line: Pick<SkillTimeline, "shots" | "objects">): number | null {
  const n = line.shots.length;
  const at = line.objects?.[object.slot] ?? object.shot;
  const k = at < 0 ? n + at : at;
  return Number.isInteger(k) && k >= 0 && k < n ? k : null;
}

/**
 * Where each shot of a timeline plays with another (SkillShot.beside): for each shot, the shot of the main line on
 * screen when it starts (the one it plays beside), else null.
 */
export function besideOf(line: Pick<SkillTimeline, "shots">): (number | null)[] {
  return line.shots.map((s) => {
    if (!s.beside) return null;
    const k = line.shots.findIndex((m) => !m.beside && m.start <= s.start + 0.005 && m.end > s.start + 0.005);
    return k < 0 ? null : k;
  });
}

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
   * For n shots: its length, each shot's span and want (two on the same moment: SkillShot.beside), its texts' moments
   * and its code's marks, its sounds and its music's shape, the shots its code cuts her out on (`cutouts`) and the shot
   * of each object (`objects`) for that count; `bpm`, at another tempo than its own (a longer or shorter Reel, a
   * music's tempo): every length it counts in beats follows it; `words`, her words by slot when they are written (the
   * plan's): what its sounds follow (a key click on each letter of her name as its code types it), never its lengths.
   * A skill timed on her voice gets `said` (her talk cut, her words and what its filler chose in them, on the Reel's
   * clock): its n shots are said.shots, its length said.duration (longer: her last shot runs on, as far as her video
   * goes); without it (the lengths of the library, a check), a nominal timeline of n shots.
   */
  timeline(n: number, options: { end: boolean; bpm?: number; settings?: Record<string, string>; words?: Record<string, string>; said?: SkillSaid }): SkillTimeline;
  /**
   * Timed on her voice: its Reel is her talking video and its words are hers, each at the instant she says it (SkillVoice).
   * Its shots are her talk's pieces (never cast by the filler), its length hers (45 s at most), its music under her voice.
   */
  voice?: SkillVoice;
  /** The tempos it plays at (default: from 0,7 to 1,2 times its own, within 60 to 140). */
  tempo?: [number, number];
  /** What her words can change in it, as a template's variants (its grid, its pace, its order, its colour). */
  settings?: SkillSetting[];
  /** What it lights up or cuts out in her shots (her sign, her windows), named by the filler from what each file shows. */
  objects?: SkillObject[];
  /**
   * The most shots it takes for a length she asks for, past `shots[1]` (the most it takes from her files alone): a model
   * whose middle can repeat (more full frames after a title, more of the place's life, more of the day) reaches 30 s at
   * its own tempo, like a verse added to a song, its opening and its ending as they are (Tristan: « si un modèle fait
   * 10 secondes mais qu'elle veut un Reel de 30 ? »). Its timeline takes any count up to it.
   */
  long?: number;
  /**
   * Its composition over the whole Reel: plain JS defining function Scene (h = React.createElement, no JSX), the kit's
   * scope (motion-scene.ts): Footage for her shots (two shots laid beside each other share their `from`: lay both, each
   * plays at its own speed), Subject and the reading tools for what is cut out of them, and `Look` for a ready look
   * (LOOK_PRESETS: « vhs », « bw »…) on one shot or one span of it, over what it wraps, where a look on the whole Reel
   * is its finish.
   */
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
};

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
  /** The font each of its texts asking for one evokes (a WORD_FONTS family), by slot; a slot left out: her fonts. */
  fonts?: Record<string, string>;
  /** A skill timed on her voice: what the filler chose in what she says (her hook, her ideas, her lists), read against her words. */
  said?: SkillPicks;
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
 * What a skill's code draws of her shots for its timeline's count, as the plan keeps it (motion.drawn): the shots it
 * cuts her out on (its timeline's `cutouts`) and each object it named on its shot (its slot's shot for that count, the
 * filler's name), so the engine cuts out and follows only those, even where its code writes the shot as a variable.
 * Nothing when its timeline says neither.
 */
export function skillDrawn(
  skill: Pick<MontageSkill, "objects">,
  line: Pick<SkillTimeline, "shots" | "cutouts" | "objects">,
  named: Record<string, string> | undefined,
): MotionDrawn | undefined {
  const count = line.shots.length;
  const subjects = line.cutouts ? [...new Set(line.cutouts.filter((k) => Number.isInteger(k) && k >= 0 && k < count))].sort((a, b) => a - b) : undefined;
  const objects = (skill.objects ?? []).flatMap((o) => {
    const shot = skillObjectShot(o, line);
    const name = skillObjectName(named?.[o.slot]);
    return shot !== null && name ? [{ shot, name }] : [];
  });
  if (!subjects && !objects.length) return undefined;
  return { shots: count, ...(subjects ? { subjects } : {}), ...(objects.length ? { objects } : {}) };
}

/**
 * Her Reel on a skill dressed the way production dresses it (designSkill, and scripts/skill-render.mts to see it as it
 * will come out): the model's lettering when she chose it (her charter's when Edith picked it: `followed.dressed`), its
 * finish over the whole Reel (its grade, its grain, its corners) without what its code does itself (MontageSkill.finish),
 * else her own look for all her Reels (`own`).
 */
export function dressSkillPlan(plan: EditPlan, skill: Pick<MontageSkill, "finish">, followed: FollowedStyle | undefined, own?: ReelLook | null): EditPlan {
  const dressed: EditPlan = { ...plan, ...followedLook(plan, followed) };
  Object.assign(dressed, followedFilter(dressed, followed));
  if (skill.finish && dressed.look) dressed.look = { ...dressed.look, ...skill.finish };
  if (!planLook(dressed) && own) dressed.look = own;
  return dressed;
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

/** The lengths a skill reaches (s): its fewest at its fastest tempo, its most at its slowest; on her voice, her talk's (45 s at most). */
export function skillLengths(skill: Pick<MontageSkill, "shots" | "long" | "timeline" | "bpm" | "tempo"> & { voice?: unknown }): { min: number; max: number } {
  if (skill.voice) return { min: 3, max: TALK_MAX_SECONDS };
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
export function readSkillFill(
  skill: Pick<MontageSkill, "texts" | "end" | "settings" | "objects" | "voice">,
  files: SkillFile[],
  n: number,
  answer: SkillFillAnswer,
  options: { wordsWanted?: boolean; talk?: SkillTalk; facts?: SkillFacts } = {},
): SkillFill | null {
  if (!files.length) return null;
  // Timed on her voice: her talk is its shots (cut by the engine), and her words its texts; without her talk, nothing to play.
  if (skill.voice && !options.talk) return null;
  const known = new Map(files.map((f) => [f.id, f]));
  let turn = 0;
  const shots = skill.voice
    ? []
    : Array.from({ length: n }, (_, i) => {
        const asked = answer.shots[i];
        const file = (asked && known.get(asked.file)) ?? files[turn++ % files.length]!;
        return { file: file.id, at: file.photo ? 0 : Math.max(0, Math.min(file.seconds, asked?.at ?? 0)) };
      });
  const texts: Record<string, string> = {};
  const fonts: Record<string, string> = {};
  for (const t of skill.texts) {
    // A fact the engine knows (her coordinates) is written by it, whatever the filler wrote.
    const fact = t.fact ? skillFact(t, options.facts) : undefined;
    const asked = answer.texts.find((w) => w.slot === t.slot);
    const fitted = fact ?? fitWords(asked?.text ?? "", t.max);
    if (fitted) texts[t.slot] = fitted;
    else if (t.required || options.wordsWanted) return null;
    const font = t.font ? wordFont(asked?.font)?.family : undefined;
    if (font && fitted) fonts[t.slot] = font;
  }
  const said = skill.voice ? readSaid(skill.voice, options.talk!, answer.voice) : undefined;
  if (skill.voice && !said) return null;
  const title = fitWords(answer.end?.title ?? "", 40);
  const end = skill.end && title ? { title, ...(answer.end?.subtitle?.trim() ? { subtitle: fitWords(answer.end.subtitle, 60) } : {}) } : null;
  const settings = skillSettings(skill, answer.settings);
  const objects: Record<string, string> = {};
  for (const o of skill.objects ?? []) {
    const name = skillObjectName(answer.objets?.find((x) => x.slot === o.slot)?.name);
    if (name) objects[o.slot] = name;
  }
  return {
    shots,
    texts,
    end,
    ...(Object.keys(settings).length ? { settings } : {}),
    ...(Object.keys(objects).length ? { objects } : {}),
    ...(Object.keys(fonts).length ? { fonts } : {}),
    ...(said ? { said } : {}),
  };
}

/** What the engine knows of her business that a skill's text can show as it is (SkillText.fact): her place's coordinates. */
export type SkillFacts = { coordinates?: string };

/** The words the engine writes in a text slot from what it knows (her coordinates), cut to its place; none when unknown. */
export const skillFact = (t: Pick<SkillText, "fact" | "max">, facts: SkillFacts | undefined): string | undefined =>
  t.fact === "coordinates" && facts?.coordinates && facts.coordinates.length <= t.max ? facts.coordinates : undefined;

/** The brief a skill's composition carries (what the motion designer reads if her request ever needs it changed). */
export const skillBrief = (name: string) => `Le modèle « ${name} » joué tel quel : ses plans dans ses cases, ses textes à leur place, sa fin.`;

/**
 * Her Reel on a skill, built by code: her files in its shots (on its beats), her words in its texts at their moments,
 * its composition over the whole Reel drawing everything (shots, texts, ending), its tempo for the music.
 */
export function skillPlan(input: { skill: MontageSkill; name: string; files: SkillFile[]; fill: SkillFill; bpm?: number; talk?: SkillTalk }): EditPlan {
  const { skill, fill } = input;
  const voice = skill.voice;
  if (voice && (!input.talk || !fill.said)) throw new Error("Ce modèle se cale sur sa voix : il lui faut une vidéo où elle parle");
  if (!voice && !fill.shots.length) throw new Error("Aucun plan pour ce modèle");
  const bpm = input.bpm && input.bpm !== skill.bpm && !voice ? input.bpm : undefined;
  const settings = skillSettings(skill, fill.settings);
  const chosen = Object.keys(settings).length ? settings : undefined;
  // Timed on her voice: her talk cut and what the filler chose in it, on the Reel's clock.
  const said = voice ? skillSaid(input.talk!, fill.said!, voice) : undefined;
  // Her words too: its sounds may follow them (a key click on each letter its code types).
  const line = skill.timeline(said ? said.shots.length : fill.shots.length, {
    end: Boolean(fill.end),
    ...(bpm ? { bpm } : {}),
    ...(chosen ? { settings: chosen } : {}),
    words: said ? { ...fill.texts, ...saidWords(said) } : fill.texts,
    ...(said ? { said } : {}),
  });
  const segments = said ? talkSegments(input.talk!, said, line) : castSegments(input.files, fill, line);
  // What its code draws of her shots for this count (her cut-out, its objects): only those are made before the render.
  const drawn = skillDrawn(skill, line, fill.objects);
  // Its length: its timeline's; on her voice, her shots' (her last one running on for an ending, as far as her video goes).
  const duration = said ? round(segments.reduce((sum, s) => sum + ("clip_id" in s ? s.out - s.in : 0), 0)) : round(line.duration);
  const texts = [
    ...skill.texts.flatMap((t) => {
      const words = fill.texts[t.slot];
      const at = line.texts[t.slot];
      const font = fill.fonts?.[t.slot];
      return words && at && at.to > at.from ? [{ text: words, from: round(at.from), to: round(Math.min(duration, at.to)), style: t.role, ...(font ? { font } : {}) }] : [];
    }),
    // Her own words, in the order she says them: her hook, each idea's keyword, the names of its list.
    ...(said ? saidTexts(said, line, duration) : []),
  ];
  // On her voice, every text in the order it shows: its code finds each one by its role and its moment, in the scene check
  // (which sorts them so) as in the render.
  if (said) texts.sort((a, b) => a.from - b.from);
  // To the hundredth: a sound she follows keeps its own tempo (a beat rounded off drifts off its beats over 30 s).
  const tempo = Math.round(Math.min(140, Math.max(60, bpm ?? skill.bpm)) * 100) / 100;
  const marks = { ...line.marks, ...(said ? saidMarks(said) : {}) };
  return {
    format: "9:16",
    duration,
    template: "libre",
    tempo,
    segments,
    texts,
    images: [],
    transitions: "cut",
    // On her voice, what she says is subtitled (the engine's, unless its code writes them: SkillVoice.subtitles).
    subtitles: Boolean(said),
    music: null,
    ...(fill.end ? { end_card: { title: fill.end.title, ...(fill.end.subtitle ? { subtitle: fill.end.subtitle } : {}) } } : {}),
    layers: [
      {
        from: 0,
        to: duration,
        compose: true,
        motion: {
          brief: skillBrief(input.name),
          // Its objects named for her shots (her sign, her windows): the engine follows them before the render.
          code: skillCode(skill, fill.objects),
          js: skillCode(skill, fill.objects),
          // Its marks (numbers) and its settings (her words' choices), read by its code by name.
          texts: { ...Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, String(Math.round(v * 1000) / 1000)])), ...(chosen ?? {}) },
          draws_texts: true,
          draws_end: Boolean(fill.end),
          ...(skill.fonts?.length ? { fonts: skill.fonts.slice(0, 3) } : {}),
          // What its code draws of her shots for this count (her cut-out, its objects): only those are made before the render.
          ...(drawn ? { drawn } : {}),
          // On her voice: its code gets her words said, each at its frame (`spoken`), whether or not it writes them all.
          ...(voice ? { times_spoken: true, writes_spoken: voice.subtitles === "own" } : {}),
          ...(voice?.row ? { subtitle_y: Math.min(0.8, Math.max(0.1, voice.row)) } : {}),
        },
      },
    ],
    // Its sounds and its music's shape, as its original plays them.
    ...skillAudio({ ...line, duration }),
    skill: { key: skill.key, version: skill.version, ...(chosen ? { settings: chosen } : {}) },
  };
}

/** Her files in its shots, one after the other on its beats: each shot's file and its passage (a photo held, a short video slowed). */
function castSegments(files: SkillFile[], fill: SkillFill, line: SkillTimeline): PlanSegment[] {
  const byId = new Map(files.map((f) => [f.id, f]));
  const taken = new Map<string, [number, number][]>();
  return line.shots.map((span, i): PlanSegment => {
    const length = round(span.end - span.start);
    const pick = fill.shots[i] ?? fill.shots[i % fill.shots.length]!;
    const file = byId.get(pick.file) ?? files[0]!;
    // A shot beside another plays from its own start on the Reel's clock, its time counted once.
    const beside = span.beside ? { beside: { at: round(span.start) } } : {};
    if (file.photo) return { clip_id: file.id, in: 0, out: length, zoom: "none", ...beside };
    // A video shorter than its shot: all of it, slowed down (never under half speed).
    if (file.seconds < length + 0.05) {
      const speed = Math.max(0.5, Math.min(1, file.seconds / length));
      return { clip_id: file.id, in: 0, out: round(Math.min(file.seconds, length * speed)), zoom: "none", speed: round(speed), ...beside };
    }
    const at = passage(file, length, pick.at, taken);
    return { clip_id: file.id, in: at, out: round(at + length), zoom: "none", ...beside };
  });
}

/**
 * Her talk's shots as the plan plays them: each piece of her main video, or of her other take at the same moment of
 * what she says (its offset added) when the shot is on it, framed tighter when it says so (`punch`, a frame held, never
 * a zoom); its last one running on when its timeline lasts longer than her talk (an ending), as far as her video goes.
 */
function talkSegments(talk: SkillTalk, said: SkillSaid, line: SkillTimeline): ClipSegment[] {
  const segments = said.shots.map((shot, i): ClipSegment => {
    const asked = line.shots[i];
    const take = Math.max(0, Math.min(talk.takes.length, Math.round(asked?.take ?? shot.take)));
    const other = take ? talk.takes[take - 1]! : null;
    const piece = pieceAt(talk, shot);
    const fits = !other || (piece.in + other.offset >= 0 && piece.out + other.offset <= other.seconds);
    const punch = asked?.punch ?? shot.punch;
    const shift = other && fits ? other.offset : 0;
    return {
      clip_id: other && fits ? other.clip : talk.clip,
      in: round(piece.in + shift),
      out: round(piece.out + shift),
      zoom: "none",
      ...(punch ? { move: "punch" as const } : {}),
    };
  });
  const extra = line.duration - said.duration;
  const last = segments.at(-1);
  if (last && extra > 0.02) {
    const seconds = last.clip_id === talk.clip ? talk.seconds : (talk.takes.find((t) => t.clip === last.clip_id)?.seconds ?? talk.seconds);
    last.out = round(Math.min(seconds, last.out + extra));
  }
  return segments;
}

/** The piece of her main video a shot of her talk plays (its Reel span mapped back through her talk's pieces). */
function pieceAt(talk: SkillTalk, shot: { start: number; end: number }): { in: number; out: number } {
  const p = talk.pieces.find((x) => shot.start >= x.start - 0.01 && shot.start < x.end - 0.01) ?? talk.pieces.at(-1)!;
  return { in: round(p.in + (shot.start - p.start)), out: round(p.in + (Math.min(shot.end, p.end) - p.start)) };
}

/** Her own words as the plan's texts, in the order she says them, at their moments (the engine's, or its timeline's). */
function saidTexts(said: SkillSaid, line: SkillTimeline, duration: number): EditPlan["texts"] {
  const at = (slot: string) => line.texts[slot] ?? said.texts[slot];
  const text = (slot: string, words: string, style: "hook" | "band" | "caption", font?: string) => {
    const span = at(slot);
    if (!span) return [];
    const from = round(Math.max(0, span.from));
    const to = round(Math.min(duration, span.to));
    return to > from ? [{ text: words, from, to, style, ...(font ? { font } : {}) }] : [];
  };
  return [
    ...(said.hook ? text("accroche", said.hook.text, "hook") : []),
    ...said.ideas.flatMap((idea, k) => [
      ...text(`idee${k + 1}`, idea.text, "band", idea.font),
      ...idea.items.flatMap((item, j) => text(`idee${k + 1}_${j + 1}`, item.text, "caption", item.font)),
    ]),
  ];
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

// ——— A skill timed on her voice ——————————————————————————————————————————————————————————————————————————————————————

/** The longest Reel her talk makes (MAX_REEL_SECONDS of editor.ts: « je mettrai 45 »). */
export const TALK_MAX_SECONDS = 45;
/** Her video before her first word: she is seen before she speaks (the original's voice comes at 0,30 s). */
const TALK_LEAD = 0.35;
/** Her video after her last word: a breath, the end of her smile. */
const TALK_TAIL = 0.5;
/** A piece of her talk shorter than this with no whole word in it goes (as jumpCut's). */
const TALK_MIN_PIECE = 0.25;
/** Her hook stays at least this long (s) from the first image. */
const HOOK_HOLD = 1;
/** A keyword stays this much after its idea's last word (s), never into the next idea. */
const KEY_HOLD = 0.1;

/**
 * Her talking video cut as a creator cuts it, for a skill timed on her voice: from just before her first word to just
 * after her last, her hesitations, false starts and long pauses out (speechCuts: between two words, a breath kept), each
 * piece kept on the Reel's clock one after the other, her words moved with them, 45 s at most (cut after the last word
 * that fits). Her other angles of the same take ride along (`takes`). Null when she says fewer than three words.
 */
export function skillTalk(
  input: { clip: string; seconds: number; words: SkillWord[]; speech: ClipSpeech },
  options: { takes?: SkillTalk["takes"]; max?: number } = {},
): SkillTalk | null {
  const words = input.words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start && w.start >= 0 && w.end <= input.seconds + 0.05).sort((a, b) => a.start - b.start);
  if (words.length < 3) return null;
  const from = round(Math.max(0, words[0]!.start - TALK_LEAD));
  const to = round(Math.min(input.seconds, words.at(-1)!.end + TALK_TAIL));
  const cuts = speechCuts({ words, speech: input.speech }, from, to, { tail: false });
  const inside = (p: { start: number; end: number }) => words.some((w) => w.start >= p.start - 0.01 && w.end <= p.end + 0.01);
  const kept: { in: number; out: number }[] = [];
  let cursor = from;
  for (const c of [...cuts, { start: to, end: to }]) {
    if (c.start > cursor && (c.start - cursor >= TALK_MIN_PIECE || inside({ start: cursor, end: c.start }))) kept.push({ in: round(cursor), out: round(c.start) });
    cursor = Math.max(cursor, c.end);
  }
  // On the Reel's clock, 45 s at most: the piece that crosses it ends after its last word that fits.
  const max = options.max ?? TALK_MAX_SECONDS;
  const pieces: SkillTalk["pieces"] = [];
  let at = 0;
  for (const p of kept) {
    let out = p.out;
    if (at + (out - p.in) > max) {
      const last = words.filter((w) => w.start >= p.in - 0.01 && at + (w.end - p.in) + 0.1 <= max).at(-1);
      if (!last) break;
      out = round(Math.min(p.out, last.end + 0.1));
    }
    if (out - p.in < 0.05) break;
    pieces.push({ in: p.in, out, start: round(at), end: round(at + (out - p.in)) });
    at += out - p.in;
    if (out < p.out) break;
  }
  if (!pieces.length) return null;
  const onReel = words.flatMap((w) => {
    const p = pieces.find((x) => w.start >= x.in - 0.01 && w.end <= x.out + 0.01);
    return p ? [{ w: w.w, start: round(p.start + (w.start - p.in)), end: round(p.start + (w.end - p.in)) }] : [];
  });
  if (onReel.length < 3) return null;
  return { clip: input.clip, pieces, words: onReel, duration: round(at), takes: options.takes ?? [], seconds: input.seconds };
}

/** Her words as the filler reads them: numbered, phrase by phrase (a pause of a third of a second, or the end of a sentence, starts another). */
export function saidLines(words: SkillWord[]): string[] {
  const lines: string[] = [];
  let line: string[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (prev && line.length && (w.start - prev.end >= 0.33 || /[.!?…]$/.test(prev.w))) {
      lines.push(line.join(" "));
      line = [];
    }
    line.push(`[${i}] ${w.w}`);
  });
  if (line.length) lines.push(line.join(" "));
  return lines;
}

/**
 * The filler's choice in what she says, read against her words: every number one of hers; her hook among her first three
 * words, six at most, cut to its place (null when it is not); her ideas in order, never overlapping, as many as the
 * skill takes at most (the first ones), each keyword inside its idea and written as the filler wrote it (her word itself
 * when it wrote none), each name of a list inside its idea, in order, once; a font only where the skill asks for one and
 * of WORD_FONTS. Null when no idea is left (the filler failed: the editor makes the Reel).
 */
export function readSaid(voice: SkillVoice, talk: Pick<SkillTalk, "words">, answer: SkillFillAnswer["voice"]): SkillPicks | null {
  const n = talk.words.length;
  if (!answer || !n) return null;
  const index = (k: unknown) => (typeof k === "number" && Number.isFinite(k) ? Math.max(0, Math.min(n - 1, Math.round(k))) : null);
  const plain = (k: number) => talk.words[k]!.w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const keyFonts = voice.fonts?.includes("key");
  const itemFonts = voice.fonts?.includes("item");
  const ideas: SkillPicks["ideas"] = [];
  const sorted = [...(answer.ideas ?? [])].sort((a, b) => (index(a.from) ?? 0) - (index(b.from) ?? 0));
  for (const idea of sorted) {
    let from = index(idea.from);
    const to = index(idea.to);
    if (from === null || to === null) continue;
    // Never into the idea before it.
    const previous = ideas.at(-1);
    if (previous && from <= previous.to) from = previous.to + 1;
    if (to < from) continue;
    let key = index(idea.key) ?? from;
    if (key < from || key > to) key = from;
    const text = fitWords(idea.text ?? "", voice.max.key) || fitWords(plain(key), voice.max.key);
    if (!text) continue;
    const font = keyFonts ? wordFont(idea.font)?.family : undefined;
    const items: SkillPicks["ideas"][number]["items"] = [];
    if (voice.items) {
      for (const item of [...(idea.items ?? [])].sort((a, b) => (index(a.word) ?? 0) - (index(b.word) ?? 0))) {
        const word = index(item.word);
        if (word === null || word < from || word > to || items.some((x) => x.word === word)) continue;
        const named = fitWords(item.text ?? "", voice.max.item ?? voice.max.key) || fitWords(plain(word), voice.max.item ?? voice.max.key);
        const itemFont = itemFonts ? wordFont(item.font)?.family : undefined;
        if (named) items.push({ word, text: named, ...(itemFont ? { font: itemFont } : {}) });
      }
    }
    ideas.push({ from, to, key, text, ...(font ? { font } : {}), items });
    if (ideas.length >= voice.ideas[1]) break;
  }
  if (!ideas.length) return null;
  const hookFrom = index(answer.hook?.from);
  const hookTo = index(answer.hook?.to);
  const hookText = fitWords(answer.hook?.text ?? "", voice.max.hook);
  const hook = answer.hook && hookFrom !== null && hookTo !== null && hookFrom <= 2 && hookTo >= hookFrom && hookTo - hookFrom < 6 && hookText ? { from: hookFrom, to: hookTo, text: hookText } : null;
  return { hook, ideas };
}

/**
 * Her talk and what the filler chose in it, as a skill timed on her voice gets them (SkillSaid): each idea on the Reel's
 * clock, its pieces cut again where an idea ends inside one (between its last word and the next idea's first), each shot
 * the idea it belongs to and its angle (with her other take, every other idea on it, when it has her picture there;
 * else, unless the skill keeps one frame, every other idea framed tighter), its texts' default moments.
 */
export function skillSaid(talk: SkillTalk, picks: SkillPicks, voice: Pick<SkillVoice, "angles">): SkillSaid {
  const words = talk.words;
  const ideas = picks.ideas.map((idea) => ({
    text: idea.text,
    ...(idea.font ? { font: idea.font } : {}),
    words: [idea.from, idea.to] as [number, number],
    key: idea.key,
    from: words[idea.from]!.start,
    to: words[idea.to]!.end,
    at: words[idea.key]!.start,
    items: idea.items.map((item) => ({ text: item.text, ...(item.font ? { font: item.font } : {}), word: item.word, at: words[item.word]!.start })),
  }));
  // Where each idea begins on the Reel: halfway between the idea before it and its first word.
  const starts = ideas.map((idea, k) => (k === 0 ? 0 : round((ideas[k - 1]!.to + idea.from) / 2)));
  const pieces: (SkillTalk["pieces"][number] & { idea: number })[] = [];
  for (const p of talk.pieces) {
    let piece = { ...p };
    for (const cut of starts.slice(1)) {
      if (cut > piece.start + 0.1 && cut < piece.end - 0.1) {
        const at = round(piece.in + (cut - piece.start));
        pieces.push({ in: piece.in, out: at, start: piece.start, end: cut, idea: 0 });
        piece = { in: at, out: piece.out, start: cut, end: piece.end };
      }
    }
    pieces.push({ ...piece, idea: 0 });
  }
  for (const p of pieces) p.idea = Math.max(0, starts.filter((s) => s <= p.start + 0.01).length - 1);
  const angles = voice.angles !== false;
  const shots = pieces.map((p) => {
    // Her other take for every other idea, when it has the picture of that moment (two phones rarely start together).
    const take = angles && talk.takes.length ? p.idea % (talk.takes.length + 1) : 0;
    const other = take ? talk.takes[take - 1]! : null;
    const fits = !other || (p.in + other.offset >= 0 && p.out + other.offset <= other.seconds);
    return { start: p.start, end: p.end, idea: p.idea, take: fits ? take : 0, punch: angles && (!talk.takes.length || !fits) && p.idea % 2 === 1 };
  });
  const hook = picks.hook
    ? (() => {
        const next = words[picks.hook.to + 1];
        const until = Math.max(HOOK_HOLD, next ? next.start : words[picks.hook.to]!.end + 0.3);
        return { text: picks.hook.text, words: [picks.hook.from, picks.hook.to] as [number, number], from: 0, to: round(Math.min(talk.duration, until)) };
      })()
    : null;
  const texts: Record<string, { from: number; to: number }> = {};
  if (hook) texts.accroche = { from: hook.from, to: hook.to };
  ideas.forEach((idea, k) => {
    const until = round(Math.min(talk.duration, ideas[k + 1] ? Math.min(ideas[k + 1]!.from, idea.to + KEY_HOLD) : idea.to + KEY_HOLD));
    texts[`idee${k + 1}`] = { from: round(idea.at), to: until };
    idea.items.forEach((item, j) => (texts[`idee${k + 1}_${j + 1}`] = { from: round(item.at), to: until }));
  });
  return { words, duration: talk.duration, hook, ideas, shots, texts };
}

/**
 * What a Reel made on her voice chose in what she says, read back from its plan's texts (in the order they show): her
 * hook, each keyword, the names of its list. What a correction keeps but for what her request changes.
 */
export function saidCurrent(texts: { text: string; style: string }[]): string[] {
  const lines: string[] = [];
  let idea = 0;
  let items: string[] = [];
  const flush = () => {
    if (items.length && lines.length) lines[lines.length - 1] += ` ; sa liste : ${items.join(", ")}`;
    items = [];
  };
  for (const t of texts) {
    if (t.style === "hook") lines.push(`accroche : ${t.text}`);
    else if (t.style === "band") {
      flush();
      lines.push(`idée ${++idea} : ${t.text}`);
    } else if (t.style === "caption" && idea) items.push(t.text);
  }
  flush();
  return lines;
}

/** Her voice's texts by slot (« accroche », « idee1 », « idee1_1 »…), as a timeline's `words` gets them. */
export function saidWords(said: Pick<SkillSaid, "hook" | "ideas">): Record<string, string> {
  return Object.fromEntries([
    ...(said.hook ? [["accroche", said.hook.text] as const] : []),
    ...said.ideas.flatMap((idea, k) => [[`idee${k + 1}`, idea.text] as const, ...idea.items.map((item, j) => [`idee${k + 1}_${j + 1}`, item.text] as const)]),
  ]);
}

/**
 * The marks a skill timed on her voice gets besides its own (frames, read by its code by name): how many ideas
 * (said_ideas), each idea's first word, keyword and last word (said_idea1_from, said_idea1_key, said_idea1_to…), and
 * the end of her hook (said_hook_to) and of her last word (said_end).
 */
export function saidMarks(said: SkillSaid): Record<string, number> {
  const marks: Record<string, number> = { said_ideas: said.ideas.length, said_end: toFrame(said.words.at(-1)?.end ?? said.duration) };
  if (said.hook) marks.said_hook_to = toFrame(said.hook.to);
  said.ideas.slice(0, 20).forEach((idea, k) => {
    marks[`said_idea${k + 1}_from`] = toFrame(idea.from);
    marks[`said_idea${k + 1}_key`] = toFrame(idea.at);
    marks[`said_idea${k + 1}_to`] = toFrame(idea.to);
  });
  return marks;
}

/**
 * A nominal talk for a skill timed on her voice without hers (its lengths in the library, a test): n pieces of 4 s, a
 * word every 0,4 s, one idea per piece, its keyword its third word.
 */
export function nominalSaid(n: number, voice: Pick<SkillVoice, "angles">): SkillSaid {
  const count = Math.max(1, n);
  const words: SkillWord[] = Array.from({ length: count * 10 }, (_, i) => ({ w: `mot${i}`, start: round(0.3 + i * 0.4), end: round(0.6 + i * 0.4) }));
  const length = count * 4 + 0.5;
  const talk: SkillTalk = { clip: "", pieces: [{ in: 0, out: length, start: 0, end: length }], words, duration: length, takes: [], seconds: length };
  const picks: SkillPicks = { hook: { from: 0, to: 1, text: "mot0 mot1" }, ideas: Array.from({ length: count }, (_, k) => ({ from: k * 10, to: k * 10 + 9, key: k * 10 + 2, text: `mot${k * 10 + 2}`, items: [] })) };
  return skillSaid(talk, picks, voice);
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
  texts: z
    .array(
      z.object({
        slot: z.string().describe("The model's text slot"),
        text: z.string().describe("Its words, in French"),
        font: z.string().optional().describe("Only for a slot that asks for a font (« police »): the family of « polices » that evokes its word; left out otherwise"),
      }),
    )
    .describe("One per text slot of the model"),
  voice: z
    .object({
      hook: z
        .object({
          from: z.number().describe("The number of her first word written big"),
          to: z.number().describe("The number of the last one"),
          text: z.string().describe("Those words as she says them, spelled right"),
        })
        .nullable()
        .describe("Her first words written big from the first image (« accroche »); null when her start announces nothing"),
      ideas: z
        .array(
          z.object({
            from: z.number().describe("The number of its first word"),
            to: z.number().describe("The number of its last word: the idea ends when it is said"),
            key: z.number().describe("The number of its keyword, the one word that carries it"),
            text: z.string().describe("Its keyword as written on screen, as she says it, spelled right"),
            font: z.string().describe("The family of « polices » that evokes it, when the model asks for one; empty otherwise"),
            items: z
              .array(
                z.object({
                  word: z.number().describe("The number of the word that names it"),
                  text: z.string().describe("That name as written on screen, as she says it"),
                  font: z.string().describe("The family of « polices » that evokes it, when the model asks for one; empty otherwise"),
                }),
              )
              .describe("The names of a list she says in this idea, in order, when the model takes one (« liste »); empty otherwise"),
          }),
        )
        .describe("Her ideas in order (« idees »), each a run of her words"),
    })
    .optional()
    .describe("Only for a model timed on her voice (« voix »): what you choose in what she says (« ce_qu_elle_dit »)"),
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
- a slot that plays at the same time as another (« en_meme_temps_que »: a split screen's other half) is seen beside it, each at its own speed: the two answer each other as its « veut » says (the gesture and what it gives), each from another file, never the same passage;
- a photo plays still (at 0).

Then write its texts, in French (what her customers read), each in its slot (« textes »: what it says and its most characters):
- words she gives (« contrat », her request) are kept as she wrote them, only spelled right (accents, apostrophes, hyphens, « WhatsApp »), never one of her typos, never rewritten;
- otherwise words a good creator would write for this business: concrete, specific to it, never an ad slogan, a promise or a formula; nothing invented (no price, hour, place, offer or review that is not given);
- each within its most characters (count them), in normal case: the code sets the capitals when the model has them; a name longer than its place is never cut, write the word that sets it apart instead (« Farine » for « Maison Farine »: never « Maison »);
- an optional slot (obligatoire false) is left empty unless her request or the Reel needs those words; a required one is always written;
- a slot the engine writes itself (« ecrit_par_le_moteur », her place's coordinates) is never written by you: leave its text empty, and never repeat those words elsewhere.
"font": only for a slot (or a word of her voice) that asks for one (« police »): the family of « polices » whose « évoque » fits the word or what it names (« croissant » → a bakery's, « soin » → a beauty one, « fort » → a strong condensed one), a different family for each word of one list; empty when none fits (her own fonts then), never a family outside « polices ».

A model timed on her voice (« voix »): her talking video is the Reel, cut by the engine (her « euh » and long pauses out), so there are no slots to cast (« cases » empty: "shots" empty) and its words are her own, chosen in what she says (« ce_qu_elle_dit »: her words numbered, phrase by phrase). Her voice and the subtitles of what she says are this model's (they fit), its length is hers (« longueurs »). Answer "voice":
- "hook" (« accroche »): her first words written big from the first image, as the model wants them, by their numbers (from her first three words) and their text as she says them; null when her start announces nothing (« Bonjour, je suis… »): her first idea's keyword opens then;
- "ideas" (« idees »): her ideas in order, as many as the model takes, each from its first word to its last (it ends when its last word is said, the next starts with the next word), its keyword ("key": the number of the one word that carries it, said early; "text": that word as written on screen, as she says it, a name of two or three words kept whole, within its most characters), and the names of a list she says in it ("items", only when the model takes a list: each name's number and text, in order);
- every text is words she says, at their numbers, spelled right (a word the transcript misheard set right: « sois » for « soins »); never a word she does not say.

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
  /** Timed on her voice: her talk as the engine cut it (her words numbered, on the Reel's clock). */
  talk?: SkillTalk;
  /** A correction on her voice: what it chose in what she says now (saidCurrent), kept except what her request changes. */
  currentSaid?: string[];
  /** What the engine knows and writes itself in a slot (her place's coordinates). */
  facts?: SkillFacts;
}) {
  const voice = input.skill.voice;
  // On her voice, no slot to cast: her talk is its shots.
  const line = voice ? null : input.skill.timeline(input.n, { end: input.skill.end, ...(input.bpm ? { bpm: input.bpm } : {}) });
  const besides = line ? besideOf(line) : [];
  const fonts = input.skill.texts.some((t) => t.font) || Boolean(voice?.fonts?.length);
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
        if (voice) return `la longueur de ce qu'elle dit, ${TALK_MAX_SECONDS} s au plus (ce Reel : ${round(input.talk?.duration ?? 0)} s)`;
        const l = skillLengths(input.skill);
        return `de ${round(l.min)} à ${round(l.max)} s selon le nombre de cases et son tempo (ce Reel : ${round(line!.duration)} s, ${input.n} cases)`;
      })(),
    },
    // A slot that plays at the same time as another (a split screen's other half) says which one.
    cases: line
      ? line.shots.map((s, i) => {
          const beside = besides[i];
          return { case: i + 1, duree: `${round(s.end - s.start)} s`, veut: s.want, ...(beside !== null && beside !== undefined ? { en_meme_temps_que: beside + 1 } : {}) };
        })
      : [],
    ...(voice && input.talk
      ? {
          voix: {
            accroche: `${voice.hook} (${voice.max.hook} caractères au plus)`,
            idees: `de ${voice.ideas[0]} à ${voice.ideas[1]} ; chacune : ${voice.key} (${voice.max.key} caractères au plus)${voice.fonts?.includes("key") ? " ; police : oui" : ""}`,
            liste: voice.items ? `${voice.items} (${voice.max.item ?? voice.max.key} caractères au plus par nom)${voice.fonts?.includes("item") ? " ; police : oui, une différente par nom" : ""}` : "aucune",
          },
          ce_qu_elle_dit: saidLines(input.talk.words),
          ...(input.currentSaid?.length ? { voix_actuelle: input.currentSaid } : {}),
        }
      : {}),
    textes: input.skill.texts.map((t) => {
      const fact = t.fact ? skillFact(t, input.facts) : undefined;
      // A fact the engine writes (her coordinates) is shown as written, never to be written again.
      return fact
        ? { slot: t.slot, ecrit_par_le_moteur: fact, obligatoire: false }
        : { slot: t.slot, dit: t.want, max_caracteres: t.max, obligatoire: t.required || Boolean(input.wordsWanted), ...(t.font ? { police: "oui" } : {}) };
    }),
    ...(fonts ? { polices: wordFontsBrief() } : {}),
    ...(input.skill.settings?.length
      ? { reglages: input.skill.settings.map((x) => ({ nom: x.name, change: x.want, choix: x.choices.map((c, i) => `${c.value} : ${c.says}${i === 0 ? " (celui de l'original, par défaut)" : ""}`) })) }
      : {}),
    // Each object on the slot its timeline gives it for this count (counted from the end, or placed by the timeline); none past its slots.
    ...(input.skill.objects?.length && line
      ? {
          objets: input.skill.objects.flatMap((o) => {
            const shot = skillObjectShot(o, line);
            return shot === null ? [] : [{ slot: o.slot, case: shot + 1, cherche: o.want }];
          }),
        }
      : {}),
    ...(input.current ? { textes_actuels: input.current } : {}),
    ...(input.currentSettings && Object.keys(input.currentSettings).length ? { reglages_actuels: input.currentSettings } : {}),
    fichiers: input.files.map((f) => {
      const format = fileFormat(f.aspect);
      return f.photo
        ? { id: f.id, type: "photo", ...(format ? { format } : {}), montre: f.shows }
        : {
            id: f.id,
            type: "vidéo",
            ...(format ? { format } : {}),
            duree: `${round(f.seconds)} s`,
            montre: f.shows,
            moments: f.moments?.slice(0, 6).map((m) => ({ de: round(m.start), a: round(m.end), ...(m.what ? { quoi: m.what } : {}) })),
          };
    }),
  };
}
