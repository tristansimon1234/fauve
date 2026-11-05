import { Component, createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { cellsUnder, decodeGrid, lostOn, outlined, parseColor, type Rgb, type SceneBackdrop } from "./contrast";
import { fitsPending } from "./Fit";
import { fontsLoaded, loadFonts } from "./fonts";
import { makeKit } from "./Kit";
import { makeType } from "./Type";
import { makeGraphic } from "./Graphic";
import { makeEffects } from "./Effects";
import { makeCaptions } from "./Captions";
import { compileScene, SCOPE, type SceneComponent } from "./MotionScene";
import { makeLooks } from "./PassageLook";
import { themeFor } from "./theme";
import { inBox, inShape, onlyProbe, probeSpoken as probeWords, silhouette, type Box as PersonBox, type Shape } from "./silhouette";
import { footageTrack, NOTHING_SEEN, type Seen, type TrackFn, type TrackPiece } from "./track";
import type { MotionTemplate, ReelProps } from "./types";

// Layout check of a generated motion scene, run by smoke.mjs before the scene
// reaches a video: the scene is laid out at many frames at once in a real browser,
// with the studio's fonts, and every visible text must stay in the safe zone
// (the side margins, out of the bottom quarter). A text may fly in from outside,
// but not stay out longer than OUT_FRAMES. A failure cancels the render with the
// reason, which goes back to the motion designer; the fixed scene is used if it persists.
// A mark (an arrow, a number, a key: isMark) only has to stay inside the picture.
// A text that stays on the eyes, nose or mouth of a face tracked under the scene (one
// hung on a hand next to the face) is not a failure: it is reported (FAUVE_FACE), and
// the motion designer gets one more round to move it. So is a sentence that does not stay
// whole on screen long enough to be read (FAUVE_READ: Tristan, « parfois c'est trop rapide
// donc on peut même pas lire »), and a text drawn under MIN_TYPE, its instructions' minimum
// (FAUVE_SIZE: the WhatsApp of a florist's Reel was written at 40 px, Tristan: « il y a une raison
// pour laquelle il fait un truc si p'tit ? »). So is a word lost on the picture under it (FAUVE_INK: a coral « Edith »
// on a café's red awning), measured on the colours of her shots given with the scene (`backdrop`). And what it draws,
// row by row (FAUVE_COVER), for the engine
// to set a voice's subtitles where the animations leave room (Tristan: « il faut pas masquer
// mais bien les placer là où ça ne gêne pas les anim et les visages »). A word laid behind
// her (before Subject) that her silhouette hides is reported too (FAUVE_HIDDEN: the first
// background replaced in production hid its big words behind her on every close-up). And a
// scene whose code reads what is said is given words said (probeSpoken) and says how many of
// them it writes at their moment (FAUVE_SPOKEN): the engine's subtitles step aside only for one
// that writes them.

/**
 * Where a text may go: 40 px from the sides, 80 from the top, above the bottom quarter (the apps' caption), and 140 px
 * from the right below the middle, where the apps' buttons are (lot 7: a giant word behind her, across the frame, was
 * refused at 140 px on both sides, on Tristan's creator references nothing holds the left nor the top right).
 */
export const SAFE_ZONE = { side: 140, edge: 40, top: 80, bottom: 0.75, buttons: 0.5 };
const TOLERANCE = 12; // px: glyph boxes are a little wider than the ink
const OUT_FRAMES = 12; // 0.4 s at 30 fps
const FACE_FRAMES = 12; // a text may cross a face, not stay on it
const FACE_MARGIN = 10; // px around the eyes, nose and mouth
const STEP = 2; // frames between two samples
/** The size a text to read is drawn at, at the least, in px of the 1080 × 1920 frame (its instructions say so too). */
const MIN_TYPE = 48;
/**
 * An accent (data-fauve-accent): a short label set small beside a title that reads, the scale contrast of an
 * editorial layout (« A · Summer · In » over « THE CANADIAN ROCKIES »; Tristan: « oui » to small labels next to a
 * readable title). Held to this smaller minimum, 4 words at most, and only when another text of the scene reads.
 */
const ACCENT_MIN = 20;
const ACCENT_WORDS = 4;
const inAccent = (node: Node) => Boolean(node.parentElement?.closest("[data-fauve-accent]"));
/** At most this many copies laid out at once: a collage's composition runs the whole Reel. */
const MAX_COPIES = 120;
/** A word may be lost on the picture this long (a shot that passes under it), not longer. */
const INK_FRAMES = 12;
/** The footage under an animation at one of its frames stands for the frames this close to it. */
const INK_REACH = 15;
/** A word behind her may be hidden while she passes it, not stay hidden: 0.4 s. */
const HIDDEN_FRAMES = 12;
/** The share of a word her silhouette may cover before it no longer reads. */
const HIDDEN_SHARE = 0.4;
/** How long after its last frame a word said may still be on screen and count as written (its phrase held). */
const SPOKEN_HOLD = 18;


export type SceneCheckProps = {
  js: string;
  texts: Record<string, string>;
  durationInFrames: number;
  brand: Parameters<SceneComponent>[0]["brand"];
  photos?: Parameters<SceneComponent>[0]["photos"];
  cuts?: number[];
  /** A collage's composition: the shots it lays (each one a grey card here). */
  shots?: Parameters<SceneComponent>[0]["shots"];
  /** What moves in the footage under it (its `track` reads the real places, so a text that follows a hand is checked where it goes). */
  track?: TrackPiece[];
  /** The Reel's rhythm and look, for its camera moves (the same theme as the render). */
  look?: { template?: MotionTemplate; tempo?: number; signature?: ReelProps["brand"]["signature"] };
  /** The fonts its code brings besides the Reel's two: checked with them, as the render draws it. */
  fonts?: string[];
  /** A collage's composition that draws the whole picture: the Reel's texts (each must be written, whole, at its moment) and its end. */
  reelTexts?: Parameters<SceneComponent>[0]["reelTexts"];
  end?: Parameters<SceneComponent>[0]["end"];
  /** The colours of the picture under it, for the words lost on it. */
  backdrop?: SceneBackdrop;
  /** Its code reads what is said: it is given words said, and how many of them it writes is measured. */
  probeSpoken?: boolean;
};

const FrameContext = createContext(0);

/** The scene's own scope, with the frame given by the copy it is drawn in (and its Sequences). */
function checkScope(width: number, height: number, durationInFrames: number): typeof SCOPE {
  const useCurrentFrame = () => useContext(FrameContext);
  const Sequence = ({ from = 0, durationInFrames: length = Infinity, layout, style, children }: {
    from?: number;
    durationInFrames?: number;
    layout?: "none" | "absolute-fill";
    style?: CSSProperties;
    children?: ReactNode;
  }) => {
    const frame = useCurrentFrame();
    if (frame < from || frame >= from + length) return null;
    const content = <FrameContext.Provider value={frame - from}>{children}</FrameContext.Provider>;
    return layout === "none" ? content : <AbsoluteFill style={style}>{content}</AbsoluteFill>;
  };
  // A cut-out as a plain image: only the texts are measured, and a rim drawn in a canvas in every copy is slow.
  const Cutout = ({ photo, x, y, height: h, style }: Parameters<typeof SCOPE.Cutout>[0]) =>
    photo?.cutout && photo.subject ? <img src={photo.cutout} style={{ position: "absolute", left: x, top: y, height: h, ...style }} /> : null;
  // One of her shots: a grey card, marked with its index (the colours under a word are read from its grid).
  const Footage = ({ shot, style }: { shot: number; style?: CSSProperties }) => (
    <div data-fauve-shot={shot} style={{ position: "absolute", overflow: "hidden", background: "linear-gradient(160deg, #9a9490, #5f5a57)", ...style }} />
  );
  // Her cut out: an empty box where it is drawn, marked with its shot (a word laid before it is behind her, and her
  // silhouette there is read from what was tracked in that shot).
  // An object followed instead of her (`object`): not her silhouette, nothing to read behind it here.
  const Subject = ({ shot, style, object }: { shot: number; style?: CSSProperties; object?: string }) =>
    object ? null : <div data-fauve-subject={shot} style={{ position: "absolute", left: 0, top: 0, width, height, ...style }} />;
  // Her shot's depth, its ground without its sky, its nearness: nothing read here (the render draws them when they were
  // read; the composition must work without).
  const Depth = () => null;
  const Skyline = () => null;
  const Near = () => null;
  const useVideoConfig = () => ({ ...SCOPE.useVideoConfig(), width, height, durationInFrames });
  return {
    ...SCOPE,
    useCurrentFrame,
    useVideoConfig,
    // The layout kit on this copy's clock: it moves in the check as it will in the render.
    ...makeKit({ useCurrentFrame, useVideoConfig }),
    ...makeType({ useCurrentFrame, useVideoConfig }),
    ...makeGraphic({ useCurrentFrame, useVideoConfig }),
    ...makeEffects({ useCurrentFrame, useVideoConfig }),
    // What is said, on this copy's clock too (its words are measured: does the scene write them?).
    Captions: makeCaptions({ useCurrentFrame, useVideoConfig }),
    // A look on one passage: none given here, what it wraps drawn plain in its box (its words are measured).
    ...makeLooks({ useCurrentFrame, useVideoConfig }),
    Sequence: Sequence as unknown as typeof SCOPE.Sequence,
    Cutout: Cutout as typeof SCOPE.Cutout,
    Footage: Footage as typeof SCOPE.Footage,
    Subject: Subject as unknown as typeof SCOPE.Subject,
    Depth: Depth as unknown as typeof SCOPE.Depth,
    Skyline: Skyline as unknown as typeof SCOPE.Skyline,
    Near: Near as unknown as typeof SCOPE.Near,
  };
}

class Catch extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Out = { text: string; frames: number[]; box: [number, number, number, number] };

/**
 * A mark, not words to read: an arrow, a number, a key of a drawn keyboard, a dot of an interface
 * (no letter and 3 characters at most, or a single character). It may sit near the edge, as in the
 * interfaces of the Reels she copies, but stays inside the picture: a fake app's « ↑ » and « 01 »
 * by its side had the whole composition of Tristan's Reel left out.
 */
const isMark = (text: string) => [...text].length <= 1 || ([...text].length <= 3 && !/\p{L}/u.test(text));

/**
 * Decoration, not words to read: what a scene marks with data-fauve-decor (the filler letters of a
 * word-search grid, a pattern, a texture of type). It may cover the whole frame, under Instagram's
 * caption and buttons, over a face, small or brief: only the words to read keep the checks (Tristan,
 * on a crossword grid squeezed into the safe zone: « pourquoi l'animation a pas pris toute la place ? »).
 */
const inDecor = (node: Node) => Boolean(node.parentElement?.closest("[data-fauve-decor]"));

/** A text over a face of the footage: the frames it is on it, and the face's box (px). */
type OnFace = { text: string; frames: number[]; face: [number, number, number, number] };

/**
 * Visible texts outside the safe zone, per text, in one copy of the scene; and those over the eyes,
 * nose or mouth of a face seen under it at that frame (`onFace`).
 */
function measure(copy: HTMLElement, frame: number, width: number, height: number, out: Map<string, Out>, seen: Seen, onFace: Map<string, OnFace>) {
  const origin = copy.getBoundingClientRect();
  const zone = {
    left: SAFE_ZONE.edge - TOLERANCE,
    right: width - SAFE_ZONE.edge + TOLERANCE,
    top: SAFE_ZONE.top - TOLERANCE,
    bottom: height * SAFE_ZONE.bottom + TOLERANCE,
  };
  // The apps' buttons: the right side, below the middle.
  const buttons = { left: width - SAFE_ZONE.side + TOLERANCE, top: height * SAFE_ZONE.buttons - TOLERANCE };
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (!text || !node.parentElement || inDecor(node)) continue;
    // Effective opacity: a text faded out does not count.
    let opacity = 1;
    for (let el: HTMLElement | null = node.parentElement; el && el !== copy; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden") opacity = 0;
      opacity *= Number(style.opacity);
    }
    if (opacity < 0.15) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      const box: Out["box"] = [r.left - origin.left, r.top - origin.top, r.right - origin.left, r.bottom - origin.top];
      for (const face of seen.faces) {
        const features = [face.points?.right_eye, face.points?.left_eye, face.points?.nose, face.points?.mouth];
        const covered = features.some(
          (p) => p && p.x >= box[0] - FACE_MARGIN && p.x <= box[2] + FACE_MARGIN && p.y >= box[1] - FACE_MARGIN && p.y <= box[3] + FACE_MARGIN,
        );
        if (!covered) continue;
        const entry = onFace.get(text) ?? { text, frames: [], face: [face.x - face.width / 2, face.y - face.height / 2, face.x + face.width / 2, face.y + face.height / 2] };
        if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
        onFace.set(text, entry);
      }
      const limit = isMark(text) ? { left: -TOLERANCE, right: width + TOLERANCE, top: -TOLERANCE, bottom: height + TOLERANCE } : zone;
      const onButtons = !isMark(text) && box[2] > buttons.left && box[3] > buttons.top;
      if (box[0] >= limit.left && box[2] <= limit.right && box[1] >= limit.top && box[3] <= limit.bottom && !onButtons) continue;
      const entry = out.get(text) ?? { text, frames: [], box };
      if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
      entry.box = [Math.min(entry.box[0], box[0]), Math.min(entry.box[1], box[1]), Math.max(entry.box[2], box[2]), Math.max(entry.box[3], box[3])];
      out.set(text, entry);
    }
  }
}

