import React, { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { continueRender, delayRender, Easing, interpolate, interpolateColors, random } from "remotion";
import { Fit } from "./Fit";
import {
  capsuleRing,
  cellsRing,
  handBreak,
  handLine,
  handPace,
  handSlots,
  handStrays,
  loopRing,
  placeWords,
  plainLetters,
  strokeTexture,
  typedState,
  type Spot as StrokeStart,
  type Turn,
} from "./handmade";
import type { Box, KitHooks } from "./Kit";
import { PICTOS, pathLength, pictoFor } from "./pictos";

// The text and materials kit of the animations (lot 2, after the layout kit): texts that decode, type
// themselves, rise word by word or count, words spread on the edges of the frame, letters pressed into
// paper and inked, a card written by hand, strokes drawn by hand, a word search, kinetic type, and the
// loud kit (WordArt, a starburst) for when she asks for it. Timings measured on the reference Reels
// (a decode holds 0.33 s, scrambles 0.6 s and lands in 0.33 s through look-alike glyphs; a hand types
// about 4 letters a second, unevenly; a card gets its next word on the next cut).
//
// Each piece keeps the whole text in the page and hides what has not appeared yet, so the scene check
// reads the sentence at its final place (safe zone, size, reading time, the Reel's texts) instead of a
// different string at every frame; what only decorates (a scrambled glyph, a rolling digit, the grid
// of a word search, an extruded shadow) is out of its reach (a CSS pseudo-element, or data-fauve-decor).

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Out, without overshoot. */
const settle = Easing.bezier(0.22, 1, 0.36, 1);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
/** The safe zone of a 1080 × 1920 frame, the same as the scene check's SAFE_ZONE. */
const SAFE = { side: 140, top: 80, bottom: 0.75 };
const safeRect = (w: number, h: number): Box => {
  const side = SAFE.side * (w / 1080);
  const top = SAFE.top * (h / 1920);
  return { x: side, y: top, w: w - side * 2, h: h * SAFE.bottom - top };
};

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("fr", { granularity: "grapheme" }) : null;
/** The letters of a text as one sees them (an emoji or an accented letter is one). */
export const letters = (text: string): string[] => (segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text));
const isSpace = (c: string) => /^\s+$/.test(c);

