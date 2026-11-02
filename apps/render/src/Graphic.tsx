import React, { useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { Easing, interpolate, interpolateColors, random } from "remotion";
import type { Box, Draw, KitHooks, Size } from "./Kit";

// The interface, graphics and transitions kit of the animations (lot 3), measured on the reference Reels:
// a cursor that moves and clicks, a switch, a button that changes when clicked, a profile card, a list of
// words rolling, an editing timeline, a grid paper; a fan of bands sliding to the centre, a landscape shot
// turned to fill the vertical frame; a whip pan, a zoom through, a cut through a word; flashes and a tint
// in a blend mode (the « Nike » edit: black and white, frames held, a white frame between two shots, red).

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const settle = Easing.bezier(0.22, 1, 0.36, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const drawAt = (d: Draw, size: Size): ReactNode => (typeof d === "function" ? (d as (s: Size) => ReactNode)(size) : d);
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

type Point = { x: number; y: number };

// ——— Cursor ——————————————————————————————————————————————————————————————————————————

type CursorProps = {
  /** Where it is at each of these frames (px of the frame); it glides from one to the next. */
  path: (Point & { at: number })[];
  /** Frames it clicks (it presses, a ring spreads). */
  clicks?: number[];
  kind?: "arrow" | "dot";
  /** Its height (px, 64). */
  size?: number;
  color?: string;
  outline?: string;
  /** Frame it goes (fades out). */
  out?: number;
};

function CursorOf(hooks: KitHooks) {
  return function Cursor({ path, clicks = [], kind = "arrow", size = 64, color = "#111111", outline = "#ffffff", out }: CursorProps) {
    const frame = hooks.useCurrentFrame();
    if (!path.length) return null;
    const first = path[0]!;
    if (frame < first.at - 6 || (out !== undefined && frame >= out + 6)) return null;
    let p: Point = first;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      if (frame >= a.at && frame <= b.at) {
        const t = inOut(interpolate(frame, [a.at, b.at], [0, 1], clamp));
        p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    if (frame > path.at(-1)!.at) p = path.at(-1)!;
    const fade = Math.min(interpolate(frame, [first.at - 6, first.at], [0, 1], clamp), out === undefined ? 1 : interpolate(frame, [out, out + 6], [1, 0], clamp));
    const last = clicks.filter((c) => c <= frame).at(-1);
    const since = last === undefined ? Infinity : frame - last;
    const press = since < 6 ? 1 - 0.18 * Math.sin((since / 6) * Math.PI) : 1;
    const ring = since < 14 ? since / 14 : null;
    return (
      <div style={{ position: "absolute", left: p.x, top: p.y, width: 0, height: 0, opacity: fade }}>
        {ring !== null ? (
          <div
            style={{
              position: "absolute",
              left: -size * 0.9 * ring,
              top: -size * 0.9 * ring,
              width: size * 1.8 * ring,
              height: size * 1.8 * ring,
              borderRadius: "50%",
              border: `${Math.max(2, size * 0.05)}px solid ${color}`,
              opacity: 1 - ring,
            }}
          />
        ) : null}
        {kind === "dot" ? (
          <div style={{ position: "absolute", left: -size * 0.25, top: -size * 0.25, width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: color, border: `3px solid ${outline}`, transform: `scale(${press})` }} />
        ) : (
          <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transform: `scale(${press})`, transformOrigin: "0 0", filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.25))" }}>
            <path d="M1 1 L1 18 L5.6 13.8 L8.7 20.6 L11.5 19.4 L8.4 12.7 L14.2 12.7 Z" fill={color} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  };
}

// ——— Toggle and Button ———————————————————————————————————————————————————————————————

type ToggleProps = {
  /** Its centre (px) and width (px, 150). */
  x: number;
  y: number;
  size?: number;
  /** Frame it switches on (and off again, if given). */
  on?: number;
  off?: number;
  at?: number;
  colorOn?: string;
  colorOff?: string;
  knob?: string;
};

function ToggleOf(hooks: KitHooks) {
  return function Toggle({ x, y, size = 150, on, off, at = 0, colorOn = "#34c759", colorOff = "#5f5f5f", knob = "#ffffff" }: ToggleProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const w = size;
    const h = size * 0.6;
    const toward = (start: number | undefined) => (start === undefined ? 0 : settle(interpolate(frame, [start, start + 6], [0, 1], clamp)));
    const p = toward(on) - toward(off);
    // The knob stretches while it moves, like the phone's switch.
    const moving = (on !== undefined && frame >= on && frame < on + 6) || (off !== undefined && frame >= off && frame < off + 6);
    const d = h - 8;
    return (
      <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: h / 2, background: interpolateColors(p, [0, 1], [colorOff, colorOn]) }}>
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4 + (w - 8 - d * (moving ? 1.18 : 1)) * p,
            width: d * (moving ? 1.18 : 1),
            height: d,
            borderRadius: d / 2,
            background: knob,
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        />
      </div>
    );
  };
}

type ButtonProps = {
  text: string;
  /** Its box (px). */
  x: number;
  y: number;
  w: number;
  h?: number;
  at?: number;
  /** Frame it is pressed: it sinks a little, then becomes `after`. */
  pressAt?: number;
  after?: { text?: string; background?: string; color?: string };
  background?: string;
  color?: string;
  style?: CSSProperties;
};

function ButtonOf(hooks: KitHooks) {
  return function Button({ text, x, y, w, h = 96, at = 0, pressAt, after, background = "#0a66ff", color = "#ffffff", style }: ButtonProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const since = pressAt === undefined ? -1 : frame - pressAt;
    const scale = since >= 0 && since < 6 ? 1 - 0.06 * Math.sin((since / 6) * Math.PI) : 1;
    const done = pressAt !== undefined && since >= 3;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: h / 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? (after?.background ?? background) : background,
          color: done ? (after?.color ?? color) : color,
          fontSize: Math.max(48, h * 0.5),
          fontWeight: 700,
          transform: `scale(${scale})`,
          ...style,
        }}
      >
        {done ? (after?.text ?? text) : text}
      </div>
    );
  };
}

