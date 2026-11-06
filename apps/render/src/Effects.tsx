import { useId, type CSSProperties, type ReactNode } from "react";
import { Easing, interpolate, random } from "remotion";
import { affineOf, cameraAt, chooseClear, clearRoom, placeClear, readableMap, withCamera, type ClearMap, type ClearOptions } from "./clear";
import type { Box, KitHooks } from "./Kit";
import { objectName, outlinePath } from "./outline";
import { lightIn, readingPlace, regionsIn, shotHeadMoves, skylineIn, vanishIn, type HeadMove, type PictureRegion } from "./reading";
import { coverLayout } from "./Retouch";
import { about, burnsMotion, cameraMotion, faceFocus, framingPercent, punchScale, straightening } from "./track";
import type { ComposeShot } from "./types";

// The effects kit of the animations (lot 7), from Tristan's reference Reels: cinema bars that open and close (and what
// steps out of them in front: Subject laid after), black and white turning to colour, a grade revealed inside a mask
// with its outline and handles as in a grading tool, a glitch on a cut, and annotations (a line or an arrow drawn to
// a label, corner brackets around what matters). Tools, never imposed; drawn from the frame number only, the same in
// the render, the live preview and the scene check.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const settle = Easing.bezier(0.22, 1, 0.36, 1);
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

type Point = { x: number; y: number };
/** A point fixed, or followed frame by frame (a hand, a face read with track). */
type Anchor = Point | ((frame: number) => Point);
const pointAt = (a: Anchor, frame: number): Point => (typeof a === "function" ? a(frame) : a);

// ——— Letterbox ————————————————————————————————————————————————————————————————————————

type LetterboxProps = {
  /** Frame the bars start closing in, and (optionally) the frame they start opening again. */
  at?: number;
  out?: number;
  /** Each bar's height, share of the frame (0.12; 0.5 closes the frame to a line). */
  size?: number;
  /** Frames to come in and to leave (12). */
  frames?: number;
  color?: string;
};

/** Cinema bars that slide in from the top and the bottom, and leave; laid before Subject, she steps out of them in front. */
function LetterboxOf(hooks: KitHooks) {
  return function Letterbox({ at = 0, out, size = 0.12, frames = 12, color = "#000000" }: LetterboxProps) {
    const frame = hooks.useCurrentFrame();
    const { height } = hooks.useVideoConfig();
    const come = interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: settle });
    const go = out === undefined ? 0 : interpolate(frame, [out, out + frames], [0, 1], { ...clamp, easing: settle });
    const h = Math.round(height * Math.min(0.5, size) * come * (1 - go));
    if (h <= 0) return null;
    return (
      <div data-fauve-decor="" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: h, background: color }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h, background: color }} />
      </div>
    );
  };
}

// ——— ColorPop ————————————————————————————————————————————————————————————————————————

type ColorPopProps = {
  /** Frame the colour starts coming back; before it, black and white. */
  at: number;
  /** Frames it takes (14). */
  frames?: number;
  /** How the colour comes: all at once fading in, a wipe from the left, or a circle growing from `origin`. */
  mode?: "fade" | "wipe" | "circle";
  /** Where the circle grows from (px of the frame; the centre by default). */
  origin?: Point;
  /** Back to black and white from this frame (optional). */
  out?: number;
  children: ReactNode;
};