// Pseudo-elements draw what is not text: the scrambled glyph over a letter, the strip of a rolling digit.
const CSS_ID = "fauve-type-kit";
const CSS = [
  ".fauve-scramble{position:relative}",
  ".fauve-scramble::after{content:attr(data-g);position:absolute;left:50%;top:0;transform:translateX(-50%);line-height:normal;white-space:pre}",
  ".fauve-roll{position:relative;display:inline-block;overflow:hidden;vertical-align:top}",
  ".fauve-roll::after{content:'0\\A 1\\A 2\\A 3\\A 4\\A 5\\A 6\\A 7\\A 8\\A 9\\A 0\\A 1\\A 2\\A 3\\A 4\\A 5\\A 6\\A 7\\A 8\\A 9\\A 0\\A 1\\A 2\\A 3\\A 4\\A 5\\A 6\\A 7\\A 8\\A 9';position:absolute;left:0;right:0;top:0;text-align:center;white-space:pre;line-height:inherit;transform:translateY(var(--roll))}",
].join("");
function ensureCss() {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ——— Decode ——————————————————————————————————————————————————————————————————————————

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** What a letter looks like just before it lands (3 for E, 0 for O…). */
const LOOKALIKE: Record<string, string> = { A: "4", a: "4", B: "8", E: "3", e: "3", G: "6", I: "1", i: "1", l: "1", O: "0", o: "0", S: "5", s: "5", T: "7", t: "7", Z: "2" };

type DecodeProps = {
  text: string;
  /** Frame it appears (scrambled, at once). */
  at?: number;
  /** Frames it holds still before scrambling (the reference: 10). */
  hold?: number;
  /** Frames of scrambling (18). */
  scramble?: number;
  /** Frames over which the letters land, in random order (10). */
  resolve?: number;
  /** A new scramble every n frames (2). */
  every?: number;
  glyphs?: string;
  style?: CSSProperties;
  seed?: string;
};

function DecodeOf(hooks: KitHooks) {
  return function Decode({ text, at = 0, hold = 0, scramble = 18, resolve = 10, every = 2, glyphs = GLYPHS, style, seed = "decode" }: DecodeProps) {
    const frame = hooks.useCurrentFrame();
    ensureCss();
    if (frame < at) return null;
    const t = frame - at;
    const landAt = hold + scramble;
    if (t >= landAt + resolve) return <span style={style}>{text}</span>;
    const tick = t < hold ? 0 : Math.floor((t - hold) / Math.max(1, every)) + 1;
    const pool = letters(glyphs);
    let k = 0;
    // Word by word, like the reference: each word scrambled as a word of its own (set normally, a letter
    // more or less while it scrambles), centred where the word will be; its letters land one by one.
    return (
      <span style={style}>
        {text.split(/(\s+)/).map((w, wi) => {
          if (!w) return null;
          if (isSpace(w)) return w;
          const chars = letters(w);
          let pending = 0;
          const mixed = chars
            .map((c) => {
              const i = k++;
              const lands = landAt + random(`${seed}-land-${i}`) * resolve;
              if (t >= lands) return c;
              pending++;
              const near = t >= landAt && LOOKALIKE[c] && random(`${seed}-look-${i}-${tick}`) < 0.6;
              if (near) return LOOKALIKE[c]!;
              // Mostly in the letter's own case (a capital scrambles into capitals and digits), so a word keeps its width.
              const upper = c !== c.toLowerCase();
              const own = random(`${seed}-case-${i}-${tick}`) < 0.85 ? pool.filter((g) => /\d/.test(g) || (upper ? g !== g.toLowerCase() : g !== g.toUpperCase())) : pool;
              const from = own.length ? own : pool;
              return from[Math.floor(random(`${seed}-${i}-${tick}`) * from.length)] ?? c;
            })
            .join("");
          if (!pending) return <span key={wi}>{w}</span>;
          // A letter less now and then while it scrambles (never more: it would run into the next word).
          const shorter = t < landAt && mixed.length > 3 && random(`${seed}-len-${wi}-${tick}`) < 0.35;
          const shown = shorter ? mixed.slice(0, -1) : mixed;
          return (
            <span key={wi} className="fauve-scramble" data-g={shown}>
              <span style={{ opacity: 0 }}>{w}</span>
            </span>
          );
        })}
      </span>
    );
  };
}

// ——— TypeOn ——————————————————————————————————————————————————————————————————————————

type TypeOnProps = {
  text: string;
  at?: number;
  /** Letters (or words) a second, on average (a hand types about 4 letters a second; 14 for a terminal). */
  speed?: number;
  by?: "letter" | "word";
  /** How uneven the rhythm is, 0 (a machine) to 1 (a hand; default 0.6). Punctuation always pauses. */
  jitter?: number;
  caret?: "none" | "bar" | "block" | "underscore";
  caretColor?: string;
  /**
   * From this frame the cursor goes back and eats the text from its end, `speed` letters a second (14: a key held
   * down), down to `keep` letters, or to the start of the text it keeps (her first name kept, her last name eaten);
   * what is eaten leaves the page. Typing stops when it starts.
   */
  erase?: { at: number; speed?: number; keep?: number | string };
  style?: CSSProperties;
  seed?: string;
};

/** The frame each unit of a text shows, from 0: an uneven rhythm, a pause after punctuation. */
export function typingTimes(units: string[], perSecond: number, jitter: number, seed: string): number[] {
  const base = 30 / Math.max(0.5, perSecond);
  let t = 0;
  return units.map((u, i) => {
    const at = t;
    if (!isSpace(u)) t += base * (1 + Math.max(0, Math.min(1, jitter)) * (random(`${seed}-t-${i}`) * 1.6 - 0.8));
    if (/[.,!?;:…—]$/.test(u)) t += base * 1.5;
    return Math.round(at);
  });
}

function TypeOnOf(hooks: KitHooks) {
  return function TypeOn({ text, at = 0, speed = 4.5, by = "letter", jitter = 0.6, caret = "none", caretColor, erase, style, seed = "type" }: TypeOnProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const split = (s: string) => (by === "word" ? s.split(/(\s+)/).filter(Boolean) : letters(s));
    const units = split(text);
    const times = typingTimes(units, speed, jitter, seed);
    const t = frame - at;
    // What it keeps once erased: a number of units, or the start of its text.
    const keep = !erase ? 0 : typeof erase.keep === "string" ? (text.startsWith(erase.keep) ? split(erase.keep).length : 0) : num(erase.keep, 0);
    const state = typedState(times, t, erase && Number.isFinite(erase.at) ? { at: erase.at - at, perSecond: num(erase.speed, 14), keep } : undefined);
    const shown = state.shown;
    // Erasing, nothing more is typed: the rest of the text leaves the page with what is eaten.
    const done = shown >= units.length || Boolean(erase && t >= erase.at - at);
    // The caret holds still while the hand types or erases, and blinks once it rests.
    const blinkOn = state.busy || Math.floor((t - state.since) / 15) % 2 === 0;
    const mark =
      caret !== "none" && blinkOn ? (
        <span style={{ display: "inline-block", width: 0, position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: caret === "block" ? 0 : "0.04em",
              bottom: caret === "underscore" ? "0.05em" : "-0.1em",
              width: caret === "bar" ? "0.08em" : "0.6em",
              height: caret === "underscore" ? "0.1em" : "1.05em",
              background: caretColor ?? "currentColor",
            }}
          />
        </span>
      ) : null;
    return (
      <span style={style}>
        {units.slice(0, shown).join("")}
        {mark}
        {done ? null : <span style={{ opacity: 0 }}>{units.slice(shown).join("")}</span>}
      </span>
    );
  };
}

// ——— Reveal ——————————————————————————————————————————————————————————————————————————

type RevealFrom = "rise" | "fall" | "blur" | "fade" | "scale" | "left" | "right" | "flicker";
type RevealProps = {
  text: string;
  at?: number;
  /** What comes in one after the other; lines are the text's own line breaks (\n). */
  by?: "letter" | "word" | "line";
  /** Frames between two units (2 for letters, 4 for words, 6 for lines). */
  stagger?: number;
  /** Frames each unit takes (12). */
  frames?: number;
  /**
   * rise / fall: out of a mask, like an editorial title; blur: out of focus; scale: from small; flicker: the units light
   * up in a random order, blinking a few times before they hold (a title of a travel film: 7 letters in 1.1 s).
   */
  from?: RevealFrom;
  seed?: string;
  /** Goes the way it came, unit by unit, from this frame. */
  exit?: { at: number; frames?: number };
  style?: CSSProperties;
};

function unitStyle(from: RevealFrom, p: number): CSSProperties {
  const q = 1 - p;
  switch (from) {
    case "rise":
      return { transform: `translateY(${q * 110}%)` };
    case "fall":
      return { transform: `translateY(${-q * 110}%)` };
    case "blur":
      return { filter: `blur(${q * 0.25}em)`, opacity: Math.min(1, p * 1.6) };
    case "scale":
      return { transform: `scale(${0.4 + 0.6 * p})`, opacity: p };
    case "left":
      return { transform: `translateX(${-q * 0.6}em)`, opacity: p };
    case "right":
      return { transform: `translateX(${q * 0.6}em)`, opacity: p };
    default:
      return { opacity: p };
  }
}

function RevealOf(hooks: KitHooks) {
  return function Reveal({ text, at = 0, by = "word", stagger, frames = 12, from = "rise", exit, style, seed = "reveal" }: RevealProps) {
    const frame = hooks.useCurrentFrame();
    const gap = num(stagger, by === "letter" ? 2 : by === "word" ? 4 : 6);
    const lines = text.split("\n");
    let index = 0;
    const count = by === "line" ? lines.length : by === "word" ? text.split(/\s+/).filter(Boolean).length : letters(text.replace(/\s+/g, "")).length;
    const doneAt = at + gap * Math.max(0, count - 1) + frames;
    const leaving = exit && frame >= exit.at;
    if (frame < at) return null;
    if (leaving && frame >= exit.at + gap * Math.max(0, count - 1) + (exit.frames ?? frames)) return null;
    // Settled: the plain text, laid out the same (no kerning across the letters' boxes).
    if (frame >= doneAt && !leaving)
      return <span style={{ whiteSpace: "pre-line", ...(by === "letter" ? { fontKerning: "none", fontVariantLigatures: "none" } : {}), ...style }}>{text}</span>;
    // In a flicker, each unit's turn comes in a random order.
    const order = from === "flicker" ? Array.from({ length: count }, (_, i) => i).sort((a, b) => random(`${seed}-o-${a}`) - random(`${seed}-o-${b}`)) : null;
    const progress = (i: number) => {
      const turn = order ? order.indexOf(i) : i;
      const p = settle(interpolate(frame, [at + turn * gap, at + turn * gap + frames], [0, 1], clamp));
      if (!leaving) return p;
      return Math.min(p, 1 - settle(interpolate(frame, [exit.at + i * gap, exit.at + i * gap + (exit.frames ?? frames)], [0, 1], clamp)));
    };
    const masked = from === "rise" || from === "fall";
    const unit = (content: ReactNode, i: number, key: string) => {
      const p = progress(i);
      // A flicker: on or off every two frames, more often on as it goes, then held.
      const look = from === "flicker" ? { opacity: p >= 1 || (p > 0 && random(`${seed}-f-${i}-${Math.floor(frame / 2)}`) < 0.25 + 0.75 * p) ? 1 : 0 } : unitStyle(from, p);
      const inner = <span style={{ display: "inline-block", whiteSpace: "pre", ...look }}>{content}</span>;
      return masked ? (
        <span key={key} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.14em", marginBottom: "-0.14em" }}>
          {inner}
        </span>
      ) : (
        <React.Fragment key={key}>{inner}</React.Fragment>
      );
    };
    const line = (l: string, li: number) => {
      if (by === "line") return unit(l, li, `l${li}`);
      return l.split(/(\s+)/).map((w, wi) => {
        if (!w) return null;
        if (isSpace(w)) return w;
        if (by === "word") return unit(w, index++, `w${li}-${wi}`);
        return (
          <span key={`w${li}-${wi}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {letters(w).map((c, ci) => unit(c, index++, `c${li}-${wi}-${ci}`))}
          </span>
        );
      });
    };
    return (
      <span style={{ ...(by === "letter" ? { fontKerning: "none", fontVariantLigatures: "none" } : {}), ...style }}>
        {lines.map((l, li) => (
          <React.Fragment key={li}>
            {/* A space before the break: the sentence reads "line one line two", not "oneline". */}
            {li ? (
              <>
                {" "}
                <br />
              </>
            ) : null}
            {line(l, li)}
          </React.Fragment>
        ))}
      </span>
    );
  };
}

// ——— Count ———————————————————————————————————————————————————————————————————————————

type CountProps = {
  to: number;
  from?: number;
  at?: number;
  frames?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** count: the number climbs; roll: each digit spins like a slot machine and lands, one after the other. */
  mode?: "count" | "roll";
  /** Frames between two digits landing in a roll (3). */
  stagger?: number;
  style?: CSSProperties;
};

/** A number written the French way: thin spaces between thousands, a decimal comma. */
export const frenchNumber = (n: number, decimals = 0) => {
  const [whole, frac] = Math.abs(n).toFixed(Math.max(0, decimals)).split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "−" : ""}${grouped}${frac ? `,${frac}` : ""}`;
};

function CountOf(hooks: KitHooks) {
  return function Count({ to, from = 0, at = 0, frames = 30, decimals = 0, prefix = "", suffix = "", mode = "count", stagger = 3, style }: CountProps) {
    const frame = hooks.useCurrentFrame();
    ensureCss();
    if (frame < at) return null;
    if (mode === "count") {
      const v = interpolate(frame, [at, at + frames], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) });
      return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{`${prefix}${frenchNumber(v, decimals)}${suffix}`}</span>;
    }
    const chars = letters(frenchNumber(to, decimals));
    const digits = chars.filter((c) => /\d/.test(c)).length;
    let d = 0;
    return (
      <span style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1.15, whiteSpace: "nowrap", ...style }}>
        {prefix}
        {chars.map((c, i) => {
          if (!/\d/.test(c)) return <span key={i}>{c}</span>;
          // The leftmost digit lands last, like a counter.
          const k = digits - 1 - d++;
          const p = settle(interpolate(frame, [at, at + frames + k * stagger], [0, 1], clamp));
          if (p >= 1) return <span key={i}>{c}</span>;
          const row = Number(c) + 20 * (1 - p);
          return (
            <span key={i} className="fauve-roll" style={{ height: "1.15em", ["--roll" as string]: `${-row * 1.15}em` } as CSSProperties}>
              <span style={{ opacity: 0 }}>{c}</span>
            </span>
          );
        })}
        {suffix}
      </span>
    );
  };
}

// ——— Edges ———————————————————————————————————————————————————————————————————————————

type Spot = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";
type EdgesProps = {
  /** The words of a sentence, each at its spot on the frame's edges, in reading order. */
  items: { text: string; spot: Spot; at?: number; style?: CSSProperties }[];
  at?: number;
  /** Frames between two words (15: the reference puts one every half second). */
  every?: number;
  enter?: "cut" | "fade" | "rise" | "type" | "decode";
  /** Frame they all go (cut). */
  out?: number;
  /** Past the safe zone, cut by the frame's edges like a graphic: then decoration, not words to read. */
  bleed?: boolean;
  style?: CSSProperties;
};

function EdgesOf(hooks: KitHooks, Reveal: ReturnType<typeof RevealOf>, TypeOn: ReturnType<typeof TypeOnOf>, Decode: ReturnType<typeof DecodeOf>) {
  return function Edges({ items, at = 0, every = 15, enter = "cut", out, bleed = false, style }: EdgesProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (out !== undefined && frame >= out) return null;
    const area = bleed ? { x: -video.width * 0.04, y: 24, w: video.width * 1.08, h: video.height - 48 } : safeRect(video.width, video.height);
    return (
      <div style={{ position: "absolute", inset: 0 }} {...(bleed ? { "data-fauve-decor": "" } : {})}>
        {items.map((item, i) => {
          const start = num(item.at, at + i * every);
          if (frame < start) return null;
          const [v, h] = item.spot === "center" ? ["middle", "center"] : item.spot.includes("-") ? item.spot.split("-") : ["top", "bottom"].includes(item.spot) ? [item.spot, "center"] : ["middle", item.spot];
          const place: CSSProperties = {
            position: "absolute",
            left: area.x,
            width: area.w,
            textAlign: h === "left" ? "left" : h === "right" ? "right" : "center",
            // A margin in em: at a large size, the letters themselves rise above (or drop below) their line.
            ...(v === "top"
              ? { top: `calc(${area.y}px + 0.22em)` }
              : v === "bottom"
                ? { bottom: `calc(${video.height - (area.y + area.h)}px + 0.22em)` }
                : { top: area.y + area.h / 2, transform: "translateY(-50%)" }),
            color: "#ffffff",
            fontSize: 64,
            lineHeight: 1.05,
            ...style,
            ...item.style,
          };
          const fade = enter === "fade" ? interpolate(frame, [start, start + 8], [0, 1], clamp) : 1;
          const body =
            enter === "rise" ? (
              <Reveal text={item.text} at={start} by="word" from="rise" />
            ) : enter === "type" ? (
              <TypeOn text={item.text} at={start} speed={14} jitter={0.3} />
            ) : enter === "decode" ? (
              <Decode text={item.text} at={start} seed={`edge-${i}`} />
            ) : (
              item.text
            );
          return (
            <div key={i} style={{ ...place, opacity: fade }}>
              {body}
            </div>
          );
        })}
      </div>
    );
  };
}

// ——— Paper and Emboss ————————————————————————————————————————————————————————————————

type PaperProps = {
  color?: string;
  /** How much grain (0 to 1, default 0.35). */
  grain?: number;
  /** Long fibres, like a sheet of real paper or card. */
  fibers?: boolean;
  /** Darker edges, as if lit from the middle (0 to 1). */
  shade?: number;
  style?: CSSProperties;
  children?: ReactNode;
};

/** A sheet of paper or card filling its box (the whole frame by default): its colour, its grain, still. */
function Paper({ color = "#f3e3d3", grain = 0.35, fibers = false, shade = 0.25, style, children }: PaperProps) {
  const id = useId().replace(/:/g, "");
  return (
    <div style={{ position: "absolute", inset: 0, background: color, overflow: "hidden", ...style }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: Math.max(0, Math.min(1, grain)) }} aria-hidden="true">
        <filter id={`g${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0.55 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${id})`} />
        {fibers ? (
          <>
            <filter id={`f${id}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="2" seed="3" />
              <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 -0.08" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#f${id})`} />
          </>
        ) : null}
      </svg>
      {shade > 0 ? <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(40,24,10,${0.35 * shade}) 100%)` }} /> : null}
      {children}
    </div>
  );
}

type EmbossProps = {
  text: string;
  /** The colour of the paper it is pressed into (the letters start in it). */
  surface: string;
  /** The ink that fills the letters, one after the other; none: pressed only. */
  ink?: string | null;
  /** deboss: pressed in; emboss: raised. */
  mode?: "deboss" | "emboss";
  /** Depth of the relief, px (3). */
  depth?: number;
  at?: number;
  /** Frame the ink starts, frames each letter takes to fill, frames between two letters (the reference fills a word in 3.5 s). */
  inkAt?: number;
  inkFrames?: number;
  stagger?: number;
  style?: CSSProperties;
};

function EmbossOf(hooks: KitHooks) {
  return function Emboss({ text, surface, ink = null, mode = "deboss", depth = 3, at = 0, inkAt, inkFrames = 30, stagger = 9, style }: EmbossProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const d = Math.max(0.5, depth);
    const relief = interpolateColors(0.07, [0, 1], [surface, mode === "deboss" ? "#000000" : "#ffffff"]);
    const shadow =
      mode === "deboss"
        ? `0 ${-d * 0.5}px ${d * 0.6}px rgba(60,30,10,0.32), 0 ${d * 0.5}px ${d * 0.5}px rgba(255,255,255,0.6)`
        : `0 ${d * 0.6}px ${d * 0.8}px rgba(60,30,10,0.32), 0 ${-d * 0.4}px ${d * 0.4}px rgba(255,255,255,0.65)`;
    const start = num(inkAt, at + 15);
    const chars = letters(text);
    const visible = chars.filter((c) => !isSpace(c)).length;
    const base: CSSProperties = { textShadow: shadow, ...style };
    if (!ink) return <span style={{ ...base, color: relief }}>{text}</span>;
    if (frame >= start + stagger * Math.max(0, visible - 1) + inkFrames) return <span style={{ ...base, color: ink }}>{text}</span>;
    let k = 0;
    return (
      <span style={base}>
        {chars.map((c, i) => {
          if (isSpace(c)) return c;
          const j = k++;
          const p = interpolate(frame, [start + j * stagger, start + j * stagger + inkFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
          return (
            <span key={i} style={{ color: interpolateColors(p, [0, 1], [relief, ink]) }}>
              {c}
            </span>
          );
        })}
      </span>
    );
  };
}

// ——— Card ————————————————————————————————————————————————————————————————————————————

type CardProps = {
  text: string;
  at?: number;
  /** One more word every n frames (10)… */
  every?: number;
  /** …or one more word on each of these frames (her cuts: a stop-motion card, moving a little on each)… */
  cuts?: number[];
  /** …with this many words a cut (0.5: one word every two cuts, as in the reference). */
  wordsPerCut?: number;
  /** …or the text as written at these frames (each one longer). */
  steps?: { at: number; text: string }[];
  /** Where the card is (px of the frame); centred, 600 × 440, by default. */
  box?: Box;
  tilt?: number;
  /** Turns and moves a little on each new word, like a card held in front of the camera (degrees, 1.2). */
  jitter?: number;
  paper?: string;
  ink?: string;
  /**
   * Written by a hand that never repeats (Handwriting): each line filling the card's width (its own \n, else cut
   * evenly, `lines` of them), the last one taller, each letter a little different, a marker's grain on the stroke.
   */
  hand?: boolean | { grain?: number; wobble?: number; bend?: number; last?: number; lines?: number };
  style?: CSSProperties;
  seed?: string;
};

function CardOf(hooks: KitHooks, Handwriting: ReturnType<typeof HandwritingOf>) {
  return function Card({ text, at = 0, every = 10, cuts, wordsPerCut = 1, steps, box, tilt = -2, jitter = 1.2, paper = "#f6f3ec", ink = "#c8102e", hand, style, seed = "card" }: CardProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const words = text.split(/\s+/).filter(Boolean);
    let written: string;
    let beat: number;
    if (steps?.length) {
      const passed = steps.filter((s) => s.at <= frame);
      written = passed.at(-1)?.text ?? "";
      beat = passed.length;
    } else if (cuts?.length) {
      const ticks = cuts.filter((c) => c > at && c <= frame).length + 1;
      written = words.slice(0, Math.max(1, Math.round(ticks * Math.max(0.1, wordsPerCut)))).join(" ");
      beat = ticks;
    } else {
      const ticks = Math.floor((frame - at) / Math.max(1, every)) + 1;
      written = words.slice(0, ticks).join(" ");
      beat = ticks;
    }
    const full = steps?.length ? (steps.at(-1)?.text ?? text) : text;
    const rest = full.startsWith(written) ? full.slice(written.length) : "";
    const b = box ?? { x: (video.width - 600) / 2, y: video.height * 0.36, w: 600, h: 440 };
    const turn = tilt + (random(`${seed}-r-${beat}`) * 2 - 1) * jitter;
    const shift = { x: (random(`${seed}-x-${beat}`) * 2 - 1) * jitter * 4, y: (random(`${seed}-y-${beat}`) * 2 - 1) * jitter * 4 };
    return (
      <div
        style={{
          position: "absolute",
          left: b.x + shift.x,
          top: b.y + shift.y,
          width: b.w,
          height: b.h,
          transform: `rotate(${turn}deg)`,
          background: `linear-gradient(176deg, rgba(255,255,255,0.5), rgba(0,0,0,0) 35%, rgba(0,0,0,0.05) 52%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.06)), ${paper}`,
          boxShadow: "0 18px 36px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.18)",
          borderRadius: 4,
        }}
      >
        {hand ? (
          // Its lines written by hand, as many letters shown as the words written so far.
          <Handwriting
            // Its own line breaks when its steps write the same words.
            text={handBreak(full.replace(/\s+/g, " ").trim() === text.replace(/\s+/g, " ").trim() ? text : full, typeof hand === "object" ? hand.lines : undefined).join("\n")}
            box={{ x: b.w * 0.06, y: b.h * 0.07, w: b.w * 0.88, h: b.h * 0.86 }}
            upTo={letters(written.replace(/\s+/g, " ").trim()).length}
            color={ink}
            {...(typeof hand === "object" ? { grain: hand.grain, wobble: hand.wobble, bend: hand.bend, last: hand.last } : {})}
            style={{ textTransform: "uppercase", ...style }}
            seed={seed}
          />
        ) : (
          <Fit
            style={{ position: "absolute", left: b.w * 0.07, top: b.h * 0.08, width: b.w * 0.86, height: b.h * 0.84 }}
            innerStyle={{ textAlign: "left", color: ink, fontSize: 92, lineHeight: 0.98, textTransform: "uppercase", ...style }}
          >
            <span>
              {written}
              {rest ? <span style={{ opacity: 0 }}>{rest}</span> : null}
            </span>
          </Fit>
        )}
      </div>
    );
  };
}

// ——— Handwriting —————————————————————————————————————————————————————————————————————

type HandwritingProps = {
  /** What is written: its lines at its own \n (each one filling the width), else cut evenly between its words. */
  text: string;
  /** Where (px of the frame, or of the element it is laid in), its lines from top to bottom. */
  box?: Box;
  at?: number;
  /** Its first n letters show (spaces counted, lines joined by one), the rest kept unseen in place… */
  upTo?: number;
  /** …or one more word every n frames from `at`; else the whole text. */
  every?: number;
  color?: string;
  /** A dry marker's or a grease pencil's grain on the stroke, its rim darker (0: a clean line; 0.6). */
  grain?: number;
  /** How far each letter strays from the font: its size, its angle, its place (1; 0: the font as it is). */
  wobble?: number;
  /** How much its strokes themselves bend, each letter its own way (0 to 1; 0 by default: it costs a filter pass a frame). */
  bend?: number;
  /** The last line this many times as tall as the others (1.3: the name it ends on). */
  last?: number;
  /** Lines to cut a text without \n into (by default about ten letters a line). */
  lines?: number;
  align?: "left" | "center" | "right";
  style?: CSSProperties;
  seed?: string;
};

/** The textures of a hand's stroke as PNG data URLs, made once each (in a browser; elsewhere, none). */
const strokeTextures = new Map<string, string | null>();
function strokeTextureUrl(kind: "slow" | "fine", size: number, seed: string, cells?: number): string | null {
  if (typeof document === "undefined") return null;
  const key = `${kind}|${size}|${seed}|${cells ?? ""}`;
  if (strokeTextures.has(key)) return strokeTextures.get(key)!;
  let url: string | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(size, size);
      image.data.set(strokeTexture(kind, size, seed, cells));
      ctx.putImageData(image, 0, 0);
      url = canvas.toDataURL("image/png");
    }
  } catch {
    url = null;
  }
  strokeTextures.set(key, url);
  return url;
}
/** Each texture decoded once: an feImage not decoded yet draws nothing, so the first image waits for it. */
const decodedTextures = new Map<string, Promise<void>>();
const decodeTexture = (url: string) => {
  const known = decodedTextures.get(url);
  if (known) return known;
  const image = new Image();
  image.src = url;
  const done = image.decode().catch(() => undefined);
  decodedTextures.set(url, done);
  return done;
};

/**
 * A text written by hand that never repeats (« Carte au feutre »: « PUT THAT / PHONE DOWN / & COME TO / BURGER NIGHT »
 * in red grease pencil): each line fits the width of its box, the last one taller; each letter a little different from
 * the last time it was written (its height, width, angle and place), each line a little crooked; one SVG filter over
 * the whole gives the stroke a dry grain, its rim darker, and with `bend` bends each letter its own way (a slow noise:
 * no letter sits on the same part of it). Its noises are small textures made once, never recomputed at every image.
 * In the font it is given (a handwritten one: Covered By Your Grace, Caveat Brush, Permanent Marker…).
 */
function HandwritingOf(hooks: KitHooks) {
  return function Handwriting({ text, box, at = 0, upTo, every, color = "#b20b21", grain = 0.6, wobble = 1, bend = 0, last = 1.3, lines, align = "left", style, seed = "hand" }: HandwritingProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    // Its stroke's textures, made once for its seed (a slow noise that bends its letters, a fine grain), decoded before an image is taken.
    const slowUrl = num(bend, 0) > 0 ? strokeTextureUrl("slow", 48, seed, 10) : null;
    const fineUrl = num(grain, 0.6) > 0 ? strokeTextureUrl("fine", 128, seed) : null;
    const [handle] = useState(() => (slowUrl || fineUrl ? delayRender("handwriting textures", { timeoutInMilliseconds: 20000 }) : null));
    useEffect(() => {
      if (handle === null) return;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        continueRender(handle);
      };
      Promise.all([slowUrl, fineUrl].filter((u): u is string => Boolean(u)).map(decodeTexture)).then(release);
      return release;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (frame < at) return null;
    const b = box ?? { x: video.width * 0.12, y: video.height * 0.3, w: video.width * 0.76, h: video.height * 0.3 };
    const rows = handBreak(text, lines);
    const slots = handSlots(rows.length, b.h, num(last, 1.3));
    const w = Math.max(0, num(wobble, 1));
    const g = Math.max(0, Math.min(1, num(grain, 0.6)));
    // How many letters show: spaces counted, its lines joined by one space (the words written so far).
    const total = letters(rows.join(" ")).length;
    const words = rows.join(" ").split(" ");
    const shown =
      upTo !== undefined && Number.isFinite(upTo)
        ? upTo
        : every && every > 0
          ? letters(words.slice(0, Math.floor((frame - at) / every) + 1).join(" ")).length
          : total;
    // The textures at the scale of its letters (a line's height): the slow noise over the whole box, the grain tiled.
    const unit = slots[0]?.h ?? b.h;
    const tile = Math.round(128 * Math.max(1, Math.min(4, unit / 56)));
    const dark = interpolateColors(0.38, [0, 1], [color, "#000000"]);
    const bent = Math.max(0, Math.min(1, num(bend, 0)));
    const bends = bent > 0 && slowUrl;
    const dry = g > 0 && fineUrl;
    let index = 0;
    return (
      <div
        style={{
          position: "absolute",
          left: b.x,
          top: b.y,
          width: b.w,
          height: b.h,
          filter: bends || dry ? `url(#h${id})` : undefined,
        }}
      >
        {bends || dry ? (
          <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
            {/* Each result is used once (the filter's steps are not shared: a result used twice is computed twice, and
                bending the letters first then graining them cost three times their sum): the grain and the rim on
                the letters as they are, then one bend of the whole at the end. */}
            <filter id={`h${id}`} x="-6%" y="-10%" width="112%" height="120%" colorInterpolationFilters="sRGB">
              {dry ? (
                <>
                  <feGaussianBlur in="SourceGraphic" stdDeviation={Math.max(0.6, unit * 0.012).toFixed(2)} result="soft" />
                  <feImage href={fineUrl} x={0} y={0} width={tile} height={tile} preserveAspectRatio="none" result="grain" />
                  <feTile in="grain" result="fine" />
                  {/* A dry stroke: the grain eats its edges (where its blurred self thins) far more than its middle. */}
                  <feComposite in="soft" in2="fine" operator="arithmetic" k1={0} k2={2.6} k3={-1.2 * g} k4={-(0.9 + 0.2 * g)} result="mask" />
                  {/* Its rim darker where the ink dries: its colour, and a darker one where the stroke thins. */}
                  <feComposite in="soft" in2="soft" operator="arithmetic" k1={0} k2={-1} k3={0} k4={1} result="thin" />
                  <feFlood floodColor={color} result="ink" />
                  <feFlood floodColor={dark} floodOpacity={0.55 + 0.4 * g} result="dark" />
                  <feComposite in="dark" in2="thin" operator="in" result="rim" />
                  <feMerge result="tinted">
                    <feMergeNode in="ink" />
                    <feMergeNode in="rim" />
                  </feMerge>
                  <feComposite in="tinted" in2="mask" operator="in" result="inked" />
                </>
              ) : null}
              {bends ? (
                <>
                  <feImage href={slowUrl} x={-b.w * 0.06} y={-b.h * 0.1} width={b.w * 1.12} height={b.h * 1.2} preserveAspectRatio="none" result="slow" />
                  <feDisplacementMap in={dry ? "inked" : "SourceGraphic"} in2="slow" scale={(unit * 0.05 * bent).toFixed(2)} xChannelSelector="R" yChannelSelector="G" />
                </>
              ) : null}
            </filter>
          </svg>
        ) : null}
        {rows.map((row, li) => {
          const slot = slots[li]!;
          const chars = letters(row);
          const strays = handStrays(chars.length, `${seed}-${li}`, random, w);
          const crooked = handLine(seed, li, random, w);
          const start = index;
          index += chars.length + 1;
          // The last line (the name it ends on) in tighter letters, so it comes out bigger even when it is long.
          const tight = li === rows.length - 1 && rows.length > 1 && num(last, 1.3) > 1 ? "-0.04em" : undefined;
          // Each line fills the width: its box tall enough that only the width limits it (a handwritten font's line is
          // much taller than its capitals), its size at most the one whose capitals fill the slot (about 0.72 em), and
          // from a size its letters about fill (FitText shrinks to 0.3 at most: a wide marker would stay too big).
          return (
            <Fit
              key={li}
              style={{ position: "absolute", left: 0, top: slot.top - slot.h, width: b.w, height: slot.h * 3 }}
              innerStyle={{
                fontSize: Math.min((slot.h / 0.72) * 0.92, b.w / (Math.max(1, chars.length) * 0.38)),
                lineHeight: 1,
                whiteSpace: "nowrap",
                color,
                alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
                textAlign: align,
                ...style,
              }}
            >
              <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap", transform: `translateY(${crooked.shift}em) rotate(${crooked.tilt.toFixed(2)}deg)` }}>
                {/* Its letters, each its own drawing (a letter alone is a mark to the scene check)… */}
                <span data-fauve-decor="" style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                  {chars.map((c, ci) => {
                    const s = strays[ci]!;
                    return (
                      <span
                        key={ci}
                        style={{
                          display: "inline-block",
                          whiteSpace: "pre",
                          marginRight: tight,
                          transformOrigin: "50% 75%",
                          transform: `translate(${s.dx.toFixed(3)}em, ${s.dy.toFixed(3)}em) rotate(${s.rotate.toFixed(2)}deg) scale(${s.sx.toFixed(3)}, ${s.sy.toFixed(3)})`,
                          opacity: start + ci < shown ? 1 : 0,
                        }}
                      >
                        {c}
                      </span>
                    );
                  })}
                </span>
                {/* …and the words written so far, unseen over them, which the scene check reads as a text (its place, its size). */}
                {shown > start ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      whiteSpace: "pre",
                      letterSpacing: tight,
                      color: "transparent",
                      WebkitTextFillColor: "transparent",
                      WebkitTextStroke: "0",
                      textShadow: "none",
                      pointerEvents: "none",
                    }}
                  >
                    {chars.slice(0, Math.max(0, shown - start)).join("")}
                  </span>
                ) : null}
              </span>
            </Fit>
          );
        })}
      </div>
    );
  };
}