// ——— ProfileCard —————————————————————————————————————————————————————————————————————

type ProfileCardProps = {
  name: string;
  handle?: string;
  bio?: string;
  /** Her photo or logo, round (an Img, a Cutout, a colour…). */
  avatar?: Draw;
  /** Where (px): within the safe zone by default, 800 wide. */
  x?: number;
  y?: number;
  w?: number;
  at?: number;
  enter?: "rise" | "pop" | "cut";
  /** Frame « Follow » is clicked (it becomes « Following »). */
  followAt?: number;
  theme?: "light" | "dark";
  /** Gone from this frame (it shrinks away). */
  out?: number;
  style?: CSSProperties;
};

function ProfileCardOf(hooks: KitHooks, Button: ReturnType<typeof ButtonOf>) {
  return function ProfileCard({ name, handle, bio, avatar, x = 140, y = 640, w = 800, at = 0, enter = "rise", followAt, theme = "light", out, style }: ProfileCardProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const p = enter === "cut" ? 1 : settle(interpolate(frame, [at, at + 12], [0, 1], clamp));
    const gone = out === undefined ? 0 : settle(interpolate(frame, [out, out + 10], [0, 1], clamp));
    if (gone >= 1) return null;
    const dark = theme === "dark";
    const ink = dark ? "#ffffff" : "#111111";
    const soft = dark ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.55)";
    const pad = 44;
    const avatarSize = 150;
    const bw = (w - pad * 2 - 24) / 2;
    const top = pad + avatarSize + 36 + (bio ? 140 : 0);
    const height = top + 96 + pad;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height,
          borderRadius: 44,
          background: dark ? "#161616" : "#ffffff",
          boxShadow: "0 30px 60px rgba(0,0,0,0.18)",
          opacity: (enter === "pop" ? 1 : p) * (1 - gone),
          transform: enter === "pop" ? `scale(${0.6 + 0.4 * p})` : `translateY(${(1 - p) * 60}px) scale(${1 - gone * 0.3})`,
          color: ink,
          ...style,
        }}
      >
        <div style={{ position: "absolute", left: pad, top: pad, width: avatarSize, height: avatarSize, borderRadius: "50%", overflow: "hidden", background: dark ? "#333" : "#e9e9ee" }}>
          {avatar ? drawAt(avatar, { width: avatarSize, height: avatarSize }) : null}
        </div>
        <div style={{ position: "absolute", left: pad + avatarSize + 32, top: pad + 18, right: pad }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          {handle ? <div style={{ fontSize: 48, color: soft, marginTop: 8, whiteSpace: "nowrap" }}>{handle}</div> : null}
        </div>
        {bio ? <div style={{ position: "absolute", left: pad, right: pad, top: pad + avatarSize + 28, fontSize: 48, lineHeight: 1.2, color: ink }}>{bio}</div> : null}
        <Button text="Follow" x={pad} y={top} w={bw} at={at} pressAt={followAt} after={{ text: "Following", background: dark ? "#2a2a2a" : "#ececf1", color: ink }} />
        <Button text="Message" x={pad + bw + 24} y={top} w={bw} at={at} background={dark ? "#2a2a2a" : "#ececf1"} color={ink} />
      </div>
    );
  };
}

