import type { CSSProperties } from "react";

/**
 * Brigitte's mascot: just a head, drawn like an icon. A full silhouette of
 * curly hair in the brand's gradient (its curls read in the scalloped edge),
 * a flat potato of a face, eyes looking over half-moon reading glasses low on
 * the nose, one eyebrow up, a smirk; the eyes blink and
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
      <svg viewBox="14 18 72 76" overflow="visible">
        <defs>
          {/* One gradient over the whole hair (not one per curl), so it reads as a single silhouette. */}
          <linearGradient id={`${id}-hair`} gradientUnits="userSpaceOnUse" x1="24" y1="26" x2="78" y2="80">
            <stop offset="0" stopColor="#5B3FD9" />
            <stop offset="1" stopColor="#F2694E" />
          </linearGradient>
          <clipPath id={`${id}-shade`}>
            <path d="M58 40 C70 50 74 68 64 86 L90 86 L90 40 Z" />
          </clipPath>
        </defs>
        {/* A soft shadow on the ground: it stays put and narrows as she floats up. */}
        <ellipse className="fauve-cat-shadow" cx="50" cy="90" rx="15" ry="2.4" fill="#1C1530" opacity="0.12" />
        <g className="fauve-cat-float">
        <g fill={`url(#${id}-hair)`}>
          <ellipse cx="50" cy="55" rx="27" ry="25" />
          {HAIR.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} />
          ))}
        </g>
        {/* Flat: no outline, a soft shade on one side gives the potato its volume. */}
        <path d={FACE} fill="#FFE3D6" />
        <path d={FACE} fill="#F7C9B6" clipPath={`url(#${id}-shade)`} />
        <g fill={`url(#${id}-hair)`}>
          {FRINGE.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} />
          ))}
        </g>
        {/* She looks over her reading glasses, one eyebrow up: the knowing look of a pro. */}
        <path d="M39.2 54 Q42.6 52.2 45.6 53.4 M54.4 52 Q57.8 49.9 61 51.6" fill="none" stroke="#1C1530" strokeWidth="1.5" strokeLinecap="round" />
        <g className="fauve-cat-eyes">
          <ellipse cx="42.6" cy="59" rx="2.3" ry="2.9" fill="#1C1530" />
          <ellipse cx="57.6" cy="58.4" rx="2.3" ry="2.9" fill="#1C1530" />
          <circle cx="43.4" cy="58" r="0.75" fill="#FFFFFF" />
          <circle cx="58.4" cy="57.4" r="0.75" fill="#FFFFFF" />
        </g>
        <ellipse cx="36.8" cy="70.5" rx="3.2" ry="2" fill="#F2694E" opacity="0.22" />
        <ellipse cx="64" cy="70" rx="3.2" ry="2" fill="#F2694E" opacity="0.22" />
        <g fill="#5B3FD9" fillOpacity="0.1" stroke="#1C1530" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M36.6 65.8 H48.2 A5.8 4.8 0 0 1 36.6 65.8 Z" />
          <path d="M52.6 65.8 H64.2 A5.8 4.8 0 0 1 52.6 65.8 Z" />
        </g>
        <path d="M48.2 66.2 Q50.4 65 52.6 66.2" fill="none" stroke="#1C1530" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M46.4 76 Q50.5 78 54.4 75.4" fill="none" stroke="#1C1530" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      </svg>
    </span>
  );
}
