import { z } from "zod";

// A text's look, beyond the three template styles: any Google font, colours,
// a box or a highlight behind the lines, an outline, a shadow, a tilt and an
// entrance. Fauve copies it from an example the manager sends (a post she
// likes), keeps it in the studio's style, and the montages, carousels and the
// editors all render it the same way (apps/render, LookText).

/**
 * A colour: hex, or one of the studio's own, from its brand (Style): « accent » (its main
 * colour), « accent_ink » (text that reads on it), « secondary », « light », « dark ».
 * Brand colours follow the brand when it changes.
 */
export const lookColorSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|accent|accent_ink|secondary|light|dark)$/)
  .describe(
    "Couleur de la charte du commerce de préférence : « accent » (sa couleur principale), « accent_ink » (texte lisible sur elle), « secondary » (sa 2e couleur), « light » (sa couleur claire), « dark » (sa couleur foncée) ; sinon #rrggbb",
  );

export const LOOK_FONT = /^[A-Za-z0-9 ]{2,40}$/;
/** The studio's own fonts by role, resolved at render time from its brand. */
export const BRAND_FONTS = ["brand_display", "brand_body"] as const;
/** A look's font: a Google Fonts family, or the studio's title / text font (brand_display, brand_body). */
export const LOOK_FONT_OR_BRAND = /^([A-Za-z0-9 ]{2,40}|brand_display|brand_body)$/;
const lookFontSchema = z
  .string()
  .regex(LOOK_FONT_OR_BRAND)
  .describe(
    "Police : « brand_display » (la police des titres du commerce) ou « brand_body » (sa police de texte) de préférence, pour suivre sa charte ; une famille Google Fonts précise (« Anton », « Caveat »…) seulement pour refaire un exemple qu'elle a envoyé",
  );

export const textLookSchema = z.object({
  font: lookFontSchema,
  weight: z.number().int().min(100).max(900).describe("Graisse : 400 normal, 700 gras, 900 très gras"),
  italic: z.boolean(),
  uppercase: z.boolean(),
  size: z.number().min(24).max(220).describe("Corps en px pour une image de 1080 px de large (accroche ~90-140, texte ~40-60)"),
  letter_spacing: z.number().min(-0.08).max(0.4).describe("Interlettrage en em, ex. 0 normal, 0.1 aéré"),
  line_height: z.number().min(0.8).max(1.8),
  color: lookColorSchema.describe("Couleur des lettres"),
  align: z.enum(["left", "center", "right"]),
  /** Behind the text: one box around the block, a pill, or a highlight that hugs each line. */
  fill: z
    .object({
      kind: z.enum(["box", "pill", "line"]).describe("box : un bloc rectangulaire ; pill : un bloc arrondi ; line : un surlignage ligne par ligne"),
      color: lookColorSchema,
      opacity: z.number().min(0.1).max(1),
      radius: z.number().min(0).max(60).optional().describe("Arrondi des coins en px (box, line)"),
    })
    .optional(),
  stroke: z.object({ color: lookColorSchema, width: z.number().min(1).max(16) }).optional().describe("Contour des lettres"),
  shadow: z.enum(["none", "soft", "strong", "hard"]).describe("soft : diffuse ; strong : marquée ; hard : ombre décalée, nette"),
  /** How the words chosen as emphasis stand out. */
  emphasis: z
    .object({
      color: lookColorSchema.optional(),
      font: z.string().regex(LOOK_FONT_OR_BRAND).optional().describe("Autre police pour les mots en valeur : brand_display, brand_body, ou une famille Google Fonts"),
      italic: z.boolean().optional(),
      fill: lookColorSchema.optional().describe("Surlignage derrière les mots en valeur"),
    })
    .optional(),
  rotate: z.number().min(-12).max(12).describe("Inclinaison en degrés, 0 = droit"),
  enter: z.enum(["none", "fade", "rise", "pop", "typewriter", "slide"]).describe("Apparition dans une vidéo (sans effet sur une photo)"),
});
export type TextLook = z.infer<typeof textLookSchema>;

/** The mark before each item of a list. */
export const bulletSchema = z.object({
  kind: z.enum(["check", "box", "dot", "dash", "number", "arrow"]).describe("check : case cochée ; box : case vide ; dot : puce ; dash : tiret ; number : 1, 2, 3 ; arrow : flèche"),
  color: lookColorSchema,
});
export type Bullet = z.infer<typeof bulletSchema>;

