import type { CSSProperties } from "react";

/**
 * Fauve's mascot, abstract: the orb becomes a face. The morphing gradient
 * sphere gets two soft ears and two minimal eyes that blink, with one orbit
 * turning around it. Pure CSS/SVG (.fauve-cat in globals.css); motion stops for
 * reduced motion. Decorative: pair it with text.
 */
export function Mascot({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`fauve-cat${className ? ` ${className}` : ""}`} style={{ "--cat": `${size}px` } as CSSProperties}>
      <svg className="fauve-cat-ears" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="fauve-cat-ear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F8A48C" />
            <stop offset="1" stopColor="#F2694E" />
          </linearGradient>
        </defs>
        <path className="fauve-cat-ear-l" d="M17 44 C14 26 18 12 26 8 C33 14 40 24 44 34 Z" fill="url(#fauve-cat-ear)" />
        <path className="fauve-cat-ear-r" d="M83 44 C86 26 82 12 74 8 C67 14 60 24 56 34 Z" fill="url(#fauve-cat-ear)" />
      </svg>
      <span className="fauve-cat-head" />
      <svg className="fauve-cat-face" viewBox="0 0 100 100">
        <g className="fauve-cat-eyes">
          <ellipse cx="40" cy="60" rx="3.6" ry="5" fill="#1C1530" />
          <ellipse cx="60" cy="60" rx="3.6" ry="5" fill="#1C1530" />
        </g>
      </svg>
      <span className="fauve-cat-ring">
        <span className="fauve-cat-moon" />
      </span>
    </span>
  );
}
