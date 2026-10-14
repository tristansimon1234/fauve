import type { CSSProperties } from "react";

/**
 * Brigitte's mascot: a soft round head under one continuous line of curls, in
 * the brand's gradient (coral to violet). Clean vector, no outline on the face,
 * two pill eyes that blink, a slow float. Pure SVG/CSS (.fauve-cat in
 * globals.css); motion stops for reduced motion. Decorative: pair it with text.
 */
const HEAD = "M27 62 C27 48 37 41 50 41 C63 41 73 48 73 62 C73 75 63 83 50 83 C37 83 27 75 27 62 Z";

/** One line of curls rolled along an arc over the head (a trochoid), uneven like real hair. */
function curls(opts: { cx: number; cy: number; rx: number; ry: number; from: number; to: number; loop: number; turns: number; phase: number }): string {
  const steps = 360;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = opts.from + (opts.to - opts.from) * t;
    const phi = opts.phase + t * opts.turns * Math.PI * 2 + 0.6 * Math.sin(t * 11 + opts.phase);
    const r = opts.loop * (0.62 + 0.5 * Math.sin(t * Math.PI) + 0.14 * Math.sin(t * 23 + opts.phase));
    const x = opts.cx + opts.rx * Math.cos(a) + r * Math.cos(phi);
    const y = opts.cy + opts.ry * Math.sin(a) + r * Math.sin(phi) * 0.85;
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
}

const CURLS = curls({ cx: 50, cy: 50, rx: 26, ry: 20, from: Math.PI * 0.9, to: Math.PI * 2.1, loop: 9, turns: 7.5, phase: 0.6 });

export function Mascot({ size = 120, className }: { size?: number; className?: string }) {
  // Unique per size, so several mascots on a page keep their own gradients.
  const id = `brigitte-${size}`;
  return (
    <span aria-hidden="true" className={`fauve-cat${className ? ` ${className}` : ""}`} style={{ "--cat": `${size}px` } as CSSProperties}>
      <svg viewBox="12 14 76 76" overflow="visible">
        <defs>
          <linearGradient id={`${id}-hair`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#F2694E" />
            <stop offset="0.55" stopColor="#D946A6" />
            <stop offset="1" stopColor="#5B3FD9" />
          </linearGradient>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#EFEBFF" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="86" rx="17" ry="2.6" fill="#1C1530" opacity="0.08" />
        <path d={HEAD} fill={`url(#${id}-face)`} />
        <path d={HEAD} fill="none" stroke="#5B3FD9" strokeOpacity="0.14" strokeWidth="1.2" />
        <path d={CURLS} fill="none" stroke={`url(#${id}-hair)`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <g className="fauve-cat-eyes">
          <rect x="40.2" y="60" width="4.6" height="8.4" rx="2.3" fill="#1C1530" />
          <rect x="55.2" y="60" width="4.6" height="8.4" rx="2.3" fill="#1C1530" />
          <circle cx="43.4" cy="61.8" r="0.9" fill="#FFFFFF" />
          <circle cx="58.4" cy="61.8" r="0.9" fill="#FFFFFF" />
        </g>
      </svg>
    </span>
  );
}