// ——— Scribble ————————————————————————————————————————————————————————————————————————

type Point = { x: number; y: number };
type ScribbleKind = "loop" | "capsule" | "cells" | "underline" | "strike" | "zigzag" | "arrow" | "cross" | "tick" | "star" | "scribble";
type ScribbleProps = {
  kind?: ScribbleKind;
  /** What it is drawn around, under or through (px of the frame). */
  box?: Box;
  /** For cells: the boxes of the rows it goes round in one stroke, one under the other (px: a word over two rows of a grid). */
  rows?: Box[];
  /** For an arrow. */
  from?: Point;
  to?: Point;
  /** A capsule (or a loop) along this angle, degrees: a word written on a diagonal. */
  angle?: number;
  at?: number;
  /** Frames to draw it (14: a hand draws a loop in about half a second)… */
  frames?: number;
  /**
   * …or a hand's pace, px an image on average (the frame's px: about a letter every 5 images round a word, 20 to 25 px
   * round letters of 110): no easing, slower in the turns, a little faster on the way back; Scribble.frames(props)
   * says how long it takes, to start the next one as it closes.
   */
  speed?: number;
  /** Where a loop, a capsule or cells start (top-left: just above the first letter) and which way they turn (ccw, like the hand of « Mots mêlés »). */
  start?: StrokeStart;
  direction?: Turn;
  color?: string;
  width?: number;
  /** How shaky the hand is (1). */
  wobble?: number;
  /** Redrawn slightly differently every n frames, like a hand-drawn animation (0: still). */
  boil?: number;
  /** Fades out from this frame. */
  out?: number;
  seed?: string;
};

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