/**
 * How long a sentence must stay whole on screen to be read on a phone: about 0.3 s a word
 * after a first glance, between 1.2 and 4.5 s (the same as readingSeconds in @fauve/agent).
 */
export const readingSeconds = (text: string) => {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * words));
};

/** The block a text sits in (its sentence), past the inline spans of its words. */
function blockOf(node: Node, copy: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el && el !== copy; el = el.parentElement) {
    if (!getComputedStyle(el).display.startsWith("inline")) return el;
  }
  return node.parentElement;
}

/**
 * Sentences that do not stay whole on screen long enough to be read (3 words or more), with how
 * long they stay and how long they need. A sentence still on screen when the scene ends is left
 * to the montage; one that only grows into a longer one is read as the longer one.
 */
function tooQuick(frames: number[], step: number, last: number, skip: (text: string) => boolean): { text: string; seconds: number; needs: number; from: number }[] {
  const seen = new Map<string, number[]>();
  document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => {
    const frame = Number(copy.dataset.checkFrame);
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const blocks = new Set<HTMLElement>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim() || inDecor(node)) continue;
      let opacity = 1;
      for (let el: HTMLElement | null = node.parentElement; el && el !== copy; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden") opacity = 0;
        opacity *= Number(style.opacity);
      }
      const block = opacity >= 0.5 ? blockOf(node, copy) : null;
      if (block) blocks.add(block);
    }
    for (const block of blocks) {
      const text = (block.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text.split(" ").length < 3 || skip(text)) continue;
      const at = seen.get(text) ?? [];
      if (at.at(-1) !== frame) at.push(frame);
      seen.set(text, at);
    }
  });
  const texts = [...seen.keys()];
  return [...seen.entries()].flatMap(([text, at]) => {
    if (texts.some((other) => other !== text && other.includes(text))) return [];
    // Its longest stay, in one piece.
    let best = { from: at[0]!, to: at[0]! };
    let run = { from: at[0]!, to: at[0]! };
    for (const f of at.slice(1)) {
      run = f - run.to <= step ? { ...run, to: f } : { from: f, to: f };
      if (run.to - run.from > best.to - best.from) best = run;
    }
    if (best.to >= last) return [];
    const seconds = (best.to - best.from + step) / 30;
    const needs = readingSeconds(text);
    return seconds < needs * 0.8 && frames.length > 1 ? [{ text, seconds, needs, from: best.from }] : [];
  });
}

