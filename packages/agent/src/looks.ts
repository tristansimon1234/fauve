import { z } from "zod";

// The look a Reel can wear over its whole video, the way Prequel's filters dress a phone video, as
// its settings rather than a list (Tristan, on a closed list of five: « le look appareil jetable,
// l'outil permet de faire n'importe quel look ou ce look spécifique ? »): a grade over her footage and
// its animations (one colour matrix, `lookMatrix`), and over it, under the texts, its texture (grain,
// light, vignette, a flash, a light leak, lines, dust, a frame, the date a camera prints). A look grades
// and textures her real images, never redraws them: Edith is an editing tool, not an image generator.
// Its settings are written by a model from her words (Edith's `set_look`, the editor, the Reel she copies)
// or taken from a preset, and drawn by the engine (apps/render/src/Looks.tsx) from the frame number alone:
// the render and the preview match. Never by default: on her request, when the Reel she copies wears one,
// or as her default for all her Reels when she asked for it. Plans made before hold a preset key in `effect`.

/** The presets, as the plans made before named them (`effect`): film dust, then the looks. */
export const REEL_EFFECTS = ["dust", "disposable", "vhs", "y2k", "cine", "bw"] as const;
export type ReelEffect = (typeof REEL_EFFECTS)[number];
export const isReelEffect = (value: unknown): value is ReelEffect => typeof value === "string" && (REEL_EFFECTS as readonly string[]).includes(value);

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX);

/** The date a camera prints, as a look draws it: in seven segments, a camcorder's pixels or a typewriter's letters. */
export const lookStampSchema = z.object({
  style: z.enum(["digital", "camcorder", "typed"]),
  format: z.enum(["yy_mm_dd", "d_mon_yyyy", "dd_mm_yyyy"]),
  color: hex(),
  corner: z.enum(["bottom_right", "bottom_left", "top_left", "top_right"]),
  /** What the camera writes beside it (« PLAY ▶ », « REC ● »), on the same side, at the other end. */
  label: z.string().max(12).default(""),
  /** The running time of the tape under the date (« SP 0:00:12 »). */
  clock: z.boolean().default(false),
});
export type LookStamp = z.infer<typeof lookStampSchema>;

/**
 * A look, as its settings: 0 leaves an image as it is. The grade (exposure to glow) is laid on her
 * footage and its animations; the rest is drawn over it, under the texts, which stay clean.
 */
export const reelLookSchema = z.object({
  /** Its name for her, in her words (« Polaroid des années 70 »): never a key. */
  name: z.string().min(1).max(48),
  /** What it does, in a few words for her and for the critic (« couleurs délavées et chaudes, grain fort »). */
  hint: z.string().max(160).default(""),
  /** The preset it is, when it is one (its tile in the app; the dust's own words for the critic). */
  preset: z.enum(REEL_EFFECTS).optional(),
  exposure: z.number().min(-0.4).max(0.4).default(0),
  contrast: z.number().min(-0.5).max(0.6).default(0),
  /** -1: black and white. */
  saturation: z.number().min(-1).max(0.8).default(0),
  /** Cool blue (-1) to warm orange (1). */
  warmth: z.number().min(-1).max(1).default(0),
  /** Green (-1) to magenta (1). */
  tint: z.number().min(-1).max(1).default(0),
  /** Lifted blacks, a washed-out print. */
  fade: z.number().min(0).max(1).default(0),
  /** A colour pushed into the shadows and one into the highlights (split toning), at `split`. */
  shadows: hex().nullable().default(null),
  highlights: hex().nullable().default(null),
  split: z.number().min(0).max(1).default(0),
  /** A hue shift, in degrees. */
  hue: z.number().min(-30).max(30).default(0),
  /** A softness, as an old lens or a tape. */
  soft: z.number().min(0).max(1).default(0),
  /** Colours slipping apart, red one way and blue the other (a tape, a cheap lens). */
  bleed: z.number().min(0).max(1).default(0),
  /** Highlights that bloom (halation), in `glow_color`. */
  glow: z.number().min(0).max(1).default(0),
  glow_color: hex().default("#FF6A3D"),
  grain: z.number().min(0).max(1).default(0),
  grain_size: z.enum(["fine", "medium", "coarse"]).default("medium"),
  vignette: z.number().min(0).max(1).default(0),
  /** A direct flash on the subject. */
  flash: z.number().min(0).max(1).default(0),
  /** A light leak that breathes on one edge, in `leak_color`. */
  leak: z.number().min(0).max(1).default(0),
  leak_color: hex().default("#FF7828"),
  /** Scanlines. */
  lines: z.number().min(0).max(1).default(0),
  /** A tape's tracking band rolling down now and then. */
  tracking: z.boolean().default(false),
  /** Film dust: specks, a fibre, a rare scratch. */
  dust: z.number().min(0).max(1).default(0),
  /** Old film's light that wavers. */
  flicker: z.number().min(0).max(1).default(0),
  /** Cinema bars top and bottom, or a print's white border. */
  frame: z.enum(["none", "bars", "border"]).default("none"),
  stamp: lookStampSchema.nullable().default(null),
});
export type ReelLook = z.infer<typeof reelLookSchema>;

