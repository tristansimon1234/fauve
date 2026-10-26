import { z } from "zod";
import { FORBIDDEN_CODE, MOTION_SCOPE } from "./motion-scene.ts";
import { SLOT_NAME } from "./schemas.ts";
import { LOOK_FONT } from "./text-look.ts";

// A whole carousel designed by the carousel designer (Opus), like a graphic designer
// lays out a series: one React component draws every slide from her photos (framed on
// their subject, her subjects cut out), her charter and her words, with text slides
// and photos or lines that run from one slide to the next. It is checked statically,
// rendered in the sandbox in check mode (texts cut or too small, missing fonts or
// photos), looked at by a critic, corrected once, and its rendered slides are what is
// published. Its words live in slots the manager edits.

export const MAX_CAROUSEL_SLIDES = 10;

/** What the designer's code may use (apps/render/src/Carousel.tsx): a scene's scope without Footage, with her photos in boxes. */
export const CAROUSEL_SCOPE = [...MOTION_SCOPE.filter((name) => name !== "Footage"), "Photo", "Subject", "Strip"];

/** A text of the carousel: its slot, the slide it is on (from 1; 0: on every slide), what it holds. */
export const carouselSlotSchema = z.object({
  name: z.string().regex(SLOT_NAME),
  slide: z.number().int().min(0).max(MAX_CAROUSEL_SLIDES),
  role: z.string().max(120),
  max_chars: z.number().int().min(1).max(400),
  multiline: z.boolean(),
});
export type CarouselSlot = z.infer<typeof carouselSlotSchema>;

/** The longest words a slot takes when she changes them: twice its room (its texts shrink to fit), 400 at most. */
export const slotTextLimit = (slot: Pick<CarouselSlot, "max_chars">) => Math.min(400, 2 * Math.max(slot.max_chars, 40));

/** A designed carousel as stored on the post (posts.slides.design): its code comes from Simone, never from the browser. */
export const carouselDesignSchema = z.object({
  name: z.string().max(80),
  js: z.string().min(1).max(80000),
  slots: z.array(carouselSlotSchema).max(80),
  texts: z.record(z.string().regex(SLOT_NAME), z.string().max(400)),
  /** Google Fonts families its code uses besides her two. */
  fonts: z.array(z.string().regex(LOOK_FONT)).max(3),
  /** Her photos its code reads, in its order (photos[0], photos[1]…). */
  photos: z.array(z.uuid()).max(MAX_CAROUSEL_SLIDES),
  count: z.number().int().min(1).max(MAX_CAROUSEL_SLIDES),
  /** What each slide says, a line each (for Simone and the editor). */
  outline: z.array(z.string().max(160)).max(MAX_CAROUSEL_SLIDES).default([]),
  /** Its source as the designer wrote it (`js` is compiled from it): a later correction starts from it. */
  code: z.string().max(60000).optional(),
});
export type CarouselDesign = z.infer<typeof carouselDesignSchema>;

/** What the carousel designer answers (no lengths nor patterns: the answer is read as written, then bounded). */
export const carouselOutputSchema = z.object({
  name: z.string().describe("Nom court et parlant, ex. « Trois gestes, couverture magazine »"),
  count: z.number().int().describe("Nombre de diapositives"),
  outline: z.array(z.string()).describe("Ce que dit chaque diapositive, une ligne chacune, dans l'ordre"),
  code: z.string(),
  slots: z.array(
    z.object({
      name: z.string().describe("s1_titre, s2_texte… (minuscules, chiffres, _)"),
      slide: z.number().int().describe("Sa diapositive, à partir de 1 ; 0 pour un texte présent sur toutes"),
      role: z.string().describe("Ce que contient ce texte, ex. « titre de la couverture »"),
      max_chars: z.number().int(),
      multiline: z.boolean(),
    }),
  ),
  texts: z.array(z.object({ slot: z.string(), text: z.string() })).describe("Les vrais mots de chaque slot"),
  fonts: z.array(z.string()).describe("Familles Google Fonts que ton code utilise en plus des siennes, 3 au plus"),
  photos: z.array(z.string()).describe("Les id des photos que ton code lit, dans l'ordre : photos[0], photos[1]…"),
});
export type CarouselOutput = z.infer<typeof carouselOutputSchema>;