/** What it wraps (her footage) in black and white, then in colour: faded in, wiped, or opening in a circle. */
function ColorPopOf(hooks: KitHooks) {
  return function ColorPop({ at, frames = 14, mode = "fade", origin, out, children }: ColorPopProps) {
    const frame = hooks.useCurrentFrame();
    const { width, height } = hooks.useVideoConfig();
    const come = interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: settle });
    const p = out === undefined ? come : come * (1 - interpolate(frame, [out, out + frames], [0, 1], { ...clamp, easing: settle }));
    // One copy only when it is all one or the other, or when the colour simply fades in.
    if (mode === "fade" || p <= 0 || p >= 1) {
      return <div style={{ position: "absolute", inset: 0, filter: p >= 1 ? undefined : `grayscale(${(1 - p).toFixed(3)})` }}>{children}</div>;
    }
    const o = origin ?? { x: width / 2, y: height / 2 };
    const reach = Math.hypot(Math.max(o.x, width - o.x), Math.max(o.y, height - o.y));
    const clip = mode === "circle" ? `circle(${Math.round(reach * p)}px at ${Math.round(o.x)}px ${Math.round(o.y)}px)` : `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, filter: "grayscale(1)" }}>{children}</div>
        <div style={{ position: "absolute", inset: 0, clipPath: clip }}>{children}</div>
      </div>
    );
  };
}

// ——— MaskReveal ——————————————————————————————————————————————————————————————————————

type MaskStep = { at: number; box: Box };

type MaskRevealProps = {
  /** The mask: its box (px of the frame), or boxes at frames it moves to (it glides from one to the next). */
  box?: Box;
  moves?: MaskStep[];
  shape?: "ellipse" | "rect";
  /** Frame it opens (it grows from its centre), frames to open (12). */
  at?: number;
  frames?: number;
  /** The grade inside and outside, as CSS filters (inside « saturate(1.4) brightness(1.08) », outside « grayscale(1) brightness(0.7) »). */
  inside?: string;
  outside?: string;
  /** Its outline and handles, as a grading tool draws them (true), from this frame until `out`. */
  outline?: boolean;
  color?: string;
  out?: number;
  children: ReactNode;
};

/** Her footage graded one way inside a shape and another outside it, the shape's outline and handles drawn like a colourist's mask. */
function MaskRevealOf(hooks: KitHooks) {
  return function MaskReveal({ box, moves, shape = "ellipse", at = 0, frames = 12, inside = "saturate(1.35) brightness(1.06) contrast(1.05)", outside = "grayscale(1) brightness(0.72)", outline = true, color = "#ffffff", out, children }: MaskRevealProps) {
    const frame = hooks.useCurrentFrame();
    const { width, height } = hooks.useVideoConfig();
    const id = safeId(useId());
    const steps = moves?.length ? [...moves].sort((a, b) => a.at - b.at) : [{ at, box: box ?? { x: width * 0.2, y: height * 0.3, w: width * 0.6, h: height * 0.3 } }];
    // Where it is now: between the two steps around this frame.
    const next = steps.findIndex((s) => s.at > frame);
    const a = steps[Math.max(0, (next < 0 ? steps.length : next) - 1)]!;
    const b = next < 0 ? a : steps[next]!;
    const t = b === a ? 1 : interpolate(frame, [a.at, b.at], [0, 1], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
    const lerp = (k: keyof Box) => a.box[k] + (b.box[k] - a.box[k]) * t;
    const grow = interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: settle });
    const leave = out === undefined ? 0 : interpolate(frame, [out, out + frames], [0, 1], clamp);
    const open = grow * (1 - leave);
    const cx = lerp("x") + lerp("w") / 2;
    const cy = lerp("y") + lerp("h") / 2;
    const w = lerp("w") * open;
    const h = lerp("h") * open;
    const clip = shape === "ellipse" ? `ellipse(${Math.round(w / 2)}px ${Math.round(h / 2)}px at ${Math.round(cx)}px ${Math.round(cy)}px)` : `inset(${Math.round(cy - h / 2)}px ${Math.round(width - cx - w / 2)}px ${Math.round(height - cy - h / 2)}px ${Math.round(cx - w / 2)}px)`;
    const handles = shape === "ellipse" ? [[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]] : [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, filter: frame >= at && open > 0 ? outside : undefined }}>{children}</div>
        {open > 0 ? (
          <div style={{ position: "absolute", inset: 0, clipPath: clip, filter: inside }}>{children}</div>
        ) : null}
        {outline && open > 0.02 ? (
          <svg data-fauve-decor="" width={width} height={height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }} aria-hidden="true">
            <defs>
              <filter id={`s${id}`}>
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.45" />
              </filter>
            </defs>
            <g filter={`url(#s${id})`} stroke={color} fill="none" strokeWidth={3}>
              {shape === "ellipse" ? <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} /> : <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} />}
              <circle cx={cx} cy={cy} r={7} fill={color} />
              {handles.map(([x, y], i) => (
                <rect key={i} x={x! - 8} y={y! - 8} width={16} height={16} fill="#00000055" />
              ))}
            </g>
          </svg>
        ) : null}
      </div>
    );
  };
}

// ——— Glitch ——————————————————————————————————————————————————————————————————————————

type GlitchProps = {
  /** Frame(s) it glitches (a cut), and for how many frames (6). */
  at: number | number[];
  frames?: number;
  /** How far it tears (1). */
  strength?: number;
  children: ReactNode;
};

