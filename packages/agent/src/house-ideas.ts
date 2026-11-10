import { addressIn } from "./geo.ts";
import { HOUSE_MODELS, HOUSE_WHEN, houseModel } from "./house-models.ts";

// « Regarde nos idées » (Tristan, 10 November: « ok » to the three doors, then « renvoie vers une page sur WhatsApp
// c'est sûrement plus facile »): when she makes a Reel, a third door beside « Fais-moi confiance » (Edith chooses) and
// « Je sais ce que je veux » (her words, a Reel she likes): a few ideas of form, never the catalogue. Six to eight of
// Edith's models, only those Tristan validated (skillGate), chosen here without any model call for her trade and the
// files she gave for this Reel, each with its animated preview and a plain name of its own (never its internal name,
// never the word « modèle »). Rotation: an idea shown this month to a business of the same trade in the same city is
// shown to another only when nothing else is left. Her Reel is then made in it with her images, her charter, her music.

/** The most ideas shown at once, the fewest worth a page (below, the door is not offered). */
export const IDEAS_MAX = 8;
export const IDEAS_MIN = 6;
export const IDEAS_FLOOR = 3;

/** Where a model's preview is kept (bucket media; never under a studio's folder, never a media_asset: retention never sees it). */
export const IDEA_PREVIEW_DIR = "house/previews";
export const ideaPreviewPath = (key: string, ext: "mp4" | "jpg") => `${IDEA_PREVIEW_DIR}/${key}.${ext}`;

/** The three doors of a new Reel, as buttons (WhatsApp's are 20 characters at most: « J'ai mon idée » there). */
export const IDEA_DOORS = { trust: "Fais-moi confiance", know: "Je sais ce que je veux", ideas: "Regarde nos idées" } as const;
export const WHATSAPP_KNOW_DOOR = "J’ai mon idée";

/** The doors' buttons on a channel; the ideas door only when her business has enough ideas to show. */
export function ideaDoors(channel: "whatsapp" | "app", ideas: boolean): string[] {
  return [IDEA_DOORS.trust, channel === "whatsapp" ? WHATSAPP_KNOW_DOOR : IDEA_DOORS.know, ...(ideas ? [IDEA_DOORS.ideas] : [])];
}

/**
 * Each idea's name for her: plain French, what it does, never the name the team gives it (Tristan, 6 November: « je
 * préfère ne pas divulguer nos modèles »). A model without one is never shown.
 */
export const IDEA_NAMES: Record<string, string> = {
  decode: "Ton nom en générique",
  "quatre-coins": "Une phrase aux quatre coins",
  mosaique: "Une mosaïque qui bouge",
  "carte-feutre": "Ton message au feutre",
  pile: "Tes photos en rafale",
  "mon-travail": "Toi devant ton travail",
  "photo-dump": "Ta semaine en vrac",
  table: "Tes tirages sur la table",
  "ecran-partage": "Le geste et le résultat",
  cadre: "Une fenêtre sur la couleur",
  fenetres: "Carnet de voyage",
  facade: "Ta devanture pièce à pièce",
  gaufre: "Ton nom en relief",
  "mot-cle": "Tes mots au-dessus de toi",
  frappe: "Ton lieu au soleil",
  "titre-derriere": "Un titre dans le ciel",
  journee: "Ta journée du matin au soir",
  rallume: "Lumières qui s’allument",
  "plans-fixes": "Comme au cinéma",
  "coups-de-fouet": "Ta rue à toute allure",
  tourne: "Deux tons, plein écran",
  nike: "Noir et blanc énergique",
  eventail: "Une étoile de bandes",
  coulisses: "Tes coulisses en fiche",
  interrupteur: "Ton logo qui s’allume",
  interface: "Ton profil à suivre",
  pixel: "Recette cosy",
  "mots-meles": "Des mots cachés",
  aplat: "Toi sur un aplat de couleur",
  detourages: "Ton nom derrière le décor",
  createur: "Tu parles, on voit",
  silhouette: "Ton portrait en silhouette",
  vision: "Vu par une machine",
  "court-metrage": "Ton court métrage",
  "titre-cinema": "Un film signé de ton nom",
  "celui-la": "Un mot sur chaque produit",
  routine: "Ton rituel du matin",
  nuit: "Ton enseigne la nuit",
  bientot: "Bientôt chez toi",
  "nom-de-ville": "Ton quartier en grand",
  carnet: "Ton produit phare raconté",
  "petites-lumieres": "Tes lumières du soir",
  "vlog-ville": "Ton quartier raconté",
  assiettes: "Ta carte vue d’en haut",
  "chef-face": "Tu le cuisines, tu le goûtes",
  recette: "Ton savoir-faire pas à pas",
  affiches: "Tes produits en affiches",
  vitraux: "Ta vitrine en kaléidoscope",
  curseur: "Un clic sur tes produits",
  bienvenue: "Bienvenue, puis la rafale",
  raccords: "Des images qui s’emboîtent",
  aventure: "Ton année en film",
  depart: "Le départ, puis l’arrivée",
  collage: "Un collage plein d’élan",
  "en-boutique": "Créé à deux, en boutique",
};