/**
 * The size each text to read (3 letters at least: a time or a tick is not read) is drawn at in a copy, kept at
 * its largest over the scene (an entrance that grows it does not count): its font size times the scale of the
 * transforms above it, in px of the frame. An SVG text, sized in its drawing's units, is read on its boxes.
 */
function sizes(copy: HTMLElement, largest: Map<string, number>, accents: Set<string>, skip: (text: string) => boolean) {
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    const el = node.parentElement;
    if (!text || !el || (text.match(/\p{L}/gu)?.length ?? 0) < 3 || inDecor(node) || skip(text)) continue;
    let opacity = 1;
    let scale = 1;
    for (let up: HTMLElement | null = el; up && up !== copy; up = up.parentElement) {
      const style = getComputedStyle(up);
      if (style.visibility === "hidden") opacity = 0;
      opacity *= Number(style.opacity);
      if (style.transform && style.transform !== "none") {
        const m = new DOMMatrixReadOnly(style.transform);
        scale *= Math.hypot(m.c, m.d);
      }
    }
    if (opacity < 0.5) continue;
    let size = parseFloat(getComputedStyle(el).fontSize) * scale;
    if (!(el instanceof HTMLElement)) {
      range.selectNodeContents(node);
      size = Math.max(0, ...Array.from(range.getClientRects()).map((r) => r.height)) / 1.2;
    }
    if (size > 0) largest.set(text, Math.max(largest.get(text) ?? 0, size));
    if (inAccent(node)) accents.add(text);
  }
}

