import type { CSSProperties } from "react";

/**
 * Fauve's mascot: a friendly doodle of a little cat head, drawn like a sketch.
 * The line "boils" (three hand-drawn takes of the same drawing shown in turn),
 * the colour sits slightly off the outline like a riso print, the eyes blink and
 * a loose scribbled orbit turns around it. Pure SVG/CSS (.fauve-cat in
 * globals.css); motion stops for reduced motion. Decorative: pair it with text.
 */
const HEAD =
  "M22 54 C21 42 25 33 30 29 L27 15 Q28 11 32 13 L42 24 C47 22.5 53 22.5 58 24 L68 13 Q72 11 73 15 L70 29 C75 33 79 42 78 54 C78 71 66 82 50 82 C34 82 22 71 22 54 Z";

const TAKES = [3, 7, 11];

export function Mascot({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`fauve-cat${className ? ` ${className}` : ""}`} style={{ "--cat": `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 100 100" overflow="visible">
        <defs>
          {TAKES.map((seed) => (
            <filter key={seed} id={`fauve-sketch-${seed}`} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed={seed} />
              <feDisplacementMap in="SourceGraphic" scale="3.2" />
            </filter>
          ))}
        </defs>
        {TAKES.map((seed) => (
          <g key={seed} className="fauve-cat-take" filter={`url(#fauve-sketch-${seed})`}>
            <g className="fauve-cat-orbit">
              <ellipse cx="50" cy="56" rx="44" ry="13" fill="none" stroke="#5B3FD9" strokeWidth="1.6" strokeDasharray="200 30" opacity="0.55" />
              <circle cx="93" cy="53" r="2.6" fill="#F2694E" />
            </g>
            <path d={HEAD} transform="translate(4 3)" fill="#FFD9CC" />
            <path d={HEAD} fill="none" stroke="#1C1530" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M29 22 L32 27 M71 22 L68 27" stroke="#F2694E" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="34" cy="64" rx="5" ry="3" fill="#F8A48C" opacity="0.7" />
            <ellipse cx="66" cy="64" rx="5" ry="3" fill="#F8A48C" opacity="0.7" />
            <g className="fauve-cat-eyes">
              <circle cx="40" cy="55" r="2.8" fill="#1C1530" />
              <circle cx="60" cy="55" r="2.8" fill="#1C1530" />
            </g>
            <path d="M45 63 Q47.5 66 50 63 Q52.5 66 55 63" fill="none" stroke="#1C1530" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
    </span>
  );
}
