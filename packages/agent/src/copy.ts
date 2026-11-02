import { z } from "zod";
import { MAX_REEL_SECONDS } from "./editor.ts";
import type { CopyLayer, EditPlan, PlanSegment } from "./schemas.ts";
import type { StolenLook } from "./steal.ts";

// A simple Reel she sends to copy, remade by code, with no editor nor motion designer (Tristan: « réduire le nombre
// d'agents, améliorer la qualité mais garder les marges », after a copy made by hand, without any model, came out far
// better than the one the chain of agents made): her shots on the model's own cut times (the model's sound, added in
// Instagram, lands on the same cuts), the subjects of her photos cut out and laid big over her other shots when the
// model lays some, its title held and drawn as the model draws it (its font, its fine stroke, its lines staggered,
// its tilt), and its plain ending card. Only the words are written, by one small call (copy-words.ts in the app).
// A Reel with a real effect goes to the effects workshop; one with a voice, a split screen, animations or several
// texts, to the editor.

/** One of her files, as the copy uses it. */
export type CopyFile = {
  id: string;
  photo: boolean;
  /** A video's length (s); a photo: 0. */
  seconds: number;
  /** A video's passages worth showing, best first (its best moments, then its clean shots). */
  moments?: { start: number; end: number }[];
  /** A photo whose subject cuts out cleanly: the subject's height over its width, and whether it is someone (a face was read on it). */
  cutout?: { tall: number; person: boolean };
};

/** The words of the copy: its title's lines (none: no title), and its ending's cards, each a few lines. */
export type CopyWords = { title: string[] | null; end: string[][] };

export type CopyInput = {
  /** The model's measures: its hard cuts and its length (s), its tempo when it has one. */
  cuts: number[];
  duration: number;
  bpm?: number | null;
  /** Her files, in the order she gave them. */
  files: CopyFile[];
  look: Pick<StolenLook, "format" | "voice" | "layout" | "ending" | "text" | "colors" | "moments">;
  words: CopyWords;
};

/** The shortest shot kept between two of the model's cuts (scene detection sees a flash as two cuts). */
const SHORTEST_SHOT = 0.2;
/** An ending card lasts this long when the model's last shot is too long to be it. */
const END_DEFAULT = 2;
const END_MIN = 0.8;
const END_MAX = 4.5;

const round = (n: number) => Math.round(n * 100) / 100;

/** Something laid over the shots: a cut-out, a sticker. */
const LAID = /d[ée]tour|d[ée]coup|autocollant|sticker/i;
/** A layout the copy does not redo (a split screen, a window, several shots at once): the editor composes those. */
const COMPOSED = /écran (partagé|coupé)|split|fenêtre|plusieurs (plans|images) (à la fois|en même temps)|mosaïque|grille|cadre dans/i;
/** A moment that needs an animation (an interface, a chart, a counter, a drawing): the editor and the motion designer. */
const ANIMATED = /carte|graphique|interface|appli|écran d'|compteur|chiffre qui|dessin|animation|3d|particule|bulle|liste|badge|flèche/i;

/** Whether the Reel she copies is simple enough to be remade by code: shots, laid cut-outs, a title, an ending. */
export function copyable(look: CopyInput["look"], measures: { cuts: number[]; duration: number }): boolean {
  if (measures.duration < 3 || measures.cuts.filter((t) => t > 0.15 && t < measures.duration - 0.15).length < 2) return false;
  if (look.voice !== "aucune" || look.format === "raconte") return false;
  if (look.text.amount === "plusieurs" || look.text.subtitles) return false;
  const layout = look.layout ?? "plein cadre";
  if (COMPOSED.test(layout) || !(/^plein (cadre|écran)\b/i.test(layout) || LAID.test(layout))) return false;
  return (look.moments ?? []).every((m) => !ANIMATED.test(m.what));
}

/** Whether the model lays cut-outs over its shots (its layout, its moments, a collage). */
export function laysCutouts(look: Pick<StolenLook, "format" | "layout" | "moments">): boolean {
  return look.format === "collage" || LAID.test(look.layout ?? "") || (look.moments ?? []).some((m) => LAID.test(m.what));
}

/** Whether the model ends on a card (a plain ground with a few words), and its ground. */
export function endingCard(ending: string): { dark: boolean } | null {
  if (!/fond|écran|carton|noir|blanc|uni\b|texte/i.test(ending)) return null;
  if (/dernier plan|sur (une|la) image|boucle/i.test(ending) && !/fond|écran|carton/i.test(ending)) return null;
  return { dark: !/(fond|écran|carton) (blanc|clair|crème)|sur (du )?blanc/i.test(ending) };
}

/** The model's cuts within the Reel's length, apart enough to be shots. */
function modelCuts(cuts: number[], duration: number): number[] {
  const kept: number[] = [];
  for (const t of [...new Set(cuts.map(round))].sort((a, b) => a - b)) {
    if (t < SHORTEST_SHOT || t > duration - SHORTEST_SHOT) continue;
    if (t - (kept.at(-1) ?? 0) < SHORTEST_SHOT) continue;
    kept.push(t);
  }
  return kept;
}

