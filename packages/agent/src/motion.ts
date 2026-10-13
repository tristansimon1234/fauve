import { isClipSegment, isMotionSegment, segmentSeconds, type ClipAnalysis, type EditPlan, type MotionTemplate, type Scene } from "./schemas.ts";

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
  | { type: "clip"; src: string; startFrom: number; startAt: number; durationInFrames: number; zoom: boolean }
  | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number }
  | { type: "motion"; js: string; fallback: Scene; texts: Record<string, string>; startAt: number; durationInFrames: number };
export type ReelText = {
  text: string;
  style: "hook" | "band" | "caption";
  emphasis: string[];
  from: number;
  durationInFrames: number;
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
  brand: { name: string; accent: string; accentInk: string; displayFont: string; bodyFont: string; logoUrl: string | null };
  endCard: { title: string; subtitle: string | null; from: number } | null;
};

export type ReelInputs = {
  template: MotionTemplate;
  /** Signed URL of each clip, by clip_id. */
  clipUrls: Record<string, string>;
  /** Word timings from the clip analyses, by clip_id (for subtitles). */
  words?: Record<string, ClipAnalysis["words"]>;
  /** fonts: the studio's brand fonts (display first); the plan's fonts win over them. */
  brand: { name: string; accent?: string | null; logoUrl?: string | null; fonts?: string[] };
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

export function buildReelProps(plan: EditPlan, inputs: ReelInputs): ReelProps {
  const fps = REEL_FPS;
  const toFrames = (seconds: number) => Math.max(0, Math.round(seconds * fps));
  const lengths = plan.segments.map((s) => Math.max(1, toFrames(segmentSeconds(s))));
  const fadeFrames =
    plan.transitions === "fade" && plan.segments.length > 1 && lengths.every((l) => l > toFrames(FADE_SECONDS) + 4)
      ? toFrames(FADE_SECONDS)
      : 0;

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
    return {
      type: "clip",
      src,
      startFrom: toFrames(s.in),
      startAt,
      durationInFrames: lengths[i]!,
      zoom: s.zoom === "light" || plan.transitions === "light_zoom",
    };
  });
  const durationInFrames = cursor + fadeFrames;

  const texts: ReelText[] = plan.texts
    .map((t) => {
      const from = toFrames(t.from);
      const to = Math.min(toFrames(t.to), durationInFrames);
      return { text: t.text, style: t.style, emphasis: t.emphasis ?? [], from, durationInFrames: to - from };
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
    brand: resolveReelBrand(plan, inputs.template, inputs.brand),
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
    displayFont: plan.fonts?.display ?? brandFonts[0] ?? TEMPLATE_FONTS[template].display,
    bodyFont: plan.fonts?.body ?? brandFonts[1] ?? TEMPLATE_FONTS[template].body,
    logoUrl: brand.logoUrl ?? null,
  };
}