/** A word lost on the picture under it: the frames it is lost, and its contrast there at the worst. */
type Ink = { text: string; frames: number[]; ratio: number };

/** An element's opacity as seen, up to the copy it is drawn in. */
function seenOpacity(el: Element, copy: HTMLElement): number {
  let opacity = 1;
  for (let up: Element | null = el; up && up !== copy; up = up.parentElement) {
    const style = getComputedStyle(up);
    if (style.visibility === "hidden") return 0;
    opacity *= Number(style.opacity);
  }
  return opacity;
}

/** Elements drawn as pictures: what is under a word there is not known. */
const PICTURES = new Set(["img", "canvas", "video", "image"]);

/**
 * The words of a copy that are lost on what is under them (see contrast.ts): one of her shots (a composition's
 * Footage, read from its grid), a flat colour the scene paints, or, with nothing painted under it, the footage
 * under the animation at the nearest frame given. A word with its own edge (a stroke, dense tight shadows) reads
 * anywhere; one over a picture of the scene (a cut-out, a photo) or a gradient is left alone.
 */
function inks(copy: HTMLElement, frame: number, backdrop: SceneBackdrop, grids: Map<string, Uint8Array>, found: Map<string, Ink>) {
  const origin = copy.getBoundingClientRect();
  const gridOf = (b64: string) => grids.get(b64) ?? grids.set(b64, decodeGrid(b64)).get(b64)!;
  const footage = (backdrop.frames ?? []).filter((f) => Math.abs(f.frame - frame) <= INK_REACH).sort((a, b) => Math.abs(a.frame - frame) - Math.abs(b.frame - frame))[0];
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    const el = node.parentElement;
    if (!text || !el || (text.match(/\p{L}/gu)?.length ?? 0) < 2 || inDecor(node)) continue;
    const opacity = seenOpacity(el, copy);
    if (opacity < 0.5) continue;
    const style = getComputedStyle(el);
    const fill = parseColor(style.webkitTextFillColor || style.color);
    if (!fill || fill.alpha < 0.3) continue;
    if (outlined(fill.rgb, style.textShadow, parseFloat(style.webkitTextStrokeWidth) || 0, style.webkitTextStrokeColor)) continue;
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 1 && r.height >= 1);
    if (!rects.length) continue;
    const box: [number, number, number, number] = [
      Math.min(...rects.map((r) => r.left)) - origin.left,
      Math.min(...rects.map((r) => r.top)) - origin.top,
      Math.max(...rects.map((r) => r.right)) - origin.left,
      Math.max(...rects.map((r) => r.bottom)) - origin.top,
    ];
    const { cells, unknown } = cellsAt(box, origin, copy, node, backdrop, footage, gridOf);
    if (unknown) continue;
    const seen = cells ? lostOn(fill.rgb, fill.alpha * opacity, cells) : null;
    if (!seen?.lost) continue;
    const entry = found.get(text) ?? { text, frames: [], ratio: seen.ratio };
    if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
    entry.ratio = Math.min(entry.ratio, seen.ratio);
    found.set(text, entry);
  }
}

/**
 * The colours under a box of a copy (px from the copy's corner): one of her shots (a composition's Footage, from its
 * grid), a flat colour the scene paints, or with nothing painted, the footage under the animation; `unknown` over a
 * picture of the scene or a gradient (left alone). `skip`: what is measured, never taken for what is under it.
 */
function cellsAt(
  box: [number, number, number, number],
  origin: DOMRect,
  copy: HTMLElement,
  skip: Node,
  backdrop: SceneBackdrop,
  footage: { frame: number; grid: string } | undefined,
  gridOf: (b64: string) => Uint8Array,
): { cells: Rgb[] | null; unknown: boolean } {
  // What is under its middle, top down, in this copy only.
  const under = document.elementsFromPoint(origin.left + (box[0] + box[2]) / 2, origin.top + (box[1] + box[3]) / 2).filter((e) => e !== copy && copy.contains(e));
  for (const e of under) {
    if (e === skip || seenOpacity(e, copy) < 0.5) continue;
    const shot = e.getAttribute("data-fauve-shot");
    if (shot !== null) {
      const grid = backdrop.shots?.[shot];
      if (!grid) return { cells: null, unknown: true };
      const r = e.getBoundingClientRect();
      return { cells: cellsUnder(gridOf(grid), box, [r.left - origin.left, r.top - origin.top, r.right - origin.left, r.bottom - origin.top]), unknown: false };
    }
    // A picture of the scene under it (not one that holds what is measured): left alone.
    if (PICTURES.has(e.tagName.toLowerCase()) && !e.contains(skip)) return { cells: null, unknown: true };
    const painted = getComputedStyle(e);
    const flat = parseColor(painted.backgroundColor);
    if (flat && flat.alpha >= 0.6) return { cells: [flat.rgb], unknown: false };
    if (painted.backgroundImage !== "none") return { cells: null, unknown: true };
  }
  return { cells: footage ? cellsUnder(gridOf(footage.grid), box, [0, 0, 1080, 1920]) : null, unknown: false };
}

