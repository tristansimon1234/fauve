// Mirror of ReelProps in packages/agent/src/motion.ts (the web app builds them).
// This package is shipped alone to the render sandbox, so it cannot import it.
import type { ClearMap } from "./clear";
import type { FaceZone, TrackPiece } from "./track";

/** A passage of a shot at one speed (a speed ramp is several). Mirrors SpeedPiece in packages/agent/src/motion.ts. */
export type SpeedPiece = { at: number; length: number; startFrom: number; speed: number };

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
  /** The faces of a video shot (shares of the picture): kept whole in the box it is laid in. */
  face?: FaceZone;
  /** What was tracked in a video shot (hands, faces, bodies) and how it is drawn: track(frame, box) places it in the box it is laid in. */
  track?: Omit<TrackPiece, "at" | "length">;
  /** Where its subject is at each image (shares of the picture), from its cut-out: SubjectBox places it in the box it is laid in. */
  subjectBoxes?: (number[] | null)[];
  /** Its subject's outline at each image (64 points, x y shares, flat), from its cut-out: Outline and SubjectOutline draw it. */
  subjectContours?: (number[] | null)[];
  /**
   * The objects followed through it, by name: where each one is and its outline, image by image (SubjectBox, SubjectOutline,
   * Outline given its name), and its pieces (the letters of a sign, each window of « every window ») as shares of its box
   * on the image it was found on (x, y, w, h, flat, in reading order): SubjectParts places them on its box at every image.
   */
  objects?: Record<string, { boxes?: (number[] | null)[]; contours?: (number[] | null)[]; parts?: number[] }>;
  /** A photo's framing and retouch, as the Reel draws it (Photo): what SubjectBox and SubjectOutline place its subject by. */
  edit?: PhotoEdit;
  /** How the Reel moves it as it draws it (set by the render: its camera move, a photo's slow zoom, the punch), so a box read on it lands where it is at each frame. */
  camera?: ShotCamera;
  /** Where a text can be set in it (its sky, an empty wall, any calm area) and how its camera moves, read before the render: ClearBox chooses its area on it. */
  clear?: ClearMap;
};
/** How the Reel moves a shot as it draws it, so what is read on its picture follows it (mirror of packages/agent/src/motion.ts). */
export type ShotCamera = {
  move?: CameraMove;
  zoomTo: number;
  punch: number;
  /** A photo's slow zoom when the editor chose no move (KenBurns): its way and its drift. */
  burns?: { zoomIn: boolean; drift: number };
  accent?: "punch";
  /** A video's straightening (degrees), turned about the box's centre and enlarged so no corner shows. */
  straighten?: number;
};
/** A text of the Reel that a collage's composition draws itself (frames from its start): its words, its role, the words to stress, a message's lines. */
export type ComposeText = {
  text: string;
  role: "hook" | "band" | "caption";
  from: number;
  to: number;
  emphasis: string[];
  items?: { title: string; detail?: string }[];
  /** A font of its own, picked for what its words evoke (a skill's filler): a Google Fonts family, loaded with the Reel. */
  font?: string;
};
/** The Reel's end that a composition draws itself: its title and line, from its frame. */
export type ComposeEnd = { title: string; subtitle: string | null; from: number };
export type RegionKind = "face" | "plate" | "screen" | "document" | "other";
export type PhotoEdit = { source: { width: number; height: number }; adjust?: Adjust; blur?: (Box & { kind: RegionKind; shape: "ellipse" | "rect" })[] };
/**
 * One of her photos in a designed carousel: as a scene gets it, with its retouch (light, framing on its subject, blurred zones),
 * its subject's outline (64 points, shares of the photo) and the objects found on it by name (a cut-out framed like the photo, its box, its outline).
 */
