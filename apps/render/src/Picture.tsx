import React, { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { continueRender, delayRender } from "remotion";
import type { Box, Draw, KitHooks, Size } from "./Kit";
import {
  burnSteps,
  cellRamp,
  dotOrder,
  echoCopies,
  edgeFade,
  glyphTile,
  lumaMatrix,
  lumaProgress,
  punchCopies,
  rgbOf,
  shadowPose,
  starPath,
  starRays,
  tileImage,
  type BurnFrom,
  type BurnStep,
  type DotBuild,
  type Ray,
} from "./picture-kit";

// The picture kit of the animations: image effects the models' fiches measured on their originals and found missing
// (docs/animations.md, « Kit d'image »), written once so any skill and the motion designer lay them instead of coding
// them again: a film burn, a lens's edges, a whip blur and a punch zoom inside one shot, a star of windows onto one
// shot, a fade by light, an echo, a pass in characters, a cut-out's shadow, a dot grid. Each draws what it is given
// (a node, or a function of its size or of the frame), from the frame number alone: the same in the render, the live
// preview and the scene check. Cheap: blend modes, a backdrop's colour filter, light SVG filters (no blur but a
// streak's or a shadow's), never a filter heavier than the look needs.

const drawAt = (d: Draw, size: Size): ReactNode => (typeof d === "function" ? (d as (s: Size) => ReactNode)(size) : d);
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
type Point = { x: number; y: number };

// ——— Burn ——————————————————————————————————————————————————————————————————————————————

type BurnProps = {
  /** The cut(s) it burns over: its light is strongest just before, its new shot still washed on its first image. */
  at: number | number[];
  /** Where its light comes in from, its colour, the paler one it washes the picture with at its peak. */
  from?: BurnFrom;
  color?: string;
  wash?: string;
  /** Images of light before the cut (4) and of its rest after it (1), and how strong (1). */
  before?: number;
  after?: number;
  strength?: number;
  /** Its images by hand, instead: [offset from the cut, a CSS background laid in screen, its opacity, a filter on what is under it]. */
  steps?: BurnStep[];
};

/** A film burn: coloured light laid in screen over what is under it, image by image around a cut, from a side or a corner. */
function BurnOf(hooks: KitHooks) {
  return function Burn({ at, steps, ...shape }: BurnProps) {
    const frame = hooks.useCurrentFrame();
    const list = steps?.length ? steps : burnSteps(shape);
    const lit = (Array.isArray(at) ? at : [at]).filter((c) => Number.isFinite(c)).flatMap((c) => list.filter((s) => frame === c + s[0]));
    if (!lit.length) return null;
    return (
      <>
        {lit.map((s, i) => (
          <React.Fragment key={i}>
            {s[3] ? <div style={{ ...layer, backdropFilter: s[3], WebkitBackdropFilter: s[3] }} /> : null}
            <div style={{ ...layer, background: s[1], mixBlendMode: "screen", opacity: s[2] }} />
          </React.Fragment>
        ))}
      </>
    );
  };
}

// ——— LensEdges ————————————————————————————————————————————————————————————————————————————

type LensEdgesProps = {
  /** What it shows (her shot, a whole composition), drawn at the frame's size; drawn once more in each edge. */
  children: Draw;
  /** y: the top and the bottom of the frame (a shot in width turned a quarter, as « Quart de tour »); x: its sides. */
  axis?: "y" | "x";
  /** Each edge's band, a share of the frame (0.25): full over its first third, fading to nothing at its end. */
  size?: number;
  /** How far apart its green and magenta are at the frame's edge (px; one number, or the first edge's and the second's). */
  split?: number | [number, number];
  /** Its streak along the axis (px of blur, 2), and the px at the very edge left to the picture (8). */
  streak?: number;
  hold?: number;
};

/**
 * The edges of an anamorphic lens: near two edges of the frame the picture streaks along them and splits green and
 * magenta, the magenta outward; the middle stays sharp (« Quart de tour, deux tons », docs/fiches/tourne.md, effect 7).
 * Laid over a picture in two tones too: its split adds the colour.
 */
function LensEdgesOf(hooks: KitHooks) {
  return function LensEdges({ children, axis = "y", size = 0.25, split = 6, streak = 2, hold = 8 }: LensEdgesProps) {
    const { width: W, height: H } = hooks.useVideoConfig();
    const id = safeId(useId());
    const full = { width: W, height: H };
    const [first, second] = Array.isArray(split) ? split : [split, split];
    const vertical = axis !== "x";
    const band = Math.round((vertical ? H : W) * Math.max(0.02, Math.min(0.5, size)));
    const sides = (vertical ? ["top", "bottom"] : ["left", "right"]) as ("top" | "bottom" | "left" | "right")[];
    // The magenta copy moved outward, the green inward, by half the split each.
    const filter = (side: string, out: number) => (
      <filter key={side} id={`${id}-${side}`} colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation={vertical ? `0 ${streak}` : `${streak} 0`} result="streak" />
        <feColorMatrix in="streak" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="magenta" />
        <feOffset in="magenta" dx={vertical ? 0 : out} dy={vertical ? out : 0} result="m" />
        <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="green" />
        <feOffset in="green" dx={vertical ? 0 : -out} dy={vertical ? -out : 0} result="g" />
        <feBlend in="m" in2="g" mode="screen" />
      </filter>
    );
    const edge = (side: (typeof sides)[number], k: number) => {
      const start = k === 0;
      const box: CSSProperties = vertical
        ? { position: "absolute", left: 0, top: start ? 0 : H - band, width: W, height: band }
        : { position: "absolute", top: 0, left: start ? 0 : W - band, height: H, width: band };
      const inner: CSSProperties = vertical ? { position: "absolute", left: 0, top: start ? 0 : band - H, width: W, height: H } : { position: "absolute", top: 0, left: start ? 0 : band - W, width: W, height: H };
      const mask = edgeFade(side, hold);
      return (
        <div key={side} data-fauve-decor="" aria-hidden="true" style={{ ...box, overflow: "hidden", filter: `url(#${id}-${side})`, WebkitMaskImage: mask, maskImage: mask }}>
          <div style={inner}>{drawAt(children, full)}</div>
        </div>
      );
    };
    return (
      <>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <defs>{[filter(sides[0]!, -first / 2), filter(sides[1]!, second / 2)]}</defs>
        </svg>
        {drawAt(children, full)}
        {sides.map(edge)}
      </>
    );
  };
}

// ——— Smear and Punch ——————————————————————————————————————————————————————————————————————

type SmearProps = {
  /** Her shot (drawn at the frame's size). */
  children: Draw;
  /** From frame `at`, over `frames` images, it slides along `direction` as it streaks; or where it is (`progress`, 0 to 1) at this frame. */
  at?: number;
  frames?: number;
  progress?: number;
  direction?: "up" | "down" | "left" | "right";
  /** Its streak (px of blur along the direction, 46), how far it slides (a share of the frame, 0.12), how much it is enlarged so it always covers (1.3). */
  blur?: number;
  travel?: number;
  scale?: number;
};

/**
 * A whip blur inside one shot (a filé): her picture smeared along a direction and sliding, as a camera swept fast
 * (« Quart de tour », docs/fiches/tourne.md, effect 5); before and after its frames, the shot as it is. Whip goes from
 * one shot to another; this is one shot swept.
 */
function SmearOf(hooks: KitHooks) {
  return function Smear({ children, at = 0, frames = 6, progress, direction = "up", blur = 46, travel = 0.12, scale = 1.3 }: SmearProps) {
    const frame = hooks.useCurrentFrame();
    const { width: W, height: H } = hooks.useVideoConfig();
    const id = safeId(useId());
    const size = { width: W, height: H };
    const p = typeof progress === "number" && Number.isFinite(progress) ? progress : frame < at || frame >= at + frames ? null : (frame - at + 0.5) / Math.max(1, frames);
    if (p === null) return <>{drawAt(children, size)}</>;
    const vertical = direction === "up" || direction === "down";
    const way = direction === "up" || direction === "left" ? -1 : 1;
    const shift = Math.round(way * clamp01(p) * (vertical ? H : W) * travel);
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <filter id={`m${id}`} x={vertical ? "0" : "-0.2"} y={vertical ? "-0.2" : "0"} width={vertical ? "1" : "1.4"} height={vertical ? "1.4" : "1"} colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={vertical ? `0 ${blur}` : `${blur} 0`} />
          </filter>
        </svg>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `${vertical ? "translateY" : "translateX"}(${shift}px) scale(${scale})`, filter: `url(#m${id})` }}>{drawAt(children, size)}</div>
      </div>
    );
  };
}

