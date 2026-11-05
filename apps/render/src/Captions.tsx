import { createContext, Fragment, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BAND_LIMITS, bandLines, captionCards, cardAt, cardTop, labelSpot, strongSize, type CaptionCard, type CaptionStyle, type SpokenWord } from "./captions";

// What is said, written like a creator does (plan.captions, lot 7): « kinetic », each phrase around the person, its
// words arriving on the frame they are said, its strong word big in the brand's titles or a serif italic, the faces
// and sides changing from one phrase to the next, and behind her when she is cut out (the strong word under her, the
// small ones in front); « stickers », each word on a small label in the brand's colour, the strong one bigger. The
// engine draws it over the Reel; an animation draws it with `Captions` and the words said under it (`spoken`).

export type CaptionLook = {
  fonts: { display: string; body: string; serif: string };
  /** The brand's colour (a label's), the ink that reads on it, and the colour as it reads bare on footage. */
  accent: string;
  accentInk: string;
  onFootage: string;
  /** The row the engine keeps free of faces and texts (share of the height). */
  row: number;
};

/** What an animation's `Captions` gets by default (the Reel's fonts, colours and free row). */
export const CaptionLookContext = createContext<CaptionLook | null>(null);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** The words' own punctuation, left off a word set big (its « ! » and « ? » kept). */
const bigWord = (w: string) => w.replace(/[.,;:…]+$/u, "");
/** Readable on any footage: a fine dark edge and a short shadow, like the apps' captions. */
const edge = (k: number): CSSProperties => ({
  WebkitTextStroke: `${(3 * k).toFixed(2)}px rgba(0,0,0,0.6)`,
  paintOrder: "stroke fill",
  textShadow: `0 ${(2 * k).toFixed(2)}px ${(6 * k).toFixed(2)}px rgba(0,0,0,0.4)`,
});
const bigShadow = (k: number) => `0 ${(4 * k).toFixed(1)}px ${(22 * k).toFixed(1)}px rgba(0,0,0,0.35)`;