type ScribbleShape = { from?: Point; to?: Point; angle?: number; wobble?: number; seed: string; start?: StrokeStart; direction?: Turn; rows?: Box[] };

/** The hand-drawn path of a scribble, in px of the frame. */
export function scribblePath(kind: ScribbleKind, box: Box, opts: ScribbleShape): string {
  return scribbleStroke(kind, box, opts).d;
}

/**
 * A scribble's path and the points it goes through, stroke by stroke (a cross has two), for a hand's pace along them;
 * `closed` when it goes round (a hand comes back faster). With `start` or `direction`, a loop or a capsule starts
 * there and turns that way, closing on its start (« Mots mêlés »); without, the shapes are drawn as they always were.
 */
export function scribbleStroke(kind: ScribbleKind, box: Box, opts: ScribbleShape): { d: string; strokes: Point[][]; closed: boolean } {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const amp = Math.max(w, h) * 0.018 * (opts.wobble ?? 1);
  // A hand drifts slowly: a smooth noise through a value every 8 points, not a shake at every point.
  const jit = (i: number, axis: string) => {
    const k = Math.floor(i / 8);
    const f = (i % 8) / 8;
    const ease = (1 - Math.cos(f * Math.PI)) / 2;
    const at = (n: number) => random(`${opts.seed}-${axis}-${n}`) * 2 - 1;
    return (at(k) * (1 - ease) + at(k + 1) * ease) * amp;
  };
  const rot = ((opts.angle ?? 0) * Math.PI) / 180;
  const turn = (p: Point): Point => ({ x: cx + (p.x - cx) * Math.cos(rot) - (p.y - cy) * Math.sin(rot), y: cy + (p.x - cx) * Math.sin(rot) + (p.y - cy) * Math.cos(rot) });
  const shake = (ps: Point[]) => ps.map((p, i) => ({ x: p.x + jit(i, "x"), y: p.y + jit(i, "y") }));
  const one = (pts: Point[], closed: boolean) => ({ d: smooth(pts), strokes: [pts], closed });
  // A hand that starts where it is told and goes the way it is told (the loops of « Mots mêlés »).
  const handed = opts.start !== undefined || opts.direction !== undefined;
  const start = opts.start ?? "top-left";
  const direction = opts.direction ?? "ccw";
  switch (kind) {
    case "cells": {
      // One stroke round several rows of a grid: the rounded outline of their cells, in steps (never turned).
      const rows = opts.rows?.length ? opts.rows : [box];
      return one(shake(cellsRing(rows, start, direction)), true);
    }
    case "loop":
    case "scribble": {
      if (kind === "loop" && handed) return one(shake(loopRing(box, start, direction).map(turn)), true);
      const turns = kind === "scribble" ? 2.4 : 1.12;
      const n = Math.round(44 * turns);
      const pts: Point[] = [];
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI * 0.6 + (i / n) * turns * Math.PI * 2;
        const grow = 1 + (kind === "scribble" ? 0.08 * Math.sin(i * 0.7) : 0.05 * (i / n));
        pts.push(turn({ x: cx + Math.cos(a) * (w / 2) * 1.14 * grow, y: cy + Math.sin(a) * (h / 2) * 1.3 * grow }));
      }
      return one(shake(pts), true);
    }
    case "capsule": {
      if (handed) return one(shake(capsuleRing(box, start, direction).map(turn)), true);
      // A stadium around a word: two half circles joined by two straight sides, ending a little past its start.
      const r = h / 2;
      const half = Math.max(0, w / 2 - r);
      const pts: Point[] = [];
      const n = 64;
      const perimeter = 4 * half + 2 * Math.PI * r;
      for (let i = 0; i <= n * 1.08; i++) {
        let s = ((i / n) * perimeter + perimeter * 0.85) % perimeter;
        let p: Point;
        if (s < 2 * half) p = { x: cx - half + s, y: cy - r };
        else if ((s -= 2 * half) < Math.PI * r) {
          const a = -Math.PI / 2 + s / r;
          p = { x: cx + half + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        } else if ((s -= Math.PI * r) < 2 * half) p = { x: cx + half - s, y: cy + r };
        else {
          s -= 2 * half;
          const a = Math.PI / 2 + s / r;
          p = { x: cx - half + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        }
        pts.push(turn(p));
      }
      return one(shake(pts), true);
    }
    case "underline":
      return one(shake([0, 0.25, 0.5, 0.75, 1].map((t) => turn({ x: x - w * 0.03 + t * w * 1.06, y: y + h * 1.04 + Math.sin(t * Math.PI) * h * 0.05 - t * h * 0.03 }))), false);
    case "strike":
      return one(shake([0, 0.33, 0.66, 1].map((t) => turn({ x: x - w * 0.03 + t * w * 1.06, y: cy + h * 0.06 - t * h * 0.12 }))), false);
    case "zigzag": {
      const teeth = Math.max(3, Math.round(w / Math.max(20, h * 0.6)));
      return one(shake(Array.from({ length: teeth * 2 + 1 }, (_, i) => turn({ x: x + (i / (teeth * 2)) * w, y: i % 2 ? y + h * 0.15 : y + h * 0.85 }))), false);
    }
    case "cross": {
      const first = shake([turn({ x, y }), turn({ x: cx, y: cy }), turn({ x: x + w, y: y + h })]);
      const second = shake([turn({ x: x + w, y }), turn({ x: cx, y: cy }), turn({ x, y: y + h })]);
      return { d: `${smooth(first)} ${smooth(second)}`, strokes: [first, second], closed: false };
    }
    case "tick":
      return one(shake([turn({ x, y: y + h * 0.55 }), turn({ x: x + w * 0.38, y: y + h }), turn({ x: x + w, y })]), false);
    case "star": {
      const pts: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
        const r = i % 2 ? 0.18 : 0.5;
        pts.push({ x: cx + Math.cos(a) * w * r, y: cy + Math.sin(a) * h * r });
      }
      return { d: pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "), strokes: [pts], closed: true };
    }
    case "arrow":
    default: {
      const a = opts.from ?? { x, y: y + h };
      const b = opts.to ?? { x: x + w, y };
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const bend = len * 0.12;
      const mid = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend };
      const shaftPts = shake([a, { x: (a.x + mid.x) / 2 + nx * bend * 0.4, y: (a.y + mid.y) / 2 + ny * bend * 0.4 }, mid, b]);
      const shaft = smooth(shaftPts);
      const dir = Math.atan2(b.y - mid.y, b.x - mid.x);
      const head = Math.min(60, len * 0.18);
      const wing = (s: number) => ({ x: b.x - Math.cos(dir + s * 0.5) * head, y: b.y - Math.sin(dir + s * 0.5) * head });
      const w1 = wing(1);
      const w2 = wing(-1);
      return {
        d: `${shaft} M ${w1.x.toFixed(1)} ${w1.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} L ${w2.x.toFixed(1)} ${w2.y.toFixed(1)}`,
        strokes: [shaftPts, [w1, b, w2]],
        closed: false,
      };
    }
  }
}