/** A glitch on a cut: the colours split apart and bands of the picture slide sideways, for a few frames. Only when asked for or copied. */
function GlitchOf(hooks: KitHooks) {
  return function Glitch({ at, frames = 6, strength = 1, children }: GlitchProps) {
    const frame = hooks.useCurrentFrame();
    const { width, height } = hooks.useVideoConfig();
    const id = safeId(useId());
    const hit = (Array.isArray(at) ? at : [at]).find((a) => frame >= a && frame < a + frames);
    if (hit === undefined) return <div style={{ position: "absolute", inset: 0 }}>{children}</div>;
    // Strongest in the middle of its frames, its tears drawn anew each frame (seeded: the same on every render).
    const k = Math.sin(((frame - hit + 0.5) / frames) * Math.PI) * strength;
    const split = Math.round(18 * k);
    const bands = Array.from({ length: 5 }, (_, i) => {
      const y = random(`glitch-y-${hit}-${frame}-${i}`) * height;
      const h = 20 + random(`glitch-h-${hit}-${frame}-${i}`) * 120;
      const dx = (random(`glitch-x-${hit}-${frame}-${i}`) - 0.5) * 160 * k;
      return { y, h, dx };
    });
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <filter id={`g${id}`} x="-5%" y="0" width="110%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={split} result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feOffset in="gb" dx={-split} result="gbo" />
            <feBlend in="ro" in2="gbo" mode="screen" />
          </filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, filter: `url(#g${id})` }}>{children}</div>
        {bands.map((b, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, clipPath: `inset(${Math.round(b.y)}px 0 ${Math.max(0, Math.round(height - b.y - b.h))}px 0)`, transform: `translateX(${Math.round(b.dx)}px)` }}>
            <div style={{ position: "absolute", inset: 0, width, height }}>{children}</div>
          </div>
        ))}
      </div>
    );
  };
}

// ——— Annotations: Callout and Brackets ———————————————————————————————————————————————————

type CalloutProps = {
  /** What it points at (px of the frame, or followed frame by frame), and where its label sits. */
  from: Anchor;
  to: Point;
  label?: string;
  /** Frame it starts drawing, frames to draw (14), frame it goes (optional). */
  at?: number;
  frames?: number;
  out?: number;
  /** An arrow at what it points at, a dot, or a plain line. */
  kind?: "arrow" | "dot" | "line";
  /** How much the line bends (0 straight, 0.25 a gentle curve). */
  curve?: number;
  color?: string;
  width?: number;
  /** The label's type (a mono label by default). */
  labelStyle?: CSSProperties;
};