/** An idea's name for her, or null for a model that has none (never shown). */
export const ideaName = (key: string): string | null => IDEA_NAMES[key] ?? null;

/** What an idea does, in one sentence for her (its catalogue's), or null. */
export const ideaPitch = (key: string): string | null => houseModel(key)?.pitch ?? null;

/** A business's trade, as the rotation and the fit read it (finer than the families of post ideas). */
export type IdeaTrade = "coiffure" | "beaute" | "mouvement" | "fleuriste" | "boulangerie" | "bar" | "restaurant" | "cafe" | "mode" | "atelier" | "lieu" | "autre";

const TRADES: [IdeaTrade, RegExp][] = [
  ["coiffure", /coiff|barbi|barber/i],
  ["beaute", /manucur|ongl|esth[ée]ti|institut|\bspa\b|massage|maquill|cils|tatou/i],
  ["mouvement", /pilates|yoga|fitness|sport|danse|boxe|\bgym|crossfit|coach|muscu|escalade|natation/i],
  ["fleuriste", /fleur/i],
  ["boulangerie", /boulang|p[âa]tiss|chocolat|biscuit|g[âa]teau|viennois/i],
  ["bar", /\bbar\b|cocktail|\bvins?\b|cave|bi[èe]re/i],
  ["restaurant", /restau|bistro|brasserie|traiteur|sandwich|pizz|cantine|burger|cuisine|\bfood/i],
  ["cafe", /caf[ée]|coffee|salon de th[ée]/i],
  ["mode", /mode|boutique|fripe|v[êe]tement|couture|styliste|concept|bijou|joaill|parfum|chaussure|magasin/i],
  ["atelier", /c[ée]ram|atelier|artisan|peint|illustr|[ée]b[ée]nist|menuis|poterie|maroquin|verrier/i],
  ["lieu", /h[ôo]tel|g[îi]te|chambre|loisir|jet[ée]e|plage|camping|mus[ée]e/i],
];

/** Her trade from her business type (free text, « salon de coiffure », « bar à vins et cave »…). */
export function ideaTrade(businessType: string | null | undefined): IdeaTrade {
  if (!businessType?.trim()) return "autre";
  return TRADES.find(([, re]) => re.test(businessType))?.[0] ?? "autre";
}

/** A town as the rotation compares it: lower case, no accents, no arrondissement. */
const townKey = (town: string) =>
  town
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b\d+(?:er|e|eme)?\b/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim() || null;

/**
 * Her city, when known: the town of her address (her place found on her facts or her site, then her facts), else
 * « à Paris » in her business type. Null when unknown: the rotation then compares her trade only.
 */
export function ideaCity(input: { address?: string | null; facts?: string[]; businessType?: string | null }): string | null {
  const address = addressIn([...(input.address ? [input.address] : []), ...(input.facts ?? [])]);
  if (address?.town) return townKey(address.town);
  const named = /(?:^|\s)(?:à|a) ((?:[A-ZÉÈ][\p{L}'’-]+)(?:[ -](?:[A-ZÉÈ][\p{L}'’-]+|sur|en|le|la|les|de))*)\s*$/u.exec(input.businessType?.trim() ?? "");
  return named ? townKey(named[1]!) : null;
}