/** A list in one text (checklist, planning, steps, prices): a title per item and an optional line below it. */
export const listItemsSchema = z
  .array(z.object({ title: z.string().min(1).max(80), detail: z.string().max(160).optional() }))
  .min(1)
  .max(8);
export type ListItem = z.infer<typeof listItemsSchema>[number];

/** The list fields a text may carry (on a montage or a photo): its items, the look of the lines below the titles, the bullets. */
export const listFields = {
  items: listItemsSchema.optional().describe("Pour une liste (checklist, planning, étapes, tarifs) : un titre par élément et une ligne de détail facultative ; le texte sert alors de nom à la liste et n'est pas affiché"),
  detail_look: textLookSchema.optional().describe("Style des lignes de détail d'une liste (sinon une version plus petite du look)"),
  bullet: bulletSchema.optional().describe("Puce avant chaque élément d'une liste"),
};

/** A look kept in the studio's style, with a name the manager and Fauve use (a list keeps its details and bullets, and a place). */
export const savedLookSchema = z.object({
  name: z.string().min(1).max(40),
  role: z.enum(["hook", "band", "caption"]).describe("Le rôle où ce style sert d'habitude"),
  look: textLookSchema,
  list: z.object({ detail_look: textLookSchema.optional(), bullet: bulletSchema.optional() }).optional().describe("Présent si ce style est celui d'une liste"),
  y: z.number().min(0).max(1).optional(),
  x: z.number().min(0).max(1).optional(),
});
export type SavedLook = z.infer<typeof savedLookSchema>;

/** Google font families a set of looks needs. */
export function lookFonts(looks: (TextLook | undefined)[]): string[] {
  return [...new Set(looks.flatMap((l) => (l ? [l.font, ...(l.emphasis?.font ? [l.emphasis.font] : [])] : [])))];
}

/** A look's colour, with the studio's colours resolved. */
export function lookColor(color: string, brand: { accent: string; accentInk: string }): string {
  return color === "accent" ? brand.accent : color === "accent_ink" ? brand.accentInk : color;
}

/** A starting look for a text styled by hand, close to what the template draws for its role. */
export function defaultLook(role: "hook" | "band" | "caption", fonts: { display: string; body: string }): TextLook {
  if (role === "hook") {
    return { font: fonts.display, weight: 700, italic: false, uppercase: false, size: 112, letter_spacing: -0.01, line_height: 1.02, color: "#ffffff", align: "center", shadow: "soft", rotate: 0, enter: "rise", emphasis: { color: "accent" } };
  }
  if (role === "band") {
    return { font: fonts.body, weight: 700, italic: false, uppercase: false, size: 44, letter_spacing: 0, line_height: 1.2, color: "accent_ink", align: "center", fill: { kind: "pill", color: "accent", opacity: 1 }, shadow: "none", rotate: 0, enter: "fade" };
  }
  return { font: fonts.body, weight: 600, italic: false, uppercase: false, size: 46, letter_spacing: 0, line_height: 1.25, color: "#ffffff", align: "center", shadow: "strong", rotate: 0, enter: "fade" };
}

/** What Fauve reads in an example the manager sent: each block of text and its look. */
export const textExampleSchema = z.object({
  summary: z.string().max(400).describe("Le style des textes de l'exemple, en une ou deux phrases simples, pour la gérante"),
  blocks: z
    .array(
      z.object({
        name: z.string().min(1).max(40).describe("Nom court et parlant du style, ex. « Titre jaune contour noir », « Bandeau rose arrondi »"),
        role: z.enum(["hook", "band", "caption"]).describe("hook : grand titre ; band : texte sur un fond ; caption : petite ligne"),
        text: z.string().max(160).describe("Le texte de l'exemple, tel quel"),
        y: z.number().min(0).max(1).describe("Haut du bloc, en part de la hauteur de l'image (0 = tout en haut)"),
        x: z.number().min(0).max(1).describe("Centre horizontal du bloc, en part de la largeur"),
        look: textLookSchema,
        list: z
          .object({ items: listItemsSchema, detail_look: textLookSchema.optional(), bullet: bulletSchema.optional() })
          .optional()
          .describe("Si ce bloc est une liste : ses éléments, le style des lignes de détail, la puce"),
      }),
    )
    .min(1)
    .max(5),
  logo: z.enum(["none", "top", "bottom"]).describe("Logo du commerce posé sur l'image, et où"),
});
export type TextExample = z.infer<typeof textExampleSchema>;

