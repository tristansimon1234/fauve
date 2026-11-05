import { z } from "zod";
import type { PhotoFacts } from "./finish.ts";
import { houseModel } from "./house-models.ts";
import { REEL_FPS } from "./motion.ts";
import { isClipSegment, screenTime, segmentSpans, SLOT_NAME, type ClipAnalysis, type EditPlan, type HandMomentKind, type MotionDrawn, type PlanLayer, type SfxCue } from "./schemas.ts";
import { readMusicShape, type MusicShape } from "./music-shape.ts";
import { BURST_MAX } from "./sfx.ts";
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
// play during it, as the engine counts them in `texts.mine` (their indices in `shots`, comma separated), else
// `const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from +
// shots[i].durationInFrames > 0)`. It reads its words by their slot (texts[slot], already cut to their place), its
// settings by their name, and its marks (frames from its start, numbers as strings): `beat`, the frames of one beat of
// the Reel's tempo, and those its timeline gives. It holds for any length within its `seconds` and any number of shots
// within its `shots`, with or without its optional words; where it writes « @slot » it names an object of one of its
// shots, replaced by what its filler saw there (left as is when nothing fits: its code does without).
//
// Three more things an effect can ask for. `spoken`: it is timed on what she says under it (her keyword written big
// above her head as she says it): its code gets the words said under it, each at its frame (`spoken`, the engine's
// subtitles staying under it), and its filler reads them to choose its words among hers. `photos`: up to four of her
// photos (her work, what she names) laid in it, chosen by its filler from what each one shows, given to its code as
// `photos` (each { src, aspect, cutout, subject }). A text of it may be written by the engine from what it knows
// (`fact`: her place's coordinates, as a skill's), and a sound of its timeline may land on a gesture of hers in one of
// its shots (`hand`: a click as her hand touches the switch).

/**
 * One of its words: what its filler writes there (in French, for the filler and Tristan) and the most characters it
 * holds. `fact`: written by the engine from what it knows, never by its filler (« coordinates », her place's, skills.ts):
 * when it is not known, its filler writes the slot as its `want` says (its fallback: her neighbourhood).
 */
export type PieceText = { slot: string; want: string; max: number; required: boolean; fact?: "coordinates" };

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
  /** `wide`: filmed in width (a video Gemini saw in landscape, a photo wider than high). */
  shot?: { framing?: PieceFraming[]; still?: boolean; outdoors?: boolean; indoors?: boolean; person?: boolean; video?: boolean; wide?: boolean };
};

/**
 * What its timeline gives for a span: its marks (frames from its start), its sounds (s from its start; `hand`: on a
 * gesture of hers in one of its shots, by its rank among them, negative from its last, `within` seconds from its start,
 * `at` its moment when nothing is read there), the shots it cuts her out on (by their rank among its shots).
 */
export type PieceTimeline = {
  marks?: Record<string, number>;
  /** `burst`: the same sound laid again at each of `times` (s after `at`), each at its own `gains` (dB), as a skill's (a clicking that slows down). */
  sounds?: {
    at: number;
    sound: string;
    seconds?: number;
    gain?: number;
    hand?: { shot: number; moment: HandMomentKind; within?: [number, number] };
    burst?: { times: number[]; gains?: number[] };
  }[];
  cutouts?: number[];
  /**
   * How it shapes the Reel's music during it (music-shape.ts, seconds from its start): where it stops dead and comes back
   * (`pauses`: a name written in silence), where it plays filtered (`filters`: muffled while the room is dark, opened when
   * it lights up). Laid on the Reel's music when the Reel has no shape of its own (a model's).
   */
  music?: Pick<MusicShape, "pauses" | "filters">;
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
  /** Timed on what she says under it: its code gets `spoken` (her words, each at its frame), its filler what she says. */
  spoken?: boolean;
  /** Her photos it lays (her work, what she names): what they are, in French for its filler, and how many (four at most). */
  photos?: { want: string; most: number };
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
  /** Filmed in width: her video in landscape, her photo wider than high. */
  wide?: boolean;
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
          wide: analysis.orientation === "landscape",
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
      wide: p.width > p.height * 1.1,
    };
  });
  return [...fromClips, ...fromPhotos];
}

