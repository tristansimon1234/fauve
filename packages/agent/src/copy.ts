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
/** font: a font she asked for the title instead of the model's (a Google Fonts family, checked). */
export type CopyWords = { title: string[] | null; end: string[][]; font?: string };

export type CopyInput = {
  /** The model's measures: its hard cuts and its length (s), its tempo when it has one. */
  cuts: number[];
  duration: number;
  bpm?: number | null;
  /** Her files, in the order she gave them. */
  files: CopyFile[];
  look: Pick<StolenLook, "format" | "voice" | "layout" | "ending" | "text" | "colors" | "moments">;
  words: CopyWords;
  /** Shot by shot, the ground and the subjects one small call chose (her files' ids), followed where they keep the rules. */
  assignment?: { ground?: string; subjects?: string[] }[];
};

/** How many shots one of her subjects is laid on, at most. */
export const MAX_SUBJECT_USES = 2;
/** Fewer clean subjects than this, and a model that lays one on most shots: she is told hers will be few. */
export const FEW_SUBJECTS = 4;
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

/** The shots of the copy: the model's cuts within the Reel's length, and where its ending card starts when it ends on one. */
export function copyShots(input: Pick<CopyInput, "cuts" | "duration" | "look">): { duration: number; endFrom: number | null; spans: { start: number; end: number }[] } {
  const duration = round(Math.min(MAX_REEL_SECONDS, input.duration));
  const cuts = modelCuts(input.cuts, duration);
  // Its ending card: the model's last shot when it is one (the last shot of hers plays under it), else its last seconds.
  let endFrom: number | null = null;
  if (endingCard(input.look.ending)) {
    const tail = duration - (cuts.at(-1) ?? 0);
    if (cuts.length && tail >= END_MIN && tail <= END_MAX) endFrom = cuts.pop()!;
    else if (tail > END_MAX) endFrom = round(duration - END_DEFAULT);
  }
  return { duration, endFrom, spans: [...cuts, duration].map((end, i) => ({ start: i ? cuts[i - 1]! : 0, end })) };
}

/**
 * Who plays what: her photos whose subject cuts out cleanly are laid over the others when the model lays some
 * (`stickers`); the rest are the grounds (`pool`), with them too when the grounds are too few for the shots.
 */
export function copyCast(files: CopyFile[], look: CopyInput["look"], shots: number): { stickers: CopyFile[]; pool: CopyFile[] } {
  const stickers = laysCutouts(look) ? files.filter((f) => f.photo && f.cutout) : [];
  const grounds = files.filter((f) => !stickers.includes(f));
  return { stickers, pool: grounds.length >= Math.ceil(shots / 3) ? grounds : [...grounds, ...stickers] };
}

/**
 * The plan of a simple copied Reel: her shots on the model's cut times, her photos' subjects laid over the other
 * shots, its title and its ending card (copyLayerSchema). With an `assignment` (one small call matched each shot of
 * the model to her ground most like it and the subject that makes sense on it), it is followed where it keeps the
 * rules; without one, or where it breaks them, her files in turn.
 */