type PunchProps = {
  /** Her shot (drawn at the frame's size). */
  children: Draw;
  /** The frame its first, wide image is on (its cut): from the next one it zooms over `frames` images (8) to `scale` (2.3), then holds. */
  at: number;
  frames?: number;
  scale?: number;
  /** The point it zooms into (a CSS transform origin, the middle by default), and a zoom blur while it rushes (true). */
  origin?: string;
  blur?: boolean;
};

/**
 * A punch zoom inside one shot: its first image wide, then a fast zoom into it, a zoom blur while it rushes, the close
 * shot held (« Quart de tour », docs/fiches/tourne.md, effect 5: ×2.3 in eight images). ZoomThrough goes from one shot
 * into the next; this zooms into the same one. Only when a model or her request does it (the engine never zooms on a cut).
 */
function PunchOf(hooks: KitHooks) {
  return function Punch({ children, at, frames = 8, scale = 2.3, origin = "50% 50%", blur = true }: PunchProps) {
    const frame = hooks.useCurrentFrame();
    const { width: W, height: H } = hooks.useVideoConfig();
    const size = { width: W, height: H };
    const copies = punchCopies(frame - at, frames, scale, blur);
    if (!copies.length) return <>{drawAt(children, size)}</>;
    return (
      <>
        {copies.map((c, k) => (
          <div key={"z" + k} {...(k ? { "data-fauve-decor": "", "aria-hidden": true } : {})} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${c.scale.toFixed(4)})`, transformOrigin: origin, ...(k ? { opacity: c.opacity } : {}) }}>
            {drawAt(children, size)}
          </div>
        ))}
      </>
    );
  };
}

// ——— WindowStar ——————————————————————————————————————————————————————————————————————————

type WindowStarProps = {
  /** The one shot it shows through its windows, at its place and size (drawn at its box's size). */
  children: Draw;
  /** Where it sits (px of the frame; the whole frame by default) and its centre in that box (its middle by default). */
  box?: Box;
  center?: Point;
  /** The square at its centre (its side in px; 9.4 % of the box's short side by default, 0 for none). */
  square?: number;
  /** Its bands (angle, width and where each starts from the centre, px): the original's six by default, turned a quarter when the box stands upright (`upright`). */
  rays?: Ray[];
  upright?: boolean;
  /** The square from `at`, then a band every `every` frames (15), or each at its frame (`times`); gone from `out`. */
  at?: number;
  every?: number;
  times?: number[];
  out?: number;
  /** A band set at once (cut, the original's), or growing out from the centre over `frames` images. */
  reveal?: "cut" | "grow";
  frames?: number;
};

/**
 * A star of windows onto one shot (« Éventail de bandes », docs/fiches/eventail.md, effect 1): a small square at its
 * centre, then a band after the other through it, each showing the piece of the shot under it at its place (never
 * turned with it), set at once on its beat; their cut ends draw a hexagon round the square. Fan slides bands of
 * several shots in; this opens windows onto one.
 */
function WindowStarOf(hooks: KitHooks) {
  return function WindowStar({ children, box, center, square, rays, upright, at = 0, every = 15, times, out, reveal = "cut", frames = 6 }: WindowStarProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    const b = box ?? { x: 0, y: 0, w: video.width, h: video.height };
    if (frame < at || (out !== undefined && frame >= out)) return null;
    const S = Math.min(b.w, b.h);
    const list = rays ?? starRays(S, upright ?? b.h > b.w);
    const shown = list.flatMap((r, k) => {
      const t = times?.[k] ?? Math.round(at + (k + 1) * every);
      return frame < t ? [] : [reveal === "grow" ? { ...r, grow: (frame - t + 1) / Math.max(1, frames) } : r];
    });
    const side = square ?? 0.094 * S;
    const d = starPath(center ?? { x: b.w / 2, y: b.h / 2 }, side, shown, b.w + b.h);
    if (!d) return null;
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, clipPath: `path('${d}')` }}>
        {drawAt(children, { width: b.w, height: b.h })}
      </div>
    );
  };
}

// ——— LumaFade ——————————————————————————————————————————————————————————————————————————————

type LumaFadeProps = {
  /** What fades (her shot, a pile of photos, a whole composition). */
  children: ReactNode;
  /** From frame `at`, over `frames` images (4). */
  at: number;
  frames?: number;
  /** out: it goes, the dark first; in: it comes, the brightest first. */
  mode?: "out" | "in";
  /** The width of light that fades at once (0.35: soft; 0.1: sharp), and the light going first instead (invert). */
  soft?: number;
  invert?: boolean;
};

/**
 * A fade by light: each point of the picture fades out once its light is under a threshold that rises, the dark first,
 * what is white last (« this is Joe Taylor », docs/fiches/table.md, effect 3: a pile of photos gone in four images, the
 * plate's white a ghost on the table); or comes in the brightest first. One colour matrix, no blur.
 */
function LumaFadeOf(hooks: KitHooks) {
  return function LumaFade({ children, at, frames = 4, mode = "out", soft = 0.35, invert = false }: LumaFadeProps) {
    const frame = hooks.useCurrentFrame();
    const id = safeId(useId());
    const p = lumaProgress(frame, at, frames, mode);
    if (p <= 0) return <div style={{ position: "absolute", inset: 0 }}>{children}</div>;
    if (p >= 1) return null;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <filter id={`l${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={lumaMatrix(p, soft, invert)} result="lit" />
            <feComposite in="lit" in2="SourceGraphic" operator="in" />
          </filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, filter: `url(#l${id})` }}>{children}</div>
      </div>
    );
  };
}

// ——— Echo ——————————————————————————————————————————————————————————————————————————————————

type EchoProps = {
  /** The element at a frame: (frame, k) => node, k how many copies back (0: itself), so it is drawn where it was then. */
  draw: (frame: number, k: number) => ReactNode;
  /** Its copies (4), how many images apart (1), how much paler each (0.6 of the last), their colour (their own without one). */
  count?: number;
  gap?: number;
  fade?: number;
  color?: string;
  /** The element itself on top (true). */
  self?: boolean;
};

/**
 * An echo: an element's positions a few images earlier, drawn behind it, tinted, paler and paler (« Présente-toi »,
 * docs/fiches/silhouette.md, effect 4: three to five peach copies behind a word that grows and moves). Its copies are
 * decor (the scene check reads the element itself).
 */
function EchoOf(hooks: KitHooks) {
  return function Echo({ draw, count = 4, gap = 1, fade = 0.6, color, self = true }: EchoProps) {
    const frame = hooks.useCurrentFrame();
    const id = safeId(useId());
    if (typeof draw !== "function") return null;
    return (
      <div style={layer}>
        {color ? (
          <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
            <filter id={`e${id}`} colorInterpolationFilters="sRGB">
              <feFlood floodColor={color} />
              <feComposite in2="SourceAlpha" operator="in" />
            </filter>
          </svg>
        ) : null}
        {echoCopies(count, gap, fade).map((c) => (
          <div key={c.k} data-fauve-decor="" aria-hidden="true" style={{ ...layer, opacity: c.opacity, filter: color ? `url(#e${id})` : undefined }}>
            {draw(frame - c.back, c.k)}
          </div>
        ))}
        {self ? draw(frame, 0) : null}
      </div>
    );
  };
}

// ——— CastShadow ——————————————————————————————————————————————————————————————————————————————

type CastShadowProps = {
  /** What casts it, drawn where it is (her Subject in her Footage's box, a Cutout): its shape makes the shadow. Laid before her. */
  children: ReactNode;
  /** Where she is at this frame (px: SubjectBox), or a function of the frame; nothing drawn without it. */
  box: Box | null | ((frame: number) => Box | null);
  /** cast: lying on the ground from her feet; drop: behind her, moved by dx, dy (a cut-out lifted off the picture). */
  kind?: "cast" | "drop";
  /** cast: slanted `angle` degrees (38) toward `direction`, flattened to `length` of her height (0.26), fading away from her feet. */
  angle?: number;
  length?: number;
  direction?: "left" | "right";
  fade?: boolean;
  dx?: number;
  dy?: number;
  /** Its softness (px of blur, 4), how dark (0.3) and its colour (black). */
  blur?: number;
  opacity?: number;
  color?: string;
};

/**
 * A cut-out's shadow, drawn from its own silhouette (« Aplat », docs/fiches/aplat.md, effect 1: the walker and his
 * shadow on the red): cast on the ground from her feet, slanted and flattened, darker at her feet; or dropped behind
 * her. Its cut-out leaves her real shadow on the floor: this one is drawn.
 */
function CastShadowOf(hooks: KitHooks) {
  return function CastShadow({ children, box, kind = "cast", angle = 38, length = 0.26, direction = "right", fade = true, dx = 14, dy = 18, blur = 4, opacity = 0.3, color = "#000000" }: CastShadowProps) {
    const frame = hooks.useCurrentFrame();
    const id = safeId(useId());
    const b = typeof box === "function" ? box(frame) : box;
    if (!b || !(b.h > 0)) return null;
    const pose = shadowPose(b, kind, angle, length, direction, dx, dy);
    const mask = kind === "cast" && fade ? `linear-gradient(to bottom, rgba(0,0,0,0.1) ${Math.round(b.y)}px, #000 ${Math.round(b.y + b.h)}px)` : undefined;
    return (
      <div data-fauve-decor="" aria-hidden="true" style={{ ...layer, opacity }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <filter id={`c${id}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor={color} />
            <feComposite in2="SourceAlpha" operator="in" />
            {blur > 0 ? <feGaussianBlur stdDeviation={blur} /> : null}
          </filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, transformOrigin: pose.transformOrigin, transform: pose.transform, filter: `url(#c${id})`, ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : {}) }}>{children}</div>
      </div>
    );
  };
}

// ——— DotGrid —————————————————————————————————————————————————————————————————————————————————

type DotGridProps = {
  /** Its shape: an SVG path (px of the frame: SubjectOutline, a function of the frame to follow her), a picture with transparency (a logo, a cut-out), or a text (a word, an emoji: a waving hand 👋). */
  shape?: string | null | ((frame: number) => string | null);
  src?: string;
  text?: string;
  /** The text's CSS font (« 700 400px Inter »). */
  font?: string;
  /** Where its grid lies (px of the frame; the whole frame by default): a picture or a text is fitted in it. */
  box?: Box;
  /** The grid's step and each dot's size (px: 14 and 10), square dots (the original's) or round, their colour. */
  step?: number;
  size?: number;
  dot?: "square" | "circle";
  color?: string;
  /** It builds from `at` over `frames` images (8): from the bottom up (rise), at random, in reading order, from the top down. */
  at?: number;
  frames?: number;
  build?: DotBuild;
  /** It unbuilds from `out` over the same images, in the reverse order. */
  out?: number;
  /** How much of a cell its shape must cover to get a dot (0.5). */
  threshold?: number;
  seed?: string;
};

/** A grid's cells inside a picture or a text, read once on a canvas (null while it loads, an empty grid when it cannot be read). */
function useSampled(src: string | undefined, text: string | undefined, font: string | undefined, cols: number, rows: number, box: Box, threshold: number): boolean[] | null {
  const key = `${src ?? ""}|${text ?? ""}|${font ?? ""}|${cols}|${rows}|${Math.round(box.w)}|${Math.round(box.h)}|${threshold}`;
  const [read, setRead] = useState<{ key: string; cells: boolean[] } | null>(null);
  const wanted = Boolean(src || text);
  const [handle] = useState(() => (wanted ? delayRender("dot grid", { timeoutInMilliseconds: 20000 }) : null));
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!wanted) return;
    const h = first.current && handle !== null ? handle : delayRender("dot grid", { timeoutInMilliseconds: 20000 });
    first.current = false;
    let done = false;
    const finish = (cells: boolean[]) => {
      if (done) return;
      done = true;
      setRead({ key, cells });
      continueRender(h);
    };
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const cells = () => {
      try {
        const data = ctx!.getImageData(0, 0, cols, rows).data;
        return Array.from({ length: cols * rows }, (_, i) => data[i * 4 + 3]! >= threshold * 255);
      } catch {
        // A picture from elsewhere that cannot be read: no dots rather than a stuck render.
        return [];
      }
    };
    if (!ctx) {
      finish([]);
      return;
    }
    if (text) {
      const draw = () => {
        // The text measured at a large size, then drawn to fit the grid (a cell a pixel), centred.
        ctx.font = font ?? "700 400px sans-serif";
        const m = ctx.measureText(text);
        const tw = Math.max(1, m.width);
        const th = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
        const k = Math.min(cols / tw, rows / th);
        ctx.clearRect(0, 0, cols, rows);
        ctx.save();
        ctx.translate(cols / 2, rows / 2);
        ctx.scale(k, k);
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#000";
        ctx.fillText(text, 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
        ctx.restore();
        finish(cells());
      };
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fonts?.load) fonts.load(font ?? "700 400px sans-serif", text).then(draw, draw);
      else draw();
      return () => finish([]);
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      // The picture fitted in the box (contain), a cell a pixel.
      const k = Math.min(box.w / image.naturalWidth, box.h / image.naturalHeight);
      const w = (image.naturalWidth * k * cols) / box.w;
      const hh = (image.naturalHeight * k * rows) / box.h;
      ctx.clearRect(0, 0, cols, rows);
      ctx.drawImage(image, (cols - w) / 2, (rows - hh) / 2, w, hh);
      finish(cells());
    };
    image.onerror = () => finish([]);
    image.src = src!;
    return () => finish([]);
  }, [key]);
  return read && read.key === key ? read.cells : wanted ? null : [];
}

/** A 2D context to test points in a path (one for every grid), or null outside a browser. */
let pathContext: CanvasRenderingContext2D | null | undefined;
const pathTester = () => {
  if (pathContext === undefined) pathContext = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  return pathContext;
};

/**
 * A dot grid that builds a shape point by point: her cut-out (SubjectOutline, following her), a logo or any picture
 * with transparency, a word or a pictogram (an emoji's shape: the waving hand of « Présente-toi »,
 * docs/fiches/silhouette.md, effect 5), each dot landing on its own frame, from the bottom up by default. Square dots
 * of one colour, a grid of a few hundred: one SVG.
 */
function DotGridOf(hooks: KitHooks) {
  return function DotGrid({ shape, src, text, font, box, step = 14, size = 10, dot = "square", color = "#2b2b2b", at = 0, frames = 8, build = "rise", out, threshold = 0.5, seed = "dots" }: DotGridProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    const b = box ?? { x: 0, y: 0, w: video.width, h: video.height };
    const s = Math.max(3, step);
    const cols = Math.max(1, Math.floor(b.w / s));
    const rows = Math.max(1, Math.floor(b.h / s));
    const ox = b.x + (b.w - cols * s) / 2;
    const oy = b.y + (b.h - rows * s) / 2;
    const sampled = useSampled(src, text, font, cols, rows, b, threshold);
    const path = typeof shape === "function" ? shape(frame) : shape;
    const tester = path ? pathTester() : null;
    const shapePath = useMemo(() => (path && typeof Path2D !== "undefined" ? new Path2D(path) : null), [path]);
    if (frame < at) return null;
    const inside = (c: number, r: number) =>
      shapePath && tester ? tester.isPointInPath(shapePath, ox + (c + 0.5) * s, oy + (r + 0.5) * s) : sampled ? Boolean(sampled[r * cols + c]) : false;
    const span = Math.max(1, frames);
    const half = (s - Math.min(s, size)) / 2;
    const dots: ReactNode[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const order = dotOrder(build, c, r, cols, rows, seed);
        if (frame < at + order * span) continue;
        if (out !== undefined && frame >= out + (1 - order) * span) continue;
        if (!inside(c, r)) continue;
        const x = ox + c * s + half;
        const y = oy + r * s + half;
        const d = Math.min(s, size);
        dots.push(dot === "circle" ? <circle key={r * cols + c} cx={x + d / 2} cy={y + d / 2} r={d / 2} /> : <rect key={r * cols + c} x={x} y={y} width={d} height={d} />);
      }
    if (!dots.length) return null;
    return (
      <svg width={video.width} height={video.height} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }} fill={color} aria-hidden="true">
        {dots}
      </svg>
    );
  };
}

