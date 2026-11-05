// Font pairings that work (Tristan, on the « Fonts pairing » Reel: « une petite bibliothèque d'associations qui
// marchent »), read on the reference Reels frame by frame: each is a title face and a text face, with how the title
// is set (its case, its weight, its tracking) and where it fits. Her charter decides her fonts; a pairing serves when
// a Reel needs others (a model of Edith's, a universe she names, her request), when she picks one in Style, or when
// the editor or the motion designer takes a liberty with the type: a tested pair rather than two fonts met by chance.
// Every family is a Google Fonts family by its exact name (the render loads it from there).

export type FontPair = {
  key: string;
  /** Its name for her, in French. */
  name: string;
  /** The title face: a Google Fonts family, its weight, case and tracking as the references set it. */
  display: { family: string; weight: number; case: "upper" | "normal"; tracking: "tight" | "normal" | "wide"; italic?: boolean };
  /** The text face: labels, a line under the title, subtitles. */
  body: { family: string; weight: number; case?: "upper" | "normal"; tracking?: "tight" | "normal" | "wide" };
  /** How the two meet, in a few French words (what the scale contrast is). */
  how: string;
  /** Where it fits, in a few French words. */
  fits: string;
};

export const FONT_PAIRS: FontPair[] = [
  {
    key: "condensee-geometrique",
    name: "Condensée et géométrique fine",
    display: { family: "Bebas Neue", weight: 400, case: "upper", tracking: "tight" },
    body: { family: "Jost", weight: 300 },
    how: "un chiffre ou un mot clé très serré à côté d'une phrase fine sur trois lignes",
    fits: "un chiffre fort, une offre, un mot clé au-dessus d'une personne",
  },
  {
    key: "affiche",
    name: "Affiche",
    display: { family: "Anton", weight: 400, case: "upper", tracking: "tight" },
    body: { family: "Inter Tight", weight: 500 },
    how: "des mots empilés en très grand, un par ligne, une petite ligne nette dessous",
    fits: "une pile de photos, un titre qui claque, un lieu tapé lettre à lettre",
  },
  {
    key: "editorial",
    name: "Éditorial",
    display: { family: "Instrument Serif", weight: 400, case: "normal", tracking: "normal" },
    body: { family: "Inter Tight", weight: 500, case: "upper", tracking: "wide" },
    how: "un titre serif en casse normale, un mot en italique, des étiquettes minuscules en capitales espacées",
    fits: "des plans fixes de cinéma, une signature en petit serif sur le noir, une table, un restaurant",
  },
  {
    key: "serif-grasse",
    name: "Serif grasse et petits mots espacés",
    display: { family: "Lora", weight: 700, case: "normal", tracking: "tight" },
    body: { family: "Poppins", weight: 600, case: "normal", tracking: "wide" },
    how: "un ou deux mots en serif gras serrés sous trois petits mots sans serif très espacés, tout petit au centre",
    fits: "des plans fixes de cinéma, un titre court posé au milieu d'un plan calme",
  },
  {
    // « Écran partagé titré » v2 (docs/fiches/ecran-partage.md): its two small titles are in a classic book serif, wider
    // than Instrument Serif; the line of its ending card in spaced small capitals.
    key: "labeur",
    name: "Serif de labeur et petites capitales",
    display: { family: "EB Garamond", weight: 400, case: "normal", tracking: "normal" },
    body: { family: "Inter Tight", weight: 500, case: "upper", tracking: "wide" },
    how: "deux petits titres en serif de labeur, romain, qui se répondent ; une ligne en petites capitales espacées sous un titre",
    fits: "un écran partagé titré, le geste et son résultat, un atelier, une cuisine",
  },
  {
    key: "didone",
    name: "Didone de luxe",
    display: { family: "Bodoni Moda", weight: 700, case: "upper", tracking: "tight" },
    body: { family: "Jost", weight: 300, case: "upper", tracking: "wide" },
    how: "un nom de lieu géant à forts contrastes de trait, une ligne fine espacée au-dessus",
    fits: "une journée dans une ville, une boutique, la mode, la beauté",
  },
  {
    key: "gaufre",
    name: "Serif gaufrée",
    display: { family: "DM Serif Display", weight: 400, case: "normal", tracking: "tight" },
    body: { family: "Cormorant Garamond", weight: 500, case: "upper", tracking: "wide" },
    how: "un seul mot serif très gras sur le papier, une ligne en petites capitales très espacées dessous",
    fits: "un titre en relief sur papier, une fin de Reel, un artisan",
  },
  {
    key: "grotesque",
    name: "Grotesque sobre",
    display: { family: "Inter Tight", weight: 600, case: "normal", tracking: "tight" },
    body: { family: "Inter Tight", weight: 400 },
    how: "une seule famille, deux graisses : un titre serré, des étiquettes petites",
    fits: "une interface, un profil, des mots aux quatre coins, un studio de design",
  },
  {
    key: "technique",
    name: "Étiquettes techniques",
    display: { family: "Oswald", weight: 500, case: "upper", tracking: "normal" },
    body: { family: "IBM Plex Mono", weight: 400, case: "upper", tracking: "wide" },
    how: "des étiquettes fixes dans les coins (une altitude, des coordonnées, une heure) qui ne bougent pas pendant que les plans passent",
    fits: "un voyage, des fenêtres posées sur un paysage, un lieu à situer",
  },
  {
    key: "pixel",
    name: "Pixel cosy",
    display: { family: "Pixelify Sans", weight: 500, case: "normal", tracking: "normal" },
    body: { family: "Space Mono", weight: 400 },
    how: "un titre en pixels doux avec deux points d'exclamation, de toutes petites légendes en machine à écrire",
    fits: "une recette, la cuisine du soir, un café, quelque chose de doux",
  },
  {
    key: "feutre",
    name: "Feutre",
    display: { family: "Permanent Marker", weight: 400, case: "upper", tracking: "normal" },
    body: { family: "Inter Tight", weight: 500 },
    how: "des mots écrits au feutre sur une carte tenue à la main, rien d'autre",
    fits: "une soirée, une invitation, un message dit en une phrase",
  },
  {
    key: "decodage",
    name: "Sans humaniste",
    display: { family: "Open Sans", weight: 400, case: "upper", tracking: "normal" },
    // Its small words in the title's own face, regular, in lower case, a little spaced (docs/fiches/decode.md, effect 3).
    body: { family: "Open Sans", weight: 400, case: "normal", tracking: "wide" },
    how: "un titre en capitales régulières qui se décode, trois petits mots en minuscules un peu espacées au-dessus, dans la même police",
    fits: "un paysage, un voyage, un titre qui se décode",
  },
  {
    key: "geante-script",
    name: "Géante et manuscrite",
    display: { family: "Archivo Black", weight: 400, case: "upper", tracking: "tight" },
    body: { family: "Caveat", weight: 500 },
    how: "un nom de lieu très gras qui remplit la largeur, deux mots manuscrits au-dessus",
    fits: "un titre derrière une personne, une ville, un quartier",
  },
  {
    key: "coulisses",
    name: "Coulisses",
    // Its original's title is a bold grotesque set tight, not condensed (the word is 8,4 times its cap height).
    display: { family: "Inter Tight", weight: 700, case: "upper", tracking: "tight" },
    body: { family: "Inter Tight", weight: 700, case: "upper", tracking: "normal" },
    how: "un grand titre gras en deux niveaux (un petit mot au-dessus de chaque bout), des étiquettes en capitales grasses",
    fits: "les coulisses, un montage montré, une liste d'étapes",
  },
  {
    key: "cinema",
    name: "Cinéma condensé",
    display: { family: "Big Shoulders Display", weight: 800, case: "upper", tracking: "tight" },
    body: { family: "Inter", weight: 400 },
    how: "un nom de ville blanc très condensé posé dans le ciel, rien d'autre ou presque",
    fits: "une ville, un film, du noir et blanc",
  },
];

