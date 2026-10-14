import { isClipSegment, isMotionSegment, segmentSeconds, type ClipAnalysis, type EditPlan, type MotionTemplate, type Scene } from "./schemas.ts";
import type { Adjust, ClipBlur, PhotoEdit } from "./retouch.ts";
import { brandPalette, resolveBrandLook, type BrandPalette, type Bullet, type ListItem, type TextLook } from "./text-look.ts";
import type { LogoOnDark } from "./logo.ts";

// Edit plan → props of the Remotion "Reel" composition (apps/render). Everything
// is converted to frames on the output timeline here, so the templates only
// animate and never compute cuts.

export const REEL_FPS = 30;
const FADE_SECONDS = 0.35;
const END_CARD_SECONDS = 1.6;

const SIZES: Record<EditPlan["format"], { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

const TEMPLATE_FONTS: Record<MotionTemplate, { display: string; body: string }> = {
  doux: { display: "Instrument Serif", body: "Plus Jakarta Sans" },
  dynamique: { display: "Poppins", body: "Poppins" },
  chic: { display: "Cormorant Garamond", body: "Plus Jakarta Sans" },
};

export type ReelSegment =
  | { type: "clip"; src: string; startFrom: number; startAt: number; durationInFrames: number; zoom: boolean; adjust?: Adjust; blur?: ClipBlur }
  /** A photo: a carousel slide (with its retouch and blurred zones), or a photo in a Reel (zoom: a slow Ken Burns move). */
  | { type: "image"; src: string; startAt: number; durationInFrames: number; edit?: PhotoEdit; zoom?: boolean }
  | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number }
  | { type: "motion"; js: string; fallback: Scene; texts: Record<string, string>; startAt: number; durationInFrames: number };
export type ReelText = {
  text: string;
  style: "hook" | "band" | "caption";
  emphasis: string[];
  from: number;
  durationInFrames: number;
  /** Manual placement from the scene editor (default: the style's place and size). */
  y?: number;
  x?: number;
  scale?: number;
  backdrop?: boolean;
  /** A look of its own (font, colours, fill…), instead of the template's style. */
  look?: TextLook;
  /** A list: its items (the text is then only its name), the look of the detail lines, the bullets. */
  items?: ListItem[];
  detail_look?: TextLook;
  bullet?: Bullet;
};
export type ReelWord = { w: string; from: number; to: number };

export type ReelProps = {
  template: MotionTemplate;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  fadeFrames: number;
  segments: ReelSegment[];
  texts: ReelText[];
  words: ReelWord[];
  brand: {
    name: string;
    accent: string;
    accentInk: string;
    displayFont: string;
    bodyFont: string;
    /** The brand's other colours by role (looks name them: secondary, light, dark). */
    palette?: BrandPalette;
    logoUrl: string | null;
    /** How the logo shows over a dark picture (end card): as it is, in white, or on a light plate. */
    logoOnDark?: LogoOnDark;
    /** The studio's own fonts (uploaded files), loaded by URL instead of from Google Fonts. */
    customFonts?: { family: string; url: string }[];
  };
  endCard: { title: string; subtitle: string | null; from: number } | null;
  /** The studio's logo over the whole video or still (carousel slides). */
  logo?: "top" | "bottom" | null;
  /** Components of the studio's bank placed on a still: drawn at their design width (base), then scaled into their box (shares of the frame). */
  elements?: {
    js: string;
    texts: Record<string, string>;
    fonts: string[];
    base: number;
    box: { x: number; y: number; w: number; rotate?: number };
    accent?: string;
    /** Named in the test render's errors (the designer's reference, e1…). */
    label?: string;
  }[];
  /** The designer's test render: fails when a text leaves the frame or a component breaks. */
  elementsCheck?: boolean;
  /** A text layer designed as code (carousel slides); `check` makes the render fail when a text leaves the frame. */
  layer?: {
    js: string;
    texts: Record<string, string>;
    fonts: string[];
    check?: boolean;
    /** Moved and resized by hand: offset (share of the frame) and size of the whole layer. */
    place?: { x: number; y: number; scale: number };
    /** Its accent colour, instead of the studio's. */
    accent?: string;
  } | null;
};