/** The vector shapes a scene draws with a stroke: a circle around a word, an underline, a frame, an arrow. */
const MARKS = "path, ellipse, circle, line, polyline, polygon, rect";

/**
 * The marks of a copy lost on what is under them, like its words (a white circle around « EFFETS » on a pale sky
 * could hardly be seen on Tristan's grid of hidden words): a stroke of 1 px or more, without a fill, named by the
 * word it surrounds. One with its own shadow (a drop-shadow filter) reads anywhere.
 */
function marks(copy: HTMLElement, frame: number, backdrop: SceneBackdrop, grids: Map<string, Uint8Array>, found: Map<string, Ink>) {
  const origin = copy.getBoundingClientRect();
  const gridOf = (b64: string) => grids.get(b64) ?? grids.set(b64, decodeGrid(b64)).get(b64)!;
  const footage = (backdrop.frames ?? []).filter((f) => Math.abs(f.frame - frame) <= INK_REACH).sort((a, b) => Math.abs(a.frame - frame) - Math.abs(b.frame - frame))[0];
  for (const el of Array.from(copy.querySelectorAll<SVGGraphicsElement>(MARKS))) {
    if (inDecor(el)) continue;
    const style = getComputedStyle(el);
    const stroke = parseColor(style.stroke);
    if (!stroke || (parseFloat(style.strokeWidth) || 0) < 1) continue;
    const fill = parseColor(style.fill);
    if (fill && fill.alpha >= 0.3) continue;
    const alpha = stroke.alpha * seenOpacity(el, copy) * (Number(style.strokeOpacity) || 1);
    if (alpha < 0.3) continue;
    let shadowed = false;
    for (let up: Element | null = el; up && up !== copy && !shadowed; up = up.parentElement) shadowed = /drop-shadow/.test(getComputedStyle(up).filter);
    if (shadowed) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 && r.height < 6) continue;
    const box: [number, number, number, number] = [r.left - origin.left, r.top - origin.top, r.right - origin.left, r.bottom - origin.top];
    const { cells, unknown } = cellsAt(box, origin, copy, el, backdrop, footage, gridOf);
    if (unknown || !cells) continue;
    const seen = lostOn(stroke.rgb, alpha, cells);
    if (!seen?.lost) continue;
    // Named by the word it surrounds or marks, when there is one.
    const word = Array.from(copy.querySelectorAll<HTMLElement>("*"))
      .filter((e) => e.childElementCount === 0 && /\p{L}{2}/u.test(e.textContent ?? "") && !inDecor(e))
      .find((e) => {
        const t = e.getBoundingClientRect();
        const [cx, cy] = [(t.left + t.right) / 2, (t.top + t.bottom) / 2];
        return cx >= r.left && cx <= r.right && cy >= r.top - 20 && cy <= r.bottom + 20;
      })
      ?.textContent?.replace(/\s+/g, " ")
      .trim();
    const text = word ? `le tracé autour de « ${word.slice(0, 30)} »` : "un tracé";
    const entry = found.get(text) ?? { text, frames: [], ratio: seen.ratio };
    if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
    entry.ratio = Math.min(entry.ratio, seen.ratio);
    found.set(text, entry);
  }
}

/** Rows of the frame the drawing is measured in (20 px each). */
const COVER_ROWS = 96;
/** Elements drawn as shapes (an image, a canvas, a vector shape), whatever their style. */
const SHAPES = new Set(["img", "canvas", "video", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "image", "use"]);
/** A colour's alpha (computed colours are rgb() or rgba()). */
const alpha = (color: string) => (color.startsWith("rgba") ? Number(color.slice(color.lastIndexOf(",") + 1, -1)) : color.startsWith("rgb") ? 1 : 0);

/**
 * What a copy of the scene draws, row by row: the share of the subtitles' width (the safe zone's)
 * covered by its texts, its pictures and its painted shapes. A backdrop over most of the frame does
 * not count: subtitles read on it, as on her footage.
 */
function drawn(copy: HTMLElement, width: number, height: number): number[] {
  const origin = copy.getBoundingClientRect();
  const [left, right] = [SAFE_ZONE.side, width - SAFE_ZONE.side];
  const rows: [number, number][][] = Array.from({ length: COVER_ROWS }, () => []);
  const add = (r: DOMRect) => {
    if (r.width * r.height > width * height * 0.6) return;
    const x0 = Math.max(left, r.left - origin.left);
    const x1 = Math.min(right, r.right - origin.left);
    if (x1 <= x0) return;
    const from = Math.max(0, Math.floor(((r.top - origin.top) / height) * COVER_ROWS));
    const to = Math.min(COVER_ROWS, Math.ceil(((r.bottom - origin.top) / height) * COVER_ROWS));
    for (let i = from; i < to; i++) rows[i]!.push([x0, x1]);
  };
  // Effective opacity, top down: a faded element and all it holds do not count.
  const opacity = new Map<Element, number>();
  const visit = (el: Element, parent: number) => {
    const style = getComputedStyle(el);
    // A decoration is read like a backdrop: subtitles read over it, as over her footage.
    if (style.display === "none" || el.hasAttribute("data-fauve-decor")) return;
    const seen = style.visibility === "hidden" ? 0 : parent * Number(style.opacity);
    if (seen < 0.15) return;
    opacity.set(el, seen);
    const border = ["Top", "Right", "Bottom", "Left"].some((side) => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0) && alpha(style.borderTopColor) > 0.15;
    if (SHAPES.has(el.tagName.toLowerCase()) || alpha(style.backgroundColor) > 0.15 || style.backgroundImage !== "none" || border) add(el.getBoundingClientRect());
    for (const child of Array.from(el.children)) visit(child, seen);
  };
  for (const child of Array.from(copy.children)) visit(child, 1);
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || !node.parentElement || !opacity.has(node.parentElement)) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) if (r.width >= 1 && r.height >= 1) add(r);
  }
  return rows.map((spans) => {
    // The width the spans cover together, overlaps counted once.
    let covered = 0;
    let end = -Infinity;
    for (const [a, b] of spans.sort((p, q) => p[0] - q[0])) {
      if (b <= end) continue;
      covered += b - Math.max(a, end);
      end = b;
    }
    return covered / (right - left);
  });
}

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