const BY_KEY = new Map(FONT_PAIRS.map((p) => [p.key, p]));

/** A pairing by its key. */
export const fontPair = (key: string | undefined | null): FontPair | undefined => (key ? BY_KEY.get(key) : undefined);

/** The two families of a pairing, as a plan holds them (plan.fonts). */
export const pairFonts = (pair: FontPair): { display: string; body: string } => ({ display: pair.display.family, body: pair.body.family });

const CASE = { upper: "capitales", normal: "casse normale" } as const;
const TRACKING = { tight: "serrée", normal: "", wide: "espacée" } as const;

/** One pairing in a line: its families and how it is set. */
export function fontPairLine(pair: FontPair): string {
  const set = (f: { weight: number; case?: "upper" | "normal"; tracking?: "tight" | "normal" | "wide"; italic?: boolean }) =>
    [String(f.weight), f.case ? CASE[f.case] : "", f.tracking ? TRACKING[f.tracking] : "", f.italic ? "italique" : ""].filter(Boolean).join(", ");
  return `${pair.name} : « ${pair.display.family} » (${set(pair.display)}) + « ${pair.body.family} » (${set(pair.body)}) ; ${pair.how} ; pour ${pair.fits}`;
}

/** The pairings for the editor and the motion designer: what to reach for when a Reel takes a liberty with the type. */
export function fontPairsBrief(): string[] {
  return FONT_PAIRS.map(fontPairLine);
}