export type ReelInputs = {
  template: MotionTemplate;
  /** Signed URL of each clip, by clip_id. */
  clipUrls: Record<string, string>;
  /** The clips that are photos (shown still with a slow zoom). */
  photoIds?: string[];
  /** Word timings from the clip analyses, by clip_id (for subtitles). */
  words?: Record<string, ClipAnalysis["words"]>;
  /** fonts: the studio's brand fonts (display first); the plan's fonts win over them. */
  brand: { name: string; accent?: string | null; logoUrl?: string | null; logoOnDark?: LogoOnDark; fonts?: string[]; colors?: string[]; customFonts?: { family: string; url: string }[] };
};

const FONT_NAME = /^[A-Za-z0-9 ]{2,40}$/;

const DEFAULT_ACCENT = "#5B3FD9";

/** White or ink text on top of the accent colour, whichever reads better. */
function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#1C1530" : "#FFFFFF";
}

const toFrames = (seconds: number) => Math.max(0, Math.round(seconds * REEL_FPS));

/** Each segment's length in frames, and the overlap of the fades between them. */
function frameLengths(plan: Pick<EditPlan, "segments" | "transitions">) {
  const lengths = plan.segments.map((s) => Math.max(1, toFrames(segmentSeconds(s))));
  const fadeFrames =
    plan.transitions === "fade" && plan.segments.length > 1 && lengths.every((l) => l > toFrames(FADE_SECONDS) + 4)
      ? toFrames(FADE_SECONDS)
      : 0;
  return { lengths, fadeFrames };
}

/** When each segment starts in the video and how long it lasts (seconds), fades included, and the video's length. */
export function planTimeline(plan: Pick<EditPlan, "segments" | "transitions">): { segments: { start: number; length: number }[]; duration: number } {
  const { lengths, fadeFrames } = frameLengths(plan);
  let cursor = 0;
  const segments = lengths.map((length) => {
    const start = cursor;
    cursor += length - fadeFrames;
    return { start: start / REEL_FPS, length: length / REEL_FPS };
  });
  return { segments, duration: (cursor + fadeFrames) / REEL_FPS };
}

/** A text's looks and bullet with the brand's fonts and colours named by role made real. */
export function brandLooks(
  t: { look?: TextLook; items?: ListItem[]; detail_look?: TextLook; bullet?: Bullet },
  brand: ReelProps["brand"],
): { look?: TextLook; items?: ListItem[]; detail_look?: TextLook; bullet?: Bullet } {
  const named = (c: string) => (c === "secondary" || c === "light" || c === "dark" ? (brand.palette?.[c] ?? c) : c);
  return {
    look: resolveBrandLook(t.look, brand),
    items: t.items,
    detail_look: resolveBrandLook(t.detail_look, brand),
    bullet: t.bullet ? { ...t.bullet, color: named(t.bullet.color) } : undefined,
  };
}