// ——— WordList ————————————————————————————————————————————————————————————————————————

type WordListProps = {
  /** The words, one after the other in the middle; the ones before and after faded above and below. */
  items: string[];
  at?: number;
  /** Frames each one holds (24). */
  every?: number;
  /** The middle line (px, the frame's middle) and the column (the safe zone by default). */
  y?: number;
  x?: number;
  w?: number;
  /** Line height (px, 110). */
  line?: number;
  /** How faded the neighbours are (0.28) and how many show on each side (1). */
  faded?: number;
  around?: number;
  style?: CSSProperties;
};

function WordListOf(hooks: KitHooks) {
  return function WordList({ items, at = 0, every = 24, y, x = 140, w = 800, line = 110, faded = 0.28, around = 1, style }: WordListProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at || !items.length) return null;
    const cy = y ?? video.height / 2;
    const step = Math.floor((frame - at) / Math.max(1, every));
    const index = Math.min(items.length - 1, step);
    const move = index === step ? settle(interpolate((frame - at) % Math.max(1, every), [0, 8], [0, 1], clamp)) : 1;
    const pos = index - 1 + move;
    return (
      <div style={{ position: "absolute", left: x, width: w, top: 0, height: video.height }}>
        {items.map((item, i) => {
          const d = i - Math.max(0, index === 0 ? 0 : pos);
          if (Math.abs(d) > around + 0.99) return null;
          const near = Math.max(0, 1 - Math.abs(d));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                width: w,
                top: cy + d * line - line / 2,
                height: line,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
                fontWeight: near > 0.5 ? 700 : 400,
                color: "#111111",
                opacity: faded + (1 - faded) * near,
                whiteSpace: "nowrap",
                ...style,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    );
  };
}

// ——— Timeline and Grid ———————————————————————————————————————————————————————————————

type TimelineProps = {
  box?: Box;
  tracks?: number;
  /** Clips on the tracks (from, to: shares of the width); an audio clip draws its waveform. */
  clips?: { track: number; from: number; to: number; color?: string; audio?: boolean }[];
  at?: number;
  /** The playhead goes from `from` to `to` (shares) over `frames`. */
  playhead?: { from?: number; to?: number; frames?: number };
  background?: string;
  seed?: string;
};

/** An editing timeline, drawn as a graphic (decoration for the checks). */
function TimelineOf(hooks: KitHooks) {
  return function Timeline({ box, tracks = 3, clips, at = 0, playhead, background = "#1d1d1f", seed = "timeline" }: TimelineProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const b = box ?? { x: 140, y: 1180, w: 800, h: 230 };
    const lane = (b.h - 24) / Math.max(1, tracks);
    const list = clips ?? [
      { track: 0, from: 0.05, to: 0.42, color: "#7b4ff2" },
      { track: 0, from: 0.44, to: 0.9, color: "#7b4ff2" },
      { track: 1, from: 0.1, to: 0.7, color: "#2f9e8f" },
      { track: tracks - 1, from: 0, to: 1, color: "#2c7be5", audio: true },
    ];
    const ph = playhead ?? {};
    const head = interpolate(frame, [at, at + (ph.frames ?? Math.max(1, video.width))], [ph.from ?? 0, ph.to ?? 1], clamp);
    return (
      <div data-fauve-decor="" style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, background, borderRadius: 18, overflow: "hidden" }}>
        {Array.from({ length: tracks }, (_, t) => (
          <div key={t} style={{ position: "absolute", left: 0, right: 0, top: 12 + t * lane, height: lane - 6, background: "rgba(255,255,255,0.04)" }} />
        ))}
        {list.map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.from * b.w,
              width: (c.to - c.from) * b.w - 4,
              top: 12 + c.track * lane + 3,
              height: lane - 12,
              background: c.color ?? "#7b4ff2",
              borderRadius: 6,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "0 4px",
            }}
          >
            {c.audio
              ? Array.from({ length: Math.max(4, Math.round(((c.to - c.from) * b.w) / 7)) }, (_, k) => (
                  <div key={k} style={{ flex: "0 0 3px", height: `${18 + random(`${seed}-${i}-${k}`) * 70}%`, background: "rgba(255,255,255,0.7)", borderRadius: 2 }} />
                ))
              : null}
          </div>
        ))}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: head * b.w - 1, width: 3, background: "#ffd23f" }} />
      </div>
    );
  };
}