const preset = (key: ReelEffect, name: string, hint: string, settings: Partial<z.input<typeof reelLookSchema>>): ReelLook =>
  reelLookSchema.parse({ name, hint, preset: key, ...settings });

/** The presets: the looks Edith knew first, and the examples the look designer learns its scales from. */
export const LOOK_PRESETS: Record<ReelEffect, ReelLook> = {
  dust: preset("dust", "Poussière de pellicule", "des grains, une fibre, une rayure de temps en temps", { dust: 1 }),
  disposable: preset("disposable", "Appareil jetable", "flash chaud, grain, coins sombres et la date en orange dans le coin", {
    exposure: 0.06,
    contrast: 0.06,
    saturation: 0.25,
    warmth: 0.45,
    flash: 0.66,
    leak: 0.6,
    vignette: 0.75,
    grain: 0.5,
    stamp: { style: "digital", format: "yy_mm_dd", color: "#FF8A1E", corner: "bottom_right" },
  }),
  vhs: preset("vhs", "Cassette VHS", "couleurs qui bavent, lignes, « PLAY ▶ » et la date du caméscope", {
    exposure: 0.04,
    contrast: 0.08,
    saturation: 0.3,
    soft: 0.5,
    bleed: 1,
    lines: 1,
    tracking: true,
    vignette: 0.5,
    grain: 0.6,
    grain_size: "fine",
    stamp: { style: "camcorder", format: "d_mon_yyyy", color: "#F4F4F4", corner: "bottom_left", label: "PLAY ▶", clock: true },
  }),
  y2k: preset("y2k", "Flash années 2000", "flash direct, couleurs vives et un peu froides, grain fin", {
    exposure: 0.08,
    contrast: 0.2,
    saturation: 0.25,
    hue: -8,
    warmth: -0.3,
    flash: 0.73,
    vignette: 0.63,
    grain: 0.3,
    grain_size: "fine",
  }),
  cine: preset("cine", "Ciné", "ombres bleu-vert, peaux chaudes, grain fin, coins sombres", {
    exposure: -0.02,
    contrast: 0.12,
    saturation: -0.05,
    shadows: "#0F6E7A",
    highlights: "#FF9A50",
    split: 0.6,
    vignette: 0.58,
    grain: 0.35,
  }),
  bw: preset("bw", "Noir et blanc", "noir et blanc contrasté, grain", { exposure: 0.04, contrast: 0.28, saturation: -1, vignette: 0.58, grain: 0.6 }),
};

/** The look a plan wears: its own, else the preset a plan made before named. */
export function planLook(plan: { look?: ReelLook | null; effect?: ReelEffect | null }): ReelLook | null {
  return plan.look ?? (plan.effect ? LOOK_PRESETS[plan.effect] : null);
}

