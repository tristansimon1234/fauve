import React, { type CSSProperties, type ReactNode } from "react";
import { Easing, interpolate, random } from "remotion";
import { landPose } from "./picture-kit";

// The layout kit of the animations (Tristan: « crée les outils toi-même, laisse pas faire l'API »):
// tiles and strips, windows, stacks of photos and split screens, written once and tested, so that an
// animation lays her shots (Footage), her photos (Img, Cutout) and its texts in these forms without
// coding their geometry and timing each time. Each piece draws what it is given, the same at every
// render of a frame: a « Draw » is a node, or a function that gets the size it is drawn at.

export type Size = { width: number; height: number };
/** The clock and the frame's size the pieces read: Remotion's in a render, the scene check's own (one copy per frame) in a check. */
export type KitHooks = { useCurrentFrame: () => number; useVideoConfig: () => { width: number; height: number } };
export type Draw = ReactNode | ((size: Size) => ReactNode);
/** A box in px of the frame. */
export type Box = { x: number; y: number; w: number; h: number };

const drawAt = (d: Draw, size: Size): ReactNode => (typeof d === "function" ? (d as (s: Size) => ReactNode)(size) : d);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Out, without overshoot: everything lands, nothing bounces. */
const settle = Easing.bezier(0.22, 1, 0.36, 1);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

// ——— Tiles ———————————————————————————————————————————————————————————————————————————

/** The order tiles change in, as a share of the wave (0 first, 1 last); reading: one tile after the other, left to right and top to bottom. */
export type Wave = "center" | "edges" | "random" | "top" | "bottom" | "left" | "right" | "diagonal" | "checker" | "groups" | "all" | "reading";
/**
 * How a tile shows its new picture: cut (at once), fade, pop (grows into place), flip (turns like a card), slide (comes
 * up inside the tile), land (laid at once a little askew and off its place, then straight: a print laid by hand).
 */
export type Reveal = "cut" | "fade" | "pop" | "flip" | "slide" | "land";
/** A picture of the tiles: from `at` (frame), each tile switches to `show` along the wave, over `spread` frames. */
export type TileStep = { at: number; show: Draw; wave?: Wave; spread?: number; reveal?: Reveal; frames?: number };

/** A tile's place in the wave (0 to 1), from its column and row. */
export function waveOrder(wave: Wave, c: number, r: number, cols: number, rows: number, seed: string): number {
  const cx = cols <= 1 ? 0 : c / (cols - 1);
  const ry = rows <= 1 ? 0 : r / (rows - 1);
  const center = Math.min(1, Math.hypot(cx - 0.5, ry - 0.5) / Math.SQRT1_2);
  switch (wave) {
    case "center":
      return center;
    case "edges":
      return 1 - center;
    case "top":
      return ry;
    case "bottom":
      return 1 - ry;
    case "left":
      return cx;
    case "right":
      return 1 - cx;
    case "diagonal":
      return (cx + ry) / 2;
    case "checker":
      return ((c + r) % 2) * 0.5 + random(`${seed}-k-${c}-${r}`) * 0.5;
    case "groups":
      return random(`${seed}-g-${Math.floor(c / 2)}-${Math.floor(r / 2)}`);
    case "all":
      return 0;
    case "reading":
      return (r * cols + c) / Math.max(1, cols * rows - 1);
    default:
      return random(`${seed}-r-${c}-${r}`);
  }
}

type TilesProps = {
  /** Columns (default 6); rows default to square tiles. 1 column makes horizontal strips, 1 row vertical strips. */
  cols?: number;
  rows?: number;
  steps: TileStep[];
  /** A gap between tiles (px), showing what lies under. */
  gap?: number;
  /** Lines drawn over the grid, drawn in from `from` over 20 frames, faded out at `to`. */
  lines?: { color?: string; width?: number; from?: number; to?: number };
  /** How much of a tile's turn is left to chance (0: the wave alone; default 0.25). */
  jitter?: number;
  /** Where the tiles sit (px), the whole frame by default. */
  box?: Box;
  seed?: string;
};

/**
 * A picture cut into tiles (a grid, or strips) that change to the next picture along a wave: each
 * tile shows its own piece of the picture, in place, so the tiles join up into the whole picture.
 */