/** The box a scribble is drawn in: its own, its rows' bounds for cells, or a default one in the frame. */
function scribbleBox(kind: ScribbleKind, box: Box | undefined, rows: Box[] | undefined, video: { width: number; height: number }): Box {
  if (box) return box;
  if (kind === "cells" && rows?.length) {
    const x0 = Math.min(...rows.map((r) => r.x));
    const y0 = Math.min(...rows.map((r) => r.y));
    return { x: x0, y: y0, w: Math.max(...rows.map((r) => r.x + r.w)) - x0, h: Math.max(...rows.map((r) => r.y + r.h)) - y0 };
  }
  return { x: video.width * 0.3, y: video.height * 0.4, w: video.width * 0.4, h: video.height * 0.08 };
}

/** A hand's pace along a scribble: a turn is measured against its rows' height for cells, its own half height otherwise. */
const scribblePace = (kind: ScribbleKind, stroke: ReturnType<typeof scribbleStroke>, b: Box, rows: Box[] | undefined, speed: number) =>
  handPace(stroke.strokes, speed, { closed: stroke.closed, radius: kind === "cells" && rows?.length ? Math.min(...rows.map((r) => r.h)) / 2 : Math.max(1, Math.min(b.w, b.h) / 2) });

function ScribbleOf(hooks: KitHooks) {
  const Scribble = function Scribble({
    kind = "loop",
    box,
    rows,
    from,
    to,
    angle,
    at = 0,
    frames = 14,
    speed,
    start,
    direction,
    color = "#ffffff",
    width = 6,
    wobble = 1,
    boil = 0,
    out,
    seed = "scribble",
  }: ScribbleProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const b = scribbleBox(kind, box, rows, video);
    const tick = boil > 0 ? Math.floor((frame - at) / boil) : 0;
    const stroke = scribbleStroke(kind, b, { from, to, angle, wobble, seed: `${seed}-${tick}`, start, direction, rows });
    // At a hand's pace (no easing, slower in the turns), or in its frames with an ease-out as it always was.
    const drawn =
      speed !== undefined && speed > 0
        ? scribblePace(kind, stroke, b, rows, speed).drawn(frame - at)
        : interpolate(frame, [at, at + Math.max(1, frames)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const fade = out === undefined ? 1 : interpolate(frame, [out, out + 8], [1, 0], clamp);
    if (fade <= 0) return null;
    return (
      <svg width={video.width} height={video.height} viewBox={`0 0 ${video.width} ${video.height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: fade }} aria-hidden="true">
        <path d={stroke.d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - drawn} />
      </svg>
    );
  };
  /** How many frames a scribble takes at a hand's pace (its `speed`), or its `frames`: to start the next one as it closes. */
  const frames = (p: ScribbleProps) => {
    // Its default box is the one of a 1080 × 1920 frame (a composition's size).
    const video = { width: 1080, height: 1920 };
    const kind = p.kind ?? "loop";
    if (!(p.speed !== undefined && p.speed > 0)) return Math.max(1, num(p.frames, 14));
    const b = scribbleBox(kind, p.box, p.rows, video);
    const stroke = scribbleStroke(kind, b, { from: p.from, to: p.to, angle: p.angle, wobble: p.wobble ?? 1, seed: `${p.seed ?? "scribble"}-0`, start: p.start, direction: p.direction, rows: p.rows });
    return Math.ceil(scribblePace(kind, stroke, b, p.rows, p.speed).frames);
  };
  return Object.assign(Scribble, { frames });
}

// ——— WordSearch ——————————————————————————————————————————————————————————————————————

type WordSearchProps = {
  /** The words hidden in the grid, found one after the other. */
  words: string[];
  /** Words of her world hidden in the grid too, never circled (along a row, down a column or a diagonal): « brioche », « cannelle ». */
  decoys?: string[];
  cols?: number;
  rows?: number;
  at?: number;
  /** Frames between two words found (60)… */
  every?: number;
  /** …and to draw the loop around a word (15); */
  loop?: number;
  /**
   * or a hand's pace: images a letter (5, « Mots mêlés »), each loop from just above its first letter, counterclockwise,
   * at the speed of a hand, and the next one `lift` frames after it closes (4: the pen lifted).
   */
  pace?: number;
  lift?: number;
  /** The grid's letters; the found words' letters; the loops. */
  color?: string;
  found?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Where the grid is (px), the whole frame by default. */
  box?: Box;
  style?: CSSProperties;
  seed?: string;
};

function WordSearchOf(hooks: KitHooks, Scribble: ReturnType<typeof ScribbleOf>) {
  return function WordSearch({
    words,
    decoys = [],
    cols,
    rows,
    at = 0,
    every = 60,
    loop = 15,
    pace,
    lift = 4,
    color = "rgba(255,255,255,0.62)",
    found = "#ffffff",
    stroke = "#ffffff",
    strokeWidth = 4,
    box,
    style,
    seed = "words",
  }: WordSearchProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const area = box ?? { x: 0, y: 0, w: video.width, h: video.height };
    const longest = Math.max(4, ...words.map((w) => plainLetters(w).length));
    const nc = Math.max(num(cols, 9), Math.min(longest + 1, 14));
    const cw = area.w / nc;
    const nr = Math.max(4, Math.round(num(rows, area.h / cw)));
    const ch = area.h / nr;
    const safe = safeRect(video.width, video.height);
    const center = (c: number, r: number) => ({ x: area.x + (c + 0.5) * cw, y: area.y + (r + 0.5) * ch });
    const allowed = (c: number, r: number) => {
      const p = center(c, r);
      return p.x - cw * 0.4 >= safe.x && p.x + cw * 0.4 <= safe.x + safe.w && p.y - ch * 0.4 >= safe.y && p.y + ch * 0.4 <= safe.y + safe.h;
    };
    const grid = new Map<string, string>();
    const placed = placeWords(words, nc, nr, allowed, seed, random, grid);
    const taken = new Set(placed.flatMap((p) => p.cells.map(([c, r]) => `${c},${r}`)));
    // Her other words, hidden among the letters and never circled: anywhere in the grid, crossing hers on a shared letter.
    const hidden = decoys.length ? placeWords(decoys, nc, nr, () => true, `${seed}-decoy`, random, grid) : [];
    const decoyAt = new Map(hidden.flatMap((p) => p.cells.map(([c, r], k) => [`${c},${r}`, p.word[k]!] as const)));
    const size = Math.min(cw, ch) * 0.46;
    const cell = (c: number, r: number, ch2: string, extra?: CSSProperties) => {
      const p = center(c, r);
      return (
        <div key={`${c},${r}`} style={{ position: "absolute", left: p.x - cw / 2, top: p.y - ch / 2, width: cw, height: ch, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size, color, ...style, ...extra }}>
          {ch2}
        </div>
      );
    };
    const filler: ReactNode[] = [];
    for (let r = 0; r < nr; r++)
      for (let c = 0; c < nc; c++) {
        if (taken.has(`${c},${r}`)) continue;
        filler.push(cell(c, r, decoyAt.get(`${c},${r}`) ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(random(`${seed}-l-${c}-${r}`) * 26)]!));
      }
    // At a hand's pace, each loop starts as the one before closes, the pen lifted a moment.
    const handed = pace !== undefined && pace > 0;
    const speed = handed ? Math.min(cw, ch) / pace : undefined;
    let next = at;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div data-fauve-decor="" style={{ position: "absolute", inset: 0 }}>
          {filler}
        </div>
        {placed.map((p, i) => {
          const [a, b] = [center(...p.cells[0]!), center(...p.cells.at(-1)!)];
          const length = Math.hypot(b.x - a.x, b.y - a.y) + Math.min(cw, ch) * 0.95;
          const thick = Math.min(cw, ch) * 0.78;
          const ring = { x: (a.x + b.x) / 2 - length / 2, y: (a.y + b.y) / 2 - thick / 2, w: length, h: thick };
          const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          const hand = handed ? ({ speed, start: "top-left", direction: "ccw" } as const) : {};
          const takes = handed ? Scribble.frames({ kind: "capsule", box: ring, angle, wobble: 0.5, seed: `${seed}-loop-${i}`, ...hand }) : loop;
          const when = handed ? next : at + i * every;
          next = when + takes + Math.max(0, lift);
          const isFound = frame >= when + takes * 0.6;
          return (
            <React.Fragment key={p.word + i}>
              <div style={{ position: "absolute", inset: 0 }}>{p.cells.map(([c, r], k) => cell(c, r, p.word[k]!, isFound ? { color: found } : undefined))}</div>
              <Scribble kind="capsule" box={ring} angle={angle} at={when} frames={loop} color={stroke} width={strokeWidth} wobble={0.5} seed={`${seed}-loop-${i}`} {...hand} />
            </React.Fragment>
          );
        })}
      </div>
    );
  };
}

// ——— Picto ———————————————————————————————————————————————————————————————————————————

type PictoProps = {
  /** Its trade or what it shows, in French or English (« café », « fleuriste », « coiffure », « scissors »), or its name (pictos.ts). */
  name: string;
  /** Where (px), drawn square in the middle of it; without a box, inline in the text it sits in, `size` high (1em). */
  box?: Box;
  size?: number | string;
  at?: number;
  /** Frames it takes to draw itself, stroke after stroke (20; 0: whole at once)… */
  frames?: number;
  /** …or a hand's pace, px an image. */
  speed?: number;
  /** Its stroke: the text's colour by default (currentColor), its width in px with a box (5.5 % of its size; inline, 8.5 %). */
  color?: string;
  width?: number;
  /** Fades out from this frame. */
  out?: number;
};

/** Each pictogram's strokes' lengths, measured once. */
const pictoLengths = new Map<string, number[]>();

/**
 * A line pictogram of her trade (a café's cup, a florist's tulip, a hairdresser's scissors, a studio's lotus, a bar's
 * cocktail…: pictos.ts), drawn stroke after stroke like a line by hand, in the colour of the text it goes with. Nothing
 * when no pictogram stands for that name.
 */
function PictoOf(hooks: KitHooks) {
  return function Picto({ name, box, size = "1em", at = 0, frames = 20, speed, color = "currentColor", width, out }: PictoProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const key = pictoFor(String(name ?? ""));
    const picto = key ? PICTOS[key] : undefined;
    if (!key || !picto) return null;
    const lengths = pictoLengths.get(key) ?? pictoLengths.set(key, picto.paths.map((d) => pathLength(d))).get(key)!;
    const total = lengths.reduce((a, b) => a + b, 0);
    const side = box ? Math.min(box.w, box.h) : null;
    // Its stroke in the drawing's own units (100 a side): px given for a box; inline, close to the stem of its text.
    const stroke = side ? (width !== undefined ? (width * 100) / side : 5.5) : 8.5;
    const time = speed !== undefined && speed > 0 && side ? (total * side) / 100 / speed : Math.max(0, num(frames, 20));
    const drawn = time > 0 ? Math.max(0, Math.min(1, (frame - at) / time)) : 1;
    const fade = out === undefined ? 1 : interpolate(frame, [out, out + 8], [1, 0], clamp);
    if (fade <= 0) return null;
    let before = 0;
    const place: CSSProperties =
      box && side
        ? { position: "absolute", left: box.x + (box.w - side) / 2, top: box.y + (box.h - side) / 2, width: side, height: side }
        : { display: "inline-block", width: size, height: size, verticalAlign: "-0.12em" };
    return (
      <svg viewBox="0 0 100 100" style={{ overflow: "visible", opacity: fade, ...place }} aria-hidden="true">
        <g fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          {picto.paths.map((d, i) => {
            const own = Math.max(0, Math.min(1, (drawn * total - before) / Math.max(1e-6, lengths[i]!)));
            before += lengths[i]!;
            // A stroke not started yet is not drawn at all (a round cap would leave a dot).
            return own > 0 ? <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - own} /> : null;
          })}
        </g>
      </svg>
    );
  };
}

// ——— Kinetic —————————————————————————————————————————————————————————————————————————

type KineticProps = {
  /** The sentence, said one word (or one chunk) at a time. */
  text: string | string[];
  at?: number;
  /** Frames per word (8), or the frame of each word (her cuts, the beat). */
  every?: number;
  times?: number[];
  /** slam: each word alone, as big as it goes, landing hard; swap: the same, alternating size and side; stack: the words pile up as lines filling the box. */
  mode?: "slam" | "swap" | "stack";
  /** The largest size a word takes (px, 260). */
  size?: number;
  box?: Box;
  /** The last word stays until this frame (the scene's end by default). */
  out?: number;
  style?: CSSProperties;
  /** Words drawn hollow (an outline), every other one in swap. */
  outline?: boolean;
  seed?: string;
};

function KineticOf(hooks: KitHooks) {
  return function Kinetic({ text, at = 0, every = 8, times, mode = "slam", size = 260, box, out, style, outline = false, seed = "kinetic" }: KineticProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at || (out !== undefined && frame >= out)) return null;
    const words = Array.isArray(text) ? text : text.split(/\s+/).filter(Boolean);
    const starts = words.map((_, i) => num(times?.[i], at + i * every));
    let current = -1;
    starts.forEach((s, i) => {
      if (s <= frame) current = i;
    });
    const area = box ?? safeRect(video.width, video.height);
    const hollow = (i: number): CSSProperties =>
      outline && (mode !== "swap" || i % 2 === 1) ? { color: "transparent", WebkitTextStroke: `${Math.max(2, size * 0.012)}px ${style?.color ?? "#ffffff"}` } : {};
    if (mode === "stack") {
      const lineH = area.h / Math.max(1, words.length);
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          {words.map((w, i) => (
            <Fit
              key={i}
              style={{ position: "absolute", left: area.x, top: area.y + i * lineH, width: area.w, height: lineH, opacity: i <= current ? 1 : 0 }}
              innerStyle={{ fontSize: Math.min(size, lineH * 0.95), lineHeight: 0.92, color: "#ffffff", whiteSpace: "nowrap", ...style, ...hollow(i) }}
            >
              {w}
            </Fit>
          ))}
        </div>
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {words.map((w, i) => {
          const on = i === current;
          const local = frame - starts[i]!;
          const scale = on ? interpolate(local, [0, 3], [1.12, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
          const small = mode === "swap" && random(`${seed}-s-${i}`) < 0.4;
          const side = mode === "swap" ? (["left", "center", "right"] as const)[Math.floor(random(`${seed}-a-${i}`) * 3)]! : "center";
          return (
            <Fit
              key={i}
              style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, opacity: on ? 1 : 0, transform: `scale(${scale})` }}
              innerStyle={{ fontSize: small ? size * 0.55 : size, lineHeight: 0.92, color: "#ffffff", textAlign: side, whiteSpace: "nowrap", width: "100%", ...style, ...hollow(i) }}
            >
              {w}
            </Fit>
          );
        })}
      </div>
    );
  };
}

// ——— The loud kit: WordArt and Burst ——————————————————————————————————————————————————

type WordArtLook = "rainbow" | "chrome" | "gold" | "fire" | "neon" | "comic" | "bubble";
const WORDART: Record<WordArtLook, { fill: string; stroke?: string; extrude: string; glow?: string }> = {
  rainbow: { fill: "linear-gradient(90deg,#ff004c,#ff8a00,#ffe600,#2bd96b,#00b3ff,#8f45ff)", stroke: "#ffffff", extrude: "#3a1d6e" },
  chrome: { fill: "linear-gradient(180deg,#ffffff 0%,#c7ced6 40%,#3a3f47 50%,#aab3bd 70%,#ffffff 100%)", stroke: "#1b1e23", extrude: "#1b1e23" },
  gold: { fill: "linear-gradient(180deg,#fff6c2 0%,#f5c542 45%,#a8741a 55%,#ffe27a 100%)", stroke: "#5a3a06", extrude: "#5a3a06" },
  fire: { fill: "linear-gradient(0deg,#d10000 0%,#ff6a00 45%,#ffe600 100%)", stroke: "#5a0000", extrude: "#3d0000" },
  neon: { fill: "#ffffff", extrude: "transparent", glow: "#ff2bd6" },
  comic: { fill: "#ffe600", stroke: "#000000", extrude: "#000000" },
  bubble: { fill: "#ff7ad9", stroke: "#ffffff", extrude: "#b0247f" },
};

type WordArtProps = {
  text: string;
  look?: WordArtLook;
  /** Depth of the 3D extrusion (px, 12). */
  extrude?: number;
  at?: number;
  enter?: "bounce" | "spin" | "zoom" | "none";
  /** Letters bobbing up and down. */
  wave?: boolean;
  style?: CSSProperties;
};

function WordArtOf(hooks: KitHooks) {
  return function WordArt({ text, look = "rainbow", extrude = 12, at = 0, enter = "bounce", wave = false, style }: WordArtProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const art = WORDART[look] ?? WORDART.rainbow;
    const t = frame - at;
    const p = interpolate(t, [0, 16], [0, 1], { ...clamp, easing: enter === "bounce" ? Easing.out(Easing.back(3)) : Easing.out(Easing.cubic) });
    const motion =
      enter === "bounce" ? `scale(${p})` : enter === "spin" ? `rotate(${(1 - p) * -540}deg) scale(${p})` : enter === "zoom" ? `scale(${1 + (1 - p) * 2.5})` : "none";
    const depth = Math.max(0, extrude);
    const shadows = Array.from({ length: Math.ceil(depth) }, (_, k) => `${(k + 1) * 0.5}px ${k + 1}px 0 ${art.extrude}`);
    const glow = art.glow ? `0 0 8px ${art.glow}, 0 0 22px ${art.glow}, 0 0 48px ${art.glow}` : undefined;
    const gradient = art.fill.includes("gradient");
    const fillStyle: CSSProperties = gradient ? { backgroundImage: art.fill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: art.fill };
    const content = (fill: boolean) =>
      wave
        ? letters(text).map((c, i) => (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${Math.sin(frame / 5 + i * 0.8) * 0.06}em)`, ...(fill ? fillStyle : {}) }}>
              {c}
            </span>
          ))
        : text;
    return (
      <span style={{ position: "relative", display: "inline-block", transform: motion, fontWeight: 900, ...style }}>
        {/* The extrusion and the outline, under the fill: only decoration for the checks. */}
        <span data-fauve-decor="" aria-hidden="true" style={{ position: "absolute", inset: 0, color: art.stroke ?? art.extrude, textShadow: shadows.join(", ") || undefined, WebkitTextStroke: art.stroke ? `0.14em ${art.stroke}` : undefined }}>
          {content(false)}
        </span>
        <span style={{ position: "relative", ...(wave ? {} : fillStyle), textShadow: glow }}>{content(true)}</span>
      </span>
    );
  };
}

