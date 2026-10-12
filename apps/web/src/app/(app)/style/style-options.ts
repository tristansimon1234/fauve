// Constants and types of the Style page, shared by the server loader, the server
// actions and the client form (keep it free of server-only imports).

export const TEMPLATES = ["doux", "dynamique", "chic"] as const;
export type Template = (typeof TEMPLATES)[number];
export const TEMPLATE_LABELS: Record<Template, string> = { doux: "Doux", dynamique: "Dynamique", chic: "Chic" };

export const CAPTION_LENGTHS = ["short", "medium", "long"] as const;
export const EMOJI_LEVELS = ["none", "few", "many"] as const;

export const ART_DIRECTION_MAX = 1500;
export const TONE_MAX = 300;
export const RULE_MAX = 200;
export const RULES_MAX = 20;
export const HASHTAGS_MAX = 30;
export const MAX_COLORS = 6;

/** Same rule as the edit plan's fonts (packages/agent): a Google Fonts family name. */
export const FONT_NAME = /^[A-Za-z0-9 ]{2,40}$/;
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
export const HASHTAG = /^[\p{L}\p{N}_]{1,60}$/u;

/** Accepted logo formats and the file extension they are stored with. */
export const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** The Reel's accent when the studio has no colour (packages/agent/src/motion.ts). */
export const DEFAULT_ACCENT = "#5b3fd9";

/** Fonts each template falls back to (mirror of TEMPLATE_FONTS in packages/agent/src/motion.ts). */
export const TEMPLATE_FONTS: Record<Template, { display: string; body: string }> = {
  doux: { display: "Instrument Serif", body: "Plus Jakarta Sans" },
  dynamique: { display: "Poppins", body: "Poppins" },
  chic: { display: "Cormorant Garamond", body: "Plus Jakarta Sans" },
};

/** What the form edits; saved into brand_profiles.profile by the server action. */
export type StyleForm = {
  art_direction: string;
  colors: string[];
  /** null: the template's font. */
  display_font: string | null;
  body_font: string | null;
  /** null: Fauve picks the template for each montage. */
  default_template: Template | null;
  tone: string;
  caption_length: (typeof CAPTION_LENGTHS)[number];
  emojis: (typeof EMOJI_LEVELS)[number];
  hashtags: string[];
  dos: string[];
  donts: string[];
};

export type Logo = { url: string; source: "upload" | "website" } | null;

// ---------------------------------------------------------------------------
// Fonts: a curated Google Fonts list for wellness and fitness brands.
// ---------------------------------------------------------------------------

export type FontCategory = "serif" | "sans" | "display";

export type CuratedFont = {
  family: string;
  category: FontCategory;
  /** Static weights requested from Google Fonts (all available for this family). */
  weights: number[];
  /** Whether a 400 italic exists (requested for the italic hooks). */
  italic: boolean;
};

const range = [300, 400, 500, 600, 700, 800];
const regular = [400];

export const CURATED_FONTS: CuratedFont[] = [
  { family: "Instrument Serif", category: "serif", weights: regular, italic: true },
  { family: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600, 700], italic: true },
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800], italic: true },
  { family: "Fraunces", category: "serif", weights: range, italic: true },
  { family: "DM Serif Display", category: "serif", weights: regular, italic: true },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700], italic: true },
  { family: "EB Garamond", category: "serif", weights: [400, 500, 600, 700, 800], italic: true },
  { family: "Bodoni Moda", category: "serif", weights: [400, 500, 600, 700, 800], italic: true },
  { family: "Gloock", category: "serif", weights: regular, italic: false },
  { family: "Young Serif", category: "serif", weights: regular, italic: false },
  { family: "Plus Jakarta Sans", category: "sans", weights: range, italic: true },
  { family: "Inter", category: "sans", weights: range, italic: false },
  { family: "Poppins", category: "sans", weights: range, italic: true },
  { family: "Montserrat", category: "sans", weights: range, italic: true },
  { family: "Manrope", category: "sans", weights: range, italic: false },
  { family: "Outfit", category: "sans", weights: range, italic: false },
  { family: "DM Sans", category: "sans", weights: range, italic: false },
  { family: "Work Sans", category: "sans", weights: range, italic: false },
  { family: "Nunito", category: "sans", weights: range, italic: false },
  { family: "Raleway", category: "sans", weights: range, italic: false },
  { family: "Figtree", category: "sans", weights: range, italic: false },
  { family: "Jost", category: "sans", weights: range, italic: false },
  { family: "Syne", category: "display", weights: [400, 500, 600, 700, 800], italic: false },
  { family: "Space Grotesk", category: "display", weights: [300, 400, 500, 600, 700], italic: false },
  { family: "Bricolage Grotesque", category: "display", weights: range, italic: false },
  { family: "Archivo", category: "display", weights: range, italic: false },
  { family: "Unbounded", category: "display", weights: range, italic: false },
  { family: "Bebas Neue", category: "display", weights: regular, italic: false },
  { family: "Anton", category: "display", weights: regular, italic: false },
  { family: "Italiana", category: "display", weights: regular, italic: false },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: "Avec empattements",
  sans: "Sans empattements",
  display: "Caractère",
};

const curatedByFamily = new Map(CURATED_FONTS.map((f) => [f.family.toLowerCase(), f]));

export function curatedFont(family: string): CuratedFont | undefined {
  return curatedByFamily.get(family.toLowerCase());
}

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2";
const familyParam = (family: string) => encodeURIComponent(family).replace(/%20/g, "+");

/**
 * Stylesheet for a family with the weights the preview uses. A family typed by
 * the manager is requested without axes: asking for a weight or an italic the
 * family lacks would fail the whole request.
 */
export function fontStylesheet(family: string): string {
  const font = curatedFont(family);
  let axes = "";
  if (font) {
    const multi = font.weights.length > 1;
    if (font.italic) {
      axes = multi ? `:ital,wght@${[...font.weights.map((w) => `0,${w}`), "1,400"].join(";")}` : ":ital@0;1";
    } else if (multi) {
      axes = `:wght@${font.weights.join(";")}`;
    }
  }
  return `${GOOGLE_FONTS_CSS}?family=${familyParam(font?.family ?? family)}${axes}&display=swap`;
}

/** Tiny stylesheet with only the glyphs of the family's own name, for the pickers. */
export function fontSampleStylesheet(family: string): string {
  return `${GOOGLE_FONTS_CSS}?family=${familyParam(family)}&text=${encodeURIComponent(family)}&display=swap`;
}

/** CSS font-family value with a fallback of the right kind. */
export function fontStack(family: string, fallback: "serif" | "sans-serif" = "sans-serif"): string {
  return `"${family}", ${fallback}`;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** White or ink text on the accent colour, whichever reads better (same rule as the Reel). */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#1C1530" : "#FFFFFF";
}

/** Colours offered when the manager adds one. */
export const COLOR_SUGGESTIONS = ["#f2694e", "#1c1530", "#fbf7f4", "#c9a227", "#7a8b6f", "#e8c4b8", "#5b3fd9"];

// ---------------------------------------------------------------------------
// Moodboard
// ---------------------------------------------------------------------------

/** Images are resized in the browser before upload: enough for Fauve to read them, light to store. */
export const MOODBOARD_IMAGE_EDGE = 1600;
export const MOODBOARD_NOTE_MAX = 200;
export const MOODBOARD_SOURCE_MAX_BYTES = 25 * 1024 * 1024;

export type MoodboardItem = { path: string; url: string; note: string };
export type MoodboardView = { items: MoodboardItem[]; reading: string | null; palette: string[] };