/** The month the rotation counts in (YYYY-MM, her time zone). */
export function ideaMonth(now: Date, timeZone = "Europe/Paris"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

/** One of her files for this Reel, as the curation reads it (its reading may not be there yet). */
export type IdeaFile = { kind: "video" | "photo"; seconds?: number; shows?: string; speaks?: boolean; aspect?: number };

/** A model that may be shown: its skill plays for her (validated), its preview is kept; `least`, the files its skill wants at least. */
export type IdeaCandidate = { key: string; least: number };

/**
 * What a model cannot do without (read on her files): someone talking, videos at all, wide videos, or something her
 * files must show (their readings: Gemini's summary, a photo's notes, in French or English). A file not read yet
 * shows nothing: a model that needs something seen is left out rather than refused later.
 */
type Need = { talk?: true; wide?: true; shows?: RegExp };
const EVENING = /soir|nuit|night|evening|dusk|dark|lampe|lamp|bougie|candle|n[ée]on|guirlande|lumi[èe]res? (?:allum|tamis|chaud)|lights? on|neon|lanterne/i;
const FRONT = /devanture|fa[çc]ade|vitrine|enseigne|storefront|shop ?front|shop window|signage|\bsign\b|porte d.entr[ée]e|entrance/i;
const PERSON = /personne|femme|homme|client|cliente|quelqu.un|person|woman|\bman\b|people|gens|[ée]quipe|team|coiffeu|barbier|chef|danseu|prof|g[ée]rant/i;
const SKY = /\bciel\b|\bsky\b|toits?|rooftops?|paysage|landscape|horizon|skyline|panorama/i;
const FOOD = /plat|assiette|dish|plate|food|g[âa]teau|cake|p[âa]tisser|pain|bread|recette|cuisin|caf[ée] |coffee|boisson|drink|cocktail/i;

const NEEDS: Record<string, Need> = {
  "mot-cle": { talk: true },
  createur: { talk: true },
  carnet: { talk: true },
  "chef-face": { talk: true, shows: FOOD },
  rallume: { shows: EVENING },
  nuit: { shows: EVENING },
  "petites-lumieres": { shows: EVENING },
  facade: { shows: FRONT },
  gaufre: { shows: FRONT },
  vitraux: { shows: FRONT },
  aplat: { shows: PERSON },
  silhouette: { shows: PERSON },
  interrupteur: { shows: PERSON },
  depart: { shows: PERSON },
  "en-boutique": { shows: PERSON },
  curseur: { shows: PERSON },
  "titre-derriere": { shows: SKY },
  detourages: { shows: SKY },
  "nom-de-ville": { shows: SKY },
  "titre-cinema": { shows: SKY },
  tourne: { wide: true },
  "court-metrage": { wide: true },
  assiettes: { shows: FOOD },
  pixel: { shows: FOOD },
};

/** The ideas that suit a trade best (its own trade's Reels): a boost, never the only ones. */
const TRADE_PICKS: Record<IdeaTrade, string[]> = {
  coiffure: ["ecran-partage", "mon-travail", "recette", "aplat", "silhouette", "pile", "celui-la"],
  beaute: ["ecran-partage", "mon-travail", "pile", "recette", "silhouette", "affiches"],
  mouvement: ["nike", "journee", "quatre-coins", "aplat", "silhouette", "mot-cle", "bienvenue"],
  fleuriste: ["mon-travail", "mosaique", "recette", "affiches", "celui-la", "table"],
  boulangerie: ["routine", "celui-la", "recette", "pixel", "affiches", "mosaique"],
  bar: ["nuit", "rallume", "petites-lumieres", "coups-de-fouet", "celui-la", "bienvenue"],
  restaurant: ["assiettes", "chef-face", "mosaique", "table", "recette", "rallume", "pixel"],
  cafe: ["routine", "rallume", "petites-lumieres", "bienvenue", "pixel", "celui-la", "curseur"],
  mode: ["affiches", "celui-la", "vitraux", "curseur", "aplat", "collage"],
  atelier: ["table", "mon-travail", "recette", "tourne", "ecran-partage", "pile"],
  lieu: ["frappe", "titre-derriere", "court-metrage", "vlog-ville", "fenetres", "detourages"],
  autre: ["decode", "quatre-coins", "raccords", "collage", "journee", "bienvenue"],
};

/** The words of a trade in the catalogue's « pour » (« un café, une boutique, un salon… »). */
const TRADE_WORDS: Record<IdeaTrade, RegExp | null> = {
  coiffure: /coiff|barbier|salon|coupe/i,
  beaute: /salon|soin|institut/i,
  mouvement: /sport|danse|effort|studio/i,
  fleuriste: /fleur|bouquet/i,
  boulangerie: /boulang|p[âa]tiss|g[âa]teau/i,
  bar: /\bbar\b|soir[ée]e/i,
  restaurant: /restaurant|traiteur|cantine|plat|cuisine/i,
  cafe: /caf[ée]/i,
  mode: /boutique|collection|vitrine|pi[èe]ces/i,
  atelier: /atelier|c[ée]ramiste|savoir-faire|artisan/i,
  lieu: /paysage|sortie|voyage|escapade|plage/i,
  autre: null,
};

/** A stable number in [0, 1) for a string (FNV-1a): the same business sees the same order within a month. */
function stable(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/** Whether her files give this model what it cannot do without. */
export function ideaFits(key: string, least: number, files: IdeaFile[]): boolean {
  if (files.length < least) return false;
  const model = houseModel(key);
  if (!model) return false;
  // A model whose catalogue asks for videos only (« 4 à 12 vidéos ») is never made of photos alone.
  if (/vid[ée]o/i.test(model.needs) && !/photo/i.test(model.needs) && !files.some((f) => f.kind === "video")) return false;
  const need = NEEDS[key];
  if (!need) return true;
  if (need.talk && !files.some((f) => f.kind === "video" && f.speaks)) return false;
  if (need.wide && files.filter((f) => f.kind === "video" && (f.aspect ?? 0) > 1.2).length < Math.min(2, files.length)) return false;
  if (need.shows && !files.some((f) => need.shows!.test(f.shows ?? ""))) return false;
  return true;
}

/** How well an idea suits her: her trade's own ideas first, then the catalogue's words for her trade, her files' size. */
export function ideaScore(key: string, trade: IdeaTrade, files: IdeaFile[]): number {
  const model = houseModel(key);
  if (!model) return -Infinity;
  let score = 0;
  if (TRADE_PICKS[trade].includes(key)) score += 3;
  const words = TRADE_WORDS[trade];
  if (words && words.test(`${HOUSE_WHEN[key]?.pour ?? ""} ${model.pitch}`)) score += 2;
  // Her files within what it takes at its best (not just its least).
  const [fewest, most] = model.files;
  if (files.length >= fewest && files.length <= Math.max(fewest, most)) score += 1;
  // Someone talks in her videos: the ideas made for it.
  if (NEEDS[key]?.talk) score += 1;
  return score;
}

/**
 * The ideas shown to her for this Reel, best first: among the candidates (validated for her, a preview kept), those her
 * files can make (ideaFits), ranked for her trade (ideaScore, a stable shuffle by business and month between equals),
 * her last Reels' models after the others. Those shown this month to another business of her trade in her city
 * (`taken`) come only when fewer than IDEAS_MIN are left without them. Empty below IDEAS_FLOOR: no page of two ideas.
 */
export function curateIdeas(input: {
  studioId: string;
  month: string;
  trade: IdeaTrade;
  files: IdeaFile[];
  candidates: IdeaCandidate[];
  taken?: string[];
  recent?: string[];
  max?: number;
}): string[] {
  const max = Math.max(1, Math.min(IDEAS_MAX, input.max ?? IDEAS_MAX));
  const taken = new Set(input.taken ?? []);
  const recent = new Set(input.recent ?? []);
  const ranked = input.candidates
    .filter((c) => ideaName(c.key) && ideaFits(c.key, c.least, input.files))
    .map((c) => ({ key: c.key, score: ideaScore(c.key, input.trade, input.files) - (recent.has(c.key) ? 2 : 0) + stable(`${input.studioId}|${input.month}|${c.key}`) }))
    .sort((a, b) => b.score - a.score)
    .map((c) => c.key);
  const free = ranked.filter((k) => !taken.has(k));
  // Too few left without them: those already shown to her neighbours fill up to IDEAS_MIN, never more.
  const shown = free.length >= IDEAS_MIN ? free.slice(0, max) : [...free, ...ranked.filter((k) => taken.has(k))].slice(0, Math.min(max, IDEAS_MIN));
  return shown.length >= IDEAS_FLOOR ? shown : [];
}

/** Every model, whether it has a name for her (the map covers the catalogue). */
export const unnamedIdeas = (): string[] => HOUSE_MODELS.map((m) => m.key).filter((k) => !IDEA_NAMES[k]);
