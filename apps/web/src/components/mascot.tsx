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

/** What Brigitte feels: at rest, writing (thinking), laughing, pleased, surprised. */
export type MascotMood = "idle" | "thinking" | "laugh" | "happy" | "surprised";

const INK = "#1C1530";

/** Eyebrows: the left one stays low, the right one is up (her look over the glasses); higher when surprised. */
function Brows({ mood }: { mood: MascotMood }) {
  const d =
    mood === "surprised" || mood === "laugh"
      ? "M39 51.6 Q42.6 49.4 45.8 50.8 M54.2 50.2 Q57.8 47.6 61.2 49.4"
      : mood === "thinking"
        ? "M39.4 54.2 Q42.6 53.2 45.8 54.6 M54.2 53.6 Q57.6 52.2 60.8 53.4"
        : "M39.2 54 Q42.6 52.2 45.6 53.4 M54.4 52 Q57.8 49.9 61 51.6";
  return <path className="fauve-cat-brows" d={d} fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />;
}

function Eyes({ mood }: { mood: MascotMood }) {
  if (mood === "laugh") {
    // Shut tight with laughter: two happy arcs.
    return <path d="M39.8 60 Q42.6 56.6 45.4 60 M54.8 59.4 Q57.6 56 60.4 59.4" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />;
  }
  // Thinking: she looks up and aside. Surprised: wide open.
  const dx = mood === "thinking" ? -0.9 : 0;
  const dy = mood === "thinking" ? -1.1 : 0;
  const big = mood === "surprised" ? 1.2 : 1;
  return (
    <g className="fauve-cat-eyes">
      <ellipse cx={42.6 + dx} cy={59 + dy} rx={2.3 * big} ry={2.9 * big} fill={INK} />
      <ellipse cx={57.6 + dx} cy={58.4 + dy} rx={2.3 * big} ry={2.9 * big} fill={INK} />
      <circle cx={43.4 + dx} cy={58 + dy} r="0.75" fill="#FFFFFF" />
      <circle cx={58.4 + dx} cy={57.4 + dy} r="0.75" fill="#FFFFFF" />
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }) {
  if (mood === "laugh") {
    return (
      <g>
        <path d="M44.8 74.2 Q50.4 74.8 56 73.6 Q55 80.6 50.2 80.6 Q45.6 80.6 44.8 74.2 Z" fill={INK} />
        <path d="M47.2 78.4 Q50.2 76.8 53.4 78.2 Q51.8 80 50.2 80 Q48.4 80 47.2 78.4 Z" fill="#F2694E" />
      </g>
    );
  }
  if (mood === "surprised") return <ellipse cx="50.4" cy="76.4" rx="2.2" ry="2.8" fill={INK} />;
  if (mood === "happy") return <path d="M45.4 75 Q50.5 79.6 55.4 74.6" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />;
  if (mood === "thinking") return <path d="M47.6 76.6 Q50.4 75.8 53.4 76.4" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />;
  return <path d="M46.4 76 Q50.5 78 54.4 75.4" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />;
}

export function Mascot({ size = 120, className, mood = "idle", still = false }: { size?: number; className?: string; mood?: MascotMood; still?: boolean }) {
  // Unique per size, so several mascots on a page keep their own gradients.
  const id = `brigitte-${size}`;
  return (
    <span
      aria-hidden="true"
      className={`fauve-cat fauve-cat-${mood}${still ? " fauve-cat-still" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--cat": `${size}px` } as CSSProperties}
    >
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
        <ellipse className="fauve-cat-shadow" cx="50" cy="90" rx="15" ry="2.4" fill={INK} opacity="0.12" />
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
          <Brows mood={mood} />
          <Eyes mood={mood} />
          <ellipse cx="36.8" cy="70.5" rx="3.2" ry="2" fill="#F2694E" opacity={mood === "laugh" || mood === "happy" ? 0.38 : 0.22} />
          <ellipse cx="64" cy="70" rx="3.2" ry="2" fill="#F2694E" opacity={mood === "laugh" || mood === "happy" ? 0.38 : 0.22} />
          <g fill="#5B3FD9" fillOpacity="0.1" stroke={INK} strokeWidth="1.2" strokeLinejoin="round">
            <path d="M36.6 65.8 H48.2 A5.8 4.8 0 0 1 36.6 65.8 Z" />
            <path d="M52.6 65.8 H64.2 A5.8 4.8 0 0 1 52.6 65.8 Z" />
          </g>
          <path d="M48.2 66.2 Q50.4 65 52.6 66.2" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          <Mouth mood={mood} />
        </g>
      </svg>
    </span>
  );
}