/** Problems that forbid running a carousel's code (empty when it is acceptable). */
export function checkCarouselCode(code: string): string[] {
  const problems: string[] = [];
  if (code.length > 60000) problems.push("code trop long");
  if (!/\bfunction\s+Carousel\s*\(/.test(code)) problems.push("il faut une fonction Carousel");
  if (/<\s*Footage\b/.test(code)) problems.push("Footage n'existe pas dans un carrousel (utilise Photo)");
  for (const [pattern, label] of FORBIDDEN_CODE) if (pattern.test(code)) problems.push(label);
  return problems;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

/**
 * The designer's words as they will read: a character written as a code (a JSON string escaped
 * twice gave « chaude : » on a slide) becomes that character. The engine sets the French
 * spaces itself (frenchTypography).
 */
export function cleanSlotText(text: string): string {
  const char = (code: number) => (code >= 32 ? String.fromCharCode(code) : " ");
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => char(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&rsquo;/gi, "’")
    .replace(/&#(\d{2,5});/g, (_, n: string) => char(Number(n)))
    .replace(/&#x([0-9a-fA-F]{2,4});/gi, (_, hex: string) => char(parseInt(hex, 16)))
    .replace(/&amp;/gi, "&");
}

/**
 * The designer's answer as a carousel (its code already transpiled), bounded: its slots,
 * their words, its fonts, the photos its code reads (only those she was offered). The
 * problems go back to the designer.
 */
export function carouselFromOutput(output: CarouselOutput, js: string, offered: string[]): { design: CarouselDesign; problems: string[] } {
  const problems: string[] = [];
  const count = Math.min(MAX_CAROUSEL_SLIDES, Math.max(1, Math.round(output.count)));
  const slots = new Map<string, CarouselSlot>();
  for (const s of output.slots) {
    if (!SLOT_NAME.test(s.name) || slots.has(s.name)) continue;
    slots.set(s.name, {
      name: s.name,
      slide: Math.min(count, Math.max(0, Math.round(s.slide))),
      role: clip(s.role, 120),
      max_chars: Math.min(400, Math.max(1, Math.round(s.max_chars))),
      multiline: Boolean(s.multiline),
    });
  }
  const texts: Record<string, string> = {};
  for (const t of output.texts) {
    if (!SLOT_NAME.test(t.slot)) continue;
    texts[t.slot] = clip(cleanSlotText(t.text), 400);
    // A text without its slot is still hers to edit: its slide from its name (s3_… is on slide 3).
    if (!slots.has(t.slot)) {
      const slide = Number(/^s(\d{1,2})_/.exec(t.slot)?.[1] ?? 0);
      slots.set(t.slot, { name: t.slot, slide: slide <= count ? slide : 0, role: t.slot, max_chars: Math.min(400, Math.max(40, Math.ceil(t.text.length * 1.5))), multiline: t.text.includes("\n") });
    }
  }
  const known = new Set(offered);
  const photos = output.photos.filter((id) => known.has(id));
  const unknown = output.photos.filter((id) => !known.has(id));
  if (unknown.length) problems.push(`photos inconnues dans "photos" : ${unknown.slice(0, 3).join(", ")} (seulement les id donnés dans « photos »)`);
  if (photos.length > MAX_CAROUSEL_SLIDES) problems.push(`${MAX_CAROUSEL_SLIDES} photos au plus`);
  const fonts = [...new Set(output.fonts.map((f) => f.trim()).filter((f) => LOOK_FONT.test(f)))].slice(0, 3);
  // The words must be the business's, not the slots' descriptions.
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const labels = [...slots.values()].filter((s) => texts[s.name] && (norm(texts[s.name]!) === norm(s.role) || norm(texts[s.name]!) === norm(s.name)));
  if (labels.length) problems.push(`textes à remplacer par de vrais mots (ce sont les descriptions des slots) : ${labels.map((s) => `${s.name} = « ${texts[s.name]} »`).join(", ")}`);
  const design = carouselDesignSchema.parse({
    name: clip(output.name.trim() || "Carrousel", 80),
    js,
    slots: [...slots.values()].slice(0, 80),
    texts,
    fonts,
    photos: [...new Set(photos)].slice(0, MAX_CAROUSEL_SLIDES),
    count,
    outline: output.outline.slice(0, MAX_CAROUSEL_SLIDES).map((line) => clip(line, 160)),
  });
  return { design, problems };
}

/** The slot texts of a slide, in the order they were declared (a slot on every slide counts on each). */
export const slideSlots = (design: Pick<CarouselDesign, "slots">, slide: number) => design.slots.filter((s) => s.slide === slide || s.slide === 0);

export const CAROUSEL_DESIGNER_PROMPT = `You are a senior art director and graphic designer, and you code. You compose a whole Instagram carousel for a neighbourhood business (« she » is its manager): up to 10 slides of 1080 × 1350, with her real photos, her charter and her words. It must look handmade by the best graphic designer in the neighbourhood, who knows this business: modern, polished, human, « waouh » from the cover. Never a ready-made template, an ad or a flyer.

What makes a carousel that works:
- The cover stops the thumb: a precise promise in 5 to 8 words (a benefit, a curiosity, a number, a question people really ask themselves), readable small. The profile grid shows it cropped to 3:4: nothing important within 76 px of the sides.
- The 2nd slide stands on its own: Instagram shows it again to those who did not swipe. It hooks too and gives a reason to go on.
- One idea per slide, few words: one strong sentence and, if needed, a short detail. Each slide reads in 3 seconds.
- A progression: the promise, then what backs it up (steps, behind the scenes, before/after, tips, the person behind it, the details), a reward, and at the end a concrete call (book, drop by, save the carousel, send it to someone), with her booking link if it is known, otherwise « lien en bio ».
- A series: the same fonts, colours, margins and the same grid from one end to the other, so that the business is recognised; but the layout changes from one slide to the next (the same box on every photo looks like a free template).
- Continuity when it serves: a photo, a line, a shape that passes from one slide to the next (Strip) makes people want to swipe.
- Often 6 to 8 slides; her request and her photos decide (3 at least, 10 at most).
- These guidelines are defaults, never obligations against her: her request and the example she likes (« Exemple qu'elle aime ») come first. What the example does not have, or what her request sets aside (a call slide at the end, a logo, a promise as the cover's title, text on every photo), her carousel does not have; what they have or ask for, it takes (their number of slides, a cover with no text, long texts, a photo grid); always with her own photos and words. What her request does not say, these guidelines decide.

The forms are leads, never a template: editorial (one big photo, little text, a lot of air); strong typography on a flat of her colour (a text slide, with no photo); handmade collage (photos that overlap, tape, notes and arrows drawn by hand in SVG, paper, grain, subjects cut out as stickers); magazine cover (the title behind the person); a subject that comes out of its frame; before/after; numbered steps; a client's words; menu or prices; photo grid. Choose what serves her message and her art direction, and make them live together in the series. When her request describes a form, a universe or a carousel she likes, that is what decides.

Her photos are the heart:
- Show them big, framed on their subject; a photo can come back, cropped differently. Never a tiny or stretched photo.
- Text on a photo only where it reads (a calm area, a gradient, a flat, a band), never on a face nor on what must be seen (the dish, the haircut, the product). Each photo is described in « photos »: what it shows, its format, where its subject is.
- A « detouree » photo gives its subject: <Subject> over its photo makes a title pass behind the person, or makes their head come out of the frame; <Cutout> lays it like a sticker with a white edge. Only those photos; a subject cut by the edge of its photo (« sujet_coupe_par ») keeps that edge clean: make it come out of the edge of the slide or hide the cut, never a visible cut in the middle.
- With no photo, or for a text slide, compose with her charter: flat colour, paper, shapes, her logo.
- Her logo, small, on the cover or the last slide (unless the example she likes has none), never as a watermark on each one.
- What feels human: a hand gesture (a word or an arrow drawn, a piece of tape laid askew, a photo slightly tilted), real light, air. What feels generic: rainbow gradients, heavy shadows, clipart pictograms, emojis, decorative frames everywhere.

Typography:
- Her fonts (brand.displayFont for titles, brand.bodyFont for text) and her colours (brand.accent, brand.palette: secondary, light, dark). Her charter is a starting point, not a cage: if her request or her art direction call for it, bring a font (« fonts »). Two fonts per slide at most.
- A real hierarchy: a very big title (often 120 to 240 px), a text of 34 to 44 px, nothing under 26 px.
- Balanced lines (textWrap: "balance"), never a word alone on its line, tight line spacing on big titles.
- Strong contrast: ink on light, off-white on dark or on a darkened photo. Never a saturated yellow or a pastel on a big title.
- French typography is set by the engine: in the code, texts arrives with its narrow non-breaking spaces (before : ; ! ? and inside « ») and its apostrophes ’; never break a text on those spaces. In « texts », write ordinary spaces and apostrophes, never an escape code.

The words:
- Hers: true, concrete, taken from her request and the business's facts. Never invent a price, an opening time, an offer, a number or a client review you were not given.
- The way she speaks (« ton »): « tu » or « vous » as she does. Short sentences, with a verb.
- Never an ad formula nor an AI tic: no em dash, no « Découvrez », « N'attendez plus », « Sublimez », « Offrez-vous », no emoji in the image's texts.
- In French, like everything she may read: texts, name, outline and the slots' roles.

Code contract (strict):
- A single function: function Carousel({ slide, count, width, height, brand, texts, photos }) { … } that returns slide number slide (0 for the cover, up to count − 1): a single component for the whole series (if (slide === 0) …). width = 1080, height = 1350. A white background under what you draw.
- Available identifiers: ${CAROUSEL_SCOPE.join(", ")}. Inline styles and inline SVG. TypeScript or JavaScript, JSX allowed.
- <Photo photo={photos[i]} style={{ left, top, width, height, … }} /> lays her photo i, retouched, covering the box and framed on its subject (left, top, width, height in px; the rest of the style is free: borderRadius, border, boxShadow, transform). focus={{ x, y }} (shares of the photo) keeps another point at the centre; zoom={1.3} tightens.
- <Subject photo={photos[i]} style={same box} />: its subject cut out exactly over its Photo (same style, focus and zoom); what you draw between the two passes behind the person, and the subject is not cut by the box (a head that sticks out of the frame). rim and shadow for a white edge and a shadow (none by default).
- <Cutout photo={photos[i]} x={…} y={…} height={…} rim={10} shadow />: the subject alone as a sticker, the subject's box top left at (x, y), height px tall; style to tilt it.
- <Strip>…</Strip>: all the slides side by side (count × 1080 px wide); what you lay in it, in the strip's coordinates (x from 0 to count × 1080), runs from one slide to the next. Render the same Strip on every slide it crosses.
- photos[i] = { aspect (width / height), cutout (when it is cut out), subject (the subject's box, in shares), cutEdges }. In "photos", answer with the ids of the photos your code reads, in order (photos[0], photos[1]…). Check that a photo exists before laying it.
- FitText for each text that can get longer: <FitText style={{ position: "absolute", left, top, width, height }} innerStyle={{ … }}>…</FitText> shrinks its content until it fits (it never enlarges it: give the size wanted for the shortest text, and a box the size the text must take up); innerStyle lays out the content (a centred flex column by default; alignItems: "flex-start", textAlign: "left" to align left).
- No hard-coded text: each text comes from a slot, texts.nom ?? "…". Name the slots by slide (s1_titre, s2_texte…), declare each one in "slots" with its slide (from 1; 0 for a text present on all of them, a footer) and its maximum length; a multiline slot can hold lines separated by "\\n" (a list, steps).
- brand = { name, accent, accentInk (text readable on accent), palette: { secondary, light, dark }, ink: "#1C1530", cream: "#FBF7F4", displayFont, bodyFont, logoUrl, logoOnDark }. The logo: <Img src={brand.logoUrl} /> when it exists (logoOnDark "white": style filter: "brightness(0) invert(1)" on a dark background; "plate": on a light flat).
- Forbidden: fetch and any network access, Math.random, Date, setTimeout, eval, window, document, <script> tags, external images (only brand.logoUrl and her photos display). It is a still image: no animation.

What is checked on each slide (a test render refuses otherwise): each text stays whole in the frame, 40 px from the edges (76 px from the sides on the cover), and never passes from one slide to another; 26 px at least; its fonts exist on Google Fonts; a photo laid exists, and a photo laid as Subject or Cutout is cut out. Then an art director looks at the render.

Answer with: name (short and telling), count, outline (what each slide says, one line each), code, slots, texts (the real words of each slot, never their description), fonts, photos.`;

export const CAROUSEL_CRITIC_PROMPT = `You are an art director. You are shown all the slides of an Instagram carousel made for a neighbourhood business, in order, with what she (its manager) asked for and her charter. Say whether a demanding graphic designer would publish it as it is.
Look at:
- the cover: it stops the thumb, reads small, and holds when cropped to 3:4;
- the story: the 2nd slide stands on its own, one idea per slide, a progression, a concrete call at the end (unless her request or the example she likes end otherwise);
- readability on a phone: the contrast (a text on a busy area or of the same value as it is a no), the sizes, nothing cut, nothing overlapping unintentionally, no face nor the subject covered by a text;
- the typography: the hierarchy, the alignments, regular margins, no word alone on its line, no « ? » alone, no fallback font, no code shown instead of a character (« \\u00a0 », « &nbsp; »);
- the photos: big enough, well framed, never distorted; a clean cut-out;
- the series: the business is recognised from one end to the other and the layouts vary; neither a ready-made template, nor an ad, nor a flyer; her charter followed (a liberty her request wants is not a defect);
- her request and the example she likes, when there is one, come before these guidelines: what the example does not have, or what her request sets aside (a call at the end, a logo, a title on the cover), her carousel does not have to have; judge whether it takes up its form well, with her own photos and words;
- the words: true, short, hers, with no ad formula nor em dash.
ok = true if it can be published as it is. Otherwise, the precise corrections, slide by slide (« diapositive 3 : le titre blanc se perd sur le mur clair : pose-le sur un aplat ou assombris le haut de la photo »), 6 at most, the most important first, in French. Say what must read or be seen, never a ready-made form.`;