// ——— Ascii ———————————————————————————————————————————————————————————————————————————————————

type AsciiProps = {
  /** What is redrawn (her shot, her cut-out, a cell of a grid). */
  children: ReactNode;
  /** A cell's size (px; one number for a square, or width and height: 4 × 8, the original's characters at 1080). */
  cell?: number | [number, number];
  /** chars: small characters, denser as the light rises; dots: a disc growing with it (a halftone). */
  kind?: "chars" | "dots";
  /** Its ink and its paper (light on black by default; « none »: the ink alone, over what is under it). */
  ink?: string;
  paper?: string;
  /** The light read: its contrast (1.15) and how much brighter (0). */
  contrast?: number;
  light?: number;
};

/** The threshold tiles already decoded: an feImage paints at once from the memory cache. */
const decodedTiles = new Set<string>();

/**
 * A pass in characters: the picture redrawn in small characters (or dots) by its light, light on black or dark on white
 * (« Vision », docs/fiches/vision.md, effect 8: cells of 4 × 8 px at 1080, too small to read, a dense scatter on the
 * stone, the dark coats left black). One SVG filter: the picture read once per cell (a tiled displacement map sends
 * every pixel of a cell to its middle: 0,4 s an image where a sampling by morphology cost 5,5 s), its light compared to
 * a tile of small glyphs; transparent where what it redraws is (a cut-out alone stays alone).
 */
