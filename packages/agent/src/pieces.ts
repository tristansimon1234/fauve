import { z } from "zod";
import type { PhotoFacts } from "./finish.ts";
import { houseModel } from "./house-models.ts";
import { REEL_FPS } from "./motion.ts";
import { isClipSegment, segmentSpans, SLOT_NAME, type ClipAnalysis, type EditPlan, type MotionDrawn, type PlanLayer, type SfxCue } from "./schemas.ts";
import { fitWords, skillObjectName, skillSettings, type SkillSetting } from "./skills.ts";

// The bank of ready-to-play effects (chantier A of docs/reprise.md; docs/modeles.md, « Banque d'effets prêts à jouer »).
// A model of Edith's is a whole Reel coded once, like an Edits or CapCut template: her files in its slots, her words in its
// texts. An effect of the bank is what CapCut calls an effect: the signature moment of one of those models, cut out of it
// and coded once to be dropped on a moment of any Reel, over the shots there, with its words. The editor lays it (which
// shots, which moment: an animation over the montage, « layers », its brief naming it « [borrow: <key>] »); one small call
// writes its words and names what it lights up in her shots (Sonnet: PIECE_FILL_PROMPT); the engine plays its code as it
// is, checked like any animation, with no motion designer (Tristan on the creative test, whose motion designer rewrote a
// model's effect for 0,42 €: « il faut capitaliser sur ce qu'on sait faire au lieu de réinventer »). One per Reel: one
// charter, one music, never a patchwork. Each piece is in pieces/<key>.ts, the bank in piece-library.ts (its code, server
// side only: @fauve/agent/pieces); this file is its form, its filler's prompt and how its plan is read, pure data.
//
// Its code is a layer over the montage: plain JS defining function Scene({ width, height, durationInFrames, brand, shots,
// texts, cuts }) (h = React.createElement, the kit's scope of motion-scene.ts), playing from the first frame of its span
// to its last, over her shots playing full frame under it (it may cover them). It finds its own shots in `shots` (the
// Reel's shots up to its end, `from` in frames from its start, so negative for one that started before it): those that
// play during it, `const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from +
// shots[i].durationInFrames > 0)`. It reads its words by their slot (texts[slot], already cut to their place), its
// settings by their name, and its marks (frames from its start, numbers as strings): `beat`, the frames of one beat of
// the Reel's tempo, and those its timeline gives. It holds for any length within its `seconds` and any number of shots
// within its `shots`, with or without its optional words; where it writes « @slot » it names an object of one of its
// shots, replaced by what its filler saw there (left as is when nothing fits: its code does without).

/** One of its words: what its filler writes there (in French, for the filler and Tristan) and the most characters it holds. */
export type PieceText = { slot: string; want: string; max: number; required: boolean };

/**
 * Something in one of its shots its code lights up, cuts out or follows (her door, her sign, her windows): written
 * « @slot » in its code, named by its filler in plain English from what that shot shows. `shot`: which of its shots
 * (0 its first; negative, from its last: −1).
 */
export type PieceObject = { slot: string; shot: number; want: string };

/** A shot's size, as the analysis reads it. */
export type PieceFraming = "wide" | "medium" | "close" | "detail";

/**
 * What it needs in her files to be offered at all, read on what was seen of them (Gemini's analysis, her photos'
 * reading): enough distinct files for a run of shots, and one shot that can carry it (its framing, a still camera, a
 * place outdoors with its sky, indoors, someone in it, a video rather than a photo).
 */
export type PieceNeeds = {
  files?: number;
  shot?: { framing?: PieceFraming[]; still?: boolean; outdoors?: boolean; indoors?: boolean; person?: boolean; video?: boolean };
};

/** What its timeline gives for a span: its marks (frames from its start), its sounds (s from its start), the shots it cuts her out on (by their rank among its shots). */
export type PieceTimeline = {
  marks?: Record<string, number>;
  sounds?: { at: number; sound: string; seconds?: number; gain?: number }[];
  cutouts?: number[];
};

/** Its span as its timeline gets it: its frames, the Reel's tempo, its shots (each one's start, frames from its start, and length), her words and its settings. */
export type PieceTimelineInput = { frames: number; bpm: number; shots: { from: number; frames: number }[]; words: Record<string, string>; settings: Record<string, string> };

