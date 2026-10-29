import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReelProps } from "./types";

// The looks a Reel can wear, the way Prequel's filters dress a phone video (a disposable camera
// with its date in orange, a VHS tape, the flash of the 2000s, cinema colours, black and white),
// drawn by the engine: a grade over her footage and its animations, an overlay under the texts
// (grain, light, vignette, the camera's own marks), the texts left clean. Only on her request or
// when the Reel she copies has one. Drawn from the frame number alone: the render and the preview match.

export type Look = "disposable" | "vhs" | "y2k" | "cine" | "bw";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The grade each look gives her footage and its animations (CSS filters, after the Reel's own). */
export function lookFilter(look: Look | null | undefined): string | undefined {
  switch (look) {
    case "disposable":
      return "sepia(0.18) saturate(1.25) contrast(1.06) brightness(1.06)";
    case "vhs":
      return "url(#fauve-vhs) saturate(1.3) contrast(1.08) brightness(1.04) blur(0.5px)";
    case "y2k":
      return "contrast(1.2) saturate(1.25) brightness(1.08) hue-rotate(-8deg)";
    case "cine":
      return "contrast(1.12) saturate(0.95) brightness(0.98)";
    case "bw":
      return "grayscale(1) contrast(1.28) brightness(1.04)";
    default:
      return undefined;
  }
}

/** Whether an effect is a look (the dust is drawn on its own). */
export const isLook = (effect: ReelProps["effect"]): effect is Look => Boolean(effect && effect !== "dust");

/** The SVG filters a look's grade names (VHS: its colours slipping apart, red one way, blue the other). */
export function LookDefs({ k }: { k: number }) {
  const shift = (3 * k).toFixed(2);
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="fauve-vhs" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feOffset in="red" dx={shift} dy="0" result="redShifted" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feOffset in="blue" dx={`-${shift}`} dy="0" result="blueShifted" />
          <feBlend in="redShifted" in2="green" mode="screen" result="redGreen" />
          <feBlend in="redGreen" in2="blueShifted" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
}

/** Film grain that changes every two frames, at `opacity`. */
function Grain({ opacity, size = 0.85 }: { opacity: number; size?: number }) {
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

const Vignette = ({ strength }: { strength: number }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,${strength}) 100%)` }} />
);

/** A seven-segment digit or mark, as a disposable camera prints its date: a b c d e f g on, from the top clockwise, g the middle. */
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

/** The date the way a disposable camera prints it (« '26 10 29 »), in glowing orange seven-segment digits. */
function DateStamp({ text, x, y, h, color }: { text: string; x: number; y: number; h: number; color: string }) {
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

/** The overlay of a look, over her footage and under the texts. `stamp`: the date it prints (a disposable, a VHS). */
export function LookOverlay({ look, stamp, k }: { look: Look; stamp?: string; k: number }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  if (look === "disposable") {
    // A light leak that breathes on one edge, a flash on the subject, the date in the corner (clear of the app's buttons).
    const leak = 0.12 + 0.06 * Math.sin((frame / fps) * 1.3);
    const h = 46 * k;
    const text = stamp ?? "";
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill style={{ background: "rgba(255,170,90,0.10)", mixBlendMode: "soft-light" }} />
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 40% at 50% 40%, rgba(255,250,235,0.20), rgba(255,250,235,0) 70%)", mixBlendMode: "screen" }} />
        <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(255,120,40,${leak.toFixed(3)}) 0%, rgba(255,120,40,0) 28%)`, mixBlendMode: "screen" }} />
        <Vignette strength={0.45} />
        <Grain opacity={0.1} />
        {text ? (
          <svg width={width} height={height} style={{ position: "absolute", inset: 0 }} aria-hidden>
            <DateStamp text={text} x={width - 150 * k - text.length * h * 0.62} y={height * 0.7} h={h} color="#FF8A1E" />
          </svg>
        ) : null}
      </AbsoluteFill>
    );
  }
  if (look === "vhs") {
    // Scanlines, a tracking band that rolls down now and then, the camcorder's PLAY and date.
    const cycle = Math.round(fps * 3.4);
    const t = frame % cycle;
    const band = t < 10 ? interpolate(t, [0, 10], [0.15, 0.85], clamp) : null;
    const seconds = Math.floor(frame / fps);
    const clock = `0:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    const font = { fontFamily: "VT323, monospace", color: "#F4F4F4", textShadow: `${2 * k}px 0 rgba(255,0,80,0.6), ${-2 * k}px 0 rgba(0,200,255,0.6)` };
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill style={{ background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, rgba(0,0,0,0.13) ${2 * k}px, rgba(0,0,0,0) ${2 * k}px, rgba(0,0,0,0) ${4 * k}px)` }} />
        {band !== null ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: `${band * 100}%`, height: 26 * k, background: "rgba(255,255,255,0.10)", filter: `blur(${3 * k}px)` }} />
        ) : null}
        <Vignette strength={0.3} />
        <Grain opacity={0.12} size={1.2} />
        <div style={{ ...font, position: "absolute", left: 72 * k, top: 64 * k, fontSize: 52 * k, letterSpacing: 2 * k }}>PLAY ▶</div>
        <div style={{ ...font, position: "absolute", left: 72 * k, top: height * 0.7, fontSize: 46 * k, lineHeight: 1.1 }}>
          {stamp ? <div>{stamp}</div> : null}
          <div>SP {clock}</div>
        </div>
      </AbsoluteFill>
    );
  }
  if (look === "y2k") {
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 55% 38% at 50% 42%, rgba(255,255,255,0.22), rgba(255,255,255,0) 70%)", mixBlendMode: "screen" }} />
        <AbsoluteFill style={{ background: "rgba(120,170,255,0.08)", mixBlendMode: "soft-light" }} />
        <Vignette strength={0.38} />
        <Grain opacity={0.06} size={1.1} />
      </AbsoluteFill>
    );
  }
  if (look === "cine") {
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,95,115,0.22), rgba(0,95,115,0.12))", mixBlendMode: "soft-light" }} />
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(255,150,70,0.12), rgba(255,150,70,0) 75%)", mixBlendMode: "soft-light" }} />
        <Vignette strength={0.35} />
        <Grain opacity={0.07} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Vignette strength={0.35} />
      <Grain opacity={0.12} />
    </AbsoluteFill>
  );
}
