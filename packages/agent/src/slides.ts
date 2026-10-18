import { z } from "zod";
import { carouselDesignSchema, type CarouselDesign } from "./carousel.ts";
import { brandLooks, frenchSpaces, REEL_FPS, resolveReelBrand, type CarouselPhoto, type ReelInputs, type ReelProps } from "./motion.ts";
import { motionTemplateSchema, type MotionTemplate } from "./schemas.ts";
import { photoEditSchema } from "./retouch.ts";
import { MAX_ELEMENTS, slideElementSchema } from "./elements.ts";
import { textLayerSchema } from "./text-layer.ts";
import { listFields, textLookSchema } from "./text-look.ts";

// Carousels and photo posts with text over the photos. Each slide is a still of
// the Reel composition (apps/render): the same fonts, styles and fit as the
// montages, on a 4:5 photo. Fauve writes the texts; the manager moves or edits
// them by hand; the rendered images are what gets published.

export const SLIDE_SIZE = { width: 1080, height: 1350 } as const;
/** A slide is laid out as a short animation and captured once every text is in, before any leaves. */
const SLIDE_FRAMES = 150;
export const SLIDE_FRAME = 120;

/** Where a text may sit on a slide (no app buttons cover a feed photo, unlike a Reel). */
export const SLIDE_Y = { min: 0.04, max: 0.86 } as const;

export const slideTextSchema = z.object({
  text: z.string().min(1).max(120),
  style: z.enum(["hook", "band", "caption"]).describe("hook : grande accroche ; band : bandeau coloré ; caption : petite ligne"),
  emphasis: z.array(z.string().min(1)).max(3).optional().describe("Mots à mettre en valeur (couleur), trois au plus"),
  /** Set by hand: top edge (share of the height), horizontal centre, size, dark background. */
  y: z.number().min(SLIDE_Y.min).max(SLIDE_Y.max).optional(),
  x: z.number().min(0.3).max(0.7).optional(),
  scale: z.number().min(0.6).max(1.6).optional(),
  backdrop: z.boolean().optional(),
  look: textLookSchema.optional().describe("Un style à part (copié d'un exemple ou un des styles enregistrés du studio) ; sinon le style du gabarit"),
  ...listFields,
});
export type SlideText = z.infer<typeof slideTextSchema>;

export const slideSchema = z.object({
  media_id: z.uuid(),
  texts: z.array(slideTextSchema).max(6),
  /** The studio's logo on the photo. */
  logo: z.enum(["top", "bottom"]).optional(),
  /** A text layer designed as code (text designer): drawn instead of `texts`. */
  layer: textLayerSchema.optional(),
  /** Components of the studio's bank placed on the photo (drawn over its texts). */
  elements: z.array(slideElementSchema).max(MAX_ELEMENTS).optional(),
  /** Retouch and blurred zones of the photo. */
  edit: photoEditSchema.optional(),
});
export type Slide = z.infer<typeof slideSchema>;

export const slidesPlanSchema = z.object({
  template: motionTemplateSchema,
  /** One per photo of the post (none for a designed carousel made of text slides only). */
  slides: z.array(slideSchema).max(10),
  /** A whole carousel designed as code (carousel.ts): its slides are published instead of the photos and their texts. */
  design: carouselDesignSchema.optional(),
});
export type SlidesPlan = z.infer<typeof slidesPlanSchema>;

/** The frame where a style preview is shown: the hook has come in, a hand-drawn circle is drawn. */
export const STYLE_PREVIEW_FRAME = 48;

/**
 * Her style shown on one of her photos (the Style step): a Reel's first seconds, its hook and
 * a line in her words, set her way (her signature, fonts and colours), still at STYLE_PREVIEW_FRAME.
 */