export type EffectPiece = {
  /** The model it comes from (house-models.ts): the signature effect of that model. */
  key: string;
  /** Raised whenever its code or its timing changes. */
  version: number;
  /** Its name for the editor and Tristan (French). */
  name: string;
  /** What it does, in a sentence (French). */
  how: string;
  /** What it needs in her videos, in a sentence (French: its « Il faut »). */
  needs: string;
  /** Where the editor lays it, in a sentence (French: its « Se pose » — which shots under it, how long). */
  lays: string;
  /** How many of her shots play under it: at least, at most (a run of shots: its first one is where it says). */
  shots: [number, number];
  /** Its length (s): at least, at most. */
  seconds: [number, number];
  /** Read on her files to offer it (piecesOffered). */
  require: PieceNeeds;
  texts: PieceText[];
  objects?: PieceObject[];
  /** What her words can change in it (like a skill's: SkillSetting), the first choice the default. */
  settings?: SkillSetting[];
  timeline?(input: PieceTimelineInput): PieceTimeline;
  code: string;
  /** Google Fonts families its code brings besides the Reel's two. */
  fonts?: string[];
};

/** The most effects of the bank one Reel plays: one charter, one music, never a patchwork. */
export const MAX_PIECES = 1;
/** The most effects of the bank the editor is offered for one Reel: those her files can carry, the best first. */
export const PIECES_OFFERED = 5;

// ——— Her files as the bank reads them ————————————————————————————————————————————————————————————————————————————

/** One of her shots as the bank weighs it: a shot Gemini saw in a video, or a photo whole. */
export type PieceShot = {
  id: string;
  photo: boolean;
  framing?: PieceFraming;
  still: boolean;
  outdoors: boolean;
  indoors: boolean;
  person: boolean;
  beauty: number;
};

const OUTDOORS = /ext[ée]rieur|\brue\b|trottoir|terrasse|fa[çc]ade|devanture|\bciel\b|\btoits?\b|plage|\bmer\b|\bparc\b|jardin|paysage|\bplace\b|quartier|\bville\b|jet[ée]e|plein air|montagne|colline|for[êe]t|\bchamps?\b|\bquai\b|\bport\b|\bpont\b|outdoor|street|\bsky\b/i;
const INDOORS = /int[ée]rieur|\bsalle\b|boutique|cuisine|comptoir|atelier|\bstudio\b|\bbar\b|restaurant|salon|magasin|librairie|\brayons?\b|\bpi[èe]ce\b|\bchambre\b|indoor|\bshop\b|\broom\b/i;
const PERSON = /personne|femme|homme|\bfille\b|gar[çc]on|client|cliente|[ée]quipe|serveu|barista|vendeu|coiffeu|fleuriste|passants?|people|woman|\bman\b|\bgens\b|\bcouple\b|enfant|silhouette|visage|profil/i;

/** Her shots as the bank weighs them: each shot of each video as Gemini read it (blurred or dark ones left out), each photo whole. */
export function pieceShots(clips: { media_id: string; analysis: ClipAnalysis }[], photos: Record<string, PhotoFacts>): PieceShot[] {
  const fromClips = clips.flatMap(({ media_id, analysis }) =>
    analysis.shots
      .filter((s) => !s.quality.blurry && !s.quality.dark)
      .map((s): PieceShot => {
        return {
          id: media_id,
          photo: false,
          ...(s.framing ? { framing: s.framing } : {}),
          still: s.camera === "static" && !s.quality.shaky,
          outdoors: OUTDOORS.test(analysis.setting) || OUTDOORS.test(s.description),
          indoors: INDOORS.test(analysis.setting) && !OUTDOORS.test(analysis.setting),
          person: s.faces_visible || PERSON.test(s.subject) || PERSON.test(s.description),
          beauty: s.beauty ?? 3,
        };
      }),
  );
  const fromPhotos = Object.entries(photos).map(([id, p]): PieceShot => {
    const notes = p.detection.notes ?? "";
    return {
      id,
      photo: true,
      still: true,
      outdoors: OUTDOORS.test(notes),
      indoors: INDOORS.test(notes) && !OUTDOORS.test(notes),
      person: p.detection.regions.some((r) => r.kind === "face") || PERSON.test(notes),
      beauty: 3,
    };
  });
  return [...fromClips, ...fromPhotos];
}