type GridProps = { background?: string; line?: string; size?: number; children?: ReactNode; style?: CSSProperties };

/** Squared paper or a blueprint: the whole box (the frame) as background. */
function Grid({ background = "#1d12b8", line = "rgba(255,255,255,0.16)", size = 36, children, style }: GridProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: background,
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ——— Fan and Turn ————————————————————————————————————————————————————————————————————

type FanProps = {
  /** What each band shows (her shots: Footage at the size given); 2 to 6 bands. */
  items: Draw[];
  at?: number;
  /** Frames they slide in (75: the reference takes 2.5 s). */
  frames?: number;
  center?: Point;
  /** Their angles (degrees), evenly spread from 45 by default (an X with four). */
  angles?: number[];
  thickness?: number;
  length?: number;
  /** Distance from the centre where their inner end starts and lands (px). */
  from?: number;
  to?: number;
  /** What sits in the middle (a small square, a logo). */
  middle?: ReactNode;
};

function FanOf(hooks: KitHooks) {
  return function Fan({ items, at = 0, frames = 75, center, angles, thickness = 220, length = 1500, from = 1100, to = 130, middle }: FanProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const c = center ?? { x: video.width / 2, y: video.height / 2 };
    const n = Math.max(1, Math.min(6, items.length));
    const dist = interpolate(frame, [at, at + Math.max(1, frames)], [from, to], { ...clamp, easing: Easing.out(Easing.quad) });
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {items.slice(0, n).map((item, i) => {
          const a = angles?.[i] ?? 45 + (360 / n) * i;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c.x,
                top: c.y - thickness / 2,
                width: length,
                height: thickness,
                transformOrigin: "0 50%",
                transform: `rotate(${a}deg) translateX(${dist}px)`,
                overflow: "hidden",
              }}
            >
              {drawAt(item, { width: length, height: thickness })}
            </div>
          );
        })}
        {middle ? <div style={{ position: "absolute", left: c.x, top: c.y, transform: "translate(-50%, -50%)" }}>{middle}</div> : null}
      </div>
    );
  };
}

type TurnProps = { draw: Draw; angle?: 90 | -90; style?: CSSProperties };

/** A shot in width turned a quarter, so it fills the vertical frame (it is drawn at the frame's height × width). */
function TurnOf(hooks: KitHooks) {
  return function Turn({ draw, angle = 90, style }: TurnProps) {
    const video = hooks.useVideoConfig();
    const W = video.width;
    const H = video.height;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", left: (W - H) / 2, top: (H - W) / 2, width: H, height: W, transform: `rotate(${angle}deg)` }}>{drawAt(draw, { width: H, height: W })}</div>
      </div>
    );
  };
}

// ——— Transitions —————————————————————————————————————————————————————————————————————

type WhipProps = {
  from: Draw;
  to: Draw;
  /** Frame it starts and how long it takes (8: a whip pan lasts about a quarter of a second). */
  at: number;
  frames?: number;
  direction?: "left" | "right" | "up" | "down";
  /** Motion blur at its strongest (px, 80). */
  blur?: number;
};

