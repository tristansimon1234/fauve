// A business's site often uses fonts that are not on Google Fonts (Adobe Fonts, bought
// families). A Reel loads its fonts from Google Fonts, or from a file she adds (« Tes
// polices »): a well-known family gets its closest free twin here; any other one takes
// the ambiance's font for its role (lib/fonts.ts, usableFonts).

/** Well-known commercial families and their closest Google Fonts twin, by lowercase name. */
const TWINS: Record<string, string> = {
  "proxima nova": "Montserrat",
  gotham: "Montserrat",
  futura: "Jost",
  avenir: "Nunito Sans",
  "avenir next": "Nunito Sans",
  helvetica: "Inter",
  "helvetica neue": "Inter",
  arial: "Inter",
  "segoe ui": "Inter",
  "sf pro": "Inter",
  "neue haas grotesk": "Inter",
  "neue haas unica": "Inter",
  "neue montreal": "Inter",
  "pp neue montreal": "Inter",
  "suisse intl": "Inter",
  graphik: "Inter",
  "aktiv grotesk": "Inter",
  "founders grotesk": "Inter Tight",
  circular: "DM Sans",
  "gt walsheim": "DM Sans",
  mabry: "DM Sans",
  gilroy: "Plus Jakarta Sans",
  "sofia pro": "Nunito",
  "museo sans": "Nunito Sans",
  "brandon grotesque": "Josefin Sans",
  apercu: "Work Sans",
  "basis grotesque": "Work Sans",
  calibre: "Manrope",
  larsseit: "Manrope",
  din: "Barlow",
  "din next": "Barlow",
  "trade gothic": "Archivo Narrow",
  canela: "Fraunces",
  recoleta: "Fraunces",
  cooper: "Fraunces",
  migra: "Fraunces",
  freight: "Lora",
  "freight display": "Lora",
  "freight text": "Lora",
  "freight big": "Lora",
  fairplex: "Lora",
  "fairplex wide": "Lora",
  didot: "Bodoni Moda",
  bodoni: "Bodoni Moda",
  garamond: "EB Garamond",
  "adobe garamond": "EB Garamond",
  "garamond premier": "EB Garamond",
  baskerville: "Libre Baskerville",
  caslon: "Libre Caslon Text",
  "adobe caslon": "Libre Caslon Text",
  "big caslon": "Libre Caslon Display",
  times: "Source Serif 4",
  "times new roman": "Source Serif 4",
  tiempos: "Source Serif 4",
  georgia: "Gelasio",
  "gt super": "Playfair Display",
  ogg: "Playfair Display",
  "editorial new": "Playfair Display",
  "pp editorial new": "Playfair Display",
  lust: "Playfair Display",
};

/** « Proxima-Nova Soft W01 », « futura_pt_book » → the words that name the family. */
const familyKey = (family: string) =>
  family
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(std|pro|lt|web|w0\d|ef|regular|book|light|medium|bold|black|thin|soft|condensed|cond|var|variable)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The closest Google Fonts family to a well-known one that Google does not serve, or null. */
export function fontTwin(family: string): string | null {
  const key = familyKey(family);
  if (!key) return null;
  if (TWINS[key]) return TWINS[key];
  // A family named after one we know (« Futura PT », « Canela Deck »): the longest match wins.
  const match = Object.keys(TWINS)
    .filter((name) => key.startsWith(`${name} `))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TWINS[match]! : null;
}

/** A family as Google Fonts names it: each word capitalised (« playfair display » → « Playfair Display »). */
export const googleFamilyName = (family: string) =>
  family
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (/^[a-z]/.test(word) ? `${word[0]!.toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