/** How well one of her shots carries a piece: null when it cannot, else a score (its beauty, its framing exactly the one wanted). */
function carries(need: NonNullable<PieceNeeds["shot"]>, shot: PieceShot): number | null {
  if (need.video && shot.photo) return null;
  if (need.framing && (!shot.framing || !need.framing.includes(shot.framing))) return shot.photo && !need.video && need.framing.includes("wide") ? 1 : null;
  if (need.still && !shot.still) return null;
  if (need.outdoors && !shot.outdoors) return null;
  if (need.indoors && !shot.indoors) return null;
  if (need.person && !shot.person) return null;
  return shot.beauty + (need.framing && shot.framing === need.framing[0] ? 1 : 0);
}

/**
 * The pieces her files can carry, the best first (PIECES_OFFERED at most; in the bank's order on a tie): enough of her
 * files, and a shot of the kind it needs. What was read on her files is coarse (a sky is not measured yet): the editor
 * reads each one's « Il faut » and lays it only where her shots have it.
 */
export function piecesOffered(pieces: EffectPiece[], shots: PieceShot[], files: number, most = PIECES_OFFERED): EffectPiece[] {
  const scored = pieces.flatMap((piece, order) => {
    if ((piece.require.files ?? 1) > files) return [];
    const need = piece.require.shot;
    const best = need ? Math.max(-1, ...shots.map((s) => carries(need, s) ?? -1)) : 3;
    return best < 0 ? [] : [{ piece, order, best }];
  });
  return scored
    .sort((a, b) => b.best - a.best || a.order - b.order)
    .slice(0, most)
    .map((s) => s.piece);
}

// ——— What the editor is given ——————————————————————————————————————————————————————————————————————————————————————

/** Its words for the editor: what each slot says and how long it may be. */
const wordsOf = (piece: Pick<EffectPiece, "texts">) =>
  piece.texts.map((t) => `${t.want} (${t.max} signes au plus${t.required ? "" : ", facultatif"})`).join(" ; ") || "aucun";

/** One piece's line for the editor (French, as its fiche and Tristan read it): its key, its name, what it does, what it needs, where it lays, its words. */
export function pieceLine(piece: EffectPiece): string {
  const name = piece.name || houseModel(piece.key)?.name || piece.key;
  const span = `${String(piece.seconds[0]).replace(".", ",")} à ${String(piece.seconds[1]).replace(".", ",")} s`;
  return `${piece.key} — ${name} : ${piece.how} Il faut : ${piece.needs} Se pose : ${piece.lays} (${span}). Ses mots : ${wordsOf(piece)}.`;
}

/** The editor's rule for the ready effects of the bank (its input's « effets_des_modeles », beside the font pairs: its prompt stays under 17 000 characters). */
export const BORROW_PIECES = `Ready-to-play effects from Edith's models, one line each: its key, its name, what it does, what it needs in her videos (« Il faut »), where it lays (« Se pose ») and its words (« Ses mots »). Each one is coded and tested once, like a CapCut effect: the engine plays it exactly as it is over the shots you lay it on, her words written in it, in her charter, with no motion designer, so it never comes out average and costs next to nothing. When one serves this Reel and her videos really have what it needs, lay ONE, never more: an animation in « layers » (from, to: seconds of the Reel) over the shots its « Se pose » says, cut for it (its first shot where it says, its length within its own), its brief beginning with [borrow: <key>], then the message, the words on screen in « » for its « Ses mots », what the shots under it show, and the energy. It writes its own words: none of your texts during it. None rather than a forced one: the Reel is then yours as usual. It counts as one of your animations (« max_new_scenes »); for the moment it serves, prefer it to an animation of your own.`;

/** What the editor gets for a Reel made in none of Edith's models: the rule and the line of each piece offered; nothing without one. */
export function piecesForEditor(pieces: EffectPiece[]): { rule: string; effets: string[] } | undefined {
  return pieces.length ? { rule: BORROW_PIECES, effets: pieces.map(pieceLine) } : undefined;
}

// ——— Its filler ————————————————————————————————————————————————————————————————————————————————————————————————————

