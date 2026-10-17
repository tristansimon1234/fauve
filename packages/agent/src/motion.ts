import { isClipSegment, isMotionSegment, segmentSeconds, type CameraMove, type ClipAnalysis, type EditPlan, type MotionTemplate, type Scene } from "./schemas.ts";
import type { Adjust, ClipBlur, PhotoEdit } from "./retouch.ts";
import { brandPalette, resolveBrandLook, type BrandPalette, type Bullet, type ListItem, type TextLook } from "./text-look.ts";
import type { LogoOnDark } from "./logo.ts";
import type { VoiceWord } from "./voice.ts";
import type { BrandSignature } from "./signature.ts";
import { previewMusic, speechWindows, type MixCase } from "./mix.ts";

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

/** Fonts of each template when the studio has none: current pairings, not the classics of ten years ago. */
const TEMPLATE_FONTS: Record<MotionTemplate, { display: string; body: string }> = {
  doux: { display: "Instrument Serif", body: "Inter Tight" },
  dynamique: { display: "Bricolage Grotesque", body: "Bricolage Grotesque" },
  chic: { display: "Bodoni Moda", body: "Inter Tight" },
  collage: { display: "Bricolage Grotesque", body: "Space Mono" },
};

/** The fonts an ambiance uses when the studio has none (or one a Reel cannot load). */
export const templateFonts = (template: MotionTemplate) => TEMPLATE_FONTS[template];

/** Footage that keeps playing under an animation: a passage of a clip, or a photo. */
export type ReelUnder =
  | { type: "clip"; src: string; startFrom: number; adjust?: Adjust; aspect?: number }
  | { type: "image"; src: string; edit?: PhotoEdit };

export type ReelSegment =
  /**
   * speech: someone speaks in this passage, its sound is kept (the other clips play muted).
   * move: the camera's move on the shot; speed: playback rate (startFrom stays a frame of the clip).
   */
  | {
      type: "clip";
      src: string;
      startFrom: number;
      startAt: number;
      durationInFrames: number;
      zoom: boolean;
      move?: CameraMove;
      speed?: number;
      /** The clip's width / height, to frame its subject in the vertical crop. */
      aspect?: number;
      adjust?: Adjust;
      blur?: ClipBlur;
      speech?: boolean;
      accent?: "punch" | "wipe";
      /** Where the subtitles sit over this shot (top, share of the frame), off its faces. */
      subtitleY?: number;
    }
  /**
   * A photo: a carousel slide (with its retouch and blurred zones), or a photo in a Reel (zoom: a slow Ken Burns move).
   * cutout: in a collage, its subject cut out (an image with transparency, the subject's box in shares of the photo), laid as a sticker.
   */
  | {
      type: "image";
      src: string;
      startAt: number;
      durationInFrames: number;
      edit?: PhotoEdit;
      zoom?: boolean;
      move?: CameraMove;
      accent?: "punch" | "wipe";
      subtitleY?: number;
      cutout?: { src: string; box: { x: number; y: number; w: number; h: number } };
    }
  /** Animations play over her footage when there is some (`under`), else on the studio's colours. */
  | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number; under?: ReelUnder }
  /** shift: how far the scene is moved down (share of the height, up when negative), off the faces of the footage under it. */
  | {
      type: "motion";
      js: string;
      fallback: Scene;
      texts: Record<string, string>;
      startAt: number;
      durationInFrames: number;
      under?: ReelUnder;
      shift?: number;
      /** The photos a free scene composes with (a collage), in the order its code reads them. */
      photos?: ScenePhoto[];
    };

/**
 * A photo a free scene composes with (collages): its link, its shape (width / height),
 * and, when its subject cuts out cleanly, the cut-out (framed like the photo) and the
 * subject's box in it (shares of the photo). Mirrors apps/render/src/types.ts.
 */
/**
 * One of her shots as a collage's composition lays it (Footage): the segment it is, when it
 * plays (frames from the composition's start), a video or a photo, its shape (width / height),
 * the centre of its subject (shares of the picture) and, for a photo cut out cleanly, its
 * cut-out and the subject's box, like a ScenePhoto (Cutout can lift it). Mirrors apps/render/src/types.ts.
 */
export type ComposeShot = ScenePhoto & {
  segment: number;
  from: number;
  durationInFrames: number;
  kind: "video" | "photo";
  focus?: { x: number; y: number };
};