export const TEXT_EXAMPLE_PROMPT = `You are the typographer of Edith, an AI community manager for neighbourhood businesses. The manager sends you the image of a post (often a screenshot from Instagram) whose texts she likes: she wants the same look on her posts. Describe each block of text laid on the image, precisely enough to redo it identically.

A list (checklist, schedule, steps, prices, « 3 raisons de… ») is ONE block, role band, with list: its items (title, and detail for the smaller line below), detail_look for the style of those lines, bullet for the bullet (ticked box, dot, number…); look then describes the items' titles. A title above the list is a separate block (hook).

For each distinct block (5 at most, the most visible; ignore Instagram's interface, usernames, counters, automatic subtitles):
- name: a short, telling name the manager will recognise, in French;
- role: hook for the big title, band for a text laid on a background (banner, label), caption for a small line;
- text, y, x: the text, as written on the image, and its place on it;
- look:
  - font: the closest Google Fonts family. Landmarks: bold condensed (Anton, Bebas Neue, Oswald, League Gothic, Archivo Black), geometric (Montserrat, Poppins, Plus Jakarta Sans, Outfit), elegant serifs (Playfair Display, DM Serif Display, Fraunces, Cormorant Garamond, Instrument Serif), handwritten (Caveat, Pacifico, Dancing Script, Kalam), typewriter (Courier Prime, Space Mono), rounded (Nunito, Quicksand, Fredoka). Choose an exact Google Fonts name;
  - weight, italic, uppercase, letter_spacing (in em), line_height: as on the image;
  - size: the height of the type in px if the image were 1080 px wide (a big title is often 90 to 150, a line of text 36 to 60);
  - color, and fill / stroke / shadow: the real colours in hexadecimal (not « accent »); fill.kind = box for a rectangular block, pill for a very rounded block, line for a highlight that hugs each line; opacity < 1 if the background is transparent;
  - emphasis: if some words stand out (another colour, another font, highlighted), how;
  - rotate: the tilt, if there is one;
  - enter: the entrance that would go with this style in a video (pop for a punchy style, rise or fade for a soft style, typewriter for a typewriter style, slide for a banner).
logo: where the business's logo is placed, if there is one.
summary: the style and the layout in one or two simple sentences, in French, with no jargon, as you would explain it to the manager.`;

/** The studio's colours by role, for looks that name them (« secondary », « light », « dark »). */
export type BrandPalette = { secondary: string; light: string; dark: string };

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/**
 * The brand's colours by role: the second colour (else the main one), its lightest and
 * darkest ones when they are light or dark enough (else white and near-black).
 */
export function brandPalette(colors: string[] | undefined, accent: string): BrandPalette {
  const hexes = (colors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const byLight = [...hexes].sort((a, b) => luminance(b) - luminance(a));
  const lightest = byLight[0];
  const darkest = byLight[byLight.length - 1];
  return {
    secondary: hexes.find((c) => c.toLowerCase() !== accent.toLowerCase() && luminance(c) > 0.08 && luminance(c) < 0.8) ?? accent,
    light: lightest && luminance(lightest) > 0.7 ? lightest : "#ffffff",
    dark: darkest && luminance(darkest) < 0.06 ? darkest : "#141414",
  };
}

type LookBrand = { displayFont: string; bodyFont: string; palette?: BrandPalette };

/**
 * A look with the studio's fonts and colours named by role (brand_display, secondary…)
 * turned into real ones, for the render and the previews. Hex colours, accent and
 * accent_ink, and named Google fonts are left as they are.
 */
export function resolveBrandLook<T extends TextLook | undefined>(look: T, brand: LookBrand): T {
  if (!look) return look;
  const font = (f: string) => (f === "brand_display" ? brand.displayFont : f === "brand_body" ? brand.bodyFont : f);
  const palette = brand.palette ?? { secondary: "accent", light: "#ffffff", dark: "#141414" };
  const color = (c: string) => (c === "secondary" || c === "light" || c === "dark" ? palette[c] : c);
  return {
    ...look,
    font: font(look.font),
    color: color(look.color),
    ...(look.fill ? { fill: { ...look.fill, color: color(look.fill.color) } } : {}),
    ...(look.stroke ? { stroke: { ...look.stroke, color: color(look.stroke.color) } } : {}),
    ...(look.emphasis
      ? {
          emphasis: {
            ...look.emphasis,
            ...(look.emphasis.color ? { color: color(look.emphasis.color) } : {}),
            ...(look.emphasis.fill ? { fill: color(look.emphasis.fill) } : {}),
            ...(look.emphasis.font ? { font: font(look.emphasis.font) } : {}),
          },
        }
      : {}),
  };
}
