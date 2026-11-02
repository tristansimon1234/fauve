import { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Sequence, useCurrentFrame } from "remotion";
import type { ReelProps } from "./types";

// A simple copied Reel remade by code (packages/agent/src/copy.ts): what the model lays over its shots, drawn by
// fixed code, never by an animation written for it. Her photos' subjects cut out and laid big (a person standing on
// the bottom edge, an object in the middle, a pair side by side), landing with a short pop; its title held, in the
// model's font and stroke, its lines staggered and tilted as the model sets them; its plain ending card. Made by hand
// first, without any model, this Reel came out far better than the chain of agents' (Tristan: « ça a l'air bcp mieux »).

type Copy = NonNullable<ReelProps["copy"]>;
type CopyCutout = Copy["cutouts"][number];

/** The shadow under a laid subject, as on a print (px at 1080 wide). */
const SHADOW = { y: 16, blur: 28, color: "rgba(0, 0, 0, 0.38)" };
/** A subject lands from 108 % of its size in 4 frames. */
const POP = { from: 1.08, frames: 4 };

export function CopyLayer({ props, k }: { props: ReelProps; k: number }) {
  const copy = props.copy!;
  return (
    <>
      {copy.cutouts.map((c, i) => (
        <Sequence key={`c${i}`} from={c.from} durationInFrames={c.durationInFrames} layout="none">
          <LaidSubject cutout={c} props={props} k={k} />
        </Sequence>
      ))}
      {copy.title ? (
        <Sequence from={copy.title.from} durationInFrames={copy.title.durationInFrames} layout="none">
          <CopyTitle title={copy.title} props={props} k={k} />
        </Sequence>
      ) : null}
      {copy.end ? (
        <Sequence from={copy.end.from} layout="none">
          <CopyEnd end={copy.end} font={copy.title?.font ?? props.brand.displayFont} weight={weightOf(copy.title?.stroke ?? "thin")} k={k} />
        </Sequence>
      ) : null}
    </>
  );
}

/** Where a subject goes and how big, in px of the frame: its box. */
export function subjectBox(c: Pick<CopyCutout, "box" | "aspect" | "place">, width: number, height: number): { x: number; y: number; w: number; h: number } {
  // The subject's height over its width, in pixels of the photo.
  const tall = (c.box.h / Math.max(0.01, c.box.w * c.aspect)) || 1;
  if (c.place === "stand") {
    let h = height * 0.68;
    let w = h / tall;
    if (w > width * 0.9) {
      w = width * 0.9;
      h = w * tall;
    }
    // Standing on the bottom edge, a little past it.
    return { x: (width - w) / 2, y: height - h + height * 0.02, w, h };
  }
  const pair = c.place !== "center";
  let w = width * (pair ? 0.46 : 0.74);
  let h = w * tall;
  const most = height * (pair ? 0.38 : 0.5);
  if (h > most) {
    h = most;
    w = h / tall;
  }
  const cx = width / 2 + (c.place === "left" ? -1 : c.place === "right" ? 1 : 0) * width * 0.24;
  return { x: cx - w / 2, y: height * 0.66 - h / 2, w, h };
}

/** One subject laid over a shot: drawn once into a canvas with its shadow (no CSS filter recomputed on every frame). */
function LaidSubject({ cutout, props, k }: { cutout: CopyCutout; props: ReelProps; k: number }) {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = subjectBox(cutout, props.width, props.height);
  const pad = Math.ceil((SHADOW.y + 1.5 * SHADOW.blur + 2) * k);
  const [size] = useState(() => ({ w: Math.max(1, Math.round(box.w)), h: Math.max(1, Math.round(box.h)) }));
  const [handle] = useState(() => delayRender("copy cut-out", { timeoutInMilliseconds: 20000 }));

  useLayoutEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };
    // No CORS asked: the canvas is drawn on, never read.
    const image = new Image();
    image.onload = () => {
      try {
        const ctx = canvas.current?.getContext("2d");
        if (ctx) {
          // Only the subject's box of the cut-out, drawn with its shadow.
          const [sx, sy, sw, sh] = [cutout.box.x * image.naturalWidth, cutout.box.y * image.naturalHeight, cutout.box.w * image.naturalWidth, cutout.box.h * image.naturalHeight];
          ctx.shadowColor = SHADOW.color;
          ctx.shadowBlur = SHADOW.blur * k;
          ctx.shadowOffsetY = SHADOW.y * k;
          ctx.drawImage(image, sx, sy, sw, sh, pad, pad, size.w, size.h);
        }
      } finally {
        finish();
      }
    };
    // Without its subject rather than a stuck render.
    image.onerror = finish;
    image.src = cutout.src;
    return finish;
  }, [cutout.src]);

  const scale = frame < POP.frames ? POP.from - ((POP.from - 1) * frame) / POP.frames : 1;
  return (
    <canvas
      ref={canvas}
      width={size.w + 2 * pad}
      height={size.h + 2 * pad}
      style={{
        position: "absolute",
        left: box.x - pad,
        top: box.y - pad,
        width: box.w + 2 * pad,
        height: box.h + 2 * pad,
        transform: `scale(${scale})`,
        transformOrigin: "50% 60%",
      }}
    />
  );
}

/** The font weight of a stroke: a fine pen stays fine. */
const weightOf = (stroke: "thin" | "regular" | "thick") => (stroke === "thick" ? 800 : stroke === "regular" ? 500 : 400);

/** Its staggered lines, shifted from the centre (shares of the width): out and back, as a hand writes them. */
const STAGGER = [-0.11, 0.09, -0.01, 0.06];

function CopyTitle({ title, props, k }: { title: NonNullable<Copy["title"]>; props: ReelProps; k: number }) {
  const longest = Math.max(...title.lines.map((l) => l.length), 1);
  // As big as the model's (about a ninth of the width a letter), never wider than the frame.
  const size = Math.min(120 * k, (props.width * 0.84) / (longest * (title.upper ? 0.62 : 0.5)));
  const shadow =
    title.shadow === "strong"
      ? `0 ${4 * k}px ${10 * k}px rgba(0, 0, 0, 0.75), 0 0 ${2 * k}px rgba(0, 0, 0, 0.6)`
      : title.shadow === "soft"
        ? `0 ${3 * k}px ${6 * k}px rgba(0, 0, 0, 0.45)`
        : "none";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: props.height * title.y,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `rotate(${title.tilt}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {title.lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: `'${title.font ?? props.brand.displayFont}', sans-serif`,
              fontWeight: weightOf(title.stroke),
              fontSize: size,
              lineHeight: 1.2,
              color: title.color,
              textTransform: title.upper ? "uppercase" : "none",
              textShadow: shadow,
              whiteSpace: "nowrap",
              transform: title.staggered ? `translateX(${STAGGER[i % STAGGER.length]! * props.width}px)` : undefined,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function CopyEnd({ end, font, weight, k }: { end: NonNullable<Copy["end"]>; font: string; weight: number; k: number }) {
  const frame = useCurrentFrame();
  const card = [...end.cards].reverse().find((c) => c.from <= frame) ?? end.cards[0]!;
  return (
    <AbsoluteFill style={{ backgroundColor: end.ground, alignItems: "center", justifyContent: "center", padding: `0 ${90 * k}px` }}>
      {card.lines.map((line, i) => (
        <div key={i} style={{ fontFamily: `'${font}', sans-serif`, fontWeight: weight, fontSize: 62 * k, lineHeight: 1.26, color: end.ink, textAlign: "center" }}>
          {line}
        </div>
      ))}
    </AbsoluteFill>
  );
}