export type ScenePhoto = {
  src: string;
  aspect: number;
  cutout?: string;
  subject?: { x: number; y: number; w: number; h: number };
  /** The edges of the photo that cut the subject (a bust at the bottom, a shoulder on the left): it comes in from there. */
  cutEdges?: ("top" | "bottom" | "left" | "right")[];
};
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
  /** In a Reel, a text with items is a message: its own words are its title, its items under it (on a photo, a list's text is only its name). */
  message?: boolean;
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
    /** Its art direction as settings: its titles, key words, boxes and light (the render's theme follows them). */
    signature?: ReelSignature;
  };
  endCard: { title: string; subtitle: string | null; from: number } | null;
  /**
   * Simone's music, played in the live preview (the render gets it mixed in afterwards):
   * its volume (0–1), and the lower one while someone speaks, in `duck.windows` (frames).
   */
  soundtrack?: { src: string; volume?: number; duck?: { volume: number; windows: [number, number][] } } | null;
  /** Her voice note over the Reel, from `from` (frames), in the render and the preview. */
  voice?: { src: string; from: number } | null;
  /** An overlay over the whole video, under the texts: film dust. */
  effect?: "dust" | null;
  /** The studio's logo over the whole video or still (carousel slides). */
  logo?: "top" | "bottom" | null;
  /** Where a voice's subtitles sit for the whole Reel (top, share of the height): off the faces, never moving. */
  subtitleY?: number;
  /**
   * Animations over several shots, above the montage and under its texts: from `from`
   * (frames) for `durationInFrames`, with the frames where the shot changes under them (`cuts`, from their start).
   */
  layers?: {
    js: string;
    texts: Record<string, string>;
    from: number;
    durationInFrames: number;
    cuts: number[];
    photos?: ScenePhoto[];
    /** A collage's composition: it lays the Reel's shots itself (Footage), nothing plays under it. */
    compose?: boolean;
    /** The shots it lays, in the order of the montage. */
    shots?: ComposeShot[];
  }[];
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
  /** Each clip's width / height when known (from its analysis), to frame its subject in the vertical crop. */
  aspects?: Record<string, number>;
  /** Word timings from the clip analyses, by clip_id (for subtitles). */
  words?: Record<string, ClipAnalysis["words"]>;
  /** fonts: the studio's brand fonts (display first); the plan's fonts win over them. */
  brand: {
    name: string;
    accent?: string | null;
    logoUrl?: string | null;
    logoOnDark?: LogoOnDark;
    fonts?: string[];
    colors?: string[];
    customFonts?: { family: string; url: string }[];
    signature?: BrandSignature;
  };
  /** Signed link of the music kept for the post: the editors play it with the preview. */
  soundtrack?: string;
  /** Her voice note (plan.voice): its signed link and her words (for the subtitles). */
  voice?: { src: string; words: VoiceWord[] };
  /** In a collage, the photos whose subject makes a sticker: the cut-out's signed link and the subject's box (shares of the photo). */
  cutouts?: Record<string, { src: string; box: { x: number; y: number; w: number; h: number } }>;
  /** Each photo's width / height (from its reading), for the free scenes that compose with it. */
  photoAspects?: Record<string, number>;
  /** The cut-outs an animation can use (clean edge, even cut by the photo's frame), with the edges that cut them. */
  sceneCutouts?: Record<string, { src: string; box: { x: number; y: number; w: number; h: number }; edges?: ("top" | "bottom" | "left" | "right")[] }>;
};

const FONT_NAME = /^[A-Za-z0-9 ]{2,40}$/;

const DEFAULT_ACCENT = "#5B3FD9";

/**
 * White or ink text on top of the accent colour, whichever has the better contrast
 * (WCAG): a mid-tone accent (a dusty pink, a sage) takes ink, white on it would not read.
 */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // #1C1530, the ink of the app, has a luminance of about 0.01.
  return (luminance + 0.05) / 0.06 > 1.05 / (luminance + 0.05) ? "#1C1530" : "#FFFFFF";
}

/**
 * The business's name kept on one line: the spaces inside it become non-breaking, so
 * « Trattoria Sole » never ends a line on « Trattoria » (the renderers split words on
 * the other spaces only).
 */
export function keepName(text: string, name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return text;
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.replace(new RegExp(escaped.join("[ \\t]+"), "giu"), (found) => found.replace(/[ \t]+/g, "\u00a0"));
}