export const PIECE_FILL_PROMPT = `You fill one of Edith's ready-made effects (Edith is an AI community manager for local businesses) on one moment of a Reel, like a CapCut effect dropped on a clip of the timeline: its code is written and tested, it plays exactly as it is; you only write its words and name what it uses in her shots. The editor cut the Reel and laid the effect over some of her shots (« plans_dessous », in order: what each one shows), with a brief in English saying its message and the words on screen in « »; her own request (« demande ») and what she fixed (« contrat ») come first.

"fits": false only when the shots under it cannot carry it (what « effet.il_faut » needs is not there: no wide shot, nobody, nothing to light up where it must be) or her request asks for something the effect does not do; then "missing" says what, in one short sentence in French. Otherwise true, "missing" empty.

"texts": one per slot of « effet.ses_mots », the words on screen, in French as her customers read them:
- the brief's words in « » for this slot when it gives some, else words from her request and her business (« commerce »: its name, its trade, what is known of it); her own words kept as she wrote them, only spelled right;
- a creator's words, concrete, specific to this business, never an ad slogan; nothing invented (no price, hour, address, offer or review that is not given);
- within its « max » characters (count them), in normal case (the code sets the capitals); a name longer than its place is never cut: the word that sets it apart (« Farine » for « Maison Farine »);
- a required slot (« obligatoire » true) always written, an optional one only when the brief or her request wants those words, else an empty text;
- « mots_actuels » (a correction): keep them, but what her request changes.
"objects": one per slot of « effet.ses_objets »: what in the shot it names (« plan », among « plans_dessous ») carries it, named in plain English as the eye sees it, two to four words (« back door », « shop window », « shop sign », « every window », « string lights »), « every » first for several to take one after the other; « none » when nothing in that shot fits (the code does without).
"settings": only a setting of « effet.reglages » her request or the brief asks for, with the value that does it; otherwise none.`;

export const pieceFillSchema = z.object({
  fits: z.boolean().describe("true when the shots under it carry the effect and her request is served by it"),
  missing: z.string().describe("When fits is false: what is missing, in one short sentence in French; empty otherwise"),
  texts: z.array(z.object({ slot: z.string().describe("A slot of « effet.ses_mots »"), text: z.string().describe("Its words, in French; empty to leave an optional one out") })),
  objects: z.array(z.object({ slot: z.string().describe("A slot of « effet.ses_objets »"), name: z.string().describe("What carries it in that shot, in plain English; « none » when nothing fits") })),
  settings: z.array(z.object({ name: z.string(), value: z.string() })),
});
export type PieceFillAnswer = z.infer<typeof pieceFillSchema>;

/** One of the shots under it, as its filler reads it. */
export type PieceUnder = { id: string; photo: boolean; shows: string; framing?: string; camera?: string };

/** What its filler is given (French keys, as the skills' filler reads them). */
export function pieceFillInput(input: {
  piece: EffectPiece;
  under: PieceUnder[];
  brief: string;
  request: string;
  business: { name?: string | null; activity?: string | null; facts?: string[] };
  contract?: string[];
  current?: Record<string, string>;
}) {
  const { piece, under } = input;
  const n = under.length;
  return {
    effet: {
      cle: piece.key,
      nom: piece.name,
      ce_qu_il_fait: piece.how,
      il_faut: piece.needs,
      ses_mots: piece.texts.map((t) => ({ slot: t.slot, veut: t.want, max: t.max, obligatoire: t.required })),
      ...(piece.objects?.length
        ? {
            ses_objets: piece.objects.flatMap((o) => {
              const k = o.shot < 0 ? n + o.shot : o.shot;
              return k >= 0 && k < n ? [{ slot: o.slot, plan: k + 1, cherche: o.want }] : [];
            }),
          }
        : {}),
      ...(piece.settings?.length ? { reglages: piece.settings.map((s) => ({ name: s.name, veut: s.want, choix: s.choices })) } : {}),
    },
    plans_dessous: under.map((u, i) => ({ plan: i + 1, fichier: u.id, ...(u.photo ? { photo: true } : {}), montre: u.shows, ...(u.framing ? { valeur: u.framing } : {}), ...(u.camera ? { camera: u.camera } : {}) })),
    brief: input.brief,
    demande: input.request,
    commerce: { nom: input.business.name ?? undefined, activite: input.business.activity ?? undefined, ...(input.business.facts?.length ? { ce_qu_on_sait: input.business.facts } : {}) },
    ...(input.contract?.length ? { contrat: input.contract } : {}),
    ...(input.current && Object.keys(input.current).length ? { mots_actuels: input.current } : {}),
  };
}

/** Its filler's answer read: its words cut to their place, its objects named, its settings; null when it does not fit or a required word is missing. */
export type PieceFill = { texts: Record<string, string>; objects: Record<string, string>; settings: Record<string, string> };