export type CarouselPhoto = ScenePhoto & {
  edit?: PhotoEdit;
  contour?: number[];
  objects?: Record<string, { cutout: string; box: Box; contour?: number[] }>;
};
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
        /** A speed ramp: the shot's passages at each speed, from `at` (frames from its start), the clip's image `startFrom` played at `speed`. */
        ramp?: SpeedPiece[];
        /** The file plays the clip from this frame of it (a slow motion's own smooth file); `startFrom` stays a frame of the clip. */
        srcFrom?: number;
        /** The clip's width / height, to frame its subject in the vertical crop. */
        aspect?: number;
        adjust?: Adjust;
        blur?: ClipBlur;
        speech?: boolean;
        accent?: "punch" | "wipe";
        /** Where the subtitles sit over this shot (top, share of the frame), off its faces. */
        subtitleY?: number;
        /** Its subject cut out at every image of the passage (a transparent video, or one image when nothing moves), for a composition's Subject. */
        subject?: { src: string; still?: boolean; top?: number };
        /** Objects followed through the passage (a cup, a product), by name, cut out the same way: Subject with `object`. */
        objects?: Record<string, { src: string; still?: boolean }>;
        /** Its depth at every image of the passage (a grey video, near white), drawn like the shot by Depth. */
        depthMap?: { src: string };
        /** Laid beside another shot on the same moment (a split screen's other half): only a composition draws it, the plain montage skips it. */
        beside?: true;
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
        /** Its subject cut out (the photo's own cut-out, framed like it), drawn exactly over the photo by an animation's Subject. */
        subject?: { src: string };
        /** Objects found on it by name (a glass, the cup she holds), cut out the same way: Subject with `object`. */
        objects?: Record<string, { src: string }>;
        /** A moving photo in relief: its subject cut out (framed like the photo), moving a little more than the room behind it. */
        depth?: { src: string; box: Box };
        /** A moving photo whose depth the card read (relief.py): the video of every pixel moved by its depth, drawn in its place. */
        relief?: { src: string; frames: number };
        /** Laid beside another shot on the same moment: only a composition draws it, the plain montage skips it. */
        beside?: true;
      }
    /** composed: an engine screen inside a composition that draws the whole picture, drawn only in its fallback. */
    | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number; under?: ReelUnder; composed?: true }
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
    /** A font of its own for its words (a skill's filler picked it for what they evoke): its composition draws it, loaded here. */
    font?: string;
  }[];
  words: { w: string; from: number; to: number }[];
  /** What is said written like a creator: each phrase around the person (kinetic), or on labels (stickers); absent, the apps' own captions. */
  captions?: "kinetic" | "stickers";
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
  /** logoNamed false: the logo does not write the name (a mascot, a symbol), the card writes it under it. */
  endCard: { title: string; subtitle: string | null; from: number; logoNamed?: false } | null;
  /**
   * Edith's music in the live preview (the render gets it mixed in afterwards); `envelope`, its model's shape (its
   * pauses, its end): points (frame, 0–1) to draw straight lines between.
   */
  soundtrack?: { src: string; volume?: number; duck?: { volume: number; windows: [number, number][] }; envelope?: [number, number][] } | null;
  /** Its sound effects in the live preview (the render strips them and mixes them afterwards): from its frame, its gain in dB, the part of its file played (s). */
  sfx?: { src: string; key: string; from: number; at: number; gain: number; onset: number; end: number }[];
  /** Her videos kept whole and horizontal, on black above and below. */
  frame?: "letterbox";
  /** Her voice note over the Reel, from `from` (frames). */
  voice?: { src: string; from: number } | null;
  /** A look over the whole video (Looks.tsx): its grade over the footage, its texture under the texts. */
  look?: ReelLookDraw | null;
  /** The date a look prints, in its camera's format (« '26 10 29 », « 29 OCT. 2026 »). */
  stamp?: string;
  /**
   * The ready looks (LOOK_PRESETS, by key: « vhs », « bw »…) an animation lays on one passage with Look (PassageLook.tsx),
   * each drawn as a look over the whole Reel is, with the date its camera prints: given when an animation's code uses Look.
   */
  looks?: Record<string, { look: ReelLookDraw; stamp?: string }>;
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
    /** A composition that starts after the Reel does (the sound she follows): its first image held from the Reel's start. */
    holdFirst?: boolean;
    /** The shots it lays, in the order of the montage. */
    shots?: ComposeShot[];
    /** What moves in the shots under it (hands, faces, bodies), read by its `track`. */
    track?: TrackPiece[];
    /** Google Fonts families its code uses besides the Reel's two, loaded with it. */
    fonts?: string[];
    /** A collage's composition that draws the whole picture: the Reel's texts and its end are its own (no paper nor texts of the engine). */
    drawsTexts?: boolean;
    /** False: written without an end card; it stops before the card, which the engine draws. */
    drawsEnd?: boolean;
    reelTexts?: ComposeText[];
    end?: ComposeEnd | null;
    /** The words said under it (frames from its start), when its code writes them (`spoken`): the engine's captions step aside. */
    spoken?: { w: string; from: number; to: number }[];
    /** Its code only times its own words on them (a montage skill timed on her voice): the engine's captions stay under it. */
    captionsStay?: true;
  }[];
  /** What she added on her Reel (a text, one of her photos or its cut-out), drawn over everything, in frames. */
  overlays?: {
    kind: "text" | "photo";
    text?: string;
    src?: string;
    /** The photo's width over its height. */
    aspect?: number;
    /** A cut-out subject: the image is the photo's size, its subject in `box` (shares). */
    cutout?: boolean;
    box?: Box;
    from: number;
    durationInFrames: number;
    /** Its centre (shares of the frame); w: a photo's width, or a text's type size, share of the width. */
    x: number;
    y: number;
    w: number;
  }[];
  /**
   * A simple copied Reel remade by code (copy.ts): her photos' subjects laid over its shots (`box` in shares of the
   * photo, `aspect` its width over height), its held title drawn as the model draws it, its ending card. In frames.
   */
  copy?: {
    cutouts: { src: string; box: Box; aspect: number; place: "stand" | "center" | "left" | "right"; from: number; durationInFrames: number; segment: number }[];
    title: {
      lines: string[];
      from: number;
      durationInFrames: number;
      font?: string;
      stroke: "thin" | "regular" | "thick";
      staggered: boolean;
      tilt: number;
      shadow: "none" | "soft" | "strong";
      color: string;
      upper: boolean;
      y: number;
    } | null;
    /** Its cards' `from` counts from the ending's. */
    end: { from: number; ground: string; ink: string; cards: { from: number; lines: string[] }[] } | null;
  };
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

/** A look as the engine draws it (looks.ts in @fauve/agent): its settings, 0 leaving the image as it is, and its grade as one colour matrix. */
export type ReelLookDraw = {
  name: string;
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  tint: number;
  fade: number;
  shadows: string | null;
  highlights: string | null;
  split: number;
  hue: number;
  soft: number;
  bleed: number;
  glow: number;
  glow_color: string;
  grain: number;
  grain_size: "fine" | "medium" | "coarse";
  vignette: number;
  flash: number;
  leak: number;
  leak_color: string;
  lines: number;
  tracking: boolean;
  dust: number;
  flicker: number;
  frame: "none" | "bars" | "border";
  stamp: {
    style: "digital" | "camcorder" | "typed";
    format: "yy_mm_dd" | "d_mon_yyyy" | "dd_mm_yyyy";
    color: string;
    corner: "bottom_right" | "bottom_left" | "top_left" | "top_right";
    label: string;
    clock: boolean;
  } | null;
  /** The 20 values of an SVG feColorMatrix: the whole grade at once. */
  matrix: number[];
};