type BurstProps = {
  /** How many points the star has (16). */
  points?: number;
  /** Its size (px, 460) and centre. */
  size?: number;
  center?: Point;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  /** How deep the points are cut (0.72: the inner radius as a share of the outer one). */
  inner?: number;
  /** Turns, degrees a second (20). */
  spin?: number;
  /** Beats a little in size. */
  pulse?: boolean;
  at?: number;
  /** What it carries, centred (a price, a word). */
  children?: ReactNode;
  style?: CSSProperties;
};

function BurstOf(hooks: KitHooks) {
  return function Burst({ points = 16, size = 460, center, color = "#ffe600", stroke = "#e4002b", strokeWidth = 8, inner = 0.72, spin = 20, pulse = false, at = 0, children, style }: BurstProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const t = frame - at;
    const c = center ?? { x: video.width / 2, y: video.height * 0.42 };
    const pop = interpolate(t, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.5)) });
    const beat = pulse ? 1 + 0.04 * Math.sin((t / 30) * Math.PI * 4) : 1;
    const n = Math.max(5, Math.round(points)) * 2;
    const r = size / 2 - strokeWidth;
    const star = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * inner : r;
      return `${(size / 2 + Math.cos(a) * rr).toFixed(1)},${(size / 2 + Math.sin(a) * rr).toFixed(1)}`;
    }).join(" ");
    return (
      <div style={{ position: "absolute", left: c.x - size / 2, top: c.y - size / 2, width: size, height: size, transform: `scale(${pop * beat})`, ...style }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: `rotate(${(t / 30) * spin}deg)` }} aria-hidden="true">
          <polygon points={star} fill={color} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
        </svg>
        <div style={{ position: "absolute", inset: size * 0.2, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</div>
      </div>
    );
  };
}

/** The text and materials kit, bound to a clock (the render's, or the scene check's own for each copy). */
export function makeType(hooks: KitHooks) {
  const Decode = DecodeOf(hooks);
  const TypeOn = TypeOnOf(hooks);
  const Reveal = RevealOf(hooks);
  const Scribble = ScribbleOf(hooks);
  const Handwriting = HandwritingOf(hooks);
  return {
    Decode,
    TypeOn,
    Reveal,
    Count: CountOf(hooks),
    Edges: EdgesOf(hooks, Reveal, TypeOn, Decode),
    Paper,
    Emboss: EmbossOf(hooks),
    Card: CardOf(hooks, Handwriting),
    Scribble,
    WordSearch: WordSearchOf(hooks, Scribble),
    Kinetic: KineticOf(hooks),
    WordArt: WordArtOf(hooks),
    Burst: BurstOf(hooks),
    // The hand-made pieces the models' fiches asked for (« Carte au feutre », « Silhouette et mot »).
    Handwriting,
    Picto: PictoOf(hooks),
  };
}