export function readPieceFill(piece: Pick<EffectPiece, "texts" | "objects" | "settings">, answer: PieceFillAnswer): PieceFill | null {
  if (!answer.fits) return null;
  const texts: Record<string, string> = {};
  for (const t of piece.texts) {
    const words = fitWords(answer.texts.find((w) => w.slot === t.slot)?.text ?? "", t.max);
    if (words) texts[t.slot] = words;
    else if (t.required) return null;
  }
  const objects: Record<string, string> = {};
  for (const o of piece.objects ?? []) {
    const name = skillObjectName(answer.objects.find((x) => x.slot === o.slot)?.name);
    if (name) objects[o.slot] = name;
  }
  return { texts, objects, settings: skillSettings(piece, answer.settings) };
}

// ——— Its plan ——————————————————————————————————————————————————————————————————————————————————————————————————————

/** Its code with its objects named: « @slot » replaced by what its filler saw in her shot, the others left (no object). */
export function pieceCode(piece: Pick<EffectPiece, "code" | "objects">, objects: Record<string, string>): string {
  let code = piece.code;
  for (const o of piece.objects ?? []) {
    const name = skillObjectName(objects[o.slot]);
    if (name) code = code.split(`"@${o.slot}"`).join(JSON.stringify(name));
  }
  return code;
}

/** The shots under a layer: their index among her shots (as its code's `shots` and motion.drawn count them), in order. */
export function layerShots(plan: Pick<EditPlan, "segments">, layer: Pick<PlanLayer, "from" | "to">): number[] {
  const { spans } = segmentSpans(plan.segments);
  const clips = plan.segments.flatMap((s, i) => (isClipSegment(s) ? [spans[i]!] : []));
  return clips.flatMap((s, k) => (s.start + s.length > layer.from + 0.05 && s.start < layer.to - 0.05 ? [k] : []));
}

/** Which piece of the bank a layer's brief names (« [borrow: <key>] »), among those offered. */
export function layerPiece(layer: Pick<PlanLayer, "motion" | "compose">, offered: Iterable<string>): string | undefined {
  if (layer.compose) return undefined;
  const brief = layer.motion.brief;
  const keys = [...offered];
  for (const mark of brief.matchAll(/\[\s*borrow\s*:\s*([^\]]{1,200})\]/gi)) {
    const said = ` ${mark[1]!.toLowerCase()} `;
    const key = keys.find((k) => new RegExp(`(?<![a-z0-9-])${k.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?![a-z0-9-])`).test(said));
    if (key) return key;
  }
  return undefined;
}

/** The layers of a plan that play a piece of the bank (MAX_PIECES at most, the first ones), with its key. */
export function pieceLayers(plan: Pick<EditPlan, "layers">, offered: Iterable<string>, most = MAX_PIECES): { index: number; key: string }[] {
  const keys = [...offered];
  const found: { index: number; key: string }[] = [];
  for (const [index, layer] of (plan.layers ?? []).entries()) {
    const key = layerPiece(layer, keys);
    if (key && found.length < most) found.push({ index, key });
  }
  return found;
}