export function stylePreviewProps(inputs: {
  template: MotionTemplate;
  imageUrl: string;
  brand: ReelInputs["brand"];
  sample: { hook: string; key?: string; band: string };
}): ReelProps {
  const brand = resolveReelBrand({}, inputs.template, inputs.brand);
  const frames = 90;
  return {
    template: inputs.template,
    width: 1080,
    height: 1920,
    fps: REEL_FPS,
    durationInFrames: frames,
    fadeFrames: 0,
    segments: [{ type: "image", src: inputs.imageUrl, startAt: 0, durationInFrames: frames }],
    texts: [
      { text: inputs.sample.hook, style: "hook", emphasis: inputs.sample.key ? [inputs.sample.key] : [], from: 0, durationInFrames: frames },
      { text: inputs.sample.band, style: "band", emphasis: [], from: 0, durationInFrames: frames, y: 0.62 },
    ],
    words: [],
    brand,
    endCard: null,
  };
}

/** Props of the Reel composition for one slide: its photo and its texts, captured at SLIDE_FRAME. */
export function buildSlideProps(
  slide: Slide,
  inputs: { template: MotionTemplate; imageUrl: string; brand: ReelInputs["brand"] },
): ReelProps {
  const brand = resolveReelBrand({}, inputs.template, inputs.brand);
  return {
    template: inputs.template,
    ...SLIDE_SIZE,
    fps: REEL_FPS,
    durationInFrames: SLIDE_FRAMES,
    fadeFrames: 0,
    segments: [{ type: "image", src: inputs.imageUrl, startAt: 0, durationInFrames: SLIDE_FRAMES, ...(slide.edit ? { edit: slide.edit } : {}) }],
    // A designed text layer replaces the slide's own texts.
    texts: (slide.layer ? [] : slide.texts).map((t) => ({
      text: t.text,
      style: t.style,
      emphasis: t.emphasis ?? [],
      from: 0,
      durationInFrames: SLIDE_FRAMES,
      y: t.y,
      x: t.x,
      scale: t.scale,
      backdrop: t.backdrop,
      ...brandLooks(t, brand),
    })),
    words: [],
    brand,
    endCard: null,
    logo: slide.logo ?? null,
    layer: slide.layer
      ? {
          js: slide.layer.js,
          texts: slide.layer.texts,
          fonts: slide.layer.fonts,
          ...(slide.layer.place ? { place: slide.layer.place } : {}),
          ...(slide.layer.accent ? { accent: slide.layer.accent } : {}),
        }
      : null,
    elements: (slide.elements ?? []).map((e) => ({ js: e.js, texts: e.texts, fonts: e.fonts, base: e.base, box: e.box, ...(e.accent ? { accent: e.accent } : {}) })),
  };
}

/**
 * Props of the Reel composition for one slide of a designed carousel (`slide` from 0), captured
 * at SLIDE_FRAME: its code, its words (French spaces made unbreakable), her photos in its order.
 */
export function buildCarouselProps(
  design: CarouselDesign,
  slide: number,
  inputs: { template: MotionTemplate; brand: ReelInputs["brand"]; photos: CarouselPhoto[]; check?: boolean },
): ReelProps {
  return {
    template: inputs.template,
    ...SLIDE_SIZE,
    fps: REEL_FPS,
    durationInFrames: SLIDE_FRAMES,
    fadeFrames: 0,
    segments: [],
    texts: [],
    words: [],
    brand: resolveReelBrand({}, inputs.template, inputs.brand),
    endCard: null,
    carousel: {
      js: design.js,
      texts: Object.fromEntries(Object.entries(design.texts).map(([slot, text]) => [slot, frenchSpaces(text)])),
      fonts: design.fonts,
      slide,
      count: design.count,
      photos: inputs.photos,
      slotSlides: Object.fromEntries(design.slots.map((s) => [s.name, s.slide])),
      ...(inputs.check ? { check: true } : {}),
    },
  };
}

/** The slides plan of a post, kept in step with its photos: one slide per photo, in order. */
export function alignSlides(plan: SlidesPlan, mediaIds: string[]): SlidesPlan {
  const byId = new Map(plan.slides.map((s) => [s.media_id, s]));
  return { ...plan, slides: mediaIds.slice(0, 10).map((id) => byId.get(id) ?? { media_id: id, texts: [] }) };
}