/** Widths measured in their font (px at 100 px), kept once the font is loaded. */
const widths = new Map<string, number>();
let canvas: HTMLCanvasElement | null = null;
function widthAt100(text: string, font: string): number | null {
  if (typeof document === "undefined") return null;
  const key = `${font}|${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font.replace("{px}", "100px");
  const w = ctx.measureText(text).width;
  if (document.fonts?.check?.(font.replace("{px}", "100px"))) widths.set(key, w);
  return w;
}

/**
 * The size of a big word so it fills the width it has and never leaves it: measured in its own font (some display
 * faces run twice as wide as others), else estimated; its letter spacing counted.
 */
function fitSize(text: string, face: "display" | "serif", look: CaptionLook, room: number, max: number, tracking = 0): number {
  const font = face === "display" ? `800 {px} "${look.fonts.display}"` : `italic 400 {px} "${look.fonts.serif}"`;
  const w = widthAt100(text, font);
  if (w === null || w <= 0) return strongSize(text, face, room, max);
  const per = w / 100 + tracking * [...text].length;
  return Math.round(Math.min(max, (room * 0.96) / Math.max(0.1, per)));
}

/**
 * Where a word goes behind her (its top and size, px), from the top of her head: across the frame, the bottom half of
 * its letters under her head; null when the room above her head is too small for the word at the width of the frame.
 */
function behindPlace(text: string, look: CaptionLook, head: number, width: number, height: number, k: number): { top: number; size: number } | null {
  const ceiling = 0.07 * height;
  const tall = (head * height - ceiling) / 0.5;
  // As wide as the frame lets it (a wide face fills it at a smaller size): behind her only when her head leaves it room.
  const fit = fitSize(text, "display", look, width - 2 * MARGIN.left * k, 380 * k, -0.02);
  const size = Math.min(fit, tall);
  if (size < 0.8 * fit || size < 70 * k) return null;
  return { top: Math.max(ceiling, head * height - 0.5 * size), size };
}

/** The side margins of a phrase (px of a 1080 frame): the right one clear of the apps' buttons. */
const MARGIN = { left: 80, right: 150 };
const SMALL = 54;
const STRONG_MAX = { display: 300, serif: 250 };

type CaptionsProps = {
  words: SpokenWord[];
  style?: CaptionStyle;
  look?: Partial<CaptionLook>;
  /**
   * The person cut out where a phrase is said (the engine: when her passage is cut out), drawn over its strong word,
   * with the top of her head (share of the height): the word sits above it, her head covering only its bottom.
   */
  subjectFor?: (card: CaptionCard) => { node: ReactNode; top: number } | null;
};

/** The clock Captions reads: Remotion's in the render, each copy's own in the scene check (one copy per frame). */
type CaptionHooks = {
  useCurrentFrame: () => number;
  useVideoConfig: () => { width: number; height: number; fps: number; durationInFrames: number };
};

/** Captions bound to a clock (the render's, or the scene check's for each of its copies: else every copy drew frame 0, and nothing). */
export function makeCaptions(hooks: CaptionHooks) {
  return function Captions(p: CaptionsProps) {
    return <CaptionsAt {...p} frame={hooks.useCurrentFrame()} video={hooks.useVideoConfig()} />;
  };
}

export const Captions = makeCaptions({ useCurrentFrame, useVideoConfig });

function CaptionsAt(p: CaptionsProps & { frame: number; video: { width: number; height: number; fps: number; durationInFrames: number } }) {
  const { frame } = p;
  const { width, height, fps, durationInFrames } = p.video;
  const inherited = useContext(CaptionLookContext);
  const look: CaptionLook = {
    fonts: { display: "Inter", body: "Inter", serif: "Instrument Serif", ...inherited?.fonts, ...p.look?.fonts },
    accent: p.look?.accent ?? inherited?.accent ?? "#ffffff",
    accentInk: p.look?.accentInk ?? inherited?.accentInk ?? "#111111",
    onFootage: p.look?.onFootage ?? inherited?.onFootage ?? p.look?.accent ?? inherited?.accent ?? "#ffffff",
    row: p.look?.row ?? inherited?.row ?? 0.64,
  };
  const bands = p.style === "bands";
  const cards = useMemo(() => captionCards(p.words, fps, durationInFrames, bands ? BAND_LIMITS : undefined), [p.words, fps, durationInFrames, bands]);
  const card = cardAt(cards, frame);
  if (!card) return null;
  const k = width / 1080;
  if (bands) return <Bands card={card} frame={frame} look={look} k={k} width={width} height={height} />;
  return (p.style ?? "kinetic") === "stickers" ? (
    <Labels card={card} frame={frame} look={look} k={k} width={width} height={height} />
  ) : (
    <Kinetic card={card} frame={frame} look={look} k={k} width={width} height={height} subject={p.subjectFor?.(card) ?? null} />
  );
}

/** How far a word has come in (0 to 1), from the frame before it is said. */
const arrived = (frame: number, from: number, frames: number) => interpolate(frame, [from - 1, from - 1 + frames], [0, 1], clamp);

function Kinetic({ card, frame, look, k, width, height, subject }: { card: CaptionCard; frame: number; look: CaptionLook; k: number; width: number; height: number; subject: { node: ReactNode; top: number } | null }) {
  const at = card.words.findIndex((w) => w.strong);
  const strong = at >= 0 ? card.words[at]! : null;
  const before = at >= 0 ? card.words.slice(0, at) : card.words;
  const after = at >= 0 ? card.words.slice(at + 1) : [];
  const left = MARGIN.left * k;
  const right = MARGIN.right * k;
  const room = width - left - right;
  const display = card.face === "display";
  const text = strong ? (display ? bigWord(strong.w).toUpperCase() : bigWord(strong.w)) : "";
  // Behind her, like a magazine cover: the word across the frame above her head, her head covering its bottom third;
  // only when the room above her head holds a big word (a head at the top of the frame hides it: then in front).
  const over = subject && strong && display ? behindPlace(text, look, subject.top, width, height, k) : null;
  const behind = Boolean(over);
  // Else it fills its side of the band.
  const size = over ? over.size : strong ? fitSize(text, card.face, look, room, STRONG_MAX[card.face] * k, display ? -0.02 : 0) : 0;
  const small = SMALL * k;
  const lines = (ws: { w: string }[]) => (ws.length ? Math.ceil((ws.map((w) => w.w).join(" ").length * small * 0.6) / room) : 0);
  // The big word's letters reach past its tight line (its font's ascent and descent): counted at 1.3 times its size, so
  // the phrase never runs under the apps' caption (the scene check measured a big word 50 px into it).
  const block = behind ? (lines(after) * small * 1.2) / height : ((lines(before) + lines(after)) * small * 1.2 + size * 1.3) / height;
  const top = cardTop(look.row, block) * height;
  const align = behind ? "center" : card.align;
  const box: CSSProperties = {
    position: "absolute",
    top,
    left,
    right: behind ? left : right,
    display: "flex",
    flexDirection: "column",
    alignItems: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
    textAlign: align,
  };
  const smallWords = (ws: CaptionCard["words"]) =>
    ws.length ? (
      <div style={{ fontFamily: `"${look.fonts.body}", sans-serif`, fontWeight: 700, fontSize: small, lineHeight: 1.2, color: "#fff", ...edge(k) }}>
        {ws.map((w, i) => {
          const a = arrived(frame, w.from, 4);
          return (
            <span key={i} style={{ display: "inline-block", margin: `0 ${0.18 * small}px`, opacity: a, transform: `translateY(${((1 - a) * 0.3).toFixed(3)}em)` }}>
              {w.w}
            </span>
          );
        })}
      </div>
    ) : null;
  const strongNode = strong
    ? (() => {
        const a = arrived(frame, strong.from, display ? 5 : 6);
        const style: CSSProperties = display
          ? {
              fontFamily: `"${look.fonts.display}", sans-serif`,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 0.92,
              transform: `scale(${interpolate(a, [0, 1], [1.22, 1]).toFixed(3)})`,
            }
          : { fontFamily: `"${look.fonts.serif}", serif`, fontStyle: "italic", fontWeight: 400, lineHeight: 0.95, transform: `translateY(${((1 - a) * 0.12).toFixed(3)}em)` };
        return (
          <div
            style={{
              fontSize: size,
              whiteSpace: "nowrap",
              color: card.tone === "accent" ? look.onFootage : "#fff",
              textShadow: bigShadow(k),
              opacity: a,
              transformOrigin: align === "left" ? "left center" : align === "right" ? "right center" : "center",
              ...style,
            }}
          >
            {text}
          </div>
        );
      })()
    : null;
  if (over && subject) {
    // Behind her: the strong word above her head, then her cut out over it; the words said before it just above it, those
    // after it in the band, both in front.
    return (
      <>
        <div style={{ position: "absolute", top: over.top, left: 0, right: 0, display: "flex", justifyContent: "center" }}>{strongNode}</div>
        {subject.node}
        {before.length ? (
          <div style={{ position: "absolute", top: Math.max(0.06 * height, over.top - small * 1.25), left, right: left, display: "flex", justifyContent: "center" }}>{smallWords(before)}</div>
        ) : null}
        {after.length ? <div style={box}>{smallWords(after)}</div> : null}
      </>
    );
  }
  return (
    <div style={box}>
      {smallWords(before)}
      {strongNode}
      {smallWords(after)}
    </div>
  );
}

function Labels({ card, frame, look, k, width, height }: { card: CaptionCard; frame: number; look: CaptionLook; k: number; width: number; height: number }) {
  const spot = labelSpot(card.index, look.row);
  const size = 70 * k;
  const room = Math.min(0.66 * width, width - (MARGIN.left + MARGIN.right) * k);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: spot.y * height,
          left: Math.min(width - MARGIN.right * k - room, Math.max(MARGIN.left * k, spot.x * width - room / 2)),
          width: room,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: `${(10 * k).toFixed(1)}px ${(12 * k).toFixed(1)}px`,
        }}
      >
        {card.words.map((w, i) => {
          if (frame < w.from - 1) return null;
          const a = arrived(frame, w.from, 3);
          const tilt = ((i % 2 ? 1 : -1) * (1.5 + (i % 3) * 0.6) + spot.tilt * 0.5).toFixed(2);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                padding: `${(0.06 * size).toFixed(1)}px ${(0.28 * size).toFixed(1)}px ${(0.1 * size).toFixed(1)}px`,
                background: w.strong ? "#fff" : look.accent,
                color: w.strong ? "#111" : look.accentInk,
                fontFamily: w.strong ? `"${look.fonts.display}", sans-serif` : `"${look.fonts.body}", sans-serif`,
                fontWeight: w.strong ? 800 : 600,
                // The strong word bigger, on one line within the cluster's width (its padding counted).
                fontSize: w.strong ? fitSize(bigWord(w.w).toUpperCase(), "display", look, room * 0.84, size * 1.7, -0.02) : size,
                whiteSpace: "nowrap",
                textTransform: w.strong ? "uppercase" : "none",
                lineHeight: 1.05,
                letterSpacing: w.strong ? "-0.02em" : "0",
                boxShadow: `0 ${(3 * k).toFixed(1)}px ${(10 * k).toFixed(1)}px rgba(0,0,0,0.25)`,
                transform: `rotate(${tilt}deg) scale(${interpolate(a, [0, 1], [0.86, 1]).toFixed(3)})`,
                opacity: a,
              }}
            >
              {w.strong ? bigWord(w.w) : w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** The bands of a hook, as measured on « Face caméra et références »: black bands, the words to come grey, white once said. */
const BAND = { size: 74, band: "#010101", pending: "#505050", said: "#ffffff", height: 1.24, pad: 0.16, width: 0.78 };

/**
 * A creator's hook on bands (« Face caméra et références », its first sentence): the whole phrase is there from its
 * first word, in bold on black bands, one band a line, touching, centred on the row; the words still to come in grey,
 * each turning white on the frame it is said. The first phrase comes in growing out of a blur (from 0.9 to 1.08 and
 * back in 6 frames), the next ones replace it at once. Its lines are one sentence in the page (inline blocks): the
 * scene check reads the phrase whole.
 */
function Bands({ card, frame, look, k, width, height }: { card: CaptionCard; frame: number; look: CaptionLook; k: number; width: number; height: number }) {
  const size = BAND.size * k;
  const line = Math.round(size * BAND.height);
  const pad = size * BAND.pad;
  const font = `700 {px} "${look.fonts.display}"`;
  const measure = (s: string) => ((widthAt100(s, font) ?? [...s].length * 52) * size) / 100;
  const lines = bandLines(
    card.words.map((w) => measure(w.w)),
    width * BAND.width - 2 * pad,
    measure(" ") || size * 0.25,
  );
  const block = lines.length * line;
  // Centred on its row, whole between the top margin and the apps' caption (74 % of the height).
  const top = Math.max(0.08 * height, Math.min(0.74 * height - block, look.row * height - block / 2));
  const local = frame - card.from;
  const first = card.index === 0;
  const grow = first ? interpolate(local, [0, 3, 6], [0.9, 1.08, 1], clamp) : 1;
  const blur = first ? interpolate(local, [0, 3], [6 * k, 0], clamp) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        textAlign: "center",
        fontSize: 0,
        lineHeight: 0,
        transform: grow !== 1 ? `scale(${grow.toFixed(3)})` : undefined,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      {lines.map((ids, li) => (
        <Fragment key={li}>
          {li ? (
            <>
              {" "}
              <br />
            </>
          ) : null}
          <span
            style={{
              display: "inline-block",
              verticalAlign: "top",
              background: BAND.band,
              height: line,
              lineHeight: `${line}px`,
              padding: `0 ${pad.toFixed(1)}px`,
              fontFamily: `"${look.fonts.display}", sans-serif`,
              fontWeight: 700,
              fontSize: size,
              letterSpacing: "-0.01em",
              whiteSpace: "pre",
            }}
          >
            {ids.map((i, j) => {
              const w = card.words[i]!;
              return (
                <Fragment key={i}>
                  {j ? " " : ""}
                  <span style={{ color: frame >= w.from ? BAND.said : BAND.pending }}>{w.w}</span>
                </Fragment>
              );
            })}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