function TilesOf(hooks: KitHooks) {
  return function Tiles({ cols = 6, rows, steps, gap = 0, lines, jitter, box, seed = "tiles" }: TilesProps) {
  const frame = hooks.useCurrentFrame();
  const video = hooks.useVideoConfig();
  const area: Box = box ?? { x: 0, y: 0, w: video.width, h: video.height };
  const c = Math.max(1, Math.round(num(cols, 6)));
  const tileW = area.w / c;
  const r = Math.max(1, Math.round(num(rows, Math.ceil(area.h / tileW))));
  const tileH = area.h / r;
  const size: Size = { width: area.w, height: area.h };
  const ordered = [...steps].filter((s) => s && Number.isFinite(s.at)).sort((a, b) => a.at - b.at);
  const j = Math.max(0, Math.min(1, num(jitter, 0.25)));
  // A tile's place in a step's wave (0 to 1); a wave in reading order keeps it exactly unless a jitter is asked for.
  const orderOf = (k: number, col: number, row: number) => {
    const step = ordered[k]!;
    const jj = jitter === undefined && step.wave === "reading" ? 0 : j;
    return (1 - jj) * waveOrder(step.wave ?? "random", col, row, c, r, `${seed}-${k}`) + jj * random(`${seed}-j-${k}-${row * c + col}`);
  };
  // For the tiles that land (picture kit): each one's rank in the order its step's tiles change in, so they lean one way
  // then the other.
  const ranks = new Map<number, number[]>();
  const rankOf = (k: number, tile: number) => {
    if (!ranks.has(k)) {
      const all = Array.from({ length: c * r }, (_, t) => ({ t, o: orderOf(k, t % c, Math.floor(t / c)) })).sort((a, b) => a.o - b.o || a.t - b.t);
      const rank = new Array<number>(c * r);
      all.forEach((x, i) => (rank[x.t] = i));
      ranks.set(k, rank);
    }
    return ranks.get(k)![tile]!;
  };
  // Each tile: the step it has settled on, and the step it is turning to (with its progress). A tile landing shows only
  // itself, askew: what lies under the tiles shows at its corners, as the paper under a print being laid.
  const settled = new Map<number, number[]>();
  const turning: { tile: number; step: number; from: number; t: number }[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const tile = row * c + col;
      let current = -1;
      let landing = false;
      for (let k = 0; k < ordered.length; k++) {
        const step = ordered[k]!;
        const order = orderOf(k, col, row);
        const start = step.at + order * Math.max(0, num(step.spread, 18));
        const frames = step.reveal && step.reveal !== "cut" ? Math.max(1, num(step.frames, step.reveal === "land" ? 3 : 8)) : 0;
        if (frame < start) break;
        if (frames && frame < start + frames) {
          turning.push({ tile, step: k, from: current, t: (frame - start) / frames });
          landing = step.reveal === "land";
          break;
        }
        current = k;
      }
      if (current >= 0 && !landing) settled.set(current, [...(settled.get(current) ?? []), tile]);
    }
  }
  const rect = (tile: number) => {
    const col = tile % c;
    const row = Math.floor(tile / c);
    return { x: col * tileW + gap / 2, y: row * tileH + gap / 2, w: tileW - gap, h: tileH - gap };
  };
  const path = (tiles: number[]) =>
    tiles
      .map((t) => {
        const q = rect(t);
        return `M${q.x} ${q.y}h${q.w}v${q.h}h${-q.w}Z`;
      })
      .join(" ");
  const full = (tiles: number[]) => tiles.length === c * r && gap === 0;
  const layer = (step: number, tiles: number[], key: string) => (
    <div key={key} style={{ position: "absolute", left: 0, top: 0, width: area.w, height: area.h, clipPath: full(tiles) ? undefined : `path('${path(tiles)}')` }}>
      {drawAt(ordered[step]!.show, size)}
    </div>
  );
  // Lines kept to the end when no `to` is given (an infinite range made interpolate throw, and the whole composition with it).
  const linesTo = lines && Number.isFinite(Number(lines.to)) ? Number(lines.to) : null;
  const lineOpacity = !lines ? 0 : linesTo === null ? 1 : interpolate(frame, [linesTo - 10, linesTo], [1, 0], clamp);
  const drawn = lines ? interpolate(frame, [num(lines.from, 0), num(lines.from, 0) + 20], [0, 1], { ...clamp, easing: settle }) : 0;
  return (
    <div style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, overflow: "hidden" }}>
      {[...settled.entries()].sort((a, b) => a[0] - b[0]).map(([step, tiles]) => layer(step, tiles, `s${step}`))}
      {turning.map(({ tile, step, t }) => {
        const q = rect(tile);
        const reveal = ordered[step]!.reveal ?? "cut";
        const p = settle(Math.max(0, Math.min(1, t)));
        const piece = (k: number, style: CSSProperties = {}) => (
          <div style={{ position: "absolute", left: q.x, top: q.y, width: q.w, height: q.h, overflow: "hidden", ...style }}>
            <div style={{ position: "absolute", left: -q.x, top: -q.y, width: area.w, height: area.h }}>{drawAt(ordered[k]!.show, size)}</div>
          </div>
        );
        const pose = reveal === "land" ? landPose(rankOf(step, tile), step, tile, c * r, seed) : null;
        const over = pose
          ? piece(step, { transform: `translate(${pose.dx}px, ${pose.dy}px) rotate(${pose.angle}deg)` })
          : reveal === "fade"
            ? piece(step, { opacity: p })
            : reveal === "pop"
              ? piece(step, { transform: `scale(${0.55 + 0.45 * p})`, opacity: Math.min(1, p * 2) })
              : reveal === "flip"
                ? piece(step, { transform: `perspective(${q.w * 4}px) rotateY(${(1 - p) * 90}deg)`, opacity: p < 0.02 ? 0 : 1 })
                : piece(step, { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` });
        return (
          <React.Fragment key={`t${tile}`}>{over}</React.Fragment>
        );
      })}
      {lines ? (
        <svg width={area.w} height={area.h} style={{ position: "absolute", left: 0, top: 0, opacity: lineOpacity, pointerEvents: "none" }}>
          {Array.from({ length: c - 1 }, (_, i) => (
            <line key={`v${i}`} x1={(i + 1) * tileW} x2={(i + 1) * tileW} y1={0} y2={area.h * drawn} stroke={lines.color ?? "rgba(0,0,0,0.45)"} strokeWidth={num(lines.width, 2)} />
          ))}
          {Array.from({ length: r - 1 }, (_, i) => (
            <line key={`h${i}`} y1={(i + 1) * tileH} y2={(i + 1) * tileH} x1={0} x2={area.w * drawn} stroke={lines.color ?? "rgba(0,0,0,0.45)"} strokeWidth={num(lines.width, 2)} />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

}

// ——— Window ——————————————————————————————————————————————————————————————————————————

export type WindowReveal = "grow" | "iris" | "wipe-up" | "wipe-down" | "wipe-left" | "wipe-right" | "fade" | "cut";

type WindowProps = {
  /** Where it opens (px of the frame). */
  box: Box;
  /** The frame it starts opening at, and how long it takes (frames). */
  at?: number;
  open?: number;
  reveal?: WindowReveal;
  /** Where it goes next: each move starts at its frame and eases to its box. */
  moves?: { at: number; frames?: number; box: Box }[];
  /** When it closes (the opening played backwards, or its own reveal). */
  close?: { at: number; frames?: number; reveal?: WindowReveal };
  radius?: number;
  /** A soft shadow under it (true), or a CSS box-shadow. */
  shadow?: boolean | string;
  border?: { width: number; color: string };
  /** cover: what it shows is drawn at its size (a shot framed in it); cut: drawn at the frame's size, in place (a piece of another picture). */
  fit?: "cover" | "cut";
  children: Draw;
};

const lerpBox = (a: Box, b: Box, t: number): Box => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

/** A window in the frame that opens, moves, grows or shrinks (into a card), and closes, showing another picture. */
function WindowOf(hooks: KitHooks) {
  return function Window({ box, at = 0, open = 12, reveal = "grow", moves = [], close, radius = 0, shadow = false, border, fit = "cover", children }: WindowProps) {
  const frame = hooks.useCurrentFrame();
  const video = hooks.useVideoConfig();
  let current = box;
  for (const m of [...moves].sort((a, b) => a.at - b.at)) {
    if (frame < m.at) break;
    const t = settle(interpolate(frame, [m.at, m.at + Math.max(1, num(m.frames, 18))], [0, 1], clamp));
    current = lerpBox(current, m.box, t);
  }
  const opening = open > 0 ? settle(interpolate(frame, [at, at + open], [0, 1], clamp)) : frame >= at ? 1 : 0;
  const closing = close ? settle(interpolate(frame, [close.at, close.at + Math.max(1, num(close.frames, open || 1))], [0, 1], clamp)) : 0;
  const shown = frame < at ? 0 : Math.max(0, opening - closing);
  if (shown <= 0) return null;
  const how = closing > 0 && close?.reveal ? close.reveal : reveal;
  const { x, y, w, h } = current;
  // The part of the window that shows, as an inset of its box.
  const inset =
    how === "grow"
      ? `inset(${((1 - shown) * h) / 2}px ${((1 - shown) * w) / 2}px round ${radius}px)`
      : how === "iris"
        ? `circle(${shown * Math.hypot(w, h) * 0.5}px at 50% 50%)`
        : how === "wipe-up"
          ? `inset(${(1 - shown) * h}px 0 0 0 round ${radius}px)`
          : how === "wipe-down"
            ? `inset(0 0 ${(1 - shown) * h}px 0 round ${radius}px)`
            : how === "wipe-left"
              ? `inset(0 0 0 ${(1 - shown) * w}px round ${radius}px)`
              : how === "wipe-right"
                ? `inset(0 ${(1 - shown) * w}px 0 0 round ${radius}px)`
                : `inset(0 round ${radius}px)`;
  const shade = shadow === true ? "0px 24px 40px rgba(0,0,0,0.35)" : typeof shadow === "string" ? shadow : undefined;
  const content =
    fit === "cut" ? (
      <div style={{ position: "absolute", left: -x, top: -y, width: video.width, height: video.height }}>{drawAt(children, { width: video.width, height: video.height })}</div>
    ) : (
      drawAt(children, { width: w, height: h })
    );
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: how === "fade" ? shown : 1, filter: shade ? `drop-shadow(${shade})` : undefined }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius, clipPath: inset }}>
        {content}
        {border ? <div style={{ position: "absolute", inset: 0, borderRadius: radius, boxShadow: `inset 0 0 0 ${border.width}px ${border.color}` }} /> : null}
      </div>
    </div>
  );
}

}

// ——— Stack ———————————————————————————————————————————————————————————————————————————

/** An item of a stack: what it shows, and its shape (width over height, 4:5 by default). */
export type StackItem = Draw | { draw: Draw; aspect?: number };
export type StackLayout = "pile" | "table" | "dump" | "row" | "grid";
export type StackEnter = "drop" | "slide" | "pop" | "fade" | "cut";

type StackProps = {
  items: StackItem[];
  /** The frame the first comes in, and the frames between two (default 8). */
  at?: number;
  every?: number;
  /** pile: on top of each other; table: scattered; dump: each one replaces the last, centred; row and grid: side by side. */
  layout?: StackLayout;
  /** The centre of the stack (px), the frame's by default. */
  center?: { x: number; y: number };
  /** An item's longer side (px; default half the frame's width). */
  size?: number;
  /** How far items stray from the centre, as a share of their size (pile 0.06, table 0.5). */
  spread?: number;
  /** The most an item turns (degrees; pile 5, table 12, dump 0). */
  tilt?: number;
  enter?: StackEnter;
  frames?: number;
  /** A white border like a print (px), its radius, a shadow. */
  border?: number;
  borderColor?: string;
  radius?: number;
  shadow?: boolean;
  /** dump: how many stay on screen (default 1). */
  keep?: number;
  /** They leave one by one, the last in first out, from `at`. */
  exit?: { at: number; every?: number; to?: "up" | "down" | "left" | "right" | "fade" };
  seed?: string;
};

const itemOf = (i: StackItem): { draw: Draw; aspect: number } =>
  i && typeof i === "object" && "draw" in (i as object) ? { draw: (i as { draw: Draw }).draw, aspect: num((i as { aspect?: number }).aspect, 0.8) } : { draw: i as Draw, aspect: 0.8 };

/** Photos or shots laid one by one: a pile, a table of prints, a photo dump, a row or a grid; and taken away one by one. */
function StackOf(hooks: KitHooks) {
  return function Stack({
  items,
  at = 0,
  every = 8,
  layout = "pile",
  center,
  size,
  spread,
  tilt,
  enter = "drop",
  frames = 10,
  border = 0,
  borderColor = "#ffffff",
  radius = 0,
  shadow = true,
  keep = 1,
  exit,
  seed = "stack",
}: StackProps) {
  const frame = hooks.useCurrentFrame();
  const video = hooks.useVideoConfig();
  const list = items.map(itemOf);
  const n = list.length;
  const mid = center ?? { x: video.width / 2, y: video.height / 2 };
  const side = num(size, video.width * 0.5);
  const stray = num(spread, layout === "table" ? 0.5 : layout === "pile" ? 0.06 : 0);
  const turn = num(tilt, layout === "table" ? 12 : layout === "pile" ? 5 : 0);
  const cols = layout === "grid" ? Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n)))) : n;
  return (
    <>
      {list.map((item, i) => {
        const start = at + i * every;
        if (frame < start) return null;
        // A dump keeps only its latest ones.
        if (layout === "dump" && i < n - 1 && frame >= at + (i + keep) * every) return null;
        const w = item.aspect >= 1 ? side : side * item.aspect;
        const h = item.aspect >= 1 ? side / item.aspect : side;
        let cx = mid.x;
        let cy = mid.y;
        if (layout === "pile" || layout === "table") {
          cx += (random(`${seed}-x-${i}`) - 0.5) * 2 * stray * side;
          cy += (random(`${seed}-y-${i}`) - 0.5) * 2 * stray * side;
        } else if (layout === "row") {
          const step = w * 1.08;
          cx = mid.x + (i - (n - 1) / 2) * step;
        } else if (layout === "grid") {
          const rowsN = Math.ceil(n / cols);
          const stepX = w * 1.06;
          const stepY = h * 1.06;
          cx = mid.x + ((i % cols) - (cols - 1) / 2) * stepX;
          cy = mid.y + (Math.floor(i / cols) - (rowsN - 1) / 2) * stepY;
        }
        const angle = (random(`${seed}-a-${i}`) - 0.5) * 2 * turn;
        const t = enter === "cut" ? 1 : settle(interpolate(frame, [start, start + Math.max(1, frames)], [0, 1], clamp));
        let dx = 0;
        let dy = 0;
        let scale = 1;
        let opacity = 1;
        if (enter === "drop") {
          scale = 1.25 - 0.25 * t;
          opacity = Math.min(1, t * 2);
        } else if (enter === "slide") {
          const fromLeft = i % 2 === 0;
          dx = (1 - t) * (fromLeft ? -1 : 1) * video.width * 0.9;
        } else if (enter === "pop") {
          scale = 0.6 + 0.4 * t;
          opacity = Math.min(1, t * 2);
        } else if (enter === "fade") {
          opacity = t;
        }
        // Taken away, the last laid first.
        if (exit) {
          const out = exit.at + (n - 1 - i) * num(exit.every, every);
          const e = settle(interpolate(frame, [out, out + Math.max(1, frames)], [0, 1], clamp));
          if (e >= 1) return null;
          const to = exit.to ?? "up";
          if (to === "fade") opacity *= 1 - e;
          else if (to === "up") dy -= e * video.height;
          else if (to === "down") dy += e * video.height;
          else if (to === "left") dx -= e * video.width;
          else dx += e * video.width;
        }
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - w / 2 - border,
              top: cy - h / 2 - border,
              width: w + border * 2,
              height: h + border * 2,
              padding: border,
              background: border ? borderColor : undefined,
              borderRadius: radius,
              boxShadow: shadow ? "0 18px 40px rgba(0,0,0,0.28), 0 3px 8px rgba(0,0,0,0.18)" : undefined,
              transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(${scale})`,
              opacity,
              boxSizing: "border-box",
            }}
          >
            <div style={{ position: "relative", width: w, height: h, overflow: "hidden", borderRadius: border ? Math.max(0, radius - border) : radius }}>{drawAt(item.draw, { width: w, height: h })}</div>
          </div>
        );
      })}
    </>
  );
}

}