/** A line (or an arrow) drawn from what matters to its label, like a hand annotating a picture; it can follow a hand or a face. */
function CalloutOf(hooks: KitHooks) {
  return function Callout({ from, to, label, at = 0, frames = 14, out, kind = "arrow", curve = 0.18, color = "#ffffff", width = 4, labelStyle }: CalloutProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at || (out !== undefined && frame >= out + 8)) return null;
    const fade = out === undefined ? 1 : 1 - interpolate(frame, [out, out + 8], [0, 1], clamp);
    const p = interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: settle });
    const a = pointAt(from, frame);
    const dx = to.x - a.x;
    const dy = to.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // The control point, off to one side of the middle.
    const c = { x: (a.x + to.x) / 2 - dy * curve, y: (a.y + to.y) / 2 + dx * curve };
    const path = `M ${to.x} ${to.y} Q ${c.x} ${c.y} ${a.x} ${a.y}`;
    const total = len * (1 + curve * curve * 1.4);
    // The head at what it points at, along the last bit of the curve.
    const ang = Math.atan2(a.y - c.y, a.x - c.x);
    const head = 22 + width * 2;
    const tip = (s: number) => `${a.x - Math.cos(ang + s) * head},${a.y - Math.sin(ang + s) * head}`;
    const labelIn = interpolate(frame, [at + frames * 0.6, at + frames], [0, 1], clamp);
    // Its line is decoration; its label is a word to read, checked as a small label (data-fauve-accent): it escaped every check.
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: fade }}>
        <svg data-fauve-decor="" width={video.width} height={video.height} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden="true">
          <path d={path} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={total} strokeDashoffset={total * (1 - p)} />
          {p >= 0.98 && kind === "arrow" ? <polyline points={`${tip(0.45)} ${a.x},${a.y} ${tip(-0.45)}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {p >= 0.98 && kind === "dot" ? <circle cx={a.x} cy={a.y} r={width * 2.5} fill={color} /> : null}
        </svg>
        {label ? (
          <div
            data-fauve-accent=""
            style={{
              position: "absolute",
              left: to.x,
              top: to.y,
              transform: `translate(${dx > 0 ? "-100%" : "0"}, -50%) translateY(${((1 - labelIn) * 12).toFixed(1)}px)`,
              padding: dx > 0 ? "0 14px 0 0" : "0 0 0 14px",
              opacity: labelIn,
              whiteSpace: "nowrap",
              color,
              fontFamily: "'IBM Plex Mono', 'Space Mono', monospace",
              fontSize: 30,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              ...labelStyle,
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    );
  };
}

type BracketsProps = {
  /** What it frames (px of the frame, or followed frame by frame: a box around a hand, a face, her). */
  box: Box | ((frame: number) => Box);
  at?: number;
  frames?: number;
  out?: number;
  /** Each corner's arm (share of the box's smaller side, 0.22). */
  arm?: number;
  color?: string;
  width?: number;
  /** A small label on the top left corner. */
  label?: string;
};

/** Corner brackets drawn around what matters (a product, a face), closing in from a little wider; they can follow it. */
function BracketsOf(hooks: KitHooks) {
  return function Brackets({ box, at = 0, frames = 10, out, arm = 0.22, color = "#ffffff", width = 4, label }: BracketsProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at || (out !== undefined && frame >= out)) return null;
    const b = typeof box === "function" ? box(frame) : box;
    const p = interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: settle });
    const pad = (1 - p) * 40;
    const [x0, y0, x1, y1] = [b.x - pad, b.y - pad, b.x + b.w + pad, b.y + b.h + pad];
    const l = Math.min(b.w, b.h) * arm;
    const corners = [
      `M ${x0} ${y0 + l} L ${x0} ${y0} L ${x0 + l} ${y0}`,
      `M ${x1 - l} ${y0} L ${x1} ${y0} L ${x1} ${y0 + l}`,
      `M ${x1} ${y1 - l} L ${x1} ${y1} L ${x1 - l} ${y1}`,
      `M ${x0 + l} ${y1} L ${x0} ${y1} L ${x0} ${y1 - l}`,
    ];
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: p }}>
        <svg data-fauve-decor="" width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden="true">
          {corners.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="square" />
          ))}
        </svg>
        {label ? (
          <div data-fauve-accent="" style={{ position: "absolute", left: x0, top: y0 - 44, color, fontFamily: "'IBM Plex Mono', 'Space Mono', monospace", fontSize: 26, letterSpacing: "0.08em", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>{label}</div>
        ) : null}
      </div>
    );
  };
}

// ——— SubjectBox: where her subject is, image by image ———————————————————————————————————

type Laid = { left: number; top: number; width: number; height: number };

/**
 * Where a shot's picture lies in the box it was laid in at a frame of the composition, exactly as the Reel draws it
 * there: a video covering the box (anchored on its subject, its faces kept whole) and straightened, a photo framed and
 * straightened as Photo draws it (its retouch's zoom and focus), then the camera's move the Reel gives it (`camera`: a
 * slow push or pan, a photo's slow zoom, the punch on its cut), about the box's centre. A point in shares of the
 * picture → px.
 */
function placer(shot: ComposeShot, laid?: Laid, frame = 0) {
  const L = laid ?? { left: 0, top: 0, width: 1080, height: 1920 };
  const frameAspect = L.width / L.height;
  const camera = shot.camera;
  // The shot's own frame (its camera move runs over its length; before and after, it holds its first or last image).
  const t = Math.max(0, Math.min(Math.max(0, shot.durationInFrames - 1), Math.round(frame - shot.from)));
  let base: (x: number, y: number) => { x: number; y: number };
  let grow = 1;
  let dw: number;
  let dh: number;
  if (shot.kind === "photo" && shot.edit) {
    // As Photo: the picture laid out to cover the box (its zoom, its focus), turned about the box's centre.
    const layout = coverLayout({ width: L.width, height: L.height }, shot.edit.source, shot.edit.adjust);
    const degrees = shot.edit.adjust?.straighten ?? 0;
    base = (x, y) => about({ x: layout.left + x * layout.width, y: layout.top + y * layout.height }, L.width, L.height, 1, degrees);
    dw = layout.width;
    dh = layout.height;
  } else {
    const A = shot.aspect || frameAspect;
    dw = A > frameAspect ? L.height * A : L.width;
    dh = A > frameAspect ? L.height : L.width / A;
    const [px, py] = framingPercent(faceFocus(shot.focus, shot.face, A, frameAspect), A, frameAspect) ?? [50, 50];
    const ox = ((dw - L.width) * px) / 100;
    const oy = ((dh - L.height) * py) / 100;
    const straight = straightening(camera?.straighten, frameAspect);
    base = (x, y) => {
      const p = { x: -ox + x * dw, y: -oy + y * dh };
      return straight ? about(p, L.width, L.height, straight.scale, straight.degrees) : p;
    };
    if (straight) grow *= straight.scale;
  }
  const move = camera?.move && camera.move !== "none" ? cameraMotion(camera.move, t, shot.durationInFrames, camera) : camera?.burns ? burnsMotion(camera.burns, t, shot.durationInFrames) : undefined;
  const punch = camera?.accent === "punch" ? punchScale(t) : 1;
  if (move) grow *= move.scale;
  grow *= punch;
  const at = (x: number, y: number) => {
    let p = base(x, y);
    if (move) p = about(p, L.width, L.height, move.scale, 0, (move.shift ?? 0) / 100);
    if (punch !== 1) p = about(p, L.width, L.height, punch);
    return [L.left + p.x, L.top + p.y] as const;
  };
  return { at, dw: dw * grow, dh: dh * grow };
}

/** A shot's reading at a frame of the composition: the nearest image that has one (a frame or two without does not make it jump), within 6. */
function nearest<T>(list: (T | null)[] | undefined, shot: ComposeShot, frame: number): T | null {
  if (!list?.length) return null;
  const t = Math.max(0, Math.min(list.length - 1, Math.round(frame - shot.from)));
  for (let d = 0; d <= 6; d++) {
    const v = list[t - d] ?? list[t + d] ?? null;
    if (v) return v;
  }
  return null;
}

/**
 * Where a shot's subject (a person, a product, a ball: what its cut-out keeps) is at a frame of the composition, in the
 * box the shot was laid in with Footage ({ left, top, width, height }, the whole frame by default), as Footage frames
 * it (cover, on its subject, its faces kept whole): { x, y, w, h } in px, or null when nothing is cut out there. Labels,
 * brackets and words follow it; a shot whose cut-out is missing gives null (the animation keeps its default place).
 */
export function SubjectBox(shot: ComposeShot | undefined, frame: number, laid?: Laid, object?: string): Box | null {
  if (!shot) return null;
  const b = nearest(object ? shot.objects?.[objectName(object)]?.boxes : shot.subjectBoxes, shot, frame);
  if (!b) return null;
  // Its four corners where the Reel draws them at this frame (a turned picture: the box around them).
  const { at } = placer(shot, laid, frame);
  const corners = [at(b[0]!, b[1]!), at(b[0]! + b[2]!, b[1]!), at(b[0]!, b[1]! + b[3]!), at(b[0]! + b[2]!, b[1]! + b[3]!)];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * The pieces of an object followed through a shot at a frame of the composition (the letters of a sign, the bulbs of a
 * garland, each window of « every window »), in reading order, in the box the shot was laid in, as Footage frames it:
 * { x, y, w, h } px each, placed on the object's box at that frame, so they light up one by one where they are. An
 * object in one piece (a board, a shop window) is cut in `slices` equal pieces along its length instead (none: no
 * pieces); nothing when it was not followed there (the animation does without). A piece whose own outline the card
 * read (each element of a shop front on a still read, two windows that overlap) also gives it, `d`: an SVG path (px).
 */
export function SubjectParts(shot: ComposeShot | undefined, frame: number, laid?: Laid, object?: string, slices = 0): (Box & { d?: string })[] {
  if (!shot || !object) return [];
  const o = shot.objects?.[objectName(object)];
  const b = nearest(o?.boxes, shot, frame);
  if (!b) return [];
  const flat = o?.parts && o.parts.length >= 8 ? o.parts : null;
  const n = flat ? Math.min(24, Math.floor(flat.length / 4)) : Math.max(0, Math.min(24, Math.round(slices)));
  if (!n) return [];
  // In one piece: slices along its longer side (on the picture, its width and height in the same unit).
  const along = b[2]! * (shot.aspect || 9 / 16) >= b[3]!;
  const { at } = placer(shot, laid, frame);
  const out: (Box & { d?: string })[] = [];
  for (let i = 0; i < n; i++) {
    // Its own outline, when read.
    const own = flat ? o?.pieces?.[i] : null;
    const c = own?.length ? nearest(own, shot, frame) : null;
    const d = c ? outlinePath(c, at) : null;
    const [rx, ry, rw, rh] = flat ? [flat[i * 4]!, flat[i * 4 + 1]!, flat[i * 4 + 2]!, flat[i * 4 + 3]!] : along ? [i / n, 0, 1 / n, 1] : [0, i / n, 1, 1 / n];
    const x0 = b[0]! + rx * b[2]!;
    const y0 = b[1]! + ry * b[3]!;
    const x1 = x0 + rw * b[2]!;
    const y1 = y0 + rh * b[3]!;
    const corners = [at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1)];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    out.push({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, ...(d ? { d } : {}) });
  }
  return out;
}

/**
 * One piece of an object followed through a shot (the k-th of SubjectParts, in reading order) where the shot is laid:
 * its own outline at that frame when the card read its pieces apart (two towers or two gondolas that overlap, each its
 * own; `pieces` of the reading), else its box (picture kit, `Subject part`). `local`: in the laid box's own px instead
 * of the frame's. Null when it is not there.
 */
export function SubjectPiece(shot: ComposeShot | undefined, frame: number, laid: Laid | undefined, object: string | undefined, k: number, slices = 0, local = false): { path: string } | { box: Box } | null {
  if (!shot || !object || !Number.isFinite(k)) return null;
  const L = laid ?? { left: 0, top: 0, width: 1080, height: 1920 };
  const dx = local ? L.left : 0;
  const dy = local ? L.top : 0;
  const own = shot.objects?.[objectName(object)]?.pieces?.[Math.round(k)];
  const c = own?.length ? nearest(own, shot, frame) : null;
  if (c) {
    const { at } = placer(shot, L, frame);
    const d = outlinePath(c, (x, y) => {
      const p = at(x, y);
      return [p[0] - dx, p[1] - dy] as const;
    });
    if (d) return { path: d };
  }
  const box = SubjectParts(shot, frame, L, object, slices)[Math.round(k)];
  return box ? { box: { ...box, x: box.x - dx, y: box.y - dy } } : null;
}

// ——— ClearBox: where a text can be set in her shot ———————————————————————————————————————————

/** The areas chosen, by a shot's grid and the way it is laid and asked for: chosen once, the same at every frame. */
const chosenAreas = new WeakMap<ClearMap, Map<string, Box | null>>();

/**
 * The largest clear area of a shot to set a text in, at a frame of the composition, in the box the shot was laid in
 * with Footage ({ left, top, width, height }, the whole frame by default): its sky first (calm and open to the top of
 * the picture), else an empty wall or any calm, even area, read on its images before the render; { x, y, w, h } px,
 * the same place of the scene for the whole shot, moving with its camera (a pan, a push, the Reel's punch), inside the
 * box and the Reel's safe zone at every image, off her faces. `aspect` (width / height) the shape wanted, `min` and
 * `max` its sizes (px), `prefer` "top" (default), "bottom" or "any", `sky: false` any calm area alike, `pad` the px kept
 * clear around it, `within` where it may lie instead of the safe zone (`origin`: where the box's space starts on the
 * frame). `fallback` (the box to use when there is none: no grid read, none large enough, the scene check) is returned
 * as it is, else null.
 */
export function ClearBox(shot: ComposeShot | undefined, frame: number, laid?: Laid, options?: ClearOptions & { fallback?: Box | null }): Box | null {
  const { fallback = null, ...asked } = options ?? {};
  const map = shot?.clear;
  if (!shot || !readableMap(map)) return fallback;
  const L = laid ?? { left: 0, top: 0, width: 1080, height: 1920 };
  const n = Math.max(1, Math.round(shot.durationInFrames));
  // Shares of the passage's first image → px of the composition at image t of the shot: the camera, then the Reel's drawing.
  const project = (t: number) => withCamera(affineOf(placer(shot, L, shot.from + t).at), cameraAt(map, t));
  const key = JSON.stringify([L, asked, shot.from, n, shot.kind, shot.aspect, shot.focus, shot.face, shot.camera, shot.edit?.adjust, shot.edit?.source]);
  let areas = chosenAreas.get(map);
  if (!areas) chosenAreas.set(map, (areas = new Map()));
  if (!areas.has(key)) areas.set(key, chooseClear(map, project, n, clearRoom(L, asked.within, asked.origin), { ...asked, avoid: shot.face ? [shot.face] : [] }));
  const area = areas.get(key);
  return area ? placeClear(area, project(Math.max(0, Math.min(n - 1, Math.round(frame - shot.from))))) : fallback;
}

// ——— What else is read on her shot: its skyline, its vanishing point, its light, her head's moves ————————————————————

/** Where a shot's reading falls at a frame of the composition: the shot's own image there, its camera's move, the Reel's drawing in the box. */
function readPlace(shot: ComposeShot, frame: number, laid?: Laid) {
  const L = laid ?? { left: 0, top: 0, width: 1080, height: 1920 };
  const t = Math.max(0, Math.min(Math.max(0, Math.round(shot.durationInFrames) - 1), Math.round(frame - shot.from)));
  return readingPlace(shot.read ?? {}, affineOf(placer(shot, L, shot.from + t).at), t);
}

/**
 * Where her shot's sky ends at a frame of the composition, in the box it was laid in with Footage (the whole frame by
 * default): the y (px) of the top of the highest thing that stands under its sky between `from` and `to` (px of the
 * same space; the whole box by default): a roof, a hill, her head; never a wire, a pole or a mast (the reading leaves
 * them out, so a title's foot sits under the roofs, a pole passing through it). It moves with the camera. Null when the
 * shot has no sky or was not read (a passage at another speed, the scene check): keep a place of your own.
 */
export function SkylineAt(shot: ComposeShot | undefined, frame: number, laid?: Laid, span?: { from?: number; to?: number }): number | null {
  if (!shot?.read) return null;
  return skylineIn(shot.read, readPlace(shot, frame, laid), span?.from ?? -Infinity, span?.to ?? Infinity);
}

/**
 * Where the lines of her shot run to at a frame of the composition (the end of a street, of a corridor, of a pier, the
 * middle of a hall), in the box it was laid in: { x, y } px, moving with the camera, maybe a little outside the box;
 * `least` how sure it must be (0 to 1, 0.25 by default); `fallback` (another point: an object's box centre, the middle)
 * when its lines run nowhere (a facade seen from the front, a field) or it was not read, else null.
 */
export function VanishingPoint(shot: ComposeShot | undefined, frame: number, laid?: Laid, options?: { least?: number; fallback?: { x: number; y: number } | null }): { x: number; y: number } | null {
  const fallback = options?.fallback ?? null;
  if (!shot?.read) return fallback;
  return vanishIn(shot.read, readPlace(shot, frame, laid), options?.least ?? 0.25) ?? fallback;
}

/**
 * How bright her shot is under a box at a frame of the composition, over its passage: { mean, high } from 0 (black) to 1
 * (white), its mean light there and that of its brightest tenth, read on its images (a wall lit by the sun, a dark
 * corner); `box` in px of the space the shot was laid in (none: the whole shot as laid). A shadow only where it is
 * bright, a veil as dark as the picture needs. Null when it was not read: keep a dose of your own.
 */
export function LightUnder(shot: ComposeShot | undefined, frame: number, laid?: Laid, box?: Box | null): { mean: number; high: number } | null {
  if (!shot?.read) return null;
  return lightIn(shot.read, readPlace(shot, frame, laid), box, laid ?? { left: 0, top: 0, width: 1080, height: 1920 });
}

/**
 * Her shot's picture split along its own edges (read on its first image, by colour: a wall, a door's frame, a plinth,
 * the pavement, the sky, a poster), each region where the Reel draws it at a frame of the composition, in the box it
 * was laid in, largest first: { d, x, y, w, h } px (`d` its outline as an SVG path, straight sides), together covering
 * the picture. To build or reveal her picture piece by piece along its own shapes, never boxes; empty when it was not
 * read (the scene check, a shot not read): keep shapes of your own.
 */
export function PictureRegions(shot: ComposeShot | undefined, frame: number, laid?: Laid): PictureRegion[] {
  if (!shot?.read?.regions?.length) return [];
  return regionsIn(shot.read, readPlace(shot, frame, laid));
}

/**
 * What her head does in one of her video shots, measured on what the tracker saw (her ears, her nose): `down` it lowers,
 * `up` it rises, `left` or `right` it turns toward that side of the picture; each { from, to, what } in frames of the
 * composition, in order. Empty when nobody was followed there: time your effect on the shot's own moments then.
 */
export function HeadMoves(shot: ComposeShot | undefined): HeadMove[] {
  return shotHeadMoves(shot);
}

// ——— Outline: a line along her edge ——————————————————————————————————————————————————————

/**
 * Her subject's outline at a frame (a person, a product she holds: what its cut-out keeps), in the box its shot was
 * laid in, as an SVG path (px), smooth through its points, open where the picture's edge cuts her; null when it was not
 * cut out there. Draw it yourself (a glow, a double line, a fill) or with Outline.
 */
export function SubjectOutline(shot: ComposeShot | undefined, frame: number, laid?: Laid, object?: string): string | null {
  if (!shot) return null;
  const c = nearest(object ? shot.objects?.[objectName(object)]?.contours : shot.subjectContours, shot, frame);
  return c ? outlinePath(c, placer(shot, laid, frame).at) : null;
}

type OutlineProps = {
  /** The shot (shots[i]) and the box it was laid in with Footage (the whole frame by default). */
  shot: ComposeShot | undefined;
  box?: Laid;
  /** An object followed through the shot instead of her (a cup she lifts), by the name its code gives it. */
  object?: string;
  /** Frame it starts to draw itself along her edge (from the top of her head, clockwise), frames to go round (18; 0: there at once). */
  at?: number;
  frames?: number;
  /** Frame it fades out. */
  out?: number;
  color?: string;
  /** Its thickness (px, 6). Laid before Subject, only its outer half shows: a line just outside her. */
  width?: number;
  /** A dashed line that runs round her, a soft glow of the same colour around it. */
  dash?: boolean;
  glow?: boolean;
};

function OutlineOf(hooks: KitHooks) {
  return function Outline({ shot, box, object, at = 0, frames = 18, out, color = "#FFFFFF", width = 6, dash, glow }: OutlineProps) {
    const frame = hooks.useCurrentFrame();
    const { width: W, height: H } = hooks.useVideoConfig();
    const d = SubjectOutline(shot, frame, box, object);
    if (!d) return null;
    const drawn = frames > 0 ? interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: settle }) : frame >= at ? 1 : 0;
    const gone = out === undefined ? 1 : 1 - interpolate(frame, [out, out + 10], [0, 1], clamp);
    if (drawn <= 0 || gone <= 0) return null;
    // pathLength 1: the drawn share of the way round, then dashes measured on it.
    const dashes = dash ? { strokeDasharray: "0.018 0.012", strokeDashoffset: -((frame * 0.004) % 0.03) } : { strokeDasharray: `${drawn} 1`, strokeDashoffset: 0 };
    // Nothing outside the box its shot was laid in (its Footage shows nothing there either).
    const clipPath = box ? `inset(${Math.round(box.top)}px ${Math.round(W - box.left - box.width)}px ${Math.round(H - box.top - box.height)}px ${Math.round(box.left)}px)` : undefined;
    return (
      <div data-fauve-decor="" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: gone * (dash ? drawn : 1), clipPath }}>
        <svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden="true">
          {glow ? <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width * 3} strokeLinejoin="round" strokeLinecap="round" opacity={0.35} style={{ filter: `blur(${Math.round(width * 1.5)}px)` }} {...dashes} /> : null}
          <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" {...dashes} />
        </svg>
      </div>
    );
  };
}

/** The effects kit, bound to a clock (the render's, or the scene check's own for each copy). */
export function makeEffects(hooks: KitHooks) {
  return {
    Letterbox: LetterboxOf(hooks),
    ColorPop: ColorPopOf(hooks),
    MaskReveal: MaskRevealOf(hooks),
    Glitch: GlitchOf(hooks),
    Callout: CalloutOf(hooks),
    Brackets: BracketsOf(hooks),
    Outline: OutlineOf(hooks),
  };
}
