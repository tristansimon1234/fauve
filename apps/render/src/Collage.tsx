import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Fit } from "./Fit";
import type { Theme } from "./theme";
import type { ReelProps } from "./types";

// « Collage »: the handmade look of today's Reels. Each shot is a photo cut out
// with a white edge, taped on a paper background in the studio's colours, and
// slapped on top of the previous one; a hand-drawn mark draws itself next to it;
// texts are cut-out labels (two typefaces mixed) and strips of torn paper; it all
// moves on twos (12 images a second) like stop-motion, under a film grain.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The serif mixed with the studio's display font in the cut-out words. */
export const COLLAGE_SERIF = "Instrument Serif";

/** How long a card stays under the next one sliding over it (frames). */
export const COLLAGE_OVERLAP = 10;

const ROTATIONS = [-3.2, 2.6, -1.8, 3.4, -2.6, 1.6];
const FROM = [1, -1, 1, -1, -1, 1];

/** Frames counted on twos: the stop-motion step. */
export const onTwos = (frame: number) => Math.floor(frame / 2) * 2;

export type CollageColors = { paper: string; ink: string; accent: string; accentInk: string; second: string };

export function collageColors(props: ReelProps): CollageColors {
  return {
    paper: props.brand.palette?.light && props.brand.palette.light.toLowerCase() !== "#ffffff" ? props.brand.palette.light : "#F2ECE3",
    ink: props.brand.palette?.dark ?? "#161414",
    accent: props.brand.accent,
    accentInk: props.brand.accentInk,
    second: props.brand.palette?.secondary ?? props.brand.accent,
  };
}

