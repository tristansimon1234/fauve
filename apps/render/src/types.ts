// Mirror of ReelProps in packages/agent/src/motion.ts (the web app builds them).
// This package is shipped alone to the render sandbox, so it cannot import it.
import type { TrackPiece } from "./track";

export type MotionTemplate = "doux" | "dynamique" | "chic" | "collage" | "libre";

/** Mirror of the retouch types in packages/agent/src/retouch.ts. */
export type Adjust = {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  straighten?: number;
  focus?: { x: number; y: number };
  zoom?: number;
};
export type Box = { x: number; y: number; w: number; h: number };

/**
 * A photo a free scene composes with (collages): its link, its shape (width / height),
 * and, when its subject cuts out cleanly, the cut-out (an image with transparency, framed
 * like the photo) and the subject's box in it (shares of the photo).
 */
export type ScenePhoto = {
  src: string;
  aspect: number;
  cutout?: string;
  subject?: Box;
  /** The edges of the photo that cut the subject (a bust at the bottom, a shoulder on the left): it comes in from there. */
  cutEdges?: ("top" | "bottom" | "left" | "right")[];
};
/**
 * One of her shots as a collage's composition lays it (Footage): the segment it is, when it
 * plays (frames from the composition's start), a video or a photo, its shape, the centre of
 * its subject and, for a photo cut out cleanly, its cut-out and the subject's box (Cutout can lift it).
 */
export type ComposeShot = ScenePhoto & {
  segment: number;
  from: number;
  durationInFrames: number;
  kind: "video" | "photo";
  focus?: { x: number; y: number };
  /** What was tracked in a video shot (hands, faces, bodies) and how it is drawn: track(frame, box) places it in the box it is laid in. */
  track?: Omit<TrackPiece, "at" | "length">;
};
/** A text of the Reel that a collage's composition draws itself (frames from its start): its words, its role, the words to stress, a message's lines. */
export type ComposeText = { text: string; role: "hook" | "band" | "caption"; from: number; to: number; emphasis: string[]; items?: { title: string; detail?: string }[] };
/** The Reel's end that a composition draws itself: its title and line, from its frame. */
export type ComposeEnd = { title: string; subtitle: string | null; from: number };
export type RegionKind = "face" | "plate" | "screen" | "document" | "other";
export type PhotoEdit = { source: { width: number; height: number }; adjust?: Adjust; blur?: (Box & { kind: RegionKind; shape: "ellipse" | "rect" })[] };
/** One of her photos in a designed carousel: as a scene gets it, with its retouch (light, framing on its subject, blurred zones). */
export type CarouselPhoto = ScenePhoto & { edit?: PhotoEdit };
export type ClipBlur = { aspect: number; tracks: { kind: RegionKind; keys: (Box & { t: number })[] }[] };

export type Scene = {
  kind: "title" | "list" | "quote" | "number";
  title: string;
  kicker?: string;
  items?: string[];
  background: "accent" | "ink" | "cream";
};

/** Mirror of TextLook in packages/agent/src/text-look.ts. Colours: #rrggbb, « accent » or « accent_ink ». */
export type TextLook = {
  font: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  size: number;
  letter_spacing: number;
  line_height: number;
  color: string;
  align: "left" | "center" | "right";
  fill?: { kind: "box" | "pill" | "line"; color: string; opacity: number; radius?: number };
  stroke?: { color: string; width: number };
  shadow: "none" | "soft" | "strong" | "hard";
  emphasis?: { color?: string; font?: string; italic?: boolean; fill?: string };
  rotate: number;
  enter: "none" | "fade" | "rise" | "pop" | "typewriter" | "slide";
};

/** The camera's move on a shot (mirror of CameraMove). */
export type CameraMove = "none" | "in" | "out" | "left" | "right" | "punch";

/** Footage that keeps playing under an animation (mirror of ReelUnder). */
export type ReelUnder =
  | { type: "clip"; src: string; startFrom: number; adjust?: Adjust; aspect?: number }
  | { type: "image"; src: string; edit?: PhotoEdit };