/** A passage of a video for a shot: its best moments first, never one already shown when another is free. */
function passage(file: CopyFile, length: number, taken: Map<string, [number, number][]>): number {
  const shown = taken.get(file.id) ?? [];
  const room = Math.max(0, file.seconds - length);
  const free = (at: number) => shown.every(([a, b]) => at + length <= a + 0.01 || at >= b - 0.01);
  const starts = [...(file.moments ?? []).map((m) => m.start), ...Array.from({ length: Math.floor(room / 0.25) + 1 }, (_, k) => k * 0.25)].map((t) => Math.min(room, Math.max(0, t)));
  const at = starts.find(free) ?? 0;
  taken.set(file.id, [...shown, [at, at + length]]);
  return round(at);
}

/**
 * The plan of a simple copied Reel: her shots on the model's cut times, her photos' subjects laid over the
 * other shots (one shot in four left bare, never a subject over its own photo, never the same twice in a row,
 * once a pair side by side), its title and its ending card (copyLayerSchema).
 */
export function copyPlan(input: CopyInput): EditPlan {
  const duration = round(Math.min(MAX_REEL_SECONDS, input.duration));
  const cuts = modelCuts(input.cuts, duration);
  if (!input.files.length) throw new Error("Aucun fichier pour refaire ce Reel");

  // Its ending card: the model's last shot when it is one (the last shot of hers plays under it), else its last seconds.
  const card = input.words.end.length ? endingCard(input.look.ending) : null;
  let endFrom: number | null = null;
  if (card) {
    const tail = duration - (cuts.at(-1) ?? 0);
    if (cuts.length && tail >= END_MIN && tail <= END_MAX) endFrom = cuts.pop()!;
    else if (tail > END_MAX) endFrom = round(duration - END_DEFAULT);
  }
  const spans = [...cuts, duration].map((end, i) => ({ start: i ? cuts[i - 1]! : 0, end }));

  // Her photos whose subject cuts out cleanly are laid over the others, when the model lays some; the rest are the grounds
  // (with them too when the grounds are too few for the shots).
  const stickers = laysCutouts(input.look) ? input.files.filter((f) => f.photo && f.cutout) : [];
  const grounds = input.files.filter((f) => !stickers.includes(f));
  const pool = grounds.length >= Math.ceil(spans.length / 3) ? grounds : [...grounds, ...stickers];
  const videos = pool.filter((f) => !f.photo).sort((a, b) => b.seconds - a.seconds);

  const taken = new Map<string, [number, number][]>();
  let turn = 0;
  const segments = spans.map((span): Extract<PlanSegment, { clip_id: string }> => {
    const length = round(span.end - span.start);
    // Her files in turn, the next one that can hold the shot.
    for (let k = 0; k < pool.length; k++) {
      const file = pool[(turn + k) % pool.length]!;
      if (!file.photo && file.seconds < length + 0.05) continue;
      turn += k + 1;
      if (file.photo) return { clip_id: file.id, in: 0, out: length, zoom: "none" };
      const at = passage(file, length, taken);
      return { clip_id: file.id, in: at, out: round(at + length), zoom: "none" };
    }
    // No file is that long: her longest video, slowed down.
    const longest = videos[0]!;
    const speed = Math.max(0.5, Math.min(1, longest.seconds / length));
    return { clip_id: longest.id, in: 0, out: round(Math.min(longest.seconds, length * speed)), zoom: "none", speed: round(speed) };
  });

  const cutouts: CopyLayer["cutouts"] = [];
  if (stickers.length) {
    let next = 0;
    let last = "";
    let paired = false;
    segments.forEach((s, i) => {
      // A breath: one shot in four stays bare.
      if (i % 4 === 3) return;
      const length = spans[i]!.end - spans[i]!.start;
      const fits = (f: CopyFile) => f.id !== s.clip_id && f.id !== last;
      const objects = stickers.filter((f) => fits(f) && !f.cutout!.person);
      // Once, past the first third, two objects side by side.
      if (!paired && i >= spans.length / 3 && objects.length >= 2 && length >= 0.45) {
        paired = true;
        cutouts.push({ segment: i, photo: objects[0]!.id, place: "left", at: 0 }, { segment: i, photo: objects[1]!.id, place: "right", at: 0 });
        last = objects[1]!.id;
        return;
      }
      for (let k = 0; k < stickers.length; k++) {
        const file = stickers[(next + k) % stickers.length]!;
        if (!fits(file)) continue;
        next += k + 1;
        // Over the opening shot, it lands once the title has been read alone.
        cutouts.push({ segment: i, photo: file.id, place: file.cutout!.person ? "stand" : "center", at: i === 0 ? round(Math.min(1, length / 2)) : 0 });
        last = file.id;
        return;
      }
    });
  }

  // Its title, held as the model holds it: all along (a held message), or its first seconds (a line).
  const text = input.look.text;
  const lines = (input.words.title ?? []).map((l) => l.trim()).filter(Boolean).slice(0, 4);
  const until = endFrom ?? duration;
  const title: CopyLayer["title"] =
    lines.length && text.amount !== "aucun"
      ? {
          lines,
          from: 0,
          to: text.amount === "une ligne" ? (cuts.find((t) => t >= 2) ?? until) : until,
          ...(text.font ? { font: text.font } : {}),
          stroke: text.stroke ?? (text.weight === "black" ? "thick" : text.weight === "bold" ? "regular" : "thin"),
          staggered: text.lines === "staggered",
          tilt: text.tilt ?? 0,
          shadow: text.shadow ?? "soft",
          color: input.look.colors?.[0] ?? "#ffffff",
          upper: text.case === "upper",
          y: /\ben bas\b|bas de l'(écran|image)|tiers (du )?bas/i.test(text.composition) ? 0.6 : /centr|milieu/i.test(text.composition) ? 0.36 : 0.12,
        }
      : null;

  // Its ending card: a plain ground, its cards one after the other (the first one longer).
  const cards = input.words.end.map((c) => c.map((l) => l.trim()).filter(Boolean).slice(0, 4)).filter((c) => c.length).slice(0, 3);
  const shares = cards.length === 3 ? [0, 0.4, 0.75] : cards.length === 2 ? [0, 0.6] : [0];
  const end: CopyLayer["end"] =
    endFrom !== null && card && cards.length
      ? {
          from: endFrom,
          ground: card.dark ? "#000000" : "#ffffff",
          ink: card.dark ? "#ffffff" : "#111111",
          cards: cards.map((lines, k) => ({ at: round(endFrom! + (duration - endFrom!) * shares[k]!), lines })),
        }
      : null;

  const tempo = input.bpm ? Math.round(Math.min(140, Math.max(60, input.bpm))) : undefined;
  return {
    format: "9:16",
    duration,
    template: "libre",
    ...(tempo ? { tempo } : {}),
    segments,
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    copy: { cutouts, title, end },
  };
}

