import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FilmDust } from "./FilmDust";
import type { ReelLookDraw } from "./types";

// The look a Reel wears over its whole video (looks.ts in @fauve/agent), drawn from its settings, the way
// Prequel's filters dress a phone video: its grade over her footage and its animations (one colour matrix,
// colours slipping apart, highlights that bloom, a softness), then over it, under the texts, its texture
// (grain, light, vignette, a flash, a light leak, lines, dust, a frame, the date its camera prints). A look
// grades and textures her real images, never redraws them. Drawn from the frame number alone: the render
// and the preview match.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** A short stable name for a look's filter (two Reels with different looks can share a page: the preview, Tes créations). */
function filterId(look: ReelLookDraw): string {
  const key = JSON.stringify([look.matrix, look.bleed, look.glow, look.glow_color]);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return `fauve-look-${(h >>> 0).toString(36)}`;
}

/** Whether a look changes her footage at all (film dust alone only lays its specks over it). */
export const gradesFootage = (look: ReelLookDraw) =>
  look.bleed > 0 || look.glow > 0 || look.soft > 0 || look.matrix.some((v, i) => Math.abs(v - IDENTITY[i]!) > 1e-4);

/** The CSS filter its grade lays on her footage and its animations. */
export function lookFilter(look: ReelLookDraw, k: number): string {
  return [`url(#${filterId(look)})`, ...(look.soft > 0 ? [`blur(${(look.soft * 1.1 * k).toFixed(2)}px)`] : [])].join(" ");
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/**
 * The SVG filter of a look's grade: its colour matrix, then its colours slipping apart (red one way,
 * blue the other), then its highlights blooming in their colour (the bright parts, blurred, added back).
 */
export function LookDefs({ look, k }: { look: ReelLookDraw; k: number }) {
  const shift = (3 * k * look.bleed).toFixed(2);
  const [gr, gg, gb] = channels(look.glow_color);
  // Only what is brighter than 70 %, stretched back to the full range.
  const gain = 1 / 0.3;
  const luma = (w: number) => (w * gain).toFixed(4);
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={filterId(look)} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix in="SourceGraphic" type="matrix" values={look.matrix.join(" ")} result="graded" />
          {look.bleed > 0 ? (
            <>
              <feColorMatrix in="graded" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
              <feOffset in="red" dx={shift} dy="0" result="redShifted" />
              <feColorMatrix in="graded" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
              <feColorMatrix in="graded" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
              <feOffset in="blue" dx={`-${shift}`} dy="0" result="blueShifted" />
              <feBlend in="redShifted" in2="green" mode="screen" result="redGreen" />
              <feBlend in="redGreen" in2="blueShifted" mode="screen" result="bled" />
            </>
          ) : null}
          {look.glow > 0 ? (
            <>
              <feColorMatrix
                in={look.bleed > 0 ? "bled" : "graded"}
                type="matrix"
                values={[0, 1, 2]
                  .map(() => `${luma(0.2126)} ${luma(0.7152)} ${luma(0.0722)} 0 ${(-0.7 * gain).toFixed(4)}`)
                  .concat("0 0 0 0 1")
                  .join("  ")}
                result="bright"
              />
              <feGaussianBlur in="bright" stdDeviation={(14 * k * (0.6 + 0.4 * look.glow)).toFixed(1)} result="bloom" />
              <feColorMatrix
                in="bloom"
                type="matrix"
                values={`${gr!.toFixed(3)} 0 0 0 0  0 ${gg!.toFixed(3)} 0 0 0  0 0 ${gb!.toFixed(3)} 0 0  0 0 0 0 1`}
                result="tinted"
              />
              <feComposite in={look.bleed > 0 ? "bled" : "graded"} in2="tinted" operator="arithmetic" k1="0" k2="1" k3={(0.75 * look.glow).toFixed(3)} k4="0" />
            </>
          ) : null}
        </filter>
      </defs>
    </svg>
  );
}

