import { useId, type ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * A word circled or underlined by hand, like the strokes on a business's site: an open loop drawn
 * around the word in a few frames, its end running past its start, or a scribbled underline. It
 * wraps the word inline, so the stroke follows the word as it is laid out, whatever its size and
 * place: drawn by hand around the box kept for a price, the circle went round empty space once
 * FitText had made the price smaller, and ran through the line above it. The engine's key words
 * use it, and so can any animation (it is in their scope).
 */
export function Marker({ color, from = 0, shape = "circle", strokeWidth, children }: { color: string; from?: number; shape?: "circle" | "underline"; strokeWidth?: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const clip = useId();
  const underline = shape === "underline";
  // Drawn by uncovering the stroke from left to right (a dash animation does not survive the non-scaling stroke).
  const drawn = interpolate(frame, [from, from + (underline ? 10 : 13)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const stroke = {
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth ?? (underline ? 7 : 6),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      <svg
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={
          underline
            ? { position: "absolute", left: "-2%", width: "104%", top: "88%", height: "26%", overflow: "visible" }
            : { position: "absolute", left: "-9%", width: "118%", top: "-4%", height: "112%", overflow: "visible" }
        }
      >
        <defs>
          <clipPath id={clip}>
            <rect x={-20} y={-20} width={240 * drawn} height={140} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {underline ? (
            <path d="M 4 40 C 50 22, 120 30, 196 18 M 30 70 C 80 52, 140 58, 180 50" {...stroke} />
          ) : (
            <path d="M 28 20 C 78 0, 168 4, 193 38 C 207 68, 152 98, 94 96 C 36 94, 4 78, 7 50 C 10 26, 52 10, 118 9" {...stroke} />
          )}
        </g>
      </svg>
    </span>
  );
}