function Ascii({ children, cell = [4, 8], kind = "chars", ink = "#ffffff", paper = "#000000", contrast = 1.15, light = 0 }: AsciiProps) {
  const id = safeId(useId());
  const [cw, ch] = (Array.isArray(cell) ? cell : [cell, cell]).map((v) => Math.max(2, Math.round(Number(v) || 4))) as [number, number];
  const tile = useMemo(() => tileImage(glyphTile(cw, ch, kind), cw, ch), [cw, ch, kind]);
  const ramp = useMemo(() => cellRamp(cw, ch), [cw, ch]);
  // The render waits for its two tiles to be decoded once (an feImage loads like any image).
  const [handle] = useState(() => (decodedTiles.has(tile + ramp.href) || typeof Image === "undefined" ? null : delayRender("ascii tiles", { timeoutInMilliseconds: 10000 })));
  useLayoutEffect(() => {
    if (handle === null) return;
    let left = 2;
    const done = () => {
      if (--left > 0) return;
      decodedTiles.add(tile + ramp.href);
      continueRender(handle);
    };
    for (const src of [tile, ramp.href]) {
      const image = new Image();
      image.onload = () => void image.decode().then(done, done);
      image.onerror = done;
      image.src = src;
    }
  }, []);
  const inkRgb = (rgbOf(ink) ?? [255, 255, 255]).map((v) => v / 255);
  const none = paper === "none" || paper === "transparent";
  const paperRgb = (none ? [0, 0, 0] : (rgbOf(paper) ?? [0, 0, 0])).map((v) => v / 255);
  // Light ink on a dark paper grows with the light; dark ink on a light one with the dark, as a print (or « none »: by the ink's own light).
  const luma = (k: number[]) => 0.2126 * k[0]! + 0.7152 * k[1]! + 0.0722 * k[2]!;
  const dark = none ? luma(inkRgb) < 0.5 : luma(inkRgb) < luma(paperRgb);
  const c = Math.max(0.1, contrast) * (dark ? -1 : 1);
  const off = (dark ? 0.5 - 0.5 * c - light : 0.5 - 0.5 * c + light).toFixed(4);
  const lum = [0.2126, 0.7152, 0.0722].map((w) => (w * c).toFixed(4)).join(" ");
  // The mask (in red, green and blue alike) mapped to the ink over the paper; « none »: the ink, its alpha the mask.
  const colours = [0, 1, 2].map((i) => `${(inkRgb[i]! - paperRgb[i]!).toFixed(4)} 0 0 0 ${paperRgb[i]!.toFixed(4)}`).join("  ") + (none ? "  1 0 0 0 0" : "  0 0 0 0 1");
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
        <filter id={`a${id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={ramp.href} x={0} y={0} width={cw} height={ch} preserveAspectRatio="none" result="ramp" />
          <feTile in="ramp" result="ramps" />
          <feDisplacementMap in="SourceGraphic" in2="ramps" scale={ramp.scale} xChannelSelector="R" yChannelSelector="G" result="cells" />
          <feColorMatrix in="cells" type="matrix" values={`${lum} 0 ${off}  ${lum} 0 ${off}  ${lum} 0 ${off}  0 0 0 0 1`} result="light" />
          <feImage href={tile} x={0} y={0} width={cw} height={ch} preserveAspectRatio="none" result="glyph" />
          <feTile in="glyph" result="glyphs" />
          <feComposite in="light" in2="glyphs" operator="arithmetic" k1={0} k2={16} k3={-16} k4={1} result="mask" />
          <feColorMatrix in="mask" type="matrix" values={colours} result="inked" />
          <feComposite in="inked" in2="cells" operator="in" />
        </filter>
      </svg>
      <div style={{ position: "absolute", inset: 0, filter: `url(#a${id})` }}>{children}</div>
    </div>
  );
}

/** The picture kit, bound to a clock (the render's, or the scene check's own for each copy). */
export function makePicture(hooks: KitHooks) {
  return {
    Burn: BurnOf(hooks),
    LensEdges: LensEdgesOf(hooks),
    Smear: SmearOf(hooks),
    Punch: PunchOf(hooks),
    WindowStar: WindowStarOf(hooks),
    LumaFade: LumaFadeOf(hooks),
    Echo: EchoOf(hooks),
    CastShadow: CastShadowOf(hooks),
    DotGrid: DotGridOf(hooks),
    Ascii,
  };
}