export function copyPlan(input: CopyInput): EditPlan {
  if (!input.files.length) throw new Error("Aucun fichier pour refaire ce Reel");
  const { duration, endFrom: cardFrom, spans } = copyShots(input);
  const card = endingCard(input.look.ending);
  const endFrom = input.words.end.length ? cardFrom : null;
  const cuts = spans.slice(1).map((s) => s.start);
  const { stickers, pool } = copyCast(input.files, input.look, spans.length);
  const videos = pool.filter((f) => !f.photo).sort((a, b) => b.seconds - a.seconds);
  const holds = (file: CopyFile, length: number) => file.photo || file.seconds >= length + 0.05;

  const taken = new Map<string, [number, number][]>();
  let turn = 0;
  const shotOf = (file: CopyFile, length: number): Extract<PlanSegment, { clip_id: string }> => {
    if (file.photo) return { clip_id: file.id, in: 0, out: length, zoom: "none" };
    const at = passage(file, length, taken);
    return { clip_id: file.id, in: at, out: round(at + length), zoom: "none" };
  };
  let previous = "";
  const segments = spans.map((span, i): Extract<PlanSegment, { clip_id: string }> => {
    const length = round(span.end - span.start);
    const shot = (() => {
      // The ground chosen for this shot, when it is one of the grounds, holds the shot and is not the one just before
      // (the same picture twice in a row reads as a missed cut).
      const chosen = pool.find((f) => f.id === input.assignment?.[i]?.ground);
      if (chosen && chosen.id !== previous && holds(chosen, length)) return shotOf(chosen, length);
      // Her files in turn, the next one that can hold the shot (another than the one just before, when there is one).
      for (const avoid of [previous, ""]) {
        for (let k = 0; k < pool.length; k++) {
          const file = pool[(turn + k) % pool.length]!;
          if (!holds(file, length) || (avoid && file.id === avoid)) continue;
          turn += k + 1;
          return shotOf(file, length);
        }
      }
      return null;
    })();
    if (shot) {
      previous = shot.clip_id;
      return shot;
    }
    // No file is that long: her longest video, slowed down.
    const longest = videos[0]!;
    const speed = Math.max(0.5, Math.min(1, longest.seconds / length));
    return { clip_id: longest.id, in: 0, out: round(Math.min(longest.seconds, length * speed)), zoom: "none", speed: round(speed) };
  });

  // Each subject twice at most, never on its own photo nor on two laid shots in a row: with few subjects, more shots stay
  // bare, spread over the Reel (three subjects had come back on 17 shots of a copy Tristan made, « 15 fois le même détourage »).
  const cutouts: CopyLayer["cutouts"] = [];
  if (stickers.length && input.assignment) {
    // The subjects chosen shot by shot, where the model lays one: kept when they keep the rules.
    const uses = new Map<string, number>();
    let last: string[] = [];
    segments.forEach((s, i) => {
      const length = spans[i]!.end - spans[i]!.start;
      const picked = [...new Set(input.assignment![i]?.subjects ?? [])]
        .map((id) => stickers.find((f) => f.id === id))
        .filter((f): f is CopyFile => Boolean(f && f.id !== s.clip_id && !last.includes(f.id) && (uses.get(f.id) ?? 0) < MAX_SUBJECT_USES))
        .slice(0, 2);
      const pair = picked.length === 2 && picked.every((f) => !f.cutout!.person);
      const laid = pair ? picked : picked.slice(0, 1);
      laid.forEach((f, k) => {
        uses.set(f.id, (uses.get(f.id) ?? 0) + 1);
        // Over the opening shot, it lands once the title has been read alone.
        cutouts.push({ segment: i, photo: f.id, place: pair ? (k ? "right" : "left") : f.cutout!.person ? "stand" : "center", at: i === 0 ? round(Math.min(1, length / 2)) : 0 });
      });
      last = laid.map((f) => f.id);
    });
  } else if (stickers.length) {
    const uses = new Map<string, number>();
    const free = (f: CopyFile) => (uses.get(f.id) ?? 0) < MAX_SUBJECT_USES;
    const take = (f: CopyFile) => uses.set(f.id, (uses.get(f.id) ?? 0) + 1);
    // The shots that may carry one (one in four stays bare), as many as her subjects allow, spread evenly.
    const open = segments.map((_, i) => i).filter((i) => i % 4 !== 3);
    const room = Math.min(open.length, stickers.length * MAX_SUBJECT_USES);
    const chosen = [...new Set(Array.from({ length: room }, (_, k) => open[Math.floor((k * open.length) / room)]!))];
    let next = 0;
    let last: string[] = [];
    let paired = false;
    for (const i of chosen) {
      const s = segments[i]!;
      const length = spans[i]!.end - spans[i]!.start;
      const fits = (f: CopyFile) => f.id !== s.clip_id && !last.includes(f.id) && free(f);
      const objects = stickers.filter((f) => fits(f) && !f.cutout!.person);
      // Once, past the first third, two objects side by side.
      if (!paired && i >= spans.length / 3 && objects.length >= 2 && length >= 0.45) {
        paired = true;
        const pair = objects.slice(0, 2);
        cutouts.push({ segment: i, photo: pair[0]!.id, place: "left", at: 0 }, { segment: i, photo: pair[1]!.id, place: "right", at: 0 });
        pair.forEach(take);
        last = pair.map((f) => f.id);
        continue;
      }
      for (let k = 0; k < stickers.length; k++) {
        const file = stickers[(next + k) % stickers.length]!;
        if (!fits(file)) continue;
        next += k + 1;
        // Over the opening shot, it lands once the title has been read alone.
        cutouts.push({ segment: i, photo: file.id, place: file.cutout!.person ? "stand" : "center", at: i === 0 ? round(Math.min(1, length / 2)) : 0 });
        take(file);
        last = [file.id];
        break;
      }
    }
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
          ...((input.words.font ?? text.font) ? { font: input.words.font ?? text.font } : {}),
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
  font: z.string().describe("The Google Fonts family she asks for the title instead of the model's; empty to keep the model's font"),
  shots: z
    .array(
      z.object({
        ground: z.string().describe("The id of her ground for this shot (f1, f2…)"),
        subjects: z.array(z.string()).describe("The ids of her subjects laid on this shot (s1…), 0 to 2; empty where the model lays nothing"),
      }),
    )
    .describe("One per shot of the remake, in order (« plans »)"),
  why: z.string().describe("One sentence in French for her: your main choices, which subject on which ground and why"),
});
export type CopyWordsAnswer = z.infer<typeof copyWordsSchema>;

