import { AbsoluteFill, Img, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReelProps } from "./types";

// What she added on her Reel (plan.overlays): a text, one of her photos, or its subject cut out, drawn by the engine over
// whatever is there, a composition too. Nothing is redrawn under it: free, and the same at every render.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function Overlays({ props, k }: { props: ReelProps; k: number }) {
  return (
    <>
      {(props.overlays ?? []).map((o, i) => (
        <Sequence key={`o${i}`} from={o.from} durationInFrames={o.durationInFrames} layout="none">
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            <Pop index={i} durationInFrames={o.durationInFrames} x={o.x * props.width} y={o.y * props.height}>
              {o.kind === "text" ? <OverlayText text={o.text ?? ""} size={o.w * props.width} props={props} k={k} /> : <OverlayPhoto o={o} width={o.w * props.width} k={k} />}
            </Pop>
          </AbsoluteFill>
        </Sequence>
      ))}
    </>
  );
}

/** Centred on its point, it lands with a short spring and leaves in a few frames. */
function Pop({ index, durationInFrames, x, y, children }: { index: number; durationInFrames: number; x: number; y: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const land = spring({ frame, fps, config: { damping: 18, stiffness: 220, mass: 0.6 } });
  const leave = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], clamp);
  return (
    <div data-fauve-overlay={index} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${0.86 + 0.14 * land})`, opacity: Math.min(land, leave) }}>
      {children}
    </div>
  );
}

function OverlayText({ text, size, props, k }: { text: string; size: number; props: ReelProps; k: number }) {
  return (
    <div
      style={{
        maxWidth: props.width - 160 * k,
        fontFamily: `"${props.brand.displayFont}", sans-serif`,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.1,
        color: "#FFFFFF",
        textAlign: "center",
        textWrap: "balance",
        textShadow: `0 ${2 * k}px ${10 * k}px rgba(0,0,0,.55)`,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}

/** A photo as a print (white edge, shadow); a cut-out as its subject only, framed on its box, with a soft shadow. */
function OverlayPhoto({ o, width, k }: { o: NonNullable<ReelProps["overlays"]>[number]; width: number; k: number }) {
  const aspect = o.aspect ?? 3 / 4;
  if (o.cutout && o.box) {
    // The image is the photo's size: scaled so its subject's box is `width` wide, and shifted onto it.
    const imageWidth = width / o.box.w;
    const imageHeight = imageWidth / aspect;
    return (
      <div style={{ position: "relative", width, height: imageHeight * o.box.h, filter: `drop-shadow(0 ${10 * k}px ${18 * k}px rgba(0,0,0,.35))` }}>
        <Img src={o.src ?? ""} style={{ position: "absolute", width: imageWidth, height: imageHeight, left: -o.box.x * imageWidth, top: -o.box.y * imageHeight, maxWidth: "none" }} />
      </div>
    );
  }
  return (
    <div style={{ background: "#FFFFFF", padding: 10 * k, borderRadius: 6 * k, boxShadow: `0 ${12 * k}px ${30 * k}px rgba(0,0,0,.35)` }}>
      <Img src={o.src ?? ""} style={{ display: "block", width, height: width / aspect, objectFit: "cover" }} />
    </div>
  );
}
