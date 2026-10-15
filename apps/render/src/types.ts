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

export type ReelProps = {
  template: MotionTemplate;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  fadeFrames: number;
  segments: (
    | { type: "clip"; src: string; startFrom: number; startAt: number; durationInFrames: number; zoom: boolean; adjust?: Adjust; blur?: ClipBlur; speech?: boolean; accent?: "punch" | "wipe" }
    | { type: "image"; src: string; startAt: number; durationInFrames: number; edit?: PhotoEdit; zoom?: boolean; accent?: "punch" | "wipe" }
    | { type: "scene"; scene: Scene; startAt: number; durationInFrames: number }
    | { type: "motion"; js: string; fallback: Scene; texts: Record<string, string>; startAt: number; durationInFrames: number }
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
  };
  endCard: { title: string; subtitle: string | null; from: number } | null;
  /** Simone's music in the live preview (the render gets it mixed in afterwards). */
  soundtrack?: { src: string } | null;
  /** Her voice note over the Reel, from `from` (frames). */
  voice?: { src: string; from: number } | null;
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