/**
 * French typography on screen: the space before « : ; ! ? % € » and inside « » never breaks
 * (a narrow no-break space), so no line of a Reel starts with « : » or a lone « % »; nor
 * does the one between a number and the word it counts (« 3 cours », « 7 h », « 2 places »).
 */
export function frenchSpaces(text: string): string {
  return text
    .replace(/[ \t\u00a0]+([:;!?»%€])/g, "\u202f$1")
    .replace(/(«)[ \t\u00a0]+/g, "$1\u202f")
    .replace(/(\d)[ \t]+(?=\p{L})/gu, "$1\u00a0");
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

/** The photos a free scene composes with, in its order: each one's link, shape and clean cut-out (a missing photo is left out). */
export function scenePhotos(ids: string[], inputs: Pick<ReelInputs, "clipUrls" | "cutouts" | "photoAspects" | "sceneCutouts">): ScenePhoto[] {
  return ids.flatMap((id) => {
    const src = inputs.clipUrls[id];
    if (!src) return [];
    const loose = inputs.sceneCutouts?.[id];
    const cut = loose ?? inputs.cutouts?.[id];
    return [
      {
        src,
        aspect: inputs.photoAspects?.[id] ?? 3 / 4,
        ...(cut ? { cutout: cut.src, subject: cut.box } : {}),
        ...(loose?.edges?.length ? { cutEdges: loose.edges } : {}),
      },
    ];
  });
}

/** A text's looks and bullet with the brand's fonts and colours named by role made real. */
export function brandLooks(
  t: { look?: TextLook; items?: ListItem[]; detail_look?: TextLook; bullet?: Bullet },
  brand: ReelProps["brand"],
): { look?: TextLook; items?: ListItem[]; detail_look?: TextLook; bullet?: Bullet } {
  const named = (c: string) => (c === "secondary" || c === "light" || c === "dark" ? (brand.palette?.[c] ?? c) : c);
  return {
    look: resolveBrandLook(t.look, brand),
    items: t.items?.map((item) => ({ ...item, title: frenchSpaces(item.title), ...(item.detail ? { detail: frenchSpaces(item.detail) } : {}) })),
    detail_look: resolveBrandLook(t.detail_look, brand),
    bullet: t.bullet ? { ...t.bullet, color: named(t.bullet.color) } : undefined,
  };
}

export function buildReelProps(plan: EditPlan, inputs: ReelInputs): ReelProps {
  const fps = REEL_FPS;
  const brand = resolveReelBrand(plan, inputs.template, inputs.brand);
  const { lengths, fadeFrames } = frameLengths(plan);

  // The footage under an animation: the passage of her clip (or the photo) the plan names.
  const underOf = (over: { clip_id: string; in?: number } | undefined): ReelUnder | undefined => {
    const src = over ? inputs.clipUrls[over.clip_id] : undefined;
    if (!over || !src) return undefined;
    const kept = plan.segments.find((x) => isClipSegment(x) && x.clip_id === over.clip_id);
    const retouch = kept && isClipSegment(kept) ? kept : undefined;
    if (inputs.photoIds?.includes(over.clip_id)) return { type: "image", src, ...(retouch?.photo ? { edit: retouch.photo } : {}) };
    const aspect = inputs.aspects?.[over.clip_id];
    return { type: "clip", src, startFrom: toFrames(over.in ?? 0), ...(retouch?.adjust ? { adjust: retouch.adjust } : {}), ...(aspect ? { aspect } : {}) };
  };

  let cursor = 0;
  const segments: ReelSegment[] = plan.segments.map((s, i) => {
    const startAt = cursor;
    cursor += lengths[i]! - fadeFrames;
    if (isMotionSegment(s)) {
      const fallback = s.motion.fallback ?? { kind: "title" as const, title: inputs.brand.name || " ", background: "accent" as const };
      const under = underOf(s.over);
      // Without generated code, the motion segment is just its fixed fallback scene.
      return s.motion.js
        ? {
            type: "motion",
            js: s.motion.js,
            fallback,
            texts: s.motion.texts ?? {},
            startAt,
            durationInFrames: lengths[i]!,
            ...(under ? { under } : {}),
            ...(under && s.motion.shift ? { shift: s.motion.shift } : {}),
            ...(s.motion.photos?.length ? { photos: scenePhotos(s.motion.photos, inputs) } : {}),
          }
        : { type: "scene", scene: fallback, startAt, durationInFrames: lengths[i]!, ...(under ? { under } : {}) };
    }
    if (!isClipSegment(s)) return { type: "scene", scene: s.scene, startAt, durationInFrames: lengths[i]! };
    const src = inputs.clipUrls[s.clip_id];
    if (!src) throw new Error(`No URL for clip ${s.clip_id}`);
    const speed = s.speed && Math.abs(s.speed - 1) > 0.01 ? s.speed : undefined;
    // Someone speaks in this passage: its sound stays (unless her voice is over the Reel, or the shot plays at another speed).
    const speech = !plan.voice && !speed && (inputs.words?.[s.clip_id] ?? []).some((w) => w.start >= s.in && w.end <= s.out);
    const zoom = s.zoom === "light" || plan.transitions === "light_zoom";
    const move: CameraMove = s.move ?? (zoom ? "in" : "none");
    // A photo in a Reel: the move the engine chose (photoMoves: most held still); a plan from before those moves keeps its slow zoom.
    if (inputs.photoIds?.includes(s.clip_id)) {
      return {
        type: "image",
        src,
        startAt,
        durationInFrames: lengths[i]!,
        zoom: s.move === undefined,
        ...(s.move ? { move: s.move } : {}),
        ...(s.photo ? { edit: s.photo } : {}),
        ...(s.accent ? { accent: s.accent } : {}),
        ...(s.subtitle_y !== undefined ? { subtitleY: s.subtitle_y } : {}),
        // A collage lays its subject over its print as a sticker (placed by the photo's framing, so only with it).
        ...(inputs.template === "collage" && s.photo && inputs.cutouts?.[s.clip_id] ? { cutout: inputs.cutouts[s.clip_id] } : {}),
      };
    }
    return {
      type: "clip",
      src,
      startFrom: toFrames(s.in),
      startAt,
      durationInFrames: lengths[i]!,
      zoom,
      ...(move !== "none" ? { move } : {}),
      ...(speed ? { speed } : {}),
      ...(inputs.aspects?.[s.clip_id] ? { aspect: inputs.aspects[s.clip_id] } : {}),
      ...(s.adjust ? { adjust: s.adjust } : {}),
      ...(s.blur ? { blur: s.blur } : {}),
      ...(speech ? { speech: true } : {}),
      ...(s.accent ? { accent: s.accent } : {}),
      ...(s.subtitle_y !== undefined ? { subtitleY: s.subtitle_y } : {}),
    };
  });
  const durationInFrames = cursor + fadeFrames;

  const texts: ReelText[] = plan.texts
    .map((t) => {
      const from = toFrames(t.from);
      const to = Math.min(toFrames(t.to), durationInFrames);
      const name = inputs.brand.name;
      return {
        text: frenchSpaces(keepName(t.text, name)),
        style: t.style,
        emphasis: (t.emphasis ?? []).map((e) => frenchSpaces(keepName(e, name))),
        from,
        durationInFrames: to - from,
        y: t.y,
        x: t.x,
        scale: t.scale,
        backdrop: t.backdrop,
        ...brandLooks(t, brand),
        ...(t.items?.length ? { message: true } : {}),
      };
    })
    .filter((t) => t.durationInFrames > 0);

  // Spoken words: her voice note's (moved to where it plays), else the clips' (moved
  // from clip time to output time, for the segments that keep them).
  const words: ReelWord[] = [];
  // A voice may start before the Reel (negative): the silence before its first word is cut.
  const voice = plan.voice && inputs.voice ? { ...inputs.voice, from: Math.round(plan.voice.at * REEL_FPS) } : null;
  if (plan.subtitles && voice) {
    for (const word of voice.words) {
      const from = voice.from + toFrames(word.start);
      const to = voice.from + toFrames(word.end);
      if (from >= 0 && from < durationInFrames) words.push({ w: word.w, from, to: Math.max(to, from + 3) });
    }
  } else if (plan.subtitles) {
    plan.segments.forEach((s, i) => {
      if (!isClipSegment(s)) return;
      const speed = s.speed ?? 1;
      for (const word of inputs.words?.[s.clip_id] ?? []) {
        if (word.start < s.in || word.end > s.out) continue;
        const from = segments[i]!.startAt + toFrames((word.start - s.in) / speed);
        const to = segments[i]!.startAt + toFrames((word.end - s.in) / speed);
        if (from < durationInFrames) words.push({ w: word.w, from, to: Math.max(to, from + 3) });
      }
    });
    words.sort((a, b) => a.from - b.from);
  }

  // The music of the live preview sits under what is said, as in the render's mix:
  // when her voice (or Simone's) speaks, else in the passages that keep their sound.
  const spoken = voice
    ? voice.words.map((w) => ({ from: voice.from + toFrames(w.start), to: voice.from + toFrames(w.end) }))
    : plan.segments.flatMap((s, i) => {
        const segment = segments[i];
        if (!isClipSegment(s) || segment?.type !== "clip" || !segment.speech) return [];
        return (inputs.words?.[s.clip_id] ?? [])
          .filter((w) => w.start >= s.in && w.end <= s.out)
          .map((w) => ({ from: segment.startAt + toFrames(w.start - s.in), to: segment.startAt + toFrames(w.end - s.in) }));
      });
  const mix: MixCase = voice ? "voice_over" : spoken.length ? "speech_in_clips" : "music";
  const music = previewMusic(mix, speechWindows(spoken.filter((w) => w.from < durationInFrames), toFrames(0.5)));

  const endCardFrames = toFrames(END_CARD_SECONDS);

  // A collage's composition lays her shots itself: each one's segment, span, shape and subject (a photo's cut-out too).
  const composeShots = (from: number): ComposeShot[] =>
    plan.segments.flatMap((s, i): ComposeShot[] => {
      const segment = segments[i];
      if (!isClipSegment(s) || !segment || (segment.type !== "clip" && segment.type !== "image")) return [];
      const span = { segment: i, from: segment.startAt - from, durationInFrames: segment.durationInFrames };
      if (segment.type === "image") {
        const photo = scenePhotos([s.clip_id], inputs)[0];
        const aspect = segment.edit ? segment.edit.source.width / segment.edit.source.height : (photo?.aspect ?? 3 / 4);
        const focus = s.photo?.adjust?.focus;
        return [{ ...(photo ?? { src: segment.src }), aspect, ...span, kind: "photo" as const, ...(focus ? { focus } : {}) }];
      }
      return [{ src: segment.src, aspect: inputs.aspects?.[s.clip_id] ?? 9 / 16, ...span, kind: "video" as const, ...(s.adjust?.focus ? { focus: s.adjust.focus } : {}) }];
    });

  // Animations over several shots: their span in frames and the cuts under them (from their start).
  const starts = segments.slice(1).map((s) => s.startAt);
  const layers = (plan.layers ?? []).flatMap((l) => {
    if (!l.motion.js) return [];
    const from = Math.min(durationInFrames - 1, toFrames(l.from));
    const length = Math.min(durationInFrames - from, toFrames(l.to) - from);
    if (length < fps) return [];
    return [
      {
        js: l.motion.js,
        texts: l.motion.texts ?? {},
        from,
        durationInFrames: length,
        cuts: starts.filter((f) => f > from && f < from + length).map((f) => f - from),
        ...(l.motion.photos?.length ? { photos: scenePhotos(l.motion.photos, inputs) } : {}),
        ...(l.compose ? { compose: true, shots: composeShots(from) } : {}),
      },
    ];
  });

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
      ? { title: frenchSpaces(keepName(plan.end_card.title, inputs.brand.name)), subtitle: plan.end_card.subtitle ? frenchSpaces(plan.end_card.subtitle) : null, from: Math.max(0, durationInFrames - endCardFrames) }
      : null,
    ...(inputs.soundtrack ? { soundtrack: { src: inputs.soundtrack, ...music } } : {}),
    ...(voice ? { voice: { src: voice.src, from: voice.from } } : {}),
    ...(plan.effect ? { effect: plan.effect } : {}),
    ...(plan.subtitle_y !== undefined ? { subtitleY: plan.subtitle_y } : {}),
    ...(layers.length ? { layers } : {}),
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
    ...(brand.signature ? { signature: reelSignature(brand.signature) } : {}),
  };
}

/** What the render applies of a signature (the rest guides the editor, the music and the animations). */
export type ReelSignature = Pick<BrandSignature, "titles" | "stress" | "band" | "grade" | "base">;
const reelSignature = ({ titles, stress, band, grade, base }: BrandSignature): ReelSignature => ({ titles, stress, band, grade, base });
