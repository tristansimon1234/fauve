import { z } from "zod";
import type { BrandSignature } from "./signature.ts";

// What the onboarding measures on a business's home page (apps/render/page.mjs, in the
// render sandbox's browser) and what it keeps: the fonts its titles and its texts really
// use, never the site builder's own (« squarespace-ui-font ») nor an icon font, and the
// colours that fill the page. The reading of the site gets these as facts: it no longer
// guesses a font or a colour from a picture.

const pageFontSchema = z.object({
  family: z.string().max(120),
  share: z.number(),
  uppercase: z.number(),
  bold: z.number(),
  size: z.number().nullable(),
  letter_spacing: z.number(),
  centered: z.number(),
  sample: z.string().max(200).optional(),
});
const shareSchema = z.object({ color: z.string().max(12), share: z.number() });

/** page.json, as written by apps/render/page.mjs. */
export const pageMeasureSchema = z.object({
  url: z.string().max(2000).optional(),
  title: z.string().max(300).optional(),
  display: z.array(pageFontSchema).max(6),
  middle: z.array(pageFontSchema).max(6),
  body: z.array(pageFontSchema).max(6),
  loaded_fonts: z.array(z.string().max(120)).max(20),
  areas: z.array(shareSchema).max(12),
  texts: z.array(shareSchema).max(12),
  buttons: z.array(shareSchema).max(12),
});
export type PageMeasure = z.infer<typeof pageMeasureSchema>;
export type PageFont = z.infer<typeof pageFontSchema>;

/** Site builders' interface fonts, system fonts and icon fonts: never a business's own. */
const NOT_A_BRAND_FONT =
  /^(squarespace-ui-font|clarkson|-apple-system|blinkmacsystemfont|system-ui|ui-sans-serif|ui-serif|sans-serif|serif|monospace|cursive|segoe ui|roboto|arial|helvetica|helvetica neue|times|times new roman|courier new|noto sans|apple color emoji|segoe ui emoji|noto color emoji)$|^(wf_|wfont_)|icon|awesome|glyph|symbol|dashicons|eicons|slick|swiper|themify|elementskit|ionicons|icomoon|fontello/i;

const WEIGHT_WORDS = "thin|hairline|extralight|ultralight|light|book|regular|normal|roman|medium|semibold|demibold|bold|extrabold|ultrabold|heavy|black";