/** How well one of her shots carries a piece: null when it cannot, else a score (its beauty, its framing exactly the one wanted). */
function carries(need: NonNullable<PieceNeeds["shot"]>, shot: PieceShot): number | null {
  if (need.video && shot.photo) return null;
  let score = shot.beauty;
  if (need.framing) {
    if (shot.framing) {
      if (!need.framing.includes(shot.framing)) return null;
      if (shot.framing === need.framing[0]) score += 1;
    } else if (shot.photo) {
      // A photo's size is not read (only what it shows): it may carry any framing asked for, weighed low (her plates for
      // the mosaic, her wide picture of the room for the frame in the frame).
      score = 1;
    } else return null;
  }
  if (need.still && !shot.still) return null;
  if (need.outdoors && !shot.outdoors) return null;
  if (need.indoors && !shot.indoors) return null;
  if (need.person && !shot.person) return null;
  if (need.wide && !shot.wide) return null;
  return score;
}

/** Words as compared: lower case, no accents, letters and digits only. */
const plainWords = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A number from a text, the same each time (a tie between two pieces broken one way for one Reel, another way for the next). */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The pieces her files can carry, the best first (PIECES_OFFERED at most): enough of her files, and a shot of the kind it
 * needs. What was read on her files is coarse (a sky is not measured yet): the editor reads each one's « Il faut » and
 * lays it only where her shots have it. Never the same few for every Reel (Tristan: « il va proposer la même chose à
 * tout le monde »): one her request names comes first (« une mosaïque de mes plats »: its name, or its model's), the ones
 * her latest Reels played come last (`avoid`), and a tie is broken by the Reel (`seed`, its post), not by the bank's order.
 */
export function piecesOffered(
  pieces: EffectPiece[],
  shots: PieceShot[],
  files: number,
  most = PIECES_OFFERED,
  options: { avoid?: Iterable<string>; request?: string; seed?: string } = {},
): EffectPiece[] {
  const avoid = new Set(options.avoid ?? []);
  const asked = ` ${plainWords(options.request ?? "")} `;
  // Named in her request: its model's key as words (« mosaique », « mots meles », « titre derriere »), or its whole name or
  // its model's (« cadre dans le cadre »); a false match only moves it into the few offered, the editor still decides.
  const named = (piece: EffectPiece) =>
    [piece.key.replace(/-/g, " "), piece.name, houseModel(piece.key)?.name ?? ""].some((name) => {
      const words = plainWords(name);
      return words.length >= 4 && (asked.includes(` ${words} `) || asked.includes(` ${words}s `));
    });
  const scored = pieces.flatMap((piece) => {
    if ((piece.require.files ?? 1) > files) return [];
    const need = piece.require.shot;
    const best = need ? Math.max(-1, ...shots.map((s) => carries(need, s) ?? -1)) : 3;
    if (best < 0) return [];
    const score = best + (named(piece) ? 10 : 0) - (avoid.has(piece.key) ? 4 : 0);
    return [{ piece, score, tie: hashOf(`${options.seed ?? ""}:${piece.key}`) }];
  });
  return scored
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
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
  const settings = piece.settings?.length
    ? ` Réglages : ${piece.settings.map((s) => `${s.name} (${s.choices.map((c) => c.value).join(", ")})`).join(" ; ")}.`
    : "";
  return `${piece.key} — ${name} : ${piece.how} Il faut : ${piece.needs} Se pose : ${piece.lays} (${span}). Ses mots : ${wordsOf(piece)}.${settings}`;
}

/** The editor's rule for the ready effects of the bank (its input's « effets_des_modeles », beside the font pairs: its prompt stays under 17 000 characters). */
export const BORROW_PIECES = `Ready-to-play effects from Edith's models, one line each: its key, its name, what it does, what it needs in her videos (« Il faut »), where it lays (« Se pose ») and its words (« Ses mots »). Each one is coded and tested once, like a CapCut effect: the engine plays it exactly as it is over the shots you lay it on, her words written in it, in her charter, with no motion designer, so it never comes out average and costs next to nothing. Its « Réglages », when it has some, are its variants (the original's first): write in its brief the one this Reel needs (« papier noir » for a night Reel), else none. This Reel is built on what Edith already knows how to do: lay ONE of them, never more, the one whose « Il faut » her videos really have and that carries her request best, as an animation in « layers » (from, to: seconds of the Reel) over the shots its « Se pose » says, cut for it (its first shot where it says, its length within its own), its brief beginning with [borrow: <key>], then the message, the words on screen in « » for its « Ses mots », what the shots under it show, and the energy. It writes its own words: none of your texts during it. It is not one of your animations (« max_new_scenes » counts yours only: it costs next to nothing): yours come beside it, for what none of these effects does, never instead of it. None only when her videos lack what each one needs, or her request rules them all out: the Reel is then yours as usual.`;

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
- « mots_actuels » (a correction): keep them, but what her request changes; its settings too (« reglages_actuels »): kept unless her request changes one.
"objects": one per slot of « effet.ses_objets »: what in the shot it names (« plan », among « plans_dessous ») carries it, named in plain English as the eye sees it, two to four words (« back door », « shop window », « shop sign », « every window », « string lights »), « every » first for several to take one after the other; « none » when nothing in that shot fits (the code does without).
"settings": only a setting of « effet.reglages » her request or the brief asks for, with the value that does it; otherwise none.
With « ce_qu_elle_dit » (an effect timed on her voice): its words are hers, written exactly as she says them (a word the transcript misheard set right), in the order she says them, each one a word or a name she really says under it.
With « ses_photos » (an effect that lays her photos): "photos", the ids of those of her photos it lays, in its order, as many as it takes at most (« effet.photos »), each one what its « veut » asks, from what each shows; none when none fits.
A slot « ecrit_par_le_moteur » (her place's coordinates) is never yours: leave its text empty.`;

export const pieceFillSchema = z.object({
  fits: z.boolean().describe("true when the shots under it carry the effect and her request is served by it"),
  missing: z.string().describe("When fits is false: what is missing, in one short sentence in French; empty otherwise"),
  texts: z.array(z.object({ slot: z.string().describe("A slot of « effet.ses_mots »"), text: z.string().describe("Its words, in French; empty to leave an optional one out") })),
  objects: z.array(z.object({ slot: z.string().describe("A slot of « effet.ses_objets »"), name: z.string().describe("What carries it in that shot, in plain English; « none » when nothing fits") })),
  settings: z.array(z.object({ name: z.string(), value: z.string() })),
});
export type PieceFillAnswer = z.infer<typeof pieceFillSchema> & { photos?: string[] };

/** Its filler's answer schema: the photos it lays only for an effect that lays some (no optional parameter for the API either way). */
export function pieceFillSchemaFor(piece: Pick<EffectPiece, "photos">) {
  return piece.photos ? pieceFillSchema.extend({ photos: z.array(z.string()).describe("The ids of her photos it lays, in its order; empty when none fits") }) : pieceFillSchema;
}

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
  /** The settings the version corrected had (a correction keeps them but what her request changes). */
  currentSettings?: Record<string, string>;
  /** What she says under it (an effect timed on her voice). */
  said?: string;
  /** Her photos it may lay (an effect that lays some): each one's id and what it shows. */
  photos?: { id: string; shows: string }[];
  /** What the engine writes itself (her coordinates): its slots are left to it. */
  facts?: PieceFacts;
}) {
  const { piece, under } = input;
  const n = under.length;
  return {
    effet: {
      cle: piece.key,
      nom: piece.name,
      ce_qu_il_fait: piece.how,
      il_faut: piece.needs,
      ses_mots: piece.texts.map((t) => ({ slot: t.slot, veut: t.want, max: t.max, obligatoire: t.required, ...(pieceFact(t, input.facts) ? { ecrit_par_le_moteur: true } : {}) })),
      ...(piece.photos ? { photos: { veut: piece.photos.want, au_plus: Math.min(4, piece.photos.most) } } : {}),
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
    ...(input.currentSettings && Object.keys(input.currentSettings).length ? { reglages_actuels: input.currentSettings } : {}),
    ...(piece.spoken && input.said?.trim() ? { ce_qu_elle_dit: input.said.trim().slice(0, 1500) } : {}),
    ...(piece.photos && input.photos?.length ? { ses_photos: input.photos.slice(0, 20).map((p) => ({ id: p.id, montre: p.shows.slice(0, 160) })) } : {}),
  };
}

/** What the engine knows of her business that an effect's text can show as it is (PieceText.fact): her place's coordinates. */
export type PieceFacts = { coordinates?: string };

/** The words the engine writes in a slot from what it knows (her coordinates), when they fit; none when unknown. */
export const pieceFact = (t: Pick<PieceText, "fact" | "max">, facts: PieceFacts | undefined): string | undefined =>
  t.fact === "coordinates" && facts?.coordinates && facts.coordinates.length <= t.max ? facts.coordinates : undefined;

/**
 * Its filler's answer read: its words cut to their place (the engine's own where it knows them), its objects named, its
 * settings, the photos it lays (among those offered, four at most); null when it does not fit or a required word is missing.
 */
export type PieceFill = { texts: Record<string, string>; objects: Record<string, string>; settings: Record<string, string>; photos?: string[] };

export function readPieceFill(
  piece: Pick<EffectPiece, "texts" | "objects" | "settings" | "photos">,
  answer: PieceFillAnswer,
  options: { photos?: string[]; facts?: PieceFacts } = {},
): PieceFill | null {
  if (!answer.fits) return null;
  const texts: Record<string, string> = {};
  for (const t of piece.texts) {
    const words = pieceFact(t, options.facts) ?? fitWords(answer.texts.find((w) => w.slot === t.slot)?.text ?? "", t.max);
    if (words) texts[t.slot] = words;
    else if (t.required) return null;
  }
  const offered = new Set(options.photos ?? []);
  const photos = piece.photos ? [...new Set(answer.photos ?? [])].filter((id) => offered.has(id)).slice(0, Math.min(4, piece.photos.most)) : [];
  const objects: Record<string, string> = {};
  for (const o of piece.objects ?? []) {
    const name = skillObjectName(answer.objects.find((x) => x.slot === o.slot)?.name);
    if (name) objects[o.slot] = name;
  }
  return { texts, objects, settings: skillSettings(piece, answer.settings), ...(photos.length ? { photos } : {}) };
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

/** Its settings as a correction finds them on the version it corrects (its slot texts by their names, at one of their choices, never the default). */
export function pieceSettingsOf(piece: Pick<EffectPiece, "settings">, motion: Pick<PlanLayer["motion"], "texts"> | undefined): Record<string, string> {
  return skillSettings(piece, Object.fromEntries((piece.settings ?? []).flatMap((s) => (motion?.texts?.[s.name] ? [[s.name, motion.texts[s.name]!] as const] : []))));
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
    // The shots under it as the engine counts them (their indices in its code's `shots`), the same in its code as here.
    mine: under.join(","),
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
  // A sound on her gesture: its shot by its index among the plan's segments (sfx.ts reads it there), its window on the Reel's clock.
  const segmentOf = (clip: number) => plan.segments.map((s, i) => (isClipSegment(s) ? i : -1)).filter((i) => i >= 0)[clip];
  const sounds: SfxCue[] = (line.sounds ?? [])
    .filter((s) => Number.isFinite(s.at) && s.at >= 0 && s.at < seconds - 0.05 && s.sound.trim().length >= 2)
    .sort((a, b) => a.at - b.at)
    .slice(0, 16)
    .map((s) => {
      const clip = s.hand ? at(s.hand.shot) : undefined;
      const shot = clip === undefined ? undefined : segmentOf(clip);
      const within = s.hand?.within && s.hand.within[1] > s.hand.within[0] ? { within: [round3(layer.from + Math.max(0, s.hand.within[0])), round3(layer.from + s.hand.within[1])] as [number, number] } : {};
      // A burst: its hits in order within its span (120 at most), their gains bounded.
      const bound = (n: number | undefined) => (Number.isFinite(n) ? Math.round(Math.min(6, Math.max(-24, n!)) * 10) / 10 : 0);
      const hits = (s.burst?.times ?? [])
        .map((t, k) => ({ t: round3(t), g: bound(s.burst!.gains?.[k]) }))
        .filter((h) => Number.isFinite(h.t) && h.t >= 0 && h.t <= 12 && s.at + h.t < seconds - 0.05)
        .sort((a, b) => a.t - b.t)
        .slice(0, BURST_MAX);
      return {
        at: round3(s.at),
        sound: s.sound.trim().slice(0, 60),
        ...(s.seconds !== undefined ? { seconds: Math.min(3, Math.max(0.5, s.seconds)) } : {}),
        ...(s.gain ? { gain: Math.round(Math.min(6, Math.max(-24, s.gain)) * 10) / 10 } : {}),
        skill: true,
        ...(s.hand && shot !== undefined ? { hand: { shot, moment: s.hand.moment, ...within } } : {}),
        ...(hits.length > 1 ? { burst: { times: hits.map((h) => h.t), ...(hits.some((h) => h.g) ? { gains: hits.map((h) => h.g) } : {}) } } : {}),
      };
    });
  // Only the objects on a shot under it are named in its code: one named for a shot it does not have (its sign before its
  // sky, with a single shot under it) would be looked for on every shot it draws, for nothing.
  const placed = Object.fromEntries(Object.entries(fill.objects).filter(([slot]) => objects.some((o) => o.name === skillObjectName(fill.objects[slot])) && (piece.objects ?? []).some((p) => p.slot === slot && at(p.shot) !== undefined)));
  const code = pieceCode(piece, placed);
  // What a fallback, a correction or an animation over it reads: its brief as the editor wrote it, nothing of its earlier code.
  const { code: _code, js: _js, texts: _texts, drawn: _drawn, sounds: _sounds, fonts: _fonts, piece: _piece, photos: _photos, times_spoken: _spoken, ...rest } = layer.motion;
  return {
    ...rest,
    code,
    js: code,
    texts,
    ...(drawn ? { drawn } : {}),
    ...(sounds.length ? { sounds } : {}),
    ...(piece.fonts?.length ? { fonts: piece.fonts.slice(0, 3) } : {}),
    // Timed on what she says under it: its code gets her words said, each at its frame; the engine's subtitles stay under it.
    ...(piece.spoken ? { times_spoken: true } : {}),
    // Her photos it lays, in its order (its code reads them as `photos`).
    ...(piece.photos && fill.photos?.length ? { photos: fill.photos.slice(0, 4) } : {}),
    piece: { key: piece.key, version: piece.version },
  };
}

/**
 * How a piece shapes the Reel's music, on the Reel's clock (its timeline's `music`, shifted by its start, within its
 * span), laid over the shape the Reel has (`current`, kept as it is: a model's shape wins); undefined when it shapes
 * nothing.
 */
export function pieceMusicShape(input: {
  piece: EffectPiece;
  fill: PieceFill;
  plan: Pick<EditPlan, "segments" | "duration" | "music_shape">;
  layer: Pick<PlanLayer, "from" | "to">;
  bpm: number;
}): MusicShape | undefined {
  const { piece, fill, plan, layer } = input;
  if (plan.music_shape) return plan.music_shape;
  const frames = Math.max(1, Math.round((layer.to - layer.from) * REEL_FPS));
  const under = layerShots(plan, layer);
  const { spans } = segmentSpans(plan.segments);
  const clipSpans = plan.segments.flatMap((s, i) => (isClipSegment(s) ? [spans[i]!] : []));
  const shots = under.map((k) => ({ from: Math.round((clipSpans[k]!.start - layer.from) * REEL_FPS), frames: Math.round(clipSpans[k]!.length * REEL_FPS) }));
  const line = piece.timeline?.({ frames, bpm: Math.min(140, Math.max(60, input.bpm)), shots, words: fill.texts, settings: fill.settings });
  const span = layer.to - layer.from;
  const inside = <T extends { from: number; to: number }>(xs: T[] | undefined) =>
    (xs ?? []).filter((x) => x.to > x.from && x.from >= 0 && x.from < span).map((x) => ({ ...x, from: round3(layer.from + x.from), to: round3(layer.from + Math.min(span, x.to)) }));
  const pauses = inside(line?.music?.pauses);
  const filters = inside(line?.music?.filters);
  if (!pauses.length && !filters.length) return undefined;
  return readMusicShape({ ...(pauses.length ? { pauses } : {}), ...(filters.length ? { filters } : {}) }, plan.duration) ?? undefined;
}

/** What she says under a layer, as its filler reads it: the words of her shots under it, as Gemini (or Scribe) timed them, in order. */
export function saidUnder(plan: Pick<EditPlan, "segments">, clips: Record<string, ClipAnalysis>, layer: Pick<PlanLayer, "from" | "to">): string {
  const { spans } = segmentSpans(plan.segments);
  const words: { w: string; at: number }[] = [];
  plan.segments.forEach((s, i) => {
    if (!isClipSegment(s) || s.beside) return;
    const span = spans[i]!;
    for (const w of clips[s.clip_id]?.words ?? []) {
      if (w.start < s.in || w.end > s.out) continue;
      const at = span.start + screenTime(s, w.start);
      if (at >= layer.from - 0.05 && at < layer.to) words.push({ w: w.w, at });
    }
  });
  return words
    .sort((a, b) => a.at - b.at)
    .map((w) => w.w)
    .join(" ");
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
  const { code: _code, js: _js, texts: _texts, drawn: _drawn, sounds: _sounds, fonts: _fonts, piece: _piece, photos: _photos, times_spoken: _spoken, ...rest } = motion;
  return rest;
}