/** Its words as a correction finds them on the version it corrects: its slots only (never its marks nor its settings). */
export function pieceWordsOf(piece: Pick<EffectPiece, "texts">, motion: Pick<PlanLayer["motion"], "texts"> | undefined): Record<string, string> {
  return Object.fromEntries(piece.texts.flatMap((t) => (motion?.texts?.[t.slot] ? [[t.slot, motion.texts[t.slot]!] as const] : [])));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its layer's motion over the shots under it: its code (its objects named), its words, settings and marks as its slot
 * texts (`beat` always: the frames of one beat), what it draws of her shots (motion.drawn: the shots it cuts her out on,
 * each object on its shot, by their index among her shots), its sounds (s from its start), its fonts and which piece it
 * is. Its code is plain JS: the scene check compiles it and gives back its js.
 */
export function pieceMotion(input: {
  piece: EffectPiece;
  fill: PieceFill;
  plan: Pick<EditPlan, "segments" | "tempo">;
  layer: Pick<PlanLayer, "from" | "to" | "motion">;
  bpm: number;
}): PlanLayer["motion"] {
  const { piece, fill, plan, layer } = input;
  const under = layerShots(plan, layer);
  const frames = Math.max(1, Math.round((layer.to - layer.from) * REEL_FPS));
  const { spans } = segmentSpans(plan.segments);
  const clipSpans = plan.segments.flatMap((s, i) => (isClipSegment(s) ? [spans[i]!] : []));
  const shots = under.map((k) => ({ from: Math.round((clipSpans[k]!.start - layer.from) * REEL_FPS), frames: Math.round(clipSpans[k]!.length * REEL_FPS) }));
  const bpm = Math.min(140, Math.max(60, input.bpm));
  const line = piece.timeline?.({ frames, bpm, shots, words: fill.texts, settings: fill.settings }) ?? {};
  const marks: Record<string, number> = { beat: (60 / bpm) * REEL_FPS, ...line.marks };
  const texts: Record<string, string> = {
    ...Object.fromEntries(Object.entries(marks).flatMap(([k, v]) => (SLOT_NAME.test(k) && Number.isFinite(v) ? [[k, String(round3(v))] as const] : []))),
    ...fill.settings,
    ...fill.texts,
  };
  const at = (rank: number) => (rank < 0 ? under[under.length + rank] : under[rank]);
  const subjects = [...new Set((line.cutouts ?? []).flatMap((r) => (at(r) === undefined ? [] : [at(r)!])))].sort((a, b) => a - b);
  const objects = (piece.objects ?? []).flatMap((o) => {
    const shot = at(o.shot);
    const name = skillObjectName(fill.objects[o.slot]);
    return shot !== undefined && name ? [{ shot, name }] : [];
  });
  const count = plan.segments.filter(isClipSegment).length;
  const drawn: MotionDrawn | undefined = subjects.length || objects.length ? { shots: count, ...(subjects.length ? { subjects } : {}), ...(objects.length ? { objects } : {}) } : undefined;
  const seconds = frames / REEL_FPS;
  const sounds: SfxCue[] = (line.sounds ?? [])
    .filter((s) => Number.isFinite(s.at) && s.at >= 0 && s.at < seconds - 0.05 && s.sound.trim().length >= 2)
    .sort((a, b) => a.at - b.at)
    .slice(0, 16)
    .map((s) => ({
      at: round3(s.at),
      sound: s.sound.trim().slice(0, 60),
      ...(s.seconds !== undefined ? { seconds: Math.min(3, Math.max(0.5, s.seconds)) } : {}),
      ...(s.gain ? { gain: Math.round(Math.min(6, Math.max(-24, s.gain)) * 10) / 10 } : {}),
      skill: true,
    }));
  const code = pieceCode(piece, fill.objects);
  // What a fallback, a correction or an animation over it reads: its brief as the editor wrote it, nothing of its earlier code.
  const { code: _code, js: _js, texts: _texts, drawn: _drawn, sounds: _sounds, fonts: _fonts, piece: _piece, ...rest } = layer.motion;
  return {
    ...rest,
    code,
    js: code,
    texts,
    ...(drawn ? { drawn } : {}),
    ...(sounds.length ? { sounds } : {}),
    ...(piece.fonts?.length ? { fonts: piece.fonts.slice(0, 3) } : {}),
    piece: { key: piece.key, version: piece.version },
  };
}

/**
 * A plain montage of her files with a piece laid over a span of it, as the chain makes it once the editor has cut it:
 * for its tests and its local render (scripts/skill-render.mts --piece), never for a Reel of hers.
 */
export function pieceTestPlan(input: { piece: EffectPiece; shots: { file: string; at: number; seconds: number; photo?: boolean }[]; span: [number, number]; fill: PieceFill; bpm: number }): EditPlan {
  const { piece, fill, bpm } = input;
  const segments = input.shots.map((s) => ({ clip_id: s.file, in: s.photo ? 0 : round3(s.at), out: round3(s.photo ? s.seconds : s.at + s.seconds), zoom: "none" as const }));
  const duration = round3(input.shots.reduce((sum, s) => sum + s.seconds, 0));
  const layer = { motion: { brief: `[borrow: ${piece.key}] ${piece.name}` }, from: round3(Math.max(0, input.span[0])), to: round3(Math.min(duration, input.span[1])) };
  const plan: EditPlan = { format: "9:16", duration, template: "libre", tempo: bpm, segments, texts: [], images: [], transitions: "cut", subtitles: false, music: null };
  return { ...plan, layers: [{ ...layer, motion: pieceMotion({ piece, fill, plan, layer, bpm }) }] };
}

/** A layer's motion as the editor left it, for the motion designer to write when the piece could not play (its brief alone). */
export function unplayedPiece(motion: PlanLayer["motion"]): PlanLayer["motion"] {
  const { code: _code, js: _js, texts: _texts, drawn: _drawn, sounds: _sounds, fonts: _fonts, piece: _piece, ...rest } = motion;
  return rest;
}