function WhipOf(hooks: KitHooks) {
  return function Whip({ from, to, at, frames = 8, direction = "left", blur = 80 }: WhipProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    const id = safeId(useId());
    const size = { width: video.width, height: video.height };
    if (frame < at) return <div style={{ position: "absolute", inset: 0 }}>{drawAt(from, size)}</div>;
    if (frame >= at + frames) return <div style={{ position: "absolute", inset: 0 }}>{drawAt(to, size)}</div>;
    const p = inOut(interpolate(frame, [at, at + frames], [0, 1], clamp));
    const b = blur * Math.sin(p * Math.PI);
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "left" || direction === "up" ? -1 : 1;
    const span = horizontal ? video.width : video.height;
    const move = (k: number) => (horizontal ? `translateX(${k}px)` : `translateY(${k}px)`);
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <filter id={`w${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={horizontal ? `${b} 0` : `0 ${b}`} />
          </filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, transform: move(sign * p * span), filter: `url(#w${id})` }}>{drawAt(from, size)}</div>
        <div style={{ position: "absolute", inset: 0, transform: move(sign * (p - 1) * span), filter: `url(#w${id})` }}>{drawAt(to, size)}</div>
      </div>
    );
  };
}

type ZoomThroughProps = { from: Draw; to: Draw; at: number; frames?: number; /** How far the outgoing shot zooms (2.5). */ scale?: number };

/** A push into the outgoing shot and out of the incoming one, with a zoom blur (copies scaled around the centre). */
function ZoomThroughOf(hooks: KitHooks) {
  return function ZoomThrough({ from, to, at, frames = 10, scale = 2.5 }: ZoomThroughProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    const size = { width: video.width, height: video.height };
    if (frame < at) return <div style={{ position: "absolute", inset: 0 }}>{drawAt(from, size)}</div>;
    if (frame >= at + frames) return <div style={{ position: "absolute", inset: 0 }}>{drawAt(to, size)}</div>;
    const p = interpolate(frame, [at, at + frames], [0, 1], clamp);
    const first = p < 0.5;
    const q = first ? Easing.in(Easing.cubic)(p * 2) : 1 - Easing.out(Easing.cubic)((p - 0.5) * 2);
    const s = 1 + (scale - 1) * q;
    const smear = 0.06 * q;
    const content = first ? from : to;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {[0, 1, 2, 3].map((k) => (
          <div key={k} style={{ position: "absolute", inset: 0, transform: `scale(${s * (1 + smear * k)})`, opacity: k === 0 ? 1 : 0.32 }}>
            {drawAt(content, size)}
          </div>
        ))}
      </div>
    );
  };
}

type ThroughProps = {
  /** The word the next shot shows through, then flies into. */
  text: string;
  from: Draw;
  to: Draw;
  at: number;
  /** Frames the word holds (15) and the flight into it lasts (18). */
  hold?: number;
  frames?: number;
  /** Which letter it flies into (its index; the middle one by default). */
  letter?: number;
  /** The word's size (px; it fits the safe width by default) and typography. */
  size?: number;
  style?: CSSProperties;
  /** What the outgoing shot becomes behind the word, so the word reads: darkened (0.55 by default), or a colour. */
  dim?: number;
  backdrop?: string;
};

