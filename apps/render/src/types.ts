// Mirror of ReelProps in packages/agent/src/motion.ts (the web app builds them).
// This package is shipped alone to the render sandbox, so it cannot import it.

export type MotionTemplate = "doux" | "dynamique" | "chic" | "collage";

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
export type RegionKind = "face" | "plate" | "screen" | "document" | "other";
export type PhotoEdit = { source: { width: number; height: number }; adjust?: Adjust; blur?: (Box & { kind: RegionKind; shape: "ellipse" | "rect" })[] };
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
    | { type: "image"; src: string; startAt: number; durationInFrames: number; edit?: PhotoEdit; zoom?: boolean; move?: CameraMove; accent?: "punch" | "wipe"; subtitleY?: number }
    | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number; under?: ReelUnder }
    /** shift: how far the scene is moved down (share of the height, up when negative), off the faces of the footage under it. */
    | { type: "motion"; js: string; fallback: Scene; texts: Record<string, string>; startAt: number; durationInFrames: number; under?: ReelUnder; shift?: number }
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
};

/** What the render applies of a business's signature (packages/agent/src/signature.ts). */
export type ReelSignature = {
  titles: { font: "display" | "body"; case: "upper" | "normal"; weight: "regular" | "bold" | "black"; align: "center" | "left"; tracking: "tight" | "normal" | "wide" };
  stress: "color" | "block" | "serif" | "marker";
  band: "white" | "accent" | "dark" | "light" | "outline";
  grade: "natural" | "warm" | "bright" | "flash" | "film" | "moody" | "cool";
  base: "light" | "dark";
};