/** The photos a copy lays as cut-outs (their cut-outs are loaded for the render). */
export const copyPhotos = (plan: Pick<EditPlan, "copy">): string[] => [...new Set((plan.copy?.cutouts ?? []).map((c) => c.photo))];

/**
 * The one call of a copy (Sonnet): whether her request is served by what the code does, and its words. What the
 * code cannot do goes to the editor (`fits` false), never done halfway in silence.
 */
export const copyWordsSchema = z.object({
  fits: z.boolean().describe("true when a faithful remake with her files, its title and its ending gives her everything she asked for"),
  missing: z.string().describe("When fits is false: what her request needs that the remake cannot do, in a few words; empty otherwise"),
  title: z.array(z.string()).describe("The title's lines (1 to 4, 24 characters at most each), in French; empty when the model has no text"),
  end: z.array(z.array(z.string())).describe("The ending's cards, 0 to 3, each 1 to 3 short lines in French; empty when the model has no ending card"),
});
export type CopyWordsAnswer = z.infer<typeof copyWordsSchema>;

export const COPY_WORDS_PROMPT = `You write the on-screen words of a Reel that remakes, with a business's own photos and videos, a Reel the manager sent as a model. The remake is done by code, and the code can do exactly this:
- her shots, cut on the model's own cut times, in the order she gave her files;
- the subjects of her photos cut out and laid big over her other shots, when the model lays some;
- ONE title held on screen, 1 to 4 short lines, drawn in the model's font and way;
- an ending card: 1 to 3 cards one after the other, each a few short lines, on a plain ground, when the model ends on one.
It cannot do anything else: no voice-over, no subtitles, no animation, no split screen, no second text at another moment, no chosen order of shots, no effect, no other length.

First decide "fits": true when this remake gives her everything she asked for. Her request may simply ask to copy the model, give her words, or ask for small things the remake does anyway (her photos, her style): that fits. When she asks for something the code cannot do and that matters to her (a voice, an animation, a shot first, a text at a precise moment, a different ending, a length), "fits" is false and "missing" says what, in a few words. When in doubt about something she clearly wants, false.

Then write the words, in French, what she and her customers read:
- The title takes the model's place and job (its composition and amount of text are given), about this business, for her customers: a line a creator would write, concrete, never a slogan, a promise of an ad or a formula. Short lines (24 characters at most), cut where one would breathe; staggered lines read well as 2 or 3 lines of a few words. Upper or lower case as the model.
- The ending's cards: her call to action in her words when she gave one, else what to do in a few words (where to find her, a link in the bio when she has a booking link, her name), as the model ends; never a fact that is not given.
- Words she gives word for word (« contrat ») are kept exactly, only split into lines. Never invent a price, an hour, a place, an offer or a review.
- A correction (« version_actuelle »): keep the current words except what her request changes.`;