/** A point inside the stroke of a letter of the word, where the flight goes (found on a canvas, once). */
function strokePoint(text: string, weight: string, family: string, fontSize: number, width: number, height: number, letter: number): Point {
  const center = { x: width / 2, y: height / 2 };
  if (typeof document === "undefined") return center;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return center;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, width / 2, height / 2);
  const total = ctx.measureText(text).width;
  const before = ctx.measureText(text.slice(0, letter)).width;
  const own = ctx.measureText(text.slice(letter, letter + 1)).width;
  const target = { x: width / 2 - total / 2 + before + own / 2, y: height / 2 };
  const data = ctx.getImageData(0, 0, width, height).data;
  let best: Point | null = null;
  let bestD = Infinity;
  const r = Math.ceil(fontSize * 0.6);
  for (let y = Math.max(0, Math.round(target.y - r)); y < Math.min(height, target.y + r); y += 2)
    for (let x = Math.max(0, Math.round(target.x - r)); x < Math.min(width, target.x + r); x += 2) {
      if (data[(y * width + x) * 4 + 3]! < 200) continue;
      const d = (x - target.x) ** 2 + (y - target.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  return best ?? target;
}

function ThroughOf(hooks: KitHooks) {
  return function Through({ text, from, to, at, hold = 15, frames = 18, letter, size, style, dim = 0.55, backdrop }: ThroughProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    const id = safeId(useId());
    const full = { width: video.width, height: video.height };
    const fontSize = size ?? Math.min(420, (video.width * 0.74 * 1.7) / Math.max(1, text.length));
    const family = String(style?.fontFamily ?? "sans-serif");
    const weight = String(style?.fontWeight ?? 900);
    const index = letter ?? Math.floor(text.length / 2);
    // Measured once the word is on (its font is loaded by then), not at every frame.
    const on = frame >= at;
    const focus = useMemo(() => (on ? strokePoint(text, weight, family, fontSize, video.width, video.height, index) : null), [on, text, weight, family, fontSize, video.width, video.height, index]);
    if (frame < at) return <div style={{ position: "absolute", inset: 0 }}>{drawAt(from, full)}</div>;
    if (frame >= at + hold + frames) return <div style={{ position: "absolute", inset: 0 }}>{drawAt(to, full)}</div>;
    const p = interpolate(frame, [at + hold, at + hold + frames], [0, 1], clamp);
    const zoom = Math.exp(Math.log(90) * Easing.in(Easing.cubic)(p));
    const f = focus ?? { x: video.width / 2, y: video.height / 2 };
    const behind = interpolate(frame, [at, at + 6], [0, 1], clamp);
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {drawAt(from, full)}
        <div style={{ position: "absolute", inset: 0, background: backdrop ?? "#000000", opacity: behind * (backdrop ? 1 : Math.max(0, Math.min(1, dim))) }} />
        <svg width={video.width} height={video.height} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden="true">
          <defs>
            <clipPath id={`t${id}`} clipPathUnits="userSpaceOnUse">
              <text
                x={video.width / 2}
                y={video.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontFamily={family}
                fontWeight={weight}
                transform={`translate(${f.x} ${f.y}) scale(${zoom}) translate(${-f.x} ${-f.y})`}
              >
                {text}
              </text>
            </clipPath>
          </defs>
        </svg>
        <div style={{ position: "absolute", inset: 0, clipPath: `url(#t${id})` }}>{drawAt(to, full)}</div>
      </div>
    );
  };
}

// ——— Flash and Tint ——————————————————————————————————————————————————————————————————

type FlashProps = { at: number | number[]; frames?: number; color?: string };

/** A frame (or two) of plain colour, on a cut: the white frame of the « Nike » edit. Only when it is asked for. */
function FlashOf(hooks: KitHooks) {
  return function Flash({ at, frames = 2, color = "#ffffff" }: FlashProps) {
    const frame = hooks.useCurrentFrame();
    const list = Array.isArray(at) ? at : [at];
    return list.some((a) => frame >= a && frame < a + frames) ? <div style={{ position: "absolute", inset: 0, background: color }} /> : null;
  };
}

type TintProps = { color?: string; mode?: CSSProperties["mixBlendMode"]; opacity?: number; style?: CSSProperties };

/** A colour laid over what is under it in a blend mode (red over black and white, multiply, the « Nike » red). */
function Tint({ color = "#e10600", mode = "multiply", opacity = 1, style }: TintProps) {
  return <div style={{ position: "absolute", inset: 0, background: color, mixBlendMode: mode, opacity, pointerEvents: "none", ...style }} />;
}

/** The interface, graphics and transitions kit, bound to a clock (the render's, or the scene check's own for each copy). */
export function makeGraphic(hooks: KitHooks) {
  const Button = ButtonOf(hooks);
  return {
    Cursor: CursorOf(hooks),
    Toggle: ToggleOf(hooks),
    Button,
    ProfileCard: ProfileCardOf(hooks, Button),
    WordList: WordListOf(hooks),
    Timeline: TimelineOf(hooks),
    Grid,
    Fan: FanOf(hooks),
    Turn: TurnOf(hooks),
    Whip: WhipOf(hooks),
    ZoomThrough: ZoomThroughOf(hooks),
    Through: ThroughOf(hooks),
    Flash: FlashOf(hooks),
    Tint,
  };
}
