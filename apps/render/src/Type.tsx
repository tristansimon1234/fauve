import React, { useId, type CSSProperties, type ReactNode } from "react";
import { Easing, interpolate, interpolateColors, random } from "remotion";
import { Fit } from "./Fit";
import type { Box, KitHooks } from "./Kit";

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
  return function TypeOn({ text, at = 0, speed = 4.5, by = "letter", jitter = 0.6, caret = "none", caretColor, style, seed = "type" }: TypeOnProps) {
    const frame = hooks.useCurrentFrame();
    if (frame < at) return null;
    const units = by === "word" ? text.split(/(\s+)/).filter(Boolean) : letters(text);
    const times = typingTimes(units, speed, jitter, seed);
    const t = frame - at;
    let shown = 0;
    while (shown < units.length && times[shown]! <= t) shown++;
    const done = shown >= units.length;
    const blinkOn = !done || Math.floor((t - (times.at(-1) ?? 0)) / 15) % 2 === 0;
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

type RevealFrom = "rise" | "fall" | "blur" | "fade" | "scale" | "left" | "right";
type RevealProps = {
  text: string;
  at?: number;
  /** What comes in one after the other; lines are the text's own line breaks (\n). */
  by?: "letter" | "word" | "line";
  /** Frames between two units (2 for letters, 4 for words, 6 for lines). */
  stagger?: number;
  /** Frames each unit takes (12). */
  frames?: number;
  /** rise / fall: out of a mask, like an editorial title; blur: out of focus; scale: from small. */
  from?: RevealFrom;
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
  return function Reveal({ text, at = 0, by = "word", stagger, frames = 12, from = "rise", exit, style }: RevealProps) {
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
    const progress = (i: number) => {
      const p = settle(interpolate(frame, [at + i * gap, at + i * gap + frames], [0, 1], clamp));
      if (!leaving) return p;
      return Math.min(p, 1 - settle(interpolate(frame, [exit.at + i * gap, exit.at + i * gap + (exit.frames ?? frames)], [0, 1], clamp)));
    };
    const masked = from === "rise" || from === "fall";
    const unit = (content: ReactNode, i: number, key: string) => {
      const inner = <span style={{ display: "inline-block", whiteSpace: "pre", ...unitStyle(from, progress(i)) }}>{content}</span>;
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
            ...(v === "top" ? { top: area.y } : v === "bottom" ? { bottom: video.height - (area.y + area.h) } : { top: area.y + area.h / 2, transform: "translateY(-50%)" }),
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
  style?: CSSProperties;
  seed?: string;
};

function CardOf(hooks: KitHooks) {
  return function Card({ text, at = 0, every = 10, cuts, wordsPerCut = 1, steps, box, tilt = -2, jitter = 1.2, paper = "#f6f3ec", ink = "#c8102e", style, seed = "card" }: CardProps) {
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
        <Fit
          style={{ position: "absolute", left: b.w * 0.07, top: b.h * 0.08, width: b.w * 0.86, height: b.h * 0.84 }}
          innerStyle={{ textAlign: "left", color: ink, fontSize: 92, lineHeight: 0.98, textTransform: "uppercase", ...style }}
        >
          <span>
            {written}
            {rest ? <span style={{ opacity: 0 }}>{rest}</span> : null}
          </span>
        </Fit>
      </div>
    );
  };
}

// ——— Scribble ————————————————————————————————————————————————————————————————————————

type Point = { x: number; y: number };
type ScribbleKind = "loop" | "capsule" | "underline" | "strike" | "zigzag" | "arrow" | "cross" | "tick" | "star" | "scribble";
type ScribbleProps = {
  kind?: ScribbleKind;
  /** What it is drawn around, under or through (px of the frame). */
  box?: Box;
  /** For an arrow. */
  from?: Point;
  to?: Point;
  /** A capsule (or a loop) along this angle, degrees: a word written on a diagonal. */
  angle?: number;
  at?: number;
  /** Frames to draw it (14: a hand draws a loop in about half a second). */
  frames?: number;
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

/** The hand-drawn path of a scribble, in px of the frame. */
export function scribblePath(kind: ScribbleKind, box: Box, opts: { from?: Point; to?: Point; angle?: number; wobble?: number; seed: string }): string {
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
  switch (kind) {
    case "loop":
    case "scribble": {
      const turns = kind === "scribble" ? 2.4 : 1.12;
      const n = Math.round(44 * turns);
      const pts: Point[] = [];
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI * 0.6 + (i / n) * turns * Math.PI * 2;
        const grow = 1 + (kind === "scribble" ? 0.08 * Math.sin(i * 0.7) : 0.05 * (i / n));
        pts.push(turn({ x: cx + Math.cos(a) * (w / 2) * 1.14 * grow, y: cy + Math.sin(a) * (h / 2) * 1.3 * grow }));
      }
      return smooth(shake(pts));
    }
    case "capsule": {
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
      return smooth(shake(pts));
    }
    case "underline":
      return smooth(shake([0, 0.25, 0.5, 0.75, 1].map((t) => turn({ x: x - w * 0.03 + t * w * 1.06, y: y + h * 1.04 + Math.sin(t * Math.PI) * h * 0.05 - t * h * 0.03 }))));
    case "strike":
      return smooth(shake([0, 0.33, 0.66, 1].map((t) => turn({ x: x - w * 0.03 + t * w * 1.06, y: cy + h * 0.06 - t * h * 0.12 }))));
    case "zigzag": {
      const teeth = Math.max(3, Math.round(w / Math.max(20, h * 0.6)));
      return smooth(shake(Array.from({ length: teeth * 2 + 1 }, (_, i) => turn({ x: x + (i / (teeth * 2)) * w, y: i % 2 ? y + h * 0.15 : y + h * 0.85 }))));
    }
    case "cross":
      return `${smooth(shake([turn({ x, y }), turn({ x: cx, y: cy }), turn({ x: x + w, y: y + h })]))} ${smooth(shake([turn({ x: x + w, y }), turn({ x: cx, y: cy }), turn({ x, y: y + h })]))}`;
    case "tick":
      return smooth(shake([turn({ x, y: y + h * 0.55 }), turn({ x: x + w * 0.38, y: y + h }), turn({ x: x + w, y })]));
    case "star": {
      const pts: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
        const r = i % 2 ? 0.18 : 0.5;
        pts.push({ x: cx + Math.cos(a) * w * r, y: cy + Math.sin(a) * h * r });
      }
      return pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
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
      const shaft = smooth(shake([a, { x: (a.x + mid.x) / 2 + nx * bend * 0.4, y: (a.y + mid.y) / 2 + ny * bend * 0.4 }, mid, b]));
      const dir = Math.atan2(b.y - mid.y, b.x - mid.x);
      const head = Math.min(60, len * 0.18);
      const wing = (s: number) => ({ x: b.x - Math.cos(dir + s * 0.5) * head, y: b.y - Math.sin(dir + s * 0.5) * head });
      const w1 = wing(1);
      const w2 = wing(-1);
      return `${shaft} M ${w1.x.toFixed(1)} ${w1.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} L ${w2.x.toFixed(1)} ${w2.y.toFixed(1)}`;
    }
  }
}

function ScribbleOf(hooks: KitHooks) {
  return function Scribble({ kind = "loop", box, from, to, angle, at = 0, frames = 14, color = "#ffffff", width = 6, wobble = 1, boil = 0, out, seed = "scribble" }: ScribbleProps) {
    const frame = hooks.useCurrentFrame();
    const video = hooks.useVideoConfig();
    if (frame < at) return null;
    const b = box ?? { x: video.width * 0.3, y: video.height * 0.4, w: video.width * 0.4, h: video.height * 0.08 };
    const tick = boil > 0 ? Math.floor((frame - at) / boil) : 0;
    const d = scribblePath(kind, b, { from, to, angle, wobble, seed: `${seed}-${tick}` });
    const drawn = interpolate(frame, [at, at + Math.max(1, frames)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const fade = out === undefined ? 1 : interpolate(frame, [out, out + 8], [1, 0], clamp);
    if (fade <= 0) return null;
    return (
      <svg width={video.width} height={video.height} viewBox={`0 0 ${video.width} ${video.height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: fade }} aria-hidden="true">
        <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - drawn} />
      </svg>
    );
  };
}

// ——— WordSearch ——————————————————————————————————————————————————————————————————————

type WordSearchProps = {
  /** The words hidden in the grid, found one after the other. */
  words: string[];
  cols?: number;
  rows?: number;
  at?: number;
  /** Frames between two words found (60). */
  every?: number;
  /** Frames to draw the loop around a word (15). */
  loop?: number;
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

const plainLetters = (w: string) =>
  w
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const DIRS = { h: [1, 0], v: [0, 1], d: [1, 1], u: [1, -1] } as const;
type Placed = { word: string; cells: [number, number][]; dir: keyof typeof DIRS };

/** Where each word goes in the grid (cells inside the allowed part only, crossings only on the same letter). */
export function placeWords(words: string[], cols: number, rows: number, allowed: (c: number, r: number) => boolean, seed: string): Placed[] {
  const grid = new Map<string, string>();
  const placed: Placed[] = [];
  words.forEach((raw, wi) => {
    const word = plainLetters(raw);
    if (!word) return;
    for (let attempt = 0; attempt < 400; attempt++) {
      const dir = (["h", "v", "d", "u"] as const)[Math.floor(random(`${seed}-d-${wi}-${attempt}`) * (attempt < 200 ? 4 : 1))]!;
      const [dx, dy] = DIRS[dir];
      const c0 = Math.floor(random(`${seed}-c-${wi}-${attempt}`) * cols);
      const r0 = Math.floor(random(`${seed}-r-${wi}-${attempt}`) * rows);
      const cells = letters(word).map((_, i) => [c0 + dx * i, r0 + dy * i] as [number, number]);
      const fits = cells.every(([c, r], i) => c >= 0 && c < cols && r >= 0 && r < rows && allowed(c, r) && (grid.get(`${c},${r}`) ?? word[i]) === word[i]);
      if (!fits) continue;
      cells.forEach(([c, r], i) => grid.set(`${c},${r}`, word[i]!));
      placed.push({ word, cells, dir });
      return;
    }
  });
  return placed;
}

function WordSearchOf(hooks: KitHooks, Scribble: ReturnType<typeof ScribbleOf>) {
  return function WordSearch({ words, cols, rows, at = 0, every = 60, loop = 15, color = "rgba(255,255,255,0.62)", found = "#ffffff", stroke = "#ffffff", strokeWidth = 4, box, style, seed = "words" }: WordSearchProps) {
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
    const placed = placeWords(words, nc, nr, allowed, seed);
    const taken = new Set(placed.flatMap((p) => p.cells.map(([c, r]) => `${c},${r}`)));
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
        filler.push(cell(c, r, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(random(`${seed}-l-${c}-${r}`) * 26)]!));
      }
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div data-fauve-decor="" style={{ position: "absolute", inset: 0 }}>
          {filler}
        </div>
        {placed.map((p, i) => {
          const when = at + i * every;
          const isFound = frame >= when + loop * 0.6;
          const [a, b] = [center(...p.cells[0]!), center(...p.cells.at(-1)!)];
          const length = Math.hypot(b.x - a.x, b.y - a.y) + Math.min(cw, ch) * 0.95;
          const thick = Math.min(cw, ch) * 0.78;
          return (
            <React.Fragment key={p.word + i}>
              <div style={{ position: "absolute", inset: 0 }}>{p.cells.map(([c, r], k) => cell(c, r, p.word[k]!, isFound ? { color: found } : undefined))}</div>
              <Scribble
                kind="capsule"
                box={{ x: (a.x + b.x) / 2 - length / 2, y: (a.y + b.y) / 2 - thick / 2, w: length, h: thick }}
                angle={(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}
                at={when}
                frames={loop}
                color={stroke}
                width={strokeWidth}
                wobble={0.5}
                seed={`${seed}-loop-${i}`}
              />
            </React.Fragment>
          );
        })}
      </div>
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
  return {
    Decode,
    TypeOn,
    Reveal,
    Count: CountOf(hooks),
    Edges: EdgesOf(hooks, Reveal, TypeOn, Decode),
    Paper,
    Emboss: EmbossOf(hooks),
    Card: CardOf(hooks),
    Scribble,
    WordSearch: WordSearchOf(hooks, Scribble),
    Kinetic: KineticOf(hooks),
    WordArt: WordArtOf(hooks),
    Burst: BurstOf(hooks),
  };
}