export const COPY_WORDS_PROMPT = `You write the on-screen words of a Reel that remakes, with a business's own photos and videos, a Reel the manager sent as a model. The remake is done by code, and the code can do exactly this:
- her shots, cut on the model's own cut times, in the order she gave her files;
- the subjects of her photos cut out and laid big over her other shots, when the model lays some;
- ONE title held on screen, 1 to 4 short lines, drawn in the model's way and font, or in a font she asks for (« font »);
- an ending card: 1 to 3 cards one after the other, each a few short lines, on a plain ground, when the model ends on one.
It cannot do anything else: no voice-over, no subtitles, no animation, no split screen, no second text at another moment, no chosen order of shots, no effect, no other length.
The music (the model's sound, Edith's music, a genre or a mood she asks for) and the caption are made elsewhere: never a reason for "fits" false.

First decide "fits": true when this remake gives her everything she asked for. Her request may simply ask to copy the model, give her words, or ask for small things the remake does anyway (her photos, her style): that fits. When she asks for something the code cannot do and that matters to her (a voice, an animation, a shot first, a text at a precise moment, a different ending, a length), "fits" is false and "missing" says what, in a few words. When in doubt about something she clearly wants, false.

Then write the words, in French, what she and her customers read:
- The title takes the model's place and job (its composition and amount of text are given), about this business, for her customers: a line a creator would write, concrete, never a slogan, a promise of an ad or a formula. Short lines (24 characters at most), cut where one would breathe; staggered lines read well as 2 or 3 lines of a few words. Upper or lower case as the model.
- The ending's cards: her call to action in her words when she gave one, else what to do in a few words (where to find her, a link in the bio when she has a booking link, her name), as the model ends; never a fact that is not given.
- Words she gives word for word (« contrat ») are kept, only split into lines, and always spelled right (accents, apostrophes, hyphens, « WhatsApp »): never one of her typos. Never invent a price, an hour, a place, an offer or a review.
- A correction (« version_actuelle »): keep the current words except what her request changes.
- "font": empty to keep the model's font. Only when she asks for another one for the title: its Google Fonts family, one of her charter's (« charte ») when she says her font or her charter's.

Then cast her files on the shots of the remake, as an editor would, never in turn. « plans » gives each shot in order: its length, and when the model was read shot by shot, what the model's shot showed (« fond_du_modele ») and what it laid over it (« pose_du_modele »: nothing, a person, an object, two objects; « sujet_du_modele »). For each shot, in order:
- ground: one of her grounds (« fonds », f1…), the one that looks most like the model's ground for that shot and makes sense at that point of the Reel: the strongest image first, a calm one before the ending. A video needs at least as many seconds as the shot. Every ground once before one comes back when there are enough of them, never the same on two shots in a row.
- subjects: where the model lays something, one of her subjects (« sujets », s1…) of the same kind (someone for a person, an object for an object, two objects for « deux objets »), the one that makes sense on that ground (a drink on a café terrace, a camera in a street, someone walking on the cobbles, never a subject on a ground where it looks absurd); where the model lays nothing, an empty list. Each subject on 2 shots at most, never on two shots in a row, never on its own photo (a subject whose « photo » is that ground). When she has fewer subjects than the model lays, choose the shots where they make the most sense and leave the others bare. Without the model's shots, lay one on about two shots in three, where it makes sense.
- why: one sentence in French for her, saying your main choices (which subject on which ground, and why).`;

/**
 * How likely a photo is to hold a subject that cuts out (an object, someone, a close-up) rather than a whole scene (a
 * street, a façade, a square), from what its reading says of it: the likeliest are cut out first.
 */
