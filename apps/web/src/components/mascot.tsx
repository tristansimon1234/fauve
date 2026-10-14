import type { CSSProperties } from "react";

/**
 * Brigitte's mascot: just a head, drawn like an icon. A full silhouette of
 * curly hair in the brand's gradient (its curls read in the scalloped edge),
 * a potato of a face, big cartoon eyes looking over half-moon reading glasses
 * low on the nose, one eyebrow up, a round nose, a smirk; the eyes blink and
 * the head floats slowly. Pure SVG/CSS (.fauve-cat in globals.css); motion stops
 * for reduced motion. Decorative: pair it with text.
 */

/** Small circles along an ellipse: together they make the curly edge of the hair. */
function ring(cx: number, cy: number, rx: number, ry: number, from: number, to: number, count: number, r: number): { x: number; y: number; r: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((from + ((to - from) * i) / (count - 1)) * Math.PI) / 180;
    // Slightly uneven curls.
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), r: r * (0.88 + (0.24 * ((i * 7) % 5)) / 4) };
  });
}

// The volume around the head (down to the jaw), then the fringe over the forehead.
const HAIR = ring(50, 52, 27, 23, 155, 385, 13, 7.8);
const FRINGE = ring(50, 45.5, 15, 5.5, 195, 345, 6, 5.4);

/** A potato of a face: lumpy, wider and lower on one side. */
const FACE = "M33.5 51 C35 43.5 42.5 41.5 50.5 42.5 C59 43.5 66.5 46 67.5 54.5 C69 61.5 71 69.5 66.5 76 C61.5 82.5 52.5 84.5 45 83.5 C37 82.5 30.5 77.5 30.8 69.5 C31 63 32 57 33.5 51 Z";

export function Mascot({ size = 120, className }: { size?: number; className?: string }) {
  // Unique per size, so several mascots on a page keep their own gradients.
  const id = `brigitte-${size}`;
  return (
    <span aria-hidden="true" className={`fauve-cat${className ? ` ${className}` : ""}`} style={{ "--cat": `${size}px` } as CSSProperties}>
      <svg viewBox="14 16 72 72" overflow="visible">
        <defs>
          {/* One gradient over the whole hair (not one per curl), so it reads as a single silhouette. */}
          <linearGradient id={`${id}-hair`} gradientUnits="userSpaceOnUse" x1="24" y1="26" x2="78" y2="80">
            <stop offset="0" stopColor="#5B3FD9" />
            <stop offset="1" stopColor="#F2694E" />
          </linearGradient>
        </defs>
        <g fill={`url(#${id}-hair)`}>
          <ellipse cx="50" cy="55" rx="27" ry="25" />
          {HAIR.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} />
          ))}
        </g>
        <path d={FACE} fill="#FFE3D6" stroke="#1C1530" strokeWidth="1.6" strokeLinejoin="round" />
        <g fill={`url(#${id}-hair)`}>
          {FRINGE.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} />
          ))}
        </g>
        {/* She looks over her reading glasses, one eyebrow up: the knowing look of a pro. */}
        <path d="M38.8 54.2 Q42.4 52 45.8 53.6 M54.2 52.2 Q57.8 49.8 61.4 51.8" fill="none" stroke="#1C1530" strokeWidth="1.7" strokeLinecap="round" />
        <g className="fauve-cat-eyes">
          <ellipse cx="42.6" cy="58.6" rx="3.4" ry="3.8" fill="#FFFFFF" stroke="#1C1530" strokeWidth="1.3" />
          <ellipse cx="57.6" cy="58" rx="3.4" ry="3.8" fill="#FFFFFF" stroke="#1C1530" strokeWidth="1.3" />
          <circle cx="43" cy="59.8" r="1.7" fill="#1C1530" />
          <circle cx="58" cy="59.2" r="1.7" fill="#1C1530" />
        </g>
        <ellipse cx="36.5" cy="70" rx="3.6" ry="2.3" fill="#F8A48C" opacity="0.65" />
        <ellipse cx="64" cy="69.5" rx="3.6" ry="2.3" fill="#F8A48C" opacity="0.65" />
        {/* A round little nose, then the half-moon glasses resting low on it. */}
        <path d="M49 64.5 C47.4 68.2 49.2 70.4 51.6 69.6" fill="none" stroke="#1C1530" strokeWidth="1.4" strokeLinecap="round" />
        <g fill="#FFFFFF" fillOpacity="0.4" stroke="#1C1530" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M36.4 66.2 H48.4 A6 5 0 0 1 36.4 66.2 Z" />
          <path d="M52.4 66.2 H64.4 A6 5 0 0 1 52.4 66.2 Z" />
        </g>
        <path d="M48.4 66.6 Q50.4 65.4 52.4 66.6" fill="none" stroke="#1C1530" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M45.5 76.2 Q50.5 78.6 55 75.4" fill="none" stroke="#1C1530" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