/** A look in one line for her, the critic or the editor: « appareil jetable (flash chaud, grain…) ». */
export function lookWords(look: ReelLook): string {
  return `${look.name.charAt(0).toLowerCase()}${look.name.slice(1)}${look.hint ? ` (${look.hint})` : ""}`;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Her words for no look at all. */
const NO_LOOK = new Set(["none", "aucun", "sans", "sans look", "pas de look", "rien", "naturel", "retirer", "enlever"]);

/**
 * Words for a look, as Edith, the editor or the app give them: « none » (no look), a preset (its key or its
 * name: « vhs », « Appareil jetable »), or a look to design (her words). The caller designs the last one.
 */
export function lookChoice(words: string | null | undefined): { look: ReelLook | null } | { design: string } | null {
  const said = (words ?? "").trim();
  if (!said) return null;
  const key = fold(said);
  if (NO_LOOK.has(key)) return { look: null };
  for (const [name, look] of Object.entries(LOOK_PRESETS) as [ReelEffect, ReelLook][]) {
    if (key === name || key === fold(look.name)) return { look };
  }
  return { design: said.slice(0, 400) };
}

/** Whether two looks draw the same. */
export const sameLook = (a: ReelLook | null, b: ReelLook | null) => JSON.stringify(a) === JSON.stringify(b);

// The grade as one colour matrix (sRGB, the way CSS filters work): each setting is an affine change of
// the colours, composed into one, applied once by an SVG feColorMatrix (cheap, the same in the render and
// the preview). [A, b]: x' = A·x + b, with x the red, green and blue from 0 to 1.
type Affine = { a: number[][]; b: number[] };

const LUMA = [0.2126, 0.7152, 0.0722] as const;
const diag = (r: number, g: number, b: number, offset = 0): Affine => ({
  a: [
    [r, 0, 0],
    [0, g, 0],
    [0, 0, b],
  ],
  b: [offset, offset, offset],
});

/** b after a: x' = B.a·(A.a·x + A.b) + B.b. */
function then(first: Affine, next: Affine): Affine {
  const a = next.a.map((row) => [0, 1, 2].map((j) => row[0]! * first.a[0]![j]! + row[1]! * first.a[1]![j]! + row[2]! * first.a[2]![j]!));
  const b = next.a.map((row, i) => row[0]! * first.b[0]! + row[1]! * first.b[1]! + row[2]! * first.b[2]! + next.b[i]!);
  return { a, b };
}

/** The saturation matrix of the SVG and CSS filters (0: grey, 1: as it is). */
function saturate(s: number): Affine {
  const [r, g, b] = LUMA;
  return {
    a: [
      [r + (1 - r) * s, g - g * s, b - b * s],
      [r - r * s, g + (1 - g) * s, b - b * s],
      [r - r * s, g - g * s, b + (1 - b) * s],
    ],
    b: [0, 0, 0],
  };
}

/** The hue rotation matrix of the SVG and CSS filters. */
function hueRotate(degrees: number): Affine {
  const t = (degrees * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {
    a: [
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ],
    b: [0, 0, 0],
  };
}

const rgb = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [number, number, number];

/**
 * Split toning: a colour pushed into the shadows and one into the highlights, by luminance. Both
 * weights (1 − L and L) are linear in the colours, so it stays one matrix.
 */
function splitTone(shadows: string | null, highlights: string | null, strength: number): Affine {
  const k = 0.35 * strength;
  const s = shadows ? rgb(shadows).map((v) => (v - 0.5) * k) : [0, 0, 0];
  const h = highlights ? rgb(highlights).map((v) => (v - 0.5) * k) : [0, 0, 0];
  // x' = x + s·(1 − L) + h·L = x + s + (h − s)·L
  return {
    a: [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (h[i]! - s[i]!) * LUMA[j]!)),
    b: s,
  };
}

/** The grade of a look as the 20 values of an SVG feColorMatrix (rows red, green, blue, alpha). */
export function lookMatrix(look: ReelLook): number[] {
  const steps: Affine[] = [
    diag(1 + look.exposure, 1 + look.exposure, 1 + look.exposure),
    diag(1 + look.contrast, 1 + look.contrast, 1 + look.contrast, 0.5 * -look.contrast),
    saturate(1 + look.saturation),
    hueRotate(look.hue),
    diag(1 + 0.08 * look.warmth, 1 + 0.02 * look.warmth, 1 - 0.1 * look.warmth),
    diag(1, 1 - 0.08 * look.tint, 1),
    splitTone(look.shadows, look.highlights, look.split),
    diag(1 - 0.18 * look.fade, 1 - 0.18 * look.fade, 1 - 0.18 * look.fade, 0.12 * look.fade),
  ];
  const { a, b } = steps.reduce(then, diag(1, 1, 1));
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return [...a.flatMap((row, i) => [...row.map(round), 0, round(b[i]!)]), 0, 0, 0, 1, 0];
}

const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

/**
 * The date a look prints, from the day of the render (YYYY-MM-DD in her time zone), in its camera's format:
 * « '26 10 29 », « 29 OCT. 2026 », « 29/10/2026 » (seven segments draw only digits: « 29 10 2026 »).
 */
export function lookStamp(look: ReelLook | null | undefined, today: string | undefined): string | undefined {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today ?? "");
  const stamp = look?.stamp;
  if (!day || !stamp) return undefined;
  const [, year, month, date] = day as unknown as [string, string, string, string];
  const digital = stamp.style === "digital";
  if (stamp.format === "yy_mm_dd" || (digital && stamp.format === "d_mon_yyyy")) return `'${year.slice(2)} ${month} ${date}`;
  if (stamp.format === "d_mon_yyyy") return `${Number(date)} ${MONTHS[Number(month) - 1] ?? ""} ${year}`;
  return digital ? `${date} ${month} ${year}` : `${date}/${month}/${year}`;
}