export function isBrandFont(family: string): boolean {
  const f = family.trim().replace(/^["']|["']$/g, "");
  return f.length >= 2 && !NOT_A_BRAND_FONT.test(f);
}

/**
 * A font's family as the business would name it: « acumin-pro » → « Acumin Pro »,
 * « Domainesemibolditalic » → « Domaine », « American Grotesk Bold » → « American Grotesk ».
 */
export function brandFontName(raw: string): string {
  const words = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[-_]+/g, " ")
    // A weight or a style glued to the name (« Domainesemibolditalic »).
    .replace(new RegExp(`([a-z])(${WEIGHT_WORDS})(italic|oblique)?$`, "i"), "$1 $2 $3")
    .replace(/([a-z])(italic|oblique)$/i, "$1 $2")
    .replace(new RegExp(`\\b(${WEIGHT_WORDS}|italic|oblique|w0\\d|webfont|web)\\b`, "gi"), " ")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const name = words.map((w) => (w === w.toLowerCase() ? w[0]!.toUpperCase() + w.slice(1) : w)).join(" ");
  return name || raw.trim();
}

/** The weight and style a family's own name says (« Sebenta Heavy », « Domainesemibolditalic »). */
export function fontNameStyle(raw: string): { weight: number | null; italic: boolean } {
  const f = raw.toLowerCase();
  const weight = /black|heavy|ultrabold|extrabold/.test(f) ? 900 : /semibold|demibold|bold/.test(f) ? 700 : /thin|hairline|light/.test(f) ? 300 : null;
  return { weight, italic: /italic|oblique/.test(f) };
}

export type MeasuredFont = {
  /** As the site's CSS names it (what its pages load). */
  raw: string;
  /** As the business would name it. */
  name: string;
  uppercase: number;
  bold: boolean;
  italic: boolean;
  centered: number;
  letterSpacing: number;
  size: number | null;
  sample?: string;
};

const measured = (f: PageFont): MeasuredFont => {
  const style = fontNameStyle(f.family);
  return {
    raw: f.family,
    name: brandFontName(f.family),
    uppercase: f.uppercase,
    bold: f.bold >= 0.5 || (style.weight ?? 0) >= 700,
    italic: style.italic,
    centered: f.centered,
    letterSpacing: f.letter_spacing,
    size: f.size,
    ...(f.sample ? { sample: f.sample } : {}),
  };
};

/** The font of its titles and the font of its texts, as measured (the most used first). */
export function pageFonts(page: PageMeasure): { display: MeasuredFont | null; body: MeasuredFont | null } {
  const pick = (fonts: PageFont[]) => fonts.filter((f) => isBrandFont(f.family)).sort((a, b) => b.share - a.share)[0];
  const display = pick(page.display) ?? pick(page.middle);
  const body = pick(page.body) ?? pick(page.middle) ?? display;
  return { display: display ? measured(display) : null, body: body ? measured(body) : null };
}

const percent = (share: number) => `${Math.round(share * 100)} %`;

/** The measures in a few lines of French, for the reading of the site. */
export function pageFacts(page: PageMeasure, pixels: { color: string; share: number }[]): string {
  const { display, body } = pageFonts(page);
  const font = (f: MeasuredFont) =>
    `« ${f.raw} » (${f.uppercase >= 0.7 ? "en capitales" : f.uppercase <= 0.2 ? "en casse normale" : "parfois en capitales"}${f.bold ? ", grasse" : ""}${f.italic ? ", italique" : ""}, ${f.centered >= 0.6 ? "centrée" : f.centered <= 0.3 ? "alignée à gauche" : "centrée ou à gauche"}${f.size ? `, ${f.size} px` : ""}${f.letterSpacing >= 0.04 ? ", lettres espacées" : f.letterSpacing <= -0.02 ? ", lettres serrées" : ""}${f.sample ? `, ex. « ${f.sample.slice(0, 50)} »` : ""})`;
  const colors = (list: { color: string; share: number }[]) =>
    list
      .filter((c) => c.color !== "photo" && c.share >= 0.01)
      .slice(0, 6)
      .map((c) => `${c.color} ${percent(c.share)}`)
      .join(", ");
  const photos = page.areas.find((a) => a.color === "photo")?.share ?? 0;
  return [
    display ? `- polices affichées : titres en ${font(display)}${body && body.raw !== display.raw ? `, texte en ${font(body)}` : ""}` : "- polices : aucune police de marque mesurée",
    pixels.length ? `- couleurs vues à l'écran (aplats, part de la page) : ${colors(pixels)}` : "",
    page.areas.length ? `- fonds des blocs de la page : ${colors(page.areas)}${photos ? ` ; photos et vidéos : ${percent(photos)} de la page` : ""}` : "",
    page.texts.length ? `- couleurs des textes : ${colors(page.texts)}` : "",
    page.buttons.length ? `- boutons : ${colors(page.buttons)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * What the measures settle without a doubt: titles all in capitals (or never), all centred
 * (or flush left). The reading decides the rest; these win over what it thought it saw.
 */
export function measuredTitles(page: PageMeasure, titles: BrandSignature["titles"]): BrandSignature["titles"] {
  const { display } = pageFonts(page);
  if (!display) return titles;
  return {
    ...titles,
    ...(display.uppercase >= 0.8 ? { case: "upper" as const } : display.uppercase <= 0.15 ? { case: "normal" as const } : {}),
    ...(display.centered >= 0.8 ? { align: "center" as const } : display.centered <= 0.2 ? { align: "left" as const } : {}),
  };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const distance = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/**
 * The palette the reading chose, each colour set to the exact value measured on the page
 * when one is close (a hex read off a picture is only approximate). A colour seen elsewhere
 * (its logo, its merch, its shopfront) stays as the reading gave it.
 */
export function snapPalette(palette: string[], seen: string[]): string[] {
  const valid = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
  const on = seen.filter(valid).map((c) => c.toLowerCase());
  const snapped = palette.filter(valid).map((c) => {
    const near = on.map((s) => ({ s, d: distance(c, s) })).sort((a, b) => a.d - b.d)[0];
    return near && near.d <= 40 ? near.s : c.toLowerCase();
  });
  return [...new Set(snapped)];
}