/** A small seeded random generator (mulberry32): the same frame always draws the same. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAIN_SIZE = { fine: 1.2, medium: 0.85, coarse: 0.55 } as const;

/** Film grain that changes every two frames, at `opacity`. */
function Grain({ opacity, size }: { opacity: number; size: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const seed = Math.floor(frame / 2) % 97;
  const id = `fauve-grain-${seed}`;
  return (
    <svg
      width={Math.round(width / 2)}
      height={Math.round(height / 2)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, mixBlendMode: "overlay" }}
      aria-hidden
    >
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={size} numOctaves={2} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = channels(hex).map((v) => Math.round(v * 255));
  return `rgba(${r},${g},${b},${Math.max(0, alpha).toFixed(3)})`;
};

/** A seven-segment digit, as a disposable camera prints its date: a b c d e f g on, from the top clockwise, g the middle. */
const SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

/** How wide a date in seven segments is, at height h. */
const digitalWidth = (text: string, h: number) =>
  [...text].reduce((w, ch) => w + (ch === " " ? h * 0.32 : ch === "'" ? h * 0.33 : h * 0.72), 0);

/** The date the way a disposable camera prints it (« '26 10 29 »), in glowing seven-segment digits. */
function DigitalDate({ text, x, y, h, color }: { text: string; x: number; y: number; h: number; color: string }) {
  const w = h * 0.52;
  const t = h * 0.13;
  const gap = h * 0.2;
  const bars = (d: string, ox: number): ReactNode[] => {
    const on = SEGMENTS[d] ?? "";
    const half = h / 2;
    const shapes: Record<string, [number, number, number, number]> = {
      a: [ox + t, y, w - 2 * t, t],
      b: [ox + w - t, y + t, t, half - 1.5 * t],
      c: [ox + w - t, y + half + t / 2, t, half - 1.5 * t],
      d: [ox + t, y + h - t, w - 2 * t, t],
      e: [ox, y + half + t / 2, t, half - 1.5 * t],
      f: [ox, y + t, t, half - 1.5 * t],
      g: [ox + t, y + half - t / 2, w - 2 * t, t],
    };
    return [...on].map((s) => {
      const [rx, ry, rw, rh] = shapes[s]!;
      return <rect key={`${ox}${s}`} x={rx} y={ry} width={rw} height={rh} rx={t / 3} fill={color} />;
    });
  };
  let cursor = x;
  const shapes: ReactNode[] = [];
  for (const ch of text) {
    if (ch === " ") cursor += gap * 1.6;
    else if (ch === "'") {
      shapes.push(<rect key={`q${cursor}`} x={cursor} y={y} width={t} height={h * 0.3} rx={t / 3} fill={color} />);
      cursor += t + gap;
    } else {
      shapes.push(...bars(ch, cursor));
      cursor += w + gap;
    }
  }
  return <g style={{ filter: `drop-shadow(0 0 ${(h * 0.18).toFixed(1)}px ${color})` }}>{shapes}</g>;
}

/** The date a camera prints and what it writes beside it, in its corner, clear of the app's buttons on the right and at the bottom. */
function Stamp({ stamp, text, k }: { stamp: NonNullable<ReelLookDraw["stamp"]>; text?: string; k: number }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const right = stamp.corner.endsWith("right");
  const bottom = stamp.corner.startsWith("bottom");
  const side = right ? 150 * k : 72 * k;
  const low = height * 0.7;
  const high = 64 * k;
  const seconds = Math.floor(frame / fps);
  const clock = `${stamp.style === "camcorder" ? "SP " : ""}0:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const font: CSSProperties =
    stamp.style === "camcorder"
      ? { fontFamily: "VT323, monospace", fontSize: 50 * k, lineHeight: 1.05, letterSpacing: 2 * k, textShadow: `${2 * k}px 0 rgba(255,0,80,0.6), ${-2 * k}px 0 rgba(0,200,255,0.6)` }
      : { fontFamily: '"Courier Prime", "Courier New", monospace', fontSize: 40 * k, lineHeight: 1.15, fontWeight: 700, textShadow: `0 0 ${3 * k}px rgba(0,0,0,0.45)` };
  const place = (top: number): CSSProperties => ({ position: "absolute", top, ...(right ? { right: side, textAlign: "right" } : { left: side }), color: stamp.color, ...font });
  const label = stamp.label && stamp.style !== "digital" ? <div style={place(bottom ? high : low)}>{stamp.label}</div> : null;
  if (stamp.style === "digital") {
    if (!text) return null;
    const h = 46 * k;
    const x = right ? width - side - digitalWidth(text, h) : side;
    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }} aria-hidden>
        <DigitalDate text={text} x={x} y={bottom ? low : high} h={h} color={stamp.color} />
      </svg>
    );
  }
  return (
    <>
      {label}
      <div style={place(bottom ? low : high)}>
        {text ? <div>{text}</div> : null}
        {stamp.clock ? <div>{clock}</div> : null}
      </div>
    </>
  );
}

/** A look's texture, over her footage and under the texts. `stamp`: the date its camera prints. */
export function LookOverlay({ look, stamp, k }: { look: ReelLookDraw; stamp?: string; k: number }) {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();
  const rand = seeded(Math.floor(frame / 2) * 4973 + 7);
  // A tape's tracking band, rolling down for a third of a second every 3.4 s.
  const cycle = Math.round(fps * 3.4);
  const band = look.tracking && frame % cycle < 10 ? interpolate(frame % cycle, [0, 10], [0.15, 0.85], clamp) : null;
  const leak = look.leak > 0 ? look.leak * (0.2 + 0.1 * Math.sin((frame / fps) * 1.3)) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {look.flash > 0 ? (
        <AbsoluteFill
          style={{ background: `radial-gradient(ellipse 58% 40% at 50% 41%, rgba(255,252,240,${(0.3 * look.flash).toFixed(3)}), rgba(255,252,240,0) 70%)`, mixBlendMode: "screen" }}
        />
      ) : null}
      {leak > 0 ? <AbsoluteFill style={{ background: `linear-gradient(90deg, ${rgba(look.leak_color, leak)} 0%, ${rgba(look.leak_color, 0)} 30%)`, mixBlendMode: "screen" }} /> : null}
      {look.lines > 0 ? (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(0deg, rgba(0,0,0,${(0.13 * look.lines).toFixed(3)}) 0px, rgba(0,0,0,${(0.13 * look.lines).toFixed(3)}) ${2 * k}px, rgba(0,0,0,0) ${2 * k}px, rgba(0,0,0,0) ${4 * k}px)`,
          }}
        />
      ) : null}
      {band !== null ? <div style={{ position: "absolute", left: 0, right: 0, top: `${band * 100}%`, height: 26 * k, background: "rgba(255,255,255,0.10)", filter: `blur(${3 * k}px)` }} /> : null}
      {look.flicker > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${(0.09 * look.flicker * rand()).toFixed(3)})` }} /> : null}
      {look.vignette > 0 ? (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,${(0.6 * look.vignette).toFixed(3)}) 100%)` }} />
      ) : null}
      {look.grain > 0 ? <Grain opacity={0.2 * look.grain} size={GRAIN_SIZE[look.grain_size]} /> : null}
      {look.dust > 0 ? (
        <AbsoluteFill style={{ opacity: Math.min(1, look.dust) }}>
          <FilmDust k={k} />
        </AbsoluteFill>
      ) : null}
      {look.frame === "bars" ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: height * 0.065, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.065, background: "#000" }} />
        </>
      ) : look.frame === "border" ? (
        <AbsoluteFill style={{ boxShadow: `inset 0 0 0 ${26 * k}px #F6F3EC, inset 0 0 ${10 * k}px ${26 * k}px rgba(0,0,0,0.12)` }} />
      ) : null}
      {look.stamp ? <Stamp stamp={look.stamp} text={stamp} k={k} /> : null}
    </AbsoluteFill>
  );
}