/** Words compared as written: spaces of any kind and case aside. */
const plain = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, "").toLowerCase();

/** A word hidden behind her: the frames it is, and how much of it at the worst. */
type Hidden = { text: string; frames: number[]; share: number };

/** Whether `a` is painted under `b` (z-index of their branches under their common ancestor, else their order). */
function paintedUnder(a: Element, b: Element): boolean {
  let common: Element | null = b.parentElement;
  while (common && !common.contains(a)) common = common.parentElement;
  if (!common || a === common) return false;
  const branch = (el: Element) => {
    let x = el;
    while (x.parentElement && x.parentElement !== common) x = x.parentElement;
    return x;
  };
  const ba = branch(a);
  const bb = branch(b);
  const z = (el: Element) => {
    const style = getComputedStyle(el);
    return style.position !== "static" && style.zIndex !== "auto" ? Number(style.zIndex) || 0 : 0;
  };
  if (z(ba) !== z(bb)) return z(ba) < z(bb);
  return Boolean(ba.compareDocumentPosition(bb) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/**
 * The words of a copy laid behind her (painted before a Subject) that her silhouette hides, read from what was
 * tracked in her shot placed in the box she is drawn in: more than HIDDEN_SHARE of a word covered.
 */
function hiddenBehind(copy: HTMLElement, frame: number, track: TrackFn, found: Map<string, Hidden>) {
  const markers = Array.from(copy.querySelectorAll<HTMLElement>("[data-fauve-subject]"));
  if (!markers.length) return;
  const origin = copy.getBoundingClientRect();
  const people = markers.flatMap((marker) => {
    // Her shadow (a faint copy of her, offset): it hides nothing.
    if (seenOpacity(marker, copy) < 0.5) return [];
    const r = marker.getBoundingClientRect();
    const box: PersonBox = { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height };
    const shot = Number(marker.dataset.fauveSubject);
    const seen = box.width > 0 && box.height > 0 && Number.isFinite(shot) ? track(frame, { shot, ...box }) : NOTHING_SEEN;
    const shapes: Shape[] = silhouette(seen, box);
    return shapes.length ? [{ marker, box, shapes }] : [];
  });
  if (!people.length) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    const el = node.parentElement;
    if (!text || !el || isMark(text) || inDecor(node) || seenOpacity(el, copy) < 0.15) continue;
    const behind = people.filter((p) => paintedUnder(el, p.marker));
    if (!behind.length) continue;
    range.selectNodeContents(node);
    let points = 0;
    let covered = 0;
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      const rect = { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
      // Each point counted once, covered when any of the people it is behind covers it.
      const step = 10;
      for (let y = rect.top + step / 2; y < rect.bottom; y += step) {
        for (let x = rect.left + step / 2; x < rect.right; x += step) {
          points++;
          if (behind.some((p) => inBox(p.box, x, y) && p.shapes.some((shape) => inShape(shape, x, y)))) covered++;
        }
      }
    }
    const share = points ? covered / points : 0;
    if (share <= HIDDEN_SHARE) continue;
    const entry = found.get(text) ?? { text, frames: [], share: 0 };
    if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
    entry.share = Math.max(entry.share, share);
    found.set(text, entry);
  }
}

/**
 * The share of the words said (the probe's) a scene writes at their moment: each one looked for in the copies of the
 * frames it is said, and a little after (its phrase held on screen).
 */
function spokenWritten(words: { w: string; from: number; to: number }[], frames: number[], step: number): number {
  const copies = new Map<number, string>();
  document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => copies.set(Number(copy.dataset.checkFrame), (copy.textContent ?? "").toLowerCase()));
  let asked = 0;
  let written = 0;
  for (const word of words) {
    const at = frames.filter((f) => f >= word.from - step && f <= word.to + SPOKEN_HOLD);
    if (!at.length) continue;
    asked++;
    const bare = word.w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (at.some((f) => copies.get(f)?.includes(bare))) written++;
  }
  return asked ? written / asked : 1;
}

/**
 * The Reel's texts a composition does not write: each one is looked for, whole, in the copies of
 * the frames it holds (its words may come one by one, so the fullest copy counts).
 */
function missingTexts(reelTexts: NonNullable<SceneCheckProps["reelTexts"]>, frames: number[]): string[] {
  const copies = new Map<number, string>();
  document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => copies.set(Number(copy.dataset.checkFrame), plain(copy.textContent ?? "")));
  return reelTexts.flatMap((t) => {
    const held = frames.filter((f) => f >= t.from && f < t.to);
    const words = [t.text, ...(t.items ?? []).map((item) => item.title)].map(plain);
    const found = held.some((f) => words.every((w) => copies.get(f)?.includes(w)));
    return held.length && !found ? [`« ${t.text.slice(0, 50)} » (images ${t.from} à ${t.to})`] : [];
  });
}