/** Today in a time zone, as lookStamp reads it. */
export function dayIn(timeZone = "Europe/Paris", at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** What the look designer answers: a look's settings, every one given, and what it could not do. */
export const lookDesignSchema = z.object({
  name: z.string().describe("Its name for her, in French, 2 to 5 words, from her words (« Polaroid des années 70 », « Pellicule Portra »)"),
  hint: z.string().describe("What it does, in French, a few words (« couleurs délavées et chaudes, grain fort, coins sombres »)"),
  exposure: z.number().min(-0.4).max(0.4),
  contrast: z.number().min(-0.5).max(0.6),
  saturation: z.number().min(-1).max(0.8),
  warmth: z.number().min(-1).max(1),
  tint: z.number().min(-1).max(1),
  fade: z.number().min(0).max(1),
  shadows: z.string().nullable().describe("#RRGGBB or null"),
  highlights: z.string().nullable().describe("#RRGGBB or null"),
  split: z.number().min(0).max(1),
  hue: z.number().min(-30).max(30),
  soft: z.number().min(0).max(1),
  bleed: z.number().min(0).max(1),
  glow: z.number().min(0).max(1),
  glow_color: z.string().describe("#RRGGBB"),
  grain: z.number().min(0).max(1),
  grain_size: z.enum(["fine", "medium", "coarse"]),
  vignette: z.number().min(0).max(1),
  flash: z.number().min(0).max(1),
  leak: z.number().min(0).max(1),
  leak_color: z.string().describe("#RRGGBB"),
  lines: z.number().min(0).max(1),
  tracking: z.boolean(),
  dust: z.number().min(0).max(1),
  flicker: z.number().min(0).max(1),
  frame: z.enum(["none", "bars", "border"]),
  stamp: z
    .object({
      style: z.enum(["digital", "camcorder", "typed"]),
      format: z.enum(["yy_mm_dd", "d_mon_yyyy", "dd_mm_yyyy"]),
      color: z.string().describe("#RRGGBB"),
      corner: z.enum(["bottom_right", "bottom_left", "top_left", "top_right"]),
      label: z.string().max(12),
      clock: z.boolean(),
    })
    .nullable(),
  note: z
    .string()
    .describe(
      "In French, one short sentence to her when her words ask for what a look cannot do (redraw her images as a cartoon, a painting, an anime; change a face, clothes or a place; add something that was not filmed), saying what you did instead; else empty",
    ),
});
export type LookDesign = z.infer<typeof lookDesignSchema>;

/** The look designer's answer as a look (a colour it got wrong falls back to the default). */
export function lookFromDesign(design: LookDesign): { look: ReelLook; note: string } {
  const color = (value: string | null | undefined) => (value && HEX.test(value) ? value.toUpperCase() : null);
  // Only its settings: a key it was not asked for (a preset's name) never makes it a preset.
  const { note, stamp, shadows, highlights, glow_color, leak_color, name, hint, preset: _preset, ...settings } = design as LookDesign & { preset?: unknown };
  const look = reelLookSchema.parse({
    ...settings,
    name: name.trim().slice(0, 48) || "Look sur mesure",
    hint: hint.trim().slice(0, 160),
    shadows: color(shadows),
    highlights: color(highlights),
    ...(color(glow_color) ? { glow_color: color(glow_color) } : {}),
    ...(color(leak_color) ? { leak_color: color(leak_color) } : {}),
    stamp: stamp && color(stamp.color) ? { ...stamp, color: color(stamp.color), label: stamp.label.trim().slice(0, 12) } : null,
  });
  return { look, note: note.trim().slice(0, 300) };
}

/** The presets, as the look designer learns its scales from them (only what each sets). */
function presetExamples(): string {
  const defaults = reelLookSchema.parse({ name: "x" });
  return (Object.values(LOOK_PRESETS) as ReelLook[])
    .map((look) => {
      const set = Object.fromEntries(
        Object.entries(look).filter(([key, value]) => !["name", "hint", "preset"].includes(key) && JSON.stringify(value) !== JSON.stringify(defaults[key as keyof ReelLook])),
      );
      return `- « ${look.name} » (${look.hint}): ${JSON.stringify(set)}`;
    })
    .join("\n");
}

export const LOOK_DESIGNER_PROMPT = `You design the look of a Reel for Edith, the assistant that edits the Reels of neighbourhood businesses: the filter laid over the whole video, the way a creator dresses a phone video in Prequel, VSCO or Dazz, from the words of the person who asked (« façon Polaroid », « pellicule Kodak des années 70 », « comme un film de Wes Anderson ») or from how a Reel she wants to copy looks.

A look grades and textures her real images; it never redraws them. You set:
- the grade, over her footage: exposure (-0.4 to 0.4), contrast (-0.5 to 0.6), saturation (-1 black and white, to 0.8), warmth (-1 cool blue, to 1 warm orange), tint (-1 green, to 1 magenta), fade (0 to 1: lifted blacks, a washed-out print), split toning (a colour pushed into the shadows and one into the highlights, #RRGGBB or null, at split 0 to 1), hue (-30 to 30 degrees), soft (0 to 1: an old lens, a tape), bleed (0 to 1: colours slipping apart, a tape or a cheap lens), glow (0 to 1: highlights that bloom, halation, in glow_color);
- the texture, over it and under her texts: grain (0 to 1) and its size, vignette (0 to 1), flash (0 to 1: a direct flash on the subject), leak (0 to 1: a light leak breathing on one edge, in leak_color), lines (0 to 1: scanlines), tracking (a tape's band rolling down now and then), dust (0 to 1: specks, a fibre, a rare scratch), flicker (0 to 1: old film's wavering light), frame (none; bars: cinema bars top and bottom; border: a print's white border);
- stamp: the date a camera prints, only when her words name a camera that prints one (a disposable camera, a camcorder, an old digital camera) or the copied Reel has one: its style (digital: seven segments; camcorder: a camcorder's pixel font; typed: a typewriter), its format, its colour, its corner, the label the camera writes beside it (« PLAY ▶ », « REC ● », else empty) and the tape's running time (clock). Else null.

The scales, from the looks Edith already has (what each sets; everything else is 0, none or null):
${presetExamples()}

What makes a good look: it reads at once as what she asked for, and stays a filter a creator would choose: her faces keep a living skin, her images stay readable, nothing is pushed to the point of looking like a cheap preset. Set only what the look needs; most settings stay at 0. glow and soft cost render time: only when the look is known for them (a film stock's halation, a dreamy or vintage lens, a tape). A film stock: its colours (warmth, split, fade, saturation) and its grain, rarely more. A film or a director: its colour palette and its contrast, never its frame unless the name says it (« cinémascope » takes the bars). A camera: its colours, its flash, its texture and its date.

Never: a look that would need to redraw her images (a cartoon, a manga, an anime, a painting, a sketch, clay, pixel art), to change a face, a body, clothes or a place, or to add what was not filmed. That is not editing: make the closest look with the settings you have (bold colours and contrast for a cartoon, soft and faded colours for a painting) and say so to her in note, in French, in one short sentence (« Je ne redessine pas tes images en dessin animé : j'ai mis des couleurs franches et contrastées, comme une BD. »). Otherwise note is empty.

name and hint in French, for her: name in 2 to 5 words from her words, hint in a few words.`;
