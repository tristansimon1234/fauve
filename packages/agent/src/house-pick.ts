import { z } from "zod";
import { HOUSE_MODELS, HOUSE_WHEN, houseModel } from "./house-models.ts";

// Edith's art direction by default (Tristan: « avec la même DA par défaut que les reels envoyés », « des 31 reels
// envoyés et des modèles »): a Reel that has no model, no Reel to copy and no form of her own is made in one of
// Edith's models (house-models.ts, the reference Reels he sent, each written down), the one her files, her request
// and her trade call for, dressed in her charter (her fonts and colours), never the model of her last Reels. Picked
// once, when the montage starts its design, by a short call; "none" when no model can be made with her files, the
// Reel then made freely in the same spirit.

/** Her request asks for her own look on a Reel she copies: her colours, her fonts, her charter. */
export const OWN_LOOK_WORDS =
  /(?:^|[\s,;.!?«"'(])(?:(?:mes|nos) (?:couleurs|polices|typos?)|(?:ma|notre) (?:charte|police|typo|palette|identité|da)(?![a-zà-ÿ])|ma direction artistique|à (?:mon|notre) (?:style|image)|(?:à|aux) (?:mes|nos) couleurs|aux couleurs de (?:mon|ma|notre|chez)|avec mon style)/i;

/** Her words, plain for the patterns below: lower case, no accents, apostrophes and hyphens as spaces. */
const plain = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`-]/g, " ")
    .replace(/[ \t]+/g, " ");

/** Creativity she turns down (« pas besoin d'être créatif », « sans surprise »): left out before the rest is read. */
const NOT_CREATIVE = /\b(?:pas|sans|ni|jamais|rien|moins)(?: (?:de|d|trop|tres|vraiment|besoin|d etre|etre|la|ta|du|un|une|truc|chose|faire))* (?:creati\w*|surpri\w*|surpren\w*|libre\w*)/g;

/**
 * What asks for creation rather than a model (Tristan, 6 November: « sois creatif ! sur le marais a paris » was made on
 * « Mots aux quatre coins »; « sois créatif » must mean creation, never a model): « sois créatif », « un Reel créatif »,
 * « de la créativité », « fais-toi plaisir », « lâche-toi », « surprends-moi », « étonne-moi », « carte blanche », « libre »,
 * « en toute liberté », « crée ! », « crée ce que tu veux ». Never a business's own word (« l'atelier créatif du
 * mercredi », « entrée libre », « ma nouvelle création ») nor the plain verb of a request (« crée un Reel sur la
 * terrasse »), which every request is. Read on her plain words.
 */
const CREATIVE = new RegExp(
  [
    // créatif, créative, asked for (never the name of a workshop: « atelier créatif »)
    String.raw`(?:^|[^a-z])(?:sois|soit|soyez|etre|plus|tres|super|hyper|vraiment|peu|mode|reel|video|montage|truc|chose|qqch|qqc|de|fais|fait|faire) (?:un peu |plus |tres |vraiment |hyper |super )?creati(?:f|ve|fs|ves)\b`,
    String.raw`^\s*creati(?:f|ve)\b`,
    String.raw`\bcreativite\b`,
    String.raw`\bfai(?:s|t|tes) (?:toi|te|vous) plaisir\b`,
    String.raw`\blache(?:z)? (?:toi|vous)\b`,
    String.raw`\bsurpren(?:ds|d|ez) (?:moi|nous)\b`,
    String.raw`\b(?:etonne|epate|bluffe)(?:z)? (?:moi|nous)\b`,
    String.raw`\bcarte blanche\b`,
    String.raw`\btoute liberte\b`,
    String.raw`\bliberte totale\b`,
    String.raw`\blibrement\b`,
    String.raw`\blibre a (?:toi|vous)\b`,
    String.raw`^\s*libre\b(?! (?:service|de droits?|acces))`,
    String.raw`\b(?:sois|soit|reste|soyez|t es|tu es|mode|style|forme|format|champ|montage|reel|creation|totalement|completement|entierement) libre\b(?! (?:service|de droits?|acces|cours))`,
    String.raw`\bcree(?:z)? ?(?:!|$)`,
    String.raw`\bcree(?:z)? (?:librement|ce que tu veux|ce qui te plait|quelque chose|qqch|qqc|un truc|a ta (?:facon|sauce|guise|maniere|idee)|comme tu (?:veux|le sens|l entends))`,
    String.raw`\ba toi de creer\b`,
    String.raw`\b(?:creation libre|en mode creation|fais (?:une|de la) creation|creation pure)\b`,
  ].join("|"),
  "m",
);

/** Her request asks Edith to be creative (CREATIVE): the Reel is created freely, in none of Edith's models. */
export function asksCreation(text: string | null | undefined): boolean {
  return CREATIVE.test(plain(text ?? "").replace(NOT_CREATIVE, " "));
}

/** Her words name this model of Edith's (its name, or its key): a model she chose, even with « sois créatif ». */
export function namesHouseModel(text: string | null | undefined, key: string): boolean {
  const model = houseModel(key.trim().toLowerCase());
  if (!model) return false;
  const words = ` ${plain(text ?? "").replace(/[^a-z0-9]+/g, " ")} `;
  return [model.name, model.key].some((n) => {
    const name = plain(n).replace(/[^a-z0-9]+/g, " ").trim();
    return name.length > 2 && words.includes(` ${name} `);
  });
}

/** How many of her last Reels' models are not picked again. */
export const HOUSE_PICK_AVOID = 3;

export const HOUSE_PICK_PROMPT = `You are Edith's art director. A local business (a salon, a café, a studio, a shop, a restaurant…) has sent its footage for one Instagram Reel. Edith's Reels are never made in a neutral, safe default: each one is made in one of Edith's own models (modeles), a form with one strong idea that carries every second of the Reel (a title that decodes like a film's credits, words in the four corners, a mosaic that never settles, a giant title the passers-by walk in front of…), dressed in the business's own fonts and colours. Choose the model this Reel is made in.

How to choose
- What each model is for (pour) and not for (pas_pour): never one whose pas_pour is her Reel.
- Her files first: a model can only be made with the footage it needs (il_faut, and its number of files). One that needs someone walking in front of the place, someone talking to the camera, a hand raised to a wall, a fixed shot of the shop front or photos on a plain background is out unless her files have it.
- Then her request (demande): what people must feel or do; when she names a form (a split screen, a collage, a word in big, black and white, a mosaic…), the model that is that form.
- Then her taste (ses_gouts, when given): her moodboard and art direction, the Reels she sent to copy, the Reels she kept as models, the models of the Reels she published. Between the models her files and her request allow, the one in that spirit (its energy, its typography, what it puts forward); never against her files or her request, never the same model as one she just published.
- Then her trade and what her footage shows: the model whose idea makes this business look its best (a mosaic for dishes or creations, fixed cinema shots for a calm place, whip pans for a lively street, a typed name for a place in the sun…).
- When she asks you to be creative, to surprise her or to go free (« sois créatif », « surprends-moi », « fais-toi plaisir », « libre »): "none", the Reel is then created freely with every tool, never in a model.
- When she asks for an effect or to say something (an offer, a name, a moment), a model whose idea is in its words or its effect (a title that decodes, a word you pass through, a title behind the passers-by, words that slam on each cut), never one made of images alone (a mosaic, a photo dump, fixed shots) unless she asks for that.
- Never one of derniers_modeles (the models of her last Reels): each Reel must look new.
- When Edith already showed her a plan for this Reel (plan_montre: its opening, its texts, its ending), it is what she said yes to: pick only a model that can hold it, its main words in the model's text slots (textes: how many, how long) or on its ending card (fin), its shots in its cases, its mood; never one with no place for the words of a plan that has some (a mosaic, a photo dump, fixed shots without a title), never one whose form contradicts it. A detail it cannot hold (a second short text, a precise moment) is adapted, never a reason for "none"; "none" only when no model can hold its main idea.
- When none can be made with her files, answer "none".

Answer with the model's key in "key", the next best model that fits as well in "next" ("none" when no other fits), and, in "why", one short sentence in French for her (« Je l'ai fait façon « Titre qui se décode » : ton nom apparaît comme un générique de film. »).`;

export const housePickSchema = z.object({
  key: z.string().max(40),
  next: z.string().max(40).optional(),
  why: z.string().max(300),
});
export type HousePick = z.infer<typeof housePickSchema>;

/** One of her files as the picker reads it. */
export type HousePickFile = { kind: "video" | "photo"; seconds?: number; shows: string; speaks?: boolean; people?: boolean; /** Width / height, when measured (the ideas door reads it; the picker does not). */ aspect?: number };

/**
 * Her taste as the picker reads it (Tristan: « attention, le user a aussi un mood board »): the reading of her moodboard
 * and her art direction (« Ton style »), the Reels she sent to copy and those she kept as models (each its look's name
 * and hook, as their reading wrote them), the models of the Reels she published. Each kept short; empty parts left out.
 */
export type HousePickTaste = { moodboard?: string; direction?: string; copied?: string[]; kept?: string[]; published?: string[] };

/** Her taste for the picker, or nothing when it says nothing: each part cut to its length, three at most of each list. */
export function housePickTaste(taste: HousePickTaste | undefined): Record<string, unknown> | undefined {
  if (!taste) return undefined;
  const list = (xs: string[] | undefined, n: number) => (xs ?? []).map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, n);
  const out = {
    ...(taste.moodboard?.trim() ? { moodboard: taste.moodboard.trim().slice(0, 600) } : {}),
    ...(taste.direction?.trim() ? { direction_artistique: taste.direction.trim().slice(0, 300) } : {}),
    ...(list(taste.copied, 3).length ? { reels_envoyes_a_recopier: list(taste.copied, 3) } : {}),
    ...(list(taste.kept, 3).length ? { reels_gardes_comme_modeles: list(taste.kept, 3) } : {}),
    ...(list(taste.published, 4).length ? { modeles_de_ses_reels_publies: list(taste.published, 4) } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/**
 * What the picker reads: her request, her trade, her taste, her files, whether a voice is wanted, and the models of her
 * last Reels; `least`, by model, the files a model coded as a montage skill wants at least (its slots), instead of its
 * catalogue's.
 */
export function housePickInput(input: {
  request: string;
  business: string | null;
  files: HousePickFile[];
  voice: boolean;
  avoid: string[];
  least?: Record<string, number>;
  taste?: HousePickTaste;
  /** The plan Edith showed her for this Reel (shownPlan), when one was: the model picked must hold it. */
  plan?: string;
  /** By model coded as a montage skill: its text slots and whether it has an ending card (houseRoom), for the plan. */
  room?: Record<string, HouseRoom>;
  /** The models this business plays (their skill added to the library, skillGate): the only ones offered. */
  only?: string[];
}): string {
  const taste = housePickTaste(input.taste);
  return JSON.stringify({
    demande: input.request.slice(0, 4000),
    ...(input.plan?.trim() ? { plan_montre: input.plan.trim().slice(0, 1500) } : {}),
    metier: input.business ?? "commerce",
    ...(taste ? { ses_gouts: taste } : {}),
    fichiers: input.files.slice(0, 20).map((f) => ({
      type: f.kind,
      ...(f.seconds ? { secondes: Math.round(f.seconds) } : {}),
      ce_qu_on_voit: f.shows.slice(0, 220),
      ...(f.speaks ? { quelqu_un_parle: true } : {}),
      ...(f.people ? { personnes: true } : {}),
    })),
    voix_off: input.voice,
    derniers_modeles: input.avoid,
    modeles: HOUSE_MODELS.filter((m) => !input.only || input.only.includes(m.key)).map((m) => ({
      key: m.key,
      nom: m.name,
      ce_que_ca_fait: m.pitch,
      ...(HOUSE_WHEN[m.key] ? { pour: HOUSE_WHEN[m.key]!.pour, pas_pour: HOUSE_WHEN[m.key]!.pas_pour } : {}),
      il_faut: m.needs,
      fichiers: input.least?.[m.key] ? [input.least[m.key], m.files[1]] : m.files,
      ...(input.room?.[m.key] ? { textes: input.room[m.key]!.texts, fin: input.room[m.key]!.end } : {}),
    })),
  });
}

/** The room a model coded as a montage skill has for the words of a plan: its text slots (« accroche, 22 caractères, facultatif ») and its ending card. */
export type HouseRoom = { texts: string[]; end: boolean };

/** A skill's room for words, as the picker reads it (a slot the engine writes itself, her coordinates, left out). */
export function houseRoom(skill: { texts: { slot: string; role: string; max: number; required: boolean; fact?: string; names?: string }[]; end: boolean; voice?: unknown }): HouseRoom {
  if (skill.voice) return { texts: ["ses propres mots, quand elle parle face caméra"], end: skill.end };
  const role: Record<string, string> = { hook: "accroche", band: "bandeau", caption: "petite ligne" };
  return {
    texts: skill.texts
      .filter((t) => !t.fact)
      .map((t) => `${role[t.role] ?? t.role}, ${t.max} caractères${t.names ? ", le nom d'une chose filmée" : ""}${t.required ? "" : ", facultatif"}`),
    end: skill.end,
  };
}

/**
 * The model to make the Reel in, from the picker's answer: a model of the catalogue that is not one of her last
 * Reels', and whose number of files hers can fill (a model asking for 10 files is not made with 3); null for none.
 * A model coded as a montage skill (`least`, by model) takes at least the files its slots want: Edith, who picks it
 * while the Reel is made, never asks her for more.
 */
export function readHousePick(answer: Partial<HousePick> | null | undefined, files: number, avoid: string[], least: Record<string, number> = {}): string | null {
  const model = houseModel(answer?.key?.trim().toLowerCase());
  if (!model || avoid.includes(model.key)) return null;
  if (least[model.key]) return files >= least[model.key]! ? model.key : null;
  // A model made of photos only (an interface with her logo) takes no files: any count fits.
  const [fewest] = model.files;
  return files >= Math.min(fewest, Math.max(1, fewest - 2)) ? model.key : null;
}

/** The picker's next best model (its « next »), read as its first choice is: one her files fill, not her last Reels', never the first again. */
export function readHouseNext(answer: HousePick | null | undefined, files: number, avoid: string[], least: Record<string, number> = {}): string | null {
  const first = readHousePick(answer, files, avoid, least);
  const next = readHousePick({ key: answer?.next ?? "" }, files, avoid, least);
  return next && next !== first ? next : null;
}

/**
 * What the chain does when the filler refuses the model a Reel was to be played on (docs/modeles.md, « Un modèle choisi
 * par Edith joue ») — Tristan, 7 November, on « Novembre, version cocon »: « mais comment ça a pu coûter si cher ? »,
 * « pourtant il ressemble fort à un modèle »: the model Edith had picked, refused, stayed the editor's inspiration and
 * the motion designer redrew it by hand (0,58 € of the Reel's 1,31 €). A model Edith picked (`picked`) is never redrawn
 * by hand: on a new Reel, the next best model of the pick, once (`next`: its skill plays with her files), else the Reel
 * made freely (`free`: the model let go, the post's inspiration cleared). A model she chose or a Reel she copies
 * (`picked` false), or a correction of a version made on that model's skill, keeps the editor's starting point as before
 * (null); a correction of a version the editor made with the model only as an inspiration lets it go too.
 */
export function houseFallback(input: {
  picked: boolean;
  correction: boolean;
  /** The model refused (on a correction, the one the post follows). */
  refused: string;
  /** The version a correction corrects was made on that model's skill. */
  previousOnModel?: boolean;
  next?: string | null;
  /** Models already tried for this Reel. */
  tried?: string[];
  /** Whether a model's skill plays this Reel (this studio plays it, her files fill it, nothing she fixed is beyond it). */
  playable: (key: string) => boolean;
}): { next: string } | { free: true } | null {
  if (!input.picked) return null;
  if (input.correction) return input.previousOnModel ? null : { free: true };
  const next = input.next?.trim().toLowerCase();
  if (next && next !== input.refused && !(input.tried ?? []).includes(next) && input.playable(next)) return { next };
  return { free: true };
}
