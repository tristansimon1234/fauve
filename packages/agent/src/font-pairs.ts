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
  {
    key: "ronde-large",
    name: "Grotesque ronde et large",
    // « Ton nom qui clignote » v2 (docs/fiches/detourages.md, effect 2): its name in very bold, round and wide capitals.
    display: { family: "Montserrat", weight: 800, case: "upper", tracking: "normal" },
    body: { family: "Montserrat", weight: 500 },
    how: "un seul nom en capitales très grasses, rondes et larges, qui remplit la largeur du cadre, rien d'autre",
    fits: "un paysage, un voyage, un nom qui s'allume derrière le décor",
  },
  {
    key: "geometrique",
    name: "Géométrique grasse",
    // « Mot clé en grand »: its hook and keyword in bold capitals of a geometric sans, its small words the same face.
    display: { family: "Poppins", weight: 700, case: "upper", tracking: "normal" },
    body: { family: "Poppins", weight: 400, case: "normal", tracking: "wide" },
    how: "ses premiers mots puis un mot clé en capitales grasses au-dessus d'une tête, ses mots dits en petit au-dessus, très espacés",
    fits: "quelqu'un qui parle face caméra, un mot clé par idée, une liste",
  },
  {
    key: "createur",
    name: "Créateur face caméra",
    // « Face caméra et références »: its first phrase in a bold condensed grotesque, its small subtitles semi-bold.
    display: { family: "Roboto Condensed", weight: 700, case: "normal", tracking: "normal" },
    body: { family: "Inter Tight", weight: 600 },
    how: "sa première phrase en grasse condensée sur des bandeaux noirs, puis de petits sous-titres sobres en grotesque demi-grasse",
    fits: "quelqu'un qui parle face caméra, une explication, des références",
  },
  {
    // « Court métrage » (docs/fiches/court-metrage.md, effect 2): its film's title card in one serif family, its title in
    // big capitals on two tight lines, one small word in spaced capitals over it, its credit in small italic under it.
    key: "generique",
    name: "Générique de film",
    display: { family: "Cormorant Garamond", weight: 600, case: "upper", tracking: "tight" },
    body: { family: "Cormorant Garamond", weight: 500, case: "upper", tracking: "wide" },
    how: "un titre de film en grandes capitales serif sur deux lignes serrées, un petit mot en capitales très espacées au-dessus, une signature en petit italique dessous, dans la même famille",
    fits: "un court métrage, une journée racontée comme un film, un générique d'ouverture",
  },
  {
    // « Titre de film signé » (docs/fiches/titre-cinema.md, effect 1): its title in very heavy square capitals with slits
    // for counters (Sarpanch 900 at its own width: 15,9 capitals for the original's 15,5), its signature in a roman serif.
    key: "generique-signe",
    name: "Générique signé",
    display: { family: "Sarpanch", weight: 900, case: "upper", tracking: "normal" },
    body: { family: "Tinos", weight: 400, case: "normal", tracking: "normal" },
    how: "un mot en capitales carrées très grasses au milieu de l'image, une signature en serif romain sous sa fin (« par Léa »)",
    fits: "un titre de film signé, un lieu raconté comme un court film, une ambiance du soir",
  },
  {
    // « Teaser qui se charge » (docs/fiches/bientot.md, effects 1, 4 and 6): its counter and its word in a wide serif of
    // strong contrast with a large x-height (0,72 of its capitals; Instrument Serif is a fifth narrower), set small at the
    // centre, its figures lining; its name in thin capitals of a geometric sans on the black.
    key: "mode",
    name: "Serif de mode et capitales fines",
    display: { family: "Playfair Display", weight: 400, case: "normal", tracking: "normal" },
    body: { family: "Jost", weight: 300, case: "upper", tracking: "wide" },
    how: "un petit compteur et un mot en serif à fort contraste au centre de l'image, une signature en capitales fines espacées sur le noir",
    fits: "un teaser, une nouvelle collection, la mode, un atelier, une boutique",
  },
  {
    key: "film-large",
    name: "Titre de film large",
    // « Ta ville racontée » (docs/fiches/vlog-ville.md, effect 3): its title in extended black capitals between quotes
    // (Unbounded 900 sets « LONDON » 389 px wide at the original's 52 px cap height, the original 410), its subtitles in
    // a plain grotesque, regular, lowercase.
    display: { family: "Unbounded", weight: 900, case: "upper", tracking: "tight" },
    body: { family: "Inter", weight: 400, case: "normal", tracking: "normal" },
    how: "un nom en capitales très larges et très grasses entre guillemets, une signature en petit au-dessus et une ligne minuscule dessous ; de petits sous-titres fins en minuscules",
    fits: "un court-métrage de ville raconté, un titre de film posé sur quelqu'un de dos",
  },
  {
    // « Défilé d'assiettes » (docs/fiches/assiettes.md, effect 3): its title typed in a very bold condensed grotesque in
    // capitals, its line typed under it in a fine upright serif in lower case (not an italic), both white, no shadow.
    key: "menu",
    name: "Titre condensé et serif fine",
    display: { family: "Anton", weight: 400, case: "upper", tracking: "normal" },
    body: { family: "Cormorant Garamond", weight: 500, case: "normal", tracking: "normal" },
    how: "un titre court en capitales condensées très grasses au milieu, une ligne fine en serif droite et en minuscules juste dessous, tapées ensemble lettre à lettre",
    fits: "un menu, une carte, des idées de recettes, une sélection de produits qui défile",
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

// ——— A font per word ————————————————————————————————————————————————————————————————————————————————————————————————

// A font for one word, for what it evokes (« Mot clé en grand », docs/fiches/mot-cle.md, effect 4: each name of a list
// in its own font, « une manuscrite pour « soin », une ronde et grasse pour « gourmand », une condensée pour « fort »,
// une machine à écrire pour « recette » »): Google Fonts families sorted by what they call to mind, from which a skill's
// filler picks the font of a keyword or of each name of a list she says, beyond her two fonts (skills.ts: `font` of a
// SkillText, `fonts` of a SkillVoice). Every family is served by Google Fonts under this exact name (each one checked on
// its CSS API, 5 November 2026), loaded by the render like any font a text brings.

export type WordFont = {
  /** Its Google Fonts family, by its exact name (the render loads it from there, every weight it has). */
  family: string;
  /** The weight it reads best at in big (400 for a family that has only that one). */
  weight: number;
  /** Set in capitals (a family made of capitals, or one that only looks right in them). */
  upper?: boolean;
  /** What its letters look like, in a few French words, for the filler. */
  looks: string;
  /** What it evokes, in French words the filler matches with her word or what it names. */
  evokes: string[];
};

export const WORD_FONTS: WordFont[] = [
  // Bakery, pastry, sweet things.
  { family: "Fraunces", weight: 900, looks: "serif molle et très grasse, des années 70 (comme Cooper Black)", evokes: ["boulangerie", "pain", "viennoiserie", "gourmand", "rétro", "chaleureux"] },
  { family: "Leckerli One", weight: 400, looks: "manuscrite grasse et gourmande", evokes: ["pâtisserie", "gâteau", "crêpe", "goûter", "sucré"] },
  { family: "Cookie", weight: 400, looks: "script rond de vitrine", evokes: ["pâtisserie", "cupcake", "salon de thé", "douceur"] },
  { family: "Shrikhand", weight: 400, looks: "italique très grasse et ronde", evokes: ["gourmand", "épices", "glace", "fruits", "street food"] },
  { family: "Lilita One", weight: 400, looks: "ronde très grasse", evokes: ["bonbon", "gourmand", "enfants", "fun", "burger"] },
  { family: "Chewy", weight: 400, looks: "dessin animé, molle", evokes: ["bonbon", "jeu", "enfants", "fun"] },
  // Coffee, tea, a terrace.
  { family: "Pacifico", weight: 400, looks: "manuscrite ronde des années 50", evokes: ["café", "glace", "plage", "été", "surf", "vintage"] },
  { family: "Satisfy", weight: 400, looks: "script léger, décontracté", evokes: ["café", "brunch", "terrasse", "été"] },
  { family: "Yellowtail", weight: 400, looks: "script rétro d'enseigne", evokes: ["diner", "café", "rétro", "américain"] },
  // Wine, gastronomy, luxury.
  { family: "Playfair Display", weight: 700, looks: "didone élégante à forts contrastes", evokes: ["vin", "gastronomie", "restaurant", "luxe", "éditorial"] },
  { family: "Cormorant Garamond", weight: 600, looks: "serif fine et classique", evokes: ["vin", "cave", "bijoux", "poésie", "élégance"] },
  { family: "Cinzel", weight: 700, upper: true, looks: "capitales romaines gravées", evokes: ["vin", "champagne", "classique", "monument", "prestige"] },
  { family: "Bodoni Moda", weight: 700, looks: "didone de magazine de mode", evokes: ["mode", "haute couture", "luxe", "boutique"] },
  { family: "Italiana", weight: 400, upper: true, looks: "capitales fines et hautes", evokes: ["mode", "parfum", "chic", "boutique"] },
  // Flowers, beauty, care.
  { family: "Dancing Script", weight: 700, looks: "manuscrite élégante et vivante", evokes: ["fleurs", "fleuriste", "bouquet", "mariage", "douceur"] },
  { family: "Great Vibes", weight: 400, looks: "calligraphie fine à boucles", evokes: ["beauté", "soin", "parfum", "mariage", "romantique"] },
  { family: "Parisienne", weight: 400, looks: "calligraphie parisienne", evokes: ["beauté", "mode", "Paris", "chic", "féminin"] },
  { family: "Sacramento", weight: 400, looks: "script monoligne très fin", evokes: ["soin", "bien-être", "spa", "douceur", "ongles"] },
  { family: "Allura", weight: 400, looks: "calligraphie souple", evokes: ["fleurs", "beauté", "mariage", "cosmétique"] },
  { family: "Yeseva One", weight: 400, looks: "serif grasse et féminine", evokes: ["beauté", "cosmétique", "institut", "maquillage"] },
  // Wellness, yoga, softness.
  { family: "Comfortaa", weight: 600, looks: "ronde légère", evokes: ["bien-être", "yoga", "doux", "zen", "bébé"] },
  { family: "Fredoka", weight: 600, looks: "ronde douce et grasse", evokes: ["enfants", "jouets", "doux", "crèche", "animaux"] },
  // Strength, sport, numbers.
  { family: "Anton", weight: 400, upper: true, looks: "condensée très grasse", evokes: ["sport", "force", "fort", "muscu", "impact", "chiffre"] },
  { family: "Bebas Neue", weight: 400, upper: true, looks: "condensée en capitales", evokes: ["sport", "salle", "course", "chiffre", "affiche"] },
  { family: "Oswald", weight: 600, upper: true, looks: "condensée nette", evokes: ["sport", "coaching", "technique", "info"] },
  { family: "Teko", weight: 600, upper: true, looks: "condensée carrée", evokes: ["sport", "compétition", "boxe", "jeu"] },
  { family: "Archivo Black", weight: 400, looks: "grotesque très grasse", evokes: ["puissance", "sport", "street", "urbain"] },
  { family: "Black Ops One", weight: 400, upper: true, looks: "pochoir militaire", evokes: ["crossfit", "outdoor", "army", "intense"] },
  // Tech, games, the future.
  { family: "Orbitron", weight: 700, looks: "géométrique futuriste", evokes: ["tech", "futur", "espace", "électronique"] },
  { family: "Space Grotesk", weight: 600, looks: "grotesque techno", evokes: ["tech", "start-up", "numérique", "design"] },
  { family: "Russo One", weight: 400, looks: "carrée et grasse", evokes: ["tech", "auto", "moto", "gaming"] },
  { family: "VT323", weight: 400, looks: "écran de terminal", evokes: ["informatique", "code", "rétro gaming", "écran"] },
  { family: "Press Start 2P", weight: 400, upper: true, looks: "pixels de jeu vidéo", evokes: ["jeu vidéo", "arcade", "rétro gaming"] },
  // Vintage, typewriters, archives.
  { family: "Special Elite", weight: 400, looks: "machine à écrire usée", evokes: ["vintage", "archives", "polar", "brocante", "recette"] },
  { family: "Courier Prime", weight: 400, looks: "machine à écrire", evokes: ["recette", "journal", "script", "note"] },
  { family: "Righteous", weight: 400, looks: "rétro années 70", evokes: ["vintage", "disco", "roller", "années 70"] },
  { family: "Josefin Sans", weight: 600, upper: true, looks: "géométrique fine des années 20", evokes: ["vintage", "art déco", "années 20", "brocante"] },
  { family: "Poiret One", weight: 400, upper: true, looks: "art déco très fine", evokes: ["art déco", "cocktail", "chic", "années 30"] },
  { family: "Lobster", weight: 400, looks: "script gras rétro", evokes: ["rétro", "pizzeria", "enseigne", "diner"] },
  // Craft, hand-made, the market.
  { family: "Caveat", weight: 600, looks: "manuscrite simple", evokes: ["fait main", "note", "recette", "cahier", "école"] },
  { family: "Permanent Marker", weight: 400, upper: true, looks: "écrit au feutre", evokes: ["atelier", "ardoise", "street", "fait main"] },
  { family: "Amatic SC", weight: 700, upper: true, looks: "capitales dessinées à la main", evokes: ["marché", "épicerie", "bio", "potager", "fait main"] },
  { family: "Alfa Slab One", weight: 400, looks: "slab très grasse d'atelier", evokes: ["artisan", "bois", "menuiserie", "boucherie", "brasserie"] },
  // Western, beer, tattoos, the night.
  { family: "Rye", weight: 400, upper: true, looks: "western à éperons", evokes: ["barbier", "whisky", "saloon", "bière", "western"] },
  { family: "UnifrakturMaguntia", weight: 400, looks: "gothique", evokes: ["bière", "tatouage", "brasserie", "rock"] },
  { family: "Monoton", weight: 400, upper: true, looks: "néon à lignes", evokes: ["bar", "nuit", "néon", "disco", "cocktail"] },
  { family: "Limelight", weight: 400, looks: "art déco de cinéma", evokes: ["cinéma", "théâtre", "spectacle", "cabaret"] },
  { family: "Bungee", weight: 400, upper: true, looks: "enseigne urbaine", evokes: ["street", "urbain", "food truck", "skate"] },
];

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const WORD_FONT_BY_NAME = new Map(WORD_FONTS.map((f) => [fold(f.family), f]));

/** A font of the library by its family as a filler wrote it (case and spacing aside); none for a family not in it. */
export const wordFont = (name: string | undefined | null): WordFont | undefined => (name ? WORD_FONT_BY_NAME.get(fold(name)) : undefined);

/** The library as the filler reads it: each family, what it looks like and what it evokes. */
export const wordFontsBrief = (): string[] => WORD_FONTS.map((f) => `${f.family} : ${f.looks}${f.upper ? ", en capitales" : ""} ; évoque ${f.evokes.join(", ")}`);