// ——— Split ———————————————————————————————————————————————————————————————————————————

type SplitProps = {
  /** What each pane shows (2 to 4), drawn at its pane's size. */
  parts: Draw[];
  /** row: side by side; column: one above the other. */
  direction?: "row" | "column";
  /** Relative sizes of the panes (equal by default). */
  weights?: number[];
  gap?: number;
  gapColor?: string;
  radius?: number;
  /** A margin around the panes (px). */
  padding?: number;
  /** How the panes come in, from `at`, each `stagger` frames after the last. */
  at?: number;
  enter?: "slide" | "grow" | "wipe" | "fade" | "cut";
  frames?: number;
  stagger?: number;
  /** A label on each pane (or null), and its style. */
  labels?: (string | null)[];
  labelStyle?: CSSProperties;
  labelPlace?: "center" | "top" | "bottom";
  box?: Box;
};

/** Two to four panes side by side or one above the other, each showing its own picture, that come in together or one by one. */
/** The safe zone of a 1080 × 1920 frame, the same as the scene check's SAFE_ZONE. */
const SAFE = { side: 140, top: 80, bottom: 0.75 };

function SplitOf(hooks: KitHooks) {
  return function Split({
  parts,
  direction = "row",
  weights,
  gap = 0,
  gapColor,
  radius = 0,
  padding = 0,
  at = 0,
  enter = "slide",
  // A text that comes in from an edge lands within 0.4 s (the scene check's rule).
  frames = 12,
  stagger = 4,
  labels,
  labelStyle,
  labelPlace = "center",
  box,
}: SplitProps) {
  const frame = hooks.useCurrentFrame();
  const video = hooks.useVideoConfig();
  const area: Box = box ?? { x: 0, y: 0, w: video.width, h: video.height };
  const panes = parts.slice(0, 4);
  const ws = panes.map((_, i) => Math.max(0.1, num(weights?.[i], 1)));
  const total = ws.reduce((a, b) => a + b, 0);
  const inner = { w: area.w - padding * 2, h: area.h - padding * 2 };
  const along = (direction === "row" ? inner.w : inner.h) - gap * (panes.length - 1);
  let offset = 0;
  return (
    <div style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, background: gapColor }}>
      {panes.map((part, i) => {
        const len = (along * ws[i]!) / total;
        const pane: Box = direction === "row" ? { x: padding + offset, y: padding, w: len, h: inner.h } : { x: padding, y: padding + offset, w: inner.w, h: len };
        offset += len + gap;
        const start = at + i * stagger;
        if (frame < start && enter !== "cut") return null;
        const t = enter === "cut" ? 1 : settle(interpolate(frame, [start, start + Math.max(1, frames)], [0, 1], clamp));
        const first = i === 0;
        const style: CSSProperties = {};
        if (enter === "slide") style.transform = direction === "row" ? `translateY(${(1 - t) * (first ? -1 : 1) * area.h}px)` : `translateX(${(1 - t) * (first ? -1 : 1) * area.w}px)`;
        else if (enter === "grow") style.transform = `scale(${0.7 + 0.3 * t})`;
        else if (enter === "wipe") style.clipPath = direction === "row" ? `inset(${(1 - t) * 100}% 0 0 0)` : `inset(0 ${(1 - t) * 100}% 0 0)`;
        else if (enter === "fade") style.opacity = t;
        const label = labels?.[i];
        // The label stays inside the safe zone of the frame (the scene check's), whatever its pane.
        const abs = { x: area.x + pane.x, y: area.y + pane.y };
        const safe = {
          left: Math.max(0, SAFE.side * (video.width / 1080) - abs.x),
          right: Math.max(0, abs.x + pane.w - video.width * (1 - SAFE.side / 1080)),
          top: Math.max(0, SAFE.top * (video.height / 1920) - abs.y),
          bottom: Math.max(0, abs.y + pane.h - video.height * SAFE.bottom),
        };
        return (
          <div key={i} style={{ position: "absolute", left: pane.x, top: pane.y, width: pane.w, height: pane.h, overflow: "hidden", borderRadius: radius, ...style }}>
            {drawAt(part, { width: pane.w, height: pane.h })}
            {label ? (
              <div
                style={{
                  position: "absolute",
                  left: safe.left,
                  right: safe.right,
                  ...(labelPlace === "top"
                    ? { top: Math.max(pane.h * 0.08, safe.top) }
                    : labelPlace === "bottom"
                      ? { bottom: Math.max(pane.h * 0.08, safe.bottom) }
                      : { top: safe.top, bottom: safe.bottom }),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  color: "#ffffff",
                  fontSize: 44,
                  textShadow: "0 2px 12px rgba(0,0,0,0.35)",
                  ...labelStyle,
                }}
              >
                {label}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
}

/** The kit bound to a clock: the render's (Remotion's hooks) or the scene check's (its frame per copy). */
export function makeKit(hooks: KitHooks) {
  return { Tiles: TilesOf(hooks), Window: WindowOf(hooks), Stack: StackOf(hooks), Split: SplitOf(hooks) };
}
