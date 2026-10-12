import type { CSSProperties } from "react";

/**
 * Fauve's mascot: a small big-cat character in the brand colours. It sways,
 * blinks and twitches an ear (CSS in globals.css, .fauve-mascot); motion stops
 * for reduced motion. Decorative: pair it with text.
 */
export function Mascot({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 230"
      width={size}
      height={(size * 230) / 200}
      className={`fauve-mascot${className ? ` ${className}` : ""}`}
      style={{ overflow: "visible" } as CSSProperties}
    >
      <defs>
        <linearGradient id="fauve-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7845F" />
          <stop offset="1" stopColor="#E85A3F" />
        </linearGradient>
        <linearGradient id="fauve-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6B4FE3" />
          <stop offset="1" stopColor="#4A31C4" />
        </linearGradient>
      </defs>

      {/* Body and paws */}
      <g className="fauve-mascot-body">
        <path d="M52 230 C52 182 72 160 100 160 C128 160 148 182 148 230 Z" fill="url(#fauve-body)" />
        <ellipse cx="78" cy="214" rx="15" ry="11" fill="#FFD6C8" />
        <ellipse cx="122" cy="214" rx="15" ry="11" fill="#FFD6C8" />
        <path d="M100 172 L100 200" stroke="#FFFFFF" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g className="fauve-mascot-head">
        {/* Ears (the right one twitches) */}
        <g className="fauve-mascot-ear-l">
          <path d="M46 70 Q44 22 74 18 Q86 40 88 58 Z" fill="url(#fauve-fur)" />
          <path d="M56 62 Q56 34 72 30 Q80 44 80 56 Z" fill="#FFD6C8" />
          <path d="M70 22 L74 6 L78 22 Z" fill="#3A2470" />
        </g>
        <g className="fauve-mascot-ear-r">
          <path d="M154 70 Q156 22 126 18 Q114 40 112 58 Z" fill="url(#fauve-fur)" />
          <path d="M144 62 Q144 34 128 30 Q120 44 120 56 Z" fill="#FFD6C8" />
          <path d="M130 22 L126 6 L122 22 Z" fill="#3A2470" />
        </g>

        {/* Head with cheek tufts */}
        <path
          d="M100 40 C140 40 164 66 164 100 C164 112 172 118 176 126 C166 128 162 132 158 138 C148 158 126 170 100 170 C74 170 52 158 42 138 C38 132 34 128 24 126 C28 118 36 112 36 100 C36 66 60 40 100 40 Z"
          fill="url(#fauve-fur)"
        />
        {/* Forehead stripes */}
        <path d="M100 48 L100 66 M88 52 L91 66 M112 52 L109 66" stroke="#5B3FD9" strokeWidth="4" strokeLinecap="round" opacity=".55" />

        {/* Muzzle */}
        <ellipse cx="100" cy="128" rx="36" ry="27" fill="#FFE9E1" />

        {/* Eyes */}
        <g className="fauve-mascot-eyes">
          <ellipse cx="76" cy="98" rx="8" ry="10" fill="#1C1530" />
          <ellipse cx="124" cy="98" rx="8" ry="10" fill="#1C1530" />
          <circle cx="79" cy="94" r="3" fill="#FFFFFF" />
          <circle cx="127" cy="94" r="3" fill="#FFFFFF" />
        </g>

        {/* Nose, mouth, whiskers */}
        <path d="M91 114 Q100 109 109 114 Q104 124 100 125 Q96 124 91 114 Z" fill="#5B3FD9" />
        <path d="M100 125 L100 131 M100 131 Q93 139 86 133 M100 131 Q107 139 114 133" stroke="#1C1530" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M66 124 L38 118 M66 132 L36 134 M134 124 L162 118 M134 132 L164 134" stroke="#1C1530" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />

        {/* Cheeks */}
        <ellipse cx="62" cy="120" rx="9" ry="6" fill="#FF9C86" opacity=".7" />
        <ellipse cx="138" cy="120" rx="9" ry="6" fill="#FF9C86" opacity=".7" />
      </g>
    </svg>
  );
}