export function subjectLikely(notes: string): number {
  const text = notes.toLowerCase();
  let score = 0;
  if (/gros plan|plan serré|posée?s? (sur|devant)|nature morte|en détail|isolée?|sur fond (uni|blanc|simple)/.test(text)) score += 2;
  if (/appareil|verre|tasse|bouteille|\bsac\b|chaussure|bonnet|manteau|chapeau|bijou|produit|\bplat\b|assiette|bouquet|gâteau|pâtisserie|vase|lampe|objet/.test(text)) score += 2;
  if (/personne|femme|homme|\bfille\b|garçon|enfant|vue de dos|silhouette|portrait|barista|serveur|serveuse/.test(text)) score += 1;
  if (/\brue\b|façade|\bplace\b|perspective|paysage|édifice|immeuble|bâtiment|panorama|vue d'ensemble|\bdôme\b|fontaine|ciel|quartier/.test(text)) score -= 2;
  return score;
}

/** Whether someone is the subject cut out: a face read on the photo inside the subject's box (box_2d [ymin, xmin, ymax, xmax] on 0 to 1000). */
export function faceInSubject(regions: { kind: string; box_2d: number[] }[], box: { x: number; y: number; w: number; h: number }): boolean {
  return regions.some((r) => {
    if (r.kind !== "face" || r.box_2d.length < 4) return false;
    const [ymin, xmin, ymax, xmax] = r.box_2d as [number, number, number, number];
    const [cx, cy] = [(xmin + xmax) / 2000, (ymin + ymax) / 2000];
    return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h;
  });
}

/** The model's shot that plays at `t` (s): the last one read that started by then. */
export function modelShotAt(shots: NonNullable<StolenLook["shots"]>, t: number): NonNullable<StolenLook["shots"]>[number] | null {
  let found: NonNullable<StolenLook["shots"]>[number] | null = null;
  for (const shot of shots) if (shot.at <= t + 0.05) found = shot;
  return found ?? shots[0] ?? null;
}

const LAID_WORDS: Record<NonNullable<StolenLook["shots"]>[number]["laid"], string> = { aucun: "rien", personne: "une personne", objet: "un objet", "deux objets": "deux objets côte à côte" };

/**
 * What the casting call reads: each shot of the copy with the model's shot under it (its ground, what it lays), her
 * grounds and her subjects under short ids (f1…, s1…: an id of 36 characters is miscopied), with what each shows.
 */
export function castInput(
  shots: { start: number; end: number }[],
  model: StolenLook["shots"] | undefined,
  cast: { stickers: CopyFile[]; pool: CopyFile[] },
  shows: Record<string, string>,
) {
  const ground = new Map(cast.pool.map((f, k) => [`f${k + 1}`, f.id]));
  const subject = new Map(cast.stickers.map((f, k) => [`s${k + 1}`, f.id]));
  const short = (map: Map<string, string>, id: string) => [...map].find(([, v]) => v === id)?.[0];
  return {
    input: {
      plans: shots.map((span, i) => {
        const seen = model?.length ? modelShotAt(model, (span.start + span.end) / 2) : null;
        return {
          n: i + 1,
          secondes: round(span.end - span.start),
          ...(seen ? { fond_du_modele: seen.ground, pose_du_modele: LAID_WORDS[seen.laid], ...(seen.subject ? { sujet_du_modele: seen.subject } : {}) } : {}),
        };
      }),
      fonds: cast.pool.map((f) => ({ id: short(ground, f.id)!, type: f.photo ? "photo" : "vidéo", montre: (shows[f.id] ?? "").slice(0, 200), ...(f.photo ? {} : { secondes: round(f.seconds) }) })),
      sujets: cast.stickers.map((f) => ({
        id: short(subject, f.id)!,
        montre: (shows[f.id] ?? "").slice(0, 200),
        personne: Boolean(f.cutout?.person),
        ...(short(ground, f.id) ? { photo: short(ground, f.id) } : {}),
      })),
    },
    /** The answer's short ids back to her files' ids, shot by shot. */
    read: (answer: { ground: string; subjects: string[] }[]): NonNullable<CopyInput["assignment"]> =>
      answer.map((a) => ({
        ...(ground.get(a.ground.trim()) ? { ground: ground.get(a.ground.trim())! } : {}),
        subjects: a.subjects.flatMap((id) => subject.get(id.trim()) ?? []),
      })),
  };
}