export type ReelProps = {
  template: MotionTemplate;
  /** The Reel's own tempo (beats per minute), chosen by the editor: how lively its texts and camera move (a « libre » Reel). */
  tempo?: number;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  fadeFrames: number;
  segments: (
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
        /** In a collage, its subject cut out (an image with transparency; its box in shares of the photo), laid as a sticker. */
        cutout?: { src: string; box: Box };
      }
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
        /** What moves in the footage under it (hands, faces, bodies), read by its `track`. */
        track?: TrackPiece[];
        /** Google Fonts families its code uses besides the Reel's two, loaded with it. */
        fonts?: string[];
      }
  )[];
  texts: {
    text: string;
    style: "hook" | "band" | "caption";
    emphasis: string[];
    from: number;
    durationInFrames: number;
    /** Manual placement (scene editor): top edge as a share of the height, size factor, dark background. */
    y?: number;
    x?: number;
    scale?: number;
    backdrop?: boolean;
    look?: TextLook;
    items?: { title: string; detail?: string }[];
    detail_look?: TextLook;
    bullet?: { kind: "check" | "box" | "dot" | "dash" | "number" | "arrow"; color: string };
    /** In a Reel, a text with items is a message: its own words are its title (on a photo, a list's text is only its name). */
    message?: boolean;
  }[];
  words: { w: string; from: number; to: number }[];
  brand: {
    name: string;
    accent: string;
    accentInk: string;
    /** The brand's other colours by role (mirror of BrandPalette). */
    palette?: { secondary: string; light: string; dark: string };
    displayFont: string;
    bodyFont: string;
    logoUrl: string | null;
    /** How the logo shows over a dark picture (end card): in white, or on a light plate; else as it is. */
    logoOnDark?: "as_is" | "white" | "plate";
    /** The studio's own fonts (uploaded files), loaded by URL instead of from Google Fonts. */
    customFonts?: { family: string; url: string }[];
    /** Its art direction as settings (mirror of BrandSignature): its titles, key words, boxes and light. */
    signature?: ReelSignature;
  };
  endCard: { title: string; subtitle: string | null; from: number } | null;
  /** Simone's music in the live preview (the render gets it mixed in afterwards). */
  soundtrack?: { src: string; volume?: number; duck?: { volume: number; windows: [number, number][] } } | null;
  /** Her voice note over the Reel, from `from` (frames). */
  voice?: { src: string; from: number } | null;
  /** An overlay over the whole video, under the texts: film dust. */
  effect?: "dust" | null;
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
    /** What moves in the shots under it (hands, faces, bodies), read by its `track`. */
    track?: TrackPiece[];
    /** Google Fonts families its code uses besides the Reel's two, loaded with it. */
    fonts?: string[];
    /** A collage's composition that draws the whole picture: the Reel's texts and its end are its own (no paper nor texts of the engine). */
    drawsTexts?: boolean;
    reelTexts?: ComposeText[];
    end?: ComposeEnd | null;
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
  /**
   * A whole carousel designed as code (the carousel designer): the slide drawn here (`slide`,
   * from 0, of `count`), its slots' texts, the fonts it brings, her photos in the order its code
   * reads them; `check` for the designer's test render (a text cut by an edge or too small, a
   * photo that does not exist, a broken code fail it). Drawn alone, on white.
   */
  carousel?: {
    js: string;
    texts: Record<string, string>;
    fonts: string[];
    slide: number;
    count: number;
    photos: CarouselPhoto[];
    /** The slide each slot is on (from 1; 0: on every slide), for the plain slide drawn if the code fails. */
    slotSlides?: Record<string, number>;
    check?: boolean;
  } | null;
};

/** What the render applies of a business's signature (packages/agent/src/signature.ts). */
export type ReelSignature = {
  titles: { font: "display" | "body"; case: "upper" | "normal"; weight: "regular" | "bold" | "black"; align: "center" | "left"; tracking: "tight" | "normal" | "wide" };
  stress: "color" | "block" | "serif" | "marker";
  band: "white" | "accent" | "dark" | "light" | "outline";
  grade: "natural" | "warm" | "bright" | "flash" | "film" | "moody" | "cool";
  base: "light" | "dark";
};