export function SceneCheck({ js, texts, durationInFrames, brand, photos = [], cuts = [], shots = [], track: pieces, look, fonts = [], reelTexts = [], end = null, backdrop, probeSpoken = false }: SceneCheckProps) {
  const width = 1080;
  const height = 1920;
  const [track] = useState(() => footageTrack(pieces, themeFor(look?.template ?? "libre", look?.signature, look?.tempo), { width, height }, { shots }));
  // The fonts its Reel's texts bring for their own words (a skill's filler picked them) laid out too, as the Reel draws them.
  loadFonts([brand.displayFont, brand.bodyFont, ...fonts, ...reelTexts.flatMap((t) => (t.font ? [t.font] : []))]);
  const [handle] = useState(() => delayRender("scene check", { timeoutInMilliseconds: 60000 }));
  const [Scene] = useState(() => compileScene(js, checkScope(width, height, durationInFrames)));
  // Words said under it, when its code reads them: written by it or not, they are what it is given.
  const [spoken] = useState(() => (probeSpoken ? probeWords(durationInFrames) : []));
  // The probe's words are said in time with a voice: never held to a sentence's reading time nor to a title's size.
  const skip = (text: string) => probeSpoken && onlyProbe(text);
  const step = Math.max(STEP, Math.ceil(durationInFrames / MAX_COPIES));
  const frames: number[] = [];
  for (let f = 0; f < durationInFrames; f += step) frames.push(f);

  useEffect(() => {
    if (!Scene) {
      cancelRender(new Error("Scene introuvable dans le code"));
      return;
    }
    (async () => {
      await fontsLoaded();
      // Let FitText boxes measure their text first.
      for (let i = 0; i < 300 && fitsPending() > 0; i++) await waitFrame();
      await waitFrame();
      const out = new Map<string, Out>();
      const onFace = new Map<string, OnFace>();
      const largest = new Map<string, number>();
      const accents = new Set<string>();
      const lost = new Map<string, Ink>();
      const grids = new Map<string, Uint8Array>();
      const hidden = new Map<string, Hidden>();
      document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => {
        const frame = Number(copy.dataset.checkFrame);
        measure(copy, frame, width, height, out, track(frame), onFace);
        sizes(copy, largest, accents, skip);
        hiddenBehind(copy, frame, track, hidden);
        if (backdrop) {
          inks(copy, frame, backdrop, grids, lost);
          marks(copy, frame, backdrop, grids, lost);
        }
      });
      const failures = [...out.values()].filter((o) => o.frames.length * step > OUT_FRAMES);
      const r = (n: number) => Math.round(n);
      // A composition that draws the whole picture writes every text of the Reel.
      const missing = missingTexts(reelTexts, frames);
      if (!failures.length && missing.length) {
        // Read by smoke.mjs: a text of the Reel the composition does not write, for one more round of its author (it
        // cancelled the check before, a failure smoke.mjs never read: the composition went out without the text).
        console.log(
          `FAUVE_MISSING ${JSON.stringify(`texte du Reel absent : ${missing.slice(0, 3).join(" ; ")}. Ta composition écrit chaque texte de reelTexts pendant son moment (from à to), en entier et tel quel, détails d'un message compris (items).`)}`,
        );
      }
      if (!failures.length) {
        // Read by smoke.mjs: the texts that stay on a face of the footage, for one more round of the motion designer.
        const onFaces = [...onFace.values()].filter((o) => o.frames.length * step > FACE_FRAMES);
        if (onFaces.length) {
          const detail = onFaces
            .slice(0, 3)
            .map((o) => `« ${o.text.slice(0, 40)} » (images ${o.frames[0]} à ${o.frames.at(-1)}, visage de x ${r(o.face[0])} à ${r(o.face[2])}, y ${r(o.face[1])} à ${r(o.face[3])})`)
            .join(" ; ");
          const message = `texte sur un visage de la vidéo : ${detail}. Un texte ne se pose pas sur les yeux, le nez ou la bouche de quelqu'un qu'on voit : lis track(frame).faces et pose-le du côté libre (de l'autre côté de la main, au-dessus de la tête ou plus bas), sans changer l'idée. Sauf si ce que tu poses cache la vidéo à cet endroit (un aplat, une carte : le visage ne se voit plus), ou si l'effet qu'elle a demandé a besoin d'être devant un visage (un mot tenu entre ses doigts, un message posé sur elle comme dans le Reel qu'elle recopie) : alors garde-le.`;
          console.log(`FAUVE_FACE ${JSON.stringify(message)}`);
        }
        const behind = [...hidden.values()].filter((o) => o.frames.length * step > HIDDEN_FRAMES);
        if (behind.length) {
          const detail = behind
            .slice(0, 3)
            .map((o) => `« ${o.text.slice(0, 40)} » (images ${o.frames[0]} à ${o.frames.at(-1)}, caché à ${Math.round(o.share * 100)} %)`)
            .join(" ; ");
          const message = `mot caché derrière la personne : ${detail}. Un mot posé derrière elle (avant Subject) se lit : ${Math.round((1 - HIDDEN_SHARE) * 100)} % de ses lettres au moins se voient à chaque image. Pose-le là où sa silhouette le laisse voir (au-dessus de sa tête, du côté libre : track(frame, box).bodies et .faces, ou SubjectBox, disent où elle est), plus petit ou sur deux lignes s'il le faut ; quand elle remplit l'image (un gros plan), pose-le devant elle (après Subject), loin de son visage. Garde l'idée.`;
          console.log(`FAUVE_HIDDEN ${JSON.stringify(message)}`);
        }
        if (probeSpoken) console.log(`FAUVE_SPOKEN ${spokenWritten(spoken, frames, step).toFixed(2)}`);
        const quick = tooQuick(frames, step, frames.at(-1) ?? 0, skip);
        if (quick.length) {
          const s = (n: number) => n.toFixed(1).replace(".", ",");
          const detail = quick
            .slice(0, 3)
            .map((q) => `« ${q.text.slice(0, 50)} » (dès l'image ${q.from}) reste ${s(q.seconds)} s entière à l'écran, il lui en faut ${s(q.needs)}`)
            .join(" ; ");
          const message = `texte trop rapide pour être lu : ${detail}. Une phrase reste entière à l'écran au moins 0,8 s plus 0,3 s par mot avant de partir (le temps de la lire sur un téléphone) : fais-la arriver plus tôt ou partir plus tard, ou garde moins de phrases, sans changer l'idée.`;
          console.log(`FAUVE_READ ${JSON.stringify(message)}`);
        }
        // An accent is held to its own minimum when a text of the scene reads at the full one.
        const titled = [...largest.entries()].some(([text, size]) => !accents.has(text) && size >= MIN_TYPE - 0.5);
        // Its words only: a separator (« · », « / », « — ») is not one.
        const words = (text: string) => text.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
        const floor = (text: string) => (titled && accents.has(text) && words(text) <= ACCENT_WORDS ? ACCENT_MIN : MIN_TYPE);
        const small = [...largest.entries()].filter(([text, size]) => size < floor(text) - 0.5).sort((a, b) => a[1] - b[1]);
        if (small.length) {
          const detail = small
            .slice(0, 3)
            .map(([text, size]) => `« ${text.slice(0, 40)} » (${r(size)} px)`)
            .join(" ; ");
          const message = `texte trop petit pour un téléphone : ${detail}. Un texte se lit d'un coup d'œil à ${MIN_TYPE} px au moins, sa taille dans l'image de 1080 × 1920 : grossis-le, et s'il n'a pas la place, garde moins de mots ou de lignes, ou prends plus de place dans l'image, sans changer l'idée.`;
          console.log(`FAUVE_SIZE ${JSON.stringify(message)}`);
        }
        const blended = [...lost.values()].filter((o) => o.frames.length * step > INK_FRAMES);
        if (blended.length) {
          const c = (n: number) => n.toFixed(1).replace(".", ",");
          const detail = blended
            .slice(0, 3)
            .map((o) => `${/^(le |un )tracé/.test(o.text) ? o.text : `« ${o.text.slice(0, 40)} »`} (images ${o.frames[0]} à ${o.frames.at(-1)}, contraste ${c(o.ratio)} avec l'image dessous)`)
            .join(" ; ");
          const message = `texte ou tracé qui se perd dans l'image dessous : ${detail}. Un mot ou un tracé (un cercle, un souligné) se voit sur chaque image qu'il croise : donne-lui d'abord un bord fin à lui (une ombre serrée et dense de 1 à 3 px, ou un contour fin ; jamais une grosse ombre floue, qui fait cheap ; pour un tracé SVG, un filtre drop-shadow serré ou un second trait sombre dessous), sinon une autre couleur là où il disparaît, ou pose-le là où l'image le laisse voir, sans changer l'idée ni le style (un trait fin reste fin).`;
          console.log(`FAUVE_INK ${JSON.stringify(message)}`);
        }
        // What it draws, row by row, over its length (each row: the share of the subtitles' width it covers, on average).
        const copies = Array.from(document.querySelectorAll<HTMLElement>("[data-check-frame]")).map((copy) => drawn(copy, width, height));
        const cover = Array.from({ length: COVER_ROWS }, (_, i) => Math.round((copies.reduce((sum, c) => sum + c[i]!, 0) / Math.max(1, copies.length)) * 100) / 100);
        console.log(`FAUVE_COVER ${JSON.stringify(cover)}`);
        return continueRender(handle);
      }
      const detail = failures
        .slice(0, 3)
        .map((o) => `« ${o.text.slice(0, 40)} » (x ${r(o.box[0])} à ${r(o.box[2])}, y ${r(o.box[1])} à ${r(o.box[3])}, images ${o.frames[0]} à ${o.frames.at(-1)})`)
        .join(" ; ");
      cancelRender(
        new Error(
          `texte hors du cadre ou de la zone de sécurité : ${detail}. Chaque texte doit rester entier entre x = ${SAFE_ZONE.edge} et x = ${width - SAFE_ZONE.edge}, entre y = ${SAFE_ZONE.top} et y = ${height * SAFE_ZONE.bottom}, et à gauche de x = ${width - SAFE_ZONE.side} sous y = ${height * SAFE_ZONE.buttons} (les boutons de l'appli), zooms, rebonds et rotations compris (une entrée depuis le bord doit finir en moins de ${(OUT_FRAMES / 30).toFixed(1).replace(".", ",")} s) : mets les textes dans FitText et n'agrandis pas un texte au-delà de sa boîte.`,
        ),
      );
    })().catch((error: unknown) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!Scene) return null;
  return (
    <AbsoluteFill>
      {frames.map((f) => (
        // Stacked copies, one per sampled frame; nothing clips them, so overflow can be measured.
        <div key={f} data-check-frame={f} style={{ position: "absolute", left: 0, top: 0, width, height }}>
          <Catch onError={(error) => cancelRender(new Error(`erreur à l'image ${f} : ${error instanceof Error ? error.message : String(error)}`))}>
            <FrameContext.Provider value={f}>
              <Scene width={width} height={height} fps={30} durationInFrames={durationInFrames} brand={brand} texts={texts} photos={photos} cuts={cuts} shots={shots} track={track} reelTexts={reelTexts} end={end} spoken={spoken} />
            </FrameContext.Provider>
          </Catch>
        </div>
      ))}
    </AbsoluteFill>
  );
}