/** The paper the collage is glued on, with a few soft stains of colour. */
export function CollageBackdrop({ props }: { props: ReelProps }) {
  const c = collageColors(props);
  return (
    <AbsoluteFill style={{ backgroundColor: c.paper }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at 15% 10%, ${c.second}22, transparent 70%), radial-gradient(50% 35% at 90% 85%, ${c.accent}1f, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
}

/** Film grain over the whole frame, changing on twos. */
export function Grain({ props }: { props: ReelProps }) {
  const frame = useCurrentFrame();
  const seed = (onTwos(frame) / 2) % 9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.16 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${props.width / 2} ${props.height / 2}`} preserveAspectRatio="none">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

/** A strip of washi tape with torn ends. */
function Tape({ color, style }: { color: string; style: CSSProperties }) {
  const teeth = "polygon(0% 8%, 4% 0%, 8% 10%, 12% 0%, 16% 8%, 84% 6%, 88% 0%, 92% 9%, 96% 0%, 100% 8%, 100% 92%, 96% 100%, 92% 91%, 88% 100%, 84% 93%, 16% 94%, 12% 100%, 8% 90%, 4% 100%, 0% 92%)";
  return <div style={{ position: "absolute", background: color, opacity: 0.82, clipPath: teeth, ...style }} />;
}

const DOODLES = [
  // a star burst
  "M50 6 L58 38 L92 30 L64 52 L84 86 L50 66 L16 86 L36 52 L8 30 L42 38 Z",
  // a looping arrow
  "M8 70 C 20 30, 60 20, 70 50 C 76 70, 50 78, 46 60 C 42 40, 70 24, 92 30 M80 20 L92 30 L80 40",
  // a scribbled circle
  "M50 10 C 80 8, 94 34, 88 58 C 82 84, 46 94, 22 80 C 2 66, 6 30, 30 16 C 44 8, 70 10, 82 22",
  // sparkles
  "M30 10 L34 34 L58 38 L34 42 L30 66 L26 42 L2 38 L26 34 Z M74 54 L76 68 L90 70 L76 72 L74 86 L72 72 L58 70 L72 68 Z",
];

/** A hand-drawn mark that draws itself, on twos. */
function Doodle({ index, color, size, style }: { index: number; color: string; size: number; style: CSSProperties }) {
  const frame = useCurrentFrame();
  const draw = interpolate(onTwos(frame), [6, 22], [1, 0], clamp);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", overflow: "visible", ...style }}>
      <path
        d={DOODLES[index % DOODLES.length]}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={draw}
      />
    </svg>
  );
}

/**
 * A shot as a cut-out photo: a white edge, a tilt, tape on two corners, coloured
 * paper peeking behind, slapped in from the side on twos.
 */
export function CollageCard({ index, props, children }: { index: number; props: ReelProps; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = props.width / 1080;
  const c = collageColors(props);
  const p = spring({ frame: onTwos(frame), fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const rot = ROTATIONS[index % ROTATIONS.length]!;
  const dir = FROM[index % FROM.length]!;
  const w = props.width * 0.84;
  const h = Math.min(props.height * 0.66, w * 1.32);
  const left = (props.width - w) / 2 + dir * 10 * k;
  const top = (props.height - h) / 2 + 30 * k;
  const edge = 16 * k;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          transform: `translateX(${(1 - p) * dir * props.width * 0.7}px) rotate(${rot + (1 - p) * dir * 9}deg) scale(${1 + (1 - p) * 0.06})`,
        }}
      >
        {/* Coloured paper behind, torn a little, for depth. */}
        <div style={{ position: "absolute", inset: `${-26 * k}px ${-18 * k}px`, background: index % 2 ? c.second : c.accent, opacity: 0.9, transform: `rotate(${-rot * 1.6}deg)`, clipPath: "polygon(2% 3%, 30% 0%, 62% 2%, 98% 0%, 100% 40%, 97% 72%, 100% 98%, 64% 100%, 30% 97%, 0% 100%, 2% 60%, 0% 30%)" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#FBFAF7",
            padding: edge,
            boxShadow: `0 ${18 * k}px ${44 * k}px rgba(0,0,0,0.28), 0 ${3 * k}px ${8 * k}px rgba(0,0,0,0.18)`,
          }}
        >
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>{children}</div>
        </div>
        <Tape color={index % 2 ? c.accent : c.second} style={{ width: 220 * k, height: 58 * k, left: -60 * k, top: 26 * k, transform: "rotate(-38deg)" }} />
        <Tape color={index % 2 ? c.second : c.accent} style={{ width: 200 * k, height: 54 * k, right: -56 * k, bottom: 40 * k, transform: "rotate(-34deg)" }} />
        <Doodle
          index={index}
          color={index % 2 ? c.ink : c.accent}
          size={190 * k}
          style={index % 2 ? { left: -70 * k, bottom: -80 * k } : { right: -64 * k, top: -86 * k }}
        />
      </div>
    </AbsoluteFill>
  );
}

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** A word of a text is stressed when the plan names it, or names a part of it (« 3 » in « 3 cours », held together on one line). */
const stressedIn = (emphasis: Set<string>, word: string) =>
  emphasis.has(normalize(word)) || word.split(/[\u00a0\u202f]/).some((part) => normalize(part).length > 0 && emphasis.has(normalize(part)));

/** Where a text breaks into words: any space but the non-breaking ones, which hold a business's name together. */
const SPACES = /[^\S\u00a0\u202f]+/;

function useExit(durationInFrames: number, theme: Theme) {
  const frame = useCurrentFrame();
  return interpolate(onTwos(frame), [durationInFrames - theme.exitFrames, durationInFrames], [1, 0], clamp);
}

type TextProps = { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number; sides: { left: number; right: number } };

/**
 * The hook as cut-out words: each word its own scrap of paper, the studio's
 * display font in capitals on light paper, every other word (and the stressed
 * ones) in an italic serif on its colour, each tilted, popping in one by one.
 */
export function CollageHook({ text, index, props, theme, k, sides }: TextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = useExit(text.durationInFrames, theme);
  const c = collageColors(props);
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(SPACES)).map(normalize));
  const words = text.text.split(SPACES).filter(Boolean);
  const size = 124 * k * (text.scale ?? 1);
  return (
    <Fit
      marker={String(index)}
      style={{ position: "absolute", top: props.height * (text.y ?? 0.08), height: props.height * 0.24 * (text.scale ?? 1), ...sides, opacity: out }}
      innerStyle={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", alignContent: "center", gap: `${10 * k}px ${12 * k}px` }}
    >
      {words.map((word, i) => {
        const p = spring({ frame: onTwos(frame - i * 3), fps, config: { damping: 12, stiffness: 210, mass: 0.6 } });
        const serif = i % 2 === 1 || stressedIn(emphasis, word);
        const tilt = [-3, 2, -1.5, 3, -2.5][i % 5]!;
        const chip: CSSProperties = serif
          ? { background: c.accent, color: c.accentInk, fontFamily: `"${COLLAGE_SERIF}", serif`, fontStyle: "italic", fontWeight: 400, fontSize: size * 1.08, textTransform: "none", letterSpacing: 0 }
          : { background: i % 4 === 0 ? "#FBFAF7" : c.ink, color: i % 4 === 0 ? c.ink : "#FBFAF7", fontFamily: `"${props.brand.displayFont}", sans-serif`, fontWeight: 800, fontSize: size, textTransform: "uppercase", letterSpacing: -0.5 * k };
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              padding: `${4 * k}px ${16 * k}px ${8 * k}px`,
              lineHeight: 1.05,
              boxShadow: `0 ${6 * k}px ${14 * k}px rgba(0,0,0,0.22)`,
              transform: `rotate(${tilt}deg) scale(${interpolate(p, [0, 1], [0.4, 1])})`,
              opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
              ...chip,
            }}
          >
            {word}
          </span>
        );
      })}
    </Fit>
  );
}

/** A band as a strip of torn paper in the studio's colour, typed in the body font. */
export function CollageBand({ text, index, props, theme, k, sides }: TextProps) {
  const frame = useCurrentFrame();
  const out = useExit(text.durationInFrames, theme);
  const c = collageColors(props);
  const reveal = interpolate(onTwos(frame), [0, 8], [0, 1], clamp);
  const torn = "polygon(0% 12%, 6% 0%, 14% 10%, 22% 2%, 31% 12%, 40% 0%, 50% 9%, 60% 1%, 69% 11%, 78% 0%, 87% 10%, 94% 2%, 100% 10%, 100% 90%, 94% 100%, 86% 89%, 77% 99%, 68% 88%, 59% 100%, 50% 90%, 41% 100%, 31% 89%, 22% 99%, 13% 88%, 6% 100%, 0% 90%)";
  return (
    <div style={{ position: "absolute", top: props.height * (text.y ?? 0.4), ...sides, display: "flex", justifyContent: "center", opacity: out, transform: "rotate(-2.5deg)" }}>
      <div
        data-fauve-text={index}
        style={{
          clipPath: `${torn}`,
          background: c.accent,
          color: c.accentInk,
          padding: `${26 * k}px ${44 * k}px`,
          fontFamily: `"${props.brand.bodyFont}", monospace`,
          fontWeight: 700,
          fontSize: 44 * k * (text.scale ?? 1),
          letterSpacing: 1 * k,
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.2,
          transform: `scaleX(${reveal})`,
          transformOrigin: "left center",
        }}
      >
        {text.text}
      </div>
    </div>
  );
}

/** A caption as a small paper label, taped on. */
export function CollageCaption({ text, index, props, theme, k, sides }: TextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = useExit(text.durationInFrames, theme);
  const c = collageColors(props);
  const p = spring({ frame: onTwos(frame), fps, config: { damping: 14, stiffness: 180, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", top: props.height * (text.y ?? 0.7), ...sides, display: "flex", justifyContent: "center", opacity: Math.min(out, p) }}>
      <div
        data-fauve-text={index}
        style={{
          position: "relative",
          background: "#FBFAF7",
          color: c.ink,
          padding: `${20 * k}px ${30 * k}px`,
          fontFamily: `"${props.brand.bodyFont}", monospace`,
          fontWeight: 600,
          fontSize: 40 * k * (text.scale ?? 1),
          lineHeight: 1.3,
          textAlign: "center",
          boxShadow: `0 ${8 * k}px ${20 * k}px rgba(0,0,0,0.22)`,
          transform: `rotate(1.8deg) translateY(${(1 - p) * 30 * k}px)`,
        }}
      >
        <Tape color={c.second} style={{ width: 150 * k, height: 44 * k, left: "50%", top: -24 * k, marginLeft: -75 * k, transform: "rotate(-4deg)" }} />
        {text.text}
      </div>
    </div>
  );
}

/** The end: the logo and the name on the paper, the call to action on a label. */
export function CollageEndCard({ props, k }: { props: ReelProps; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = collageColors(props);
  const card = props.endCard!;
  const shade = interpolate(onTwos(frame), [0, 8], [0, 1], clamp);
  const p = spring({ frame: onTwos(frame - 4), fps, config: { damping: 13, stiffness: 180, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ backgroundColor: c.paper, opacity: shade, alignItems: "center", justifyContent: "center", padding: `0 ${140 * k}px` }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 * k, transform: `scale(${interpolate(p, [0, 1], [0.7, 1])}) rotate(${(1 - p) * -6}deg)` }}>
        {props.brand.logoUrl ? <Img src={props.brand.logoUrl} style={{ maxWidth: 520 * k, maxHeight: 220 * k, objectFit: "contain" }} /> : null}
        {props.brand.logoUrl ? null : (
          <div style={{ fontFamily: `"${props.brand.displayFont}", sans-serif`, fontWeight: 800, fontSize: 104 * k, lineHeight: 1, color: c.ink, textAlign: "center", textTransform: "uppercase", letterSpacing: -1 * k }}>
            {card.title}
          </div>
        )}
        {card.subtitle ? (
          <div
            style={{
              background: c.accent,
              color: c.accentInk,
              padding: `${14 * k}px ${30 * k}px ${18 * k}px`,
              fontFamily: `"${COLLAGE_SERIF}", serif`,
              fontStyle: "italic",
              fontSize: 64 * k,
              transform: "rotate(-2.5deg)",
              boxShadow: `0 ${8 * k}px ${20 * k}px rgba(0,0,0,0.2)`,
            }}
          >
            {card.subtitle}
          </div>
        ) : null}
      </div>
      <Doodle index={3} color={c.accent} size={170 * k} style={{ right: 120 * k, top: props.height * 0.26 }} />
    </AbsoluteFill>
  );
}