export function buildReelProps(plan: EditPlan, inputs: ReelInputs): ReelProps {
  const fps = REEL_FPS;
  const brand = resolveReelBrand(plan, inputs.template, inputs.brand);
  const { lengths, fadeFrames } = frameLengths(plan);

  let cursor = 0;
  const segments: ReelSegment[] = plan.segments.map((s, i) => {
    const startAt = cursor;
    cursor += lengths[i]! - fadeFrames;
    if (isMotionSegment(s)) {
      const fallback = s.motion.fallback ?? { kind: "title" as const, title: inputs.brand.name || " ", background: "accent" as const };
      // Without generated code, the motion segment is just its fixed fallback scene.
      return s.motion.js
        ? { type: "motion", js: s.motion.js, fallback, texts: s.motion.texts ?? {}, startAt, durationInFrames: lengths[i]! }
        : { type: "scene", scene: fallback, startAt, durationInFrames: lengths[i]! };
    }
    if (!isClipSegment(s)) return { type: "scene", scene: s.scene, startAt, durationInFrames: lengths[i]! };
    const src = inputs.clipUrls[s.clip_id];
    if (!src) throw new Error(`No URL for clip ${s.clip_id}`);
    // A photo in a Reel: still, with a slow zoom so it lives.
    if (inputs.photoIds?.includes(s.clip_id)) return { type: "image", src, startAt, durationInFrames: lengths[i]!, zoom: true, ...(s.photo ? { edit: s.photo } : {}) };
    return {
      type: "clip",
      src,
      startFrom: toFrames(s.in),
      startAt,
      durationInFrames: lengths[i]!,
      zoom: s.zoom === "light" || plan.transitions === "light_zoom",
      ...(s.adjust ? { adjust: s.adjust } : {}),
      ...(s.blur ? { blur: s.blur } : {}),
    };
  });
  const durationInFrames = cursor + fadeFrames;

  const texts: ReelText[] = plan.texts
    .map((t) => {
      const from = toFrames(t.from);
      const to = Math.min(toFrames(t.to), durationInFrames);
      return { text: t.text, style: t.style, emphasis: t.emphasis ?? [], from, durationInFrames: to - from, y: t.y, x: t.x, scale: t.scale, backdrop: t.backdrop, ...brandLooks(t, brand) };
    })
    .filter((t) => t.durationInFrames > 0);

  // Spoken words, moved from clip time to output time, for the segments that keep them.
  const words: ReelWord[] = [];
  if (plan.subtitles) {
    plan.segments.forEach((s, i) => {
      if (!isClipSegment(s)) return;
      for (const word of inputs.words?.[s.clip_id] ?? []) {
        if (word.start < s.in || word.end > s.out) continue;
        const from = segments[i]!.startAt + toFrames(word.start - s.in);
        const to = segments[i]!.startAt + toFrames(word.end - s.in);
        if (from < durationInFrames) words.push({ w: word.w, from, to: Math.max(to, from + 3) });
      }
    });
    words.sort((a, b) => a.from - b.from);
  }

  const endCardFrames = toFrames(END_CARD_SECONDS);

  return {
    template: inputs.template,
    ...SIZES[plan.format],
    fps,
    durationInFrames,
    fadeFrames,
    segments,
    texts,
    words,
    brand,
    endCard: plan.end_card
      ? { title: plan.end_card.title, subtitle: plan.end_card.subtitle ?? null, from: Math.max(0, durationInFrames - endCardFrames) }
      : null,
  };
}

/** Colours and fonts a Reel uses: the plan's fonts, then the studio's, then the template's. */
export function resolveReelBrand(plan: Pick<EditPlan, "fonts">, template: MotionTemplate, brand: ReelInputs["brand"]): ReelProps["brand"] {
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent ?? "") ? brand.accent! : DEFAULT_ACCENT;
  const brandFonts = (brand.fonts ?? []).filter((f) => FONT_NAME.test(f));
  return {
    name: brand.name,
    accent,
    accentInk: inkOn(accent),
    palette: brandPalette(brand.colors, accent),
    displayFont: plan.fonts?.display ?? brandFonts[0] ?? TEMPLATE_FONTS[template].display,
    bodyFont: plan.fonts?.body ?? brandFonts[1] ?? TEMPLATE_FONTS[template].body,
    logoUrl: brand.logoUrl ?? null,
    ...(brand.logoUrl && brand.logoOnDark && brand.logoOnDark !== "as_is" ? { logoOnDark: brand.logoOnDark } : {}),
    ...(brand.customFonts?.length ? { customFonts: brand.customFonts } : {}),
  };
}
