import type { CSSProperties, ReactNode } from "react";

/**
 * Simone's mascot: just a head, drawn like an icon. A full silhouette of
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

/** What Simone feels: at rest, writing (thinking), laughing, pleased, surprised, sad, in tears, cross, shy (a compliment). */
export type MascotMood = "idle" | "thinking" | "laugh" | "happy" | "surprised" | "sad" | "cry" | "angry" | "shy";

const INK = "#1C1530";

const BROWS: Record<MascotMood, string> = {
  idle: "M39.2 54 Q42.6 52.2 45.6 53.4 M54.4 52 Q57.8 49.9 61 51.6",
  happy: "M39.2 53.6 Q42.6 51.8 45.6 53 M54.4 51.6 Q57.8 49.5 61 51.2",
  thinking: "M39.4 54.2 Q42.6 53.2 45.8 54.6 M54.2 53.6 Q57.6 52.2 60.8 53.4",
  laugh: "M39 51.6 Q42.6 49.4 45.8 50.8 M54.2 50.2 Q57.8 47.6 61.2 49.4",
  surprised: "M39 51 Q42.6 48.6 45.8 50.2 M54.2 49.6 Q57.8 47 61.2 48.8",
  // Worried: the inner ends up.
  sad: "M39.4 54.6 Q42.4 54.2 45.6 52.2 M54.4 51.8 Q57.6 53.6 60.8 54.2",
  cry: "M39.4 54.4 Q42.4 54 45.6 51.6 M54.4 51.2 Q57.6 53.2 60.8 53.8",
  // Cross: the inner ends down, frowning.
  angry: "M39.2 51.6 Q42.6 52.2 45.8 54.8 M54.2 54.4 Q57.6 51.6 61 51",
  // Shy: soft, a little raised.
  shy: "M39.4 53.2 Q42.6 51.8 45.6 52.8 M54.4 52.2 Q57.6 51 60.8 52.2",
};

const MOUTHS: Record<MascotMood, ReactNode> = {
  idle: <path d="M46.4 76 Q50.5 78 54.4 75.4" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />,
  happy: <path d="M45.4 75 Q50.5 79.6 55.4 74.6" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />,
  thinking: <path d="M47.6 76.6 Q50.4 75.8 53.4 76.4" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />,
  laugh: (
    <>
      <path d="M44.8 74.2 Q50.4 74.8 56 73.6 Q55 80.6 50.2 80.6 Q45.6 80.6 44.8 74.2 Z" fill={INK} />
      <path d="M47.2 78.4 Q50.2 76.8 53.4 78.2 Q51.8 80 50.2 80 Q48.4 80 47.2 78.4 Z" fill="#F2694E" />
    </>
  ),
  surprised: <ellipse cx="50.4" cy="76.4" rx="2.2" ry="2.8" fill={INK} />,
  sad: <path d="M46.4 77.4 Q50.4 74.6 54.4 77.2" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />,
  cry: <path d="M45.6 78 Q50.4 73.8 55.2 77.8" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />,
  // A tight pout.
  angry: <path d="M46.8 77.6 Q48.6 76 50.4 76.8 Q52.2 76 54 77.6" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  // A small closed smile, to one side.
  shy: <path d="M47.8 75.8 Q50.6 77.6 53.2 75.4" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />,
};

/**
 * The face, every expression drawn at once and only the current one shown: changing
 * mood cross-fades the mouth and the eyes, and slides the brows and the look.
 */
function Face({ mood }: { mood: MascotMood }) {
  const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transition: "opacity 220ms ease" });
  // Thinking: she looks up and aside. Surprised: eyes wide open.
  // Shy: she looks down and aside. Cross: a stare, eyes a bit narrowed.
  const look =
    mood === "thinking"
      ? "translate(-0.9px, -1.1px)"
      : mood === "surprised"
        ? "scale(1.18)"
        : mood === "sad" || mood === "cry"
          ? "translate(0, 0.9px)"
          : mood === "shy"
            ? "translate(1.1px, 1.2px)"
            : mood === "angry"
              ? "scale(1, 0.78)"
              : "none";
  return (
    <>
      <path
        className="fauve-cat-brows"
        d={BROWS[mood]}
        style={{ d: `path("${BROWS[mood]}")`, transition: "d 260ms ease" } as CSSProperties}
        fill="none"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g style={{ ...fade(mood !== "laugh"), transform: look, transformBox: "fill-box", transformOrigin: "center", transition: "opacity 220ms ease, transform 260ms ease" }}>
        <g className="fauve-cat-eyes">
          <ellipse cx="42.6" cy="59" rx="2.3" ry="2.9" fill={INK} />
          <ellipse cx="57.6" cy="58.4" rx="2.3" ry="2.9" fill={INK} />
          <circle cx="43.4" cy="58" r="0.75" fill="#FFFFFF" />
          <circle cx="58.4" cy="57.4" r="0.75" fill="#FFFFFF" />
        </g>
      </g>
      {/* Shut tight with laughter: two happy arcs. */}
      <path d="M39.8 60 Q42.6 56.6 45.4 60 M54.8 59.4 Q57.6 56 60.4 59.4" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" style={fade(mood === "laugh")} />
      {/* Tears: they run from under the glasses and fall again and again. */}
      <g style={fade(mood === "cry")} fill="#5BA8F0">
        <path className="fauve-cat-tear" d="M38.6 66.6 Q35.8 71.4 38.6 73.4 Q41.4 71.4 38.6 66.6 Z" />
        <path className="fauve-cat-tear fauve-cat-tear-b" d="M61.8 66 Q59 70.8 61.8 72.8 Q64.6 70.8 61.8 66 Z" />
      </g>
      {/* Shy: little blush strokes on her cheeks. */}
      <path
        d="M34.6 69.6 L35.6 71.6 M36.8 69.4 L37.8 71.4 M39 69.2 L40 71.2 M61.8 69 L62.8 71 M64 68.8 L65 70.8 M66.2 68.6 L67.2 70.6"
        fill="none"
        stroke="#E5484D"
        strokeWidth="0.8"
        strokeLinecap="round"
        style={fade(mood === "shy")}
      />
      {/* Cross: the anger mark on her forehead, throbbing. */}
      <g style={fade(mood === "angry")}>
        <path
          className="fauve-cat-vein"
          d="M60.6 47.4 Q62.4 47 62.6 45.2 M65.4 45.2 Q65.6 47 67.4 47.4 M67.4 50.2 Q65.6 50.6 65.4 52.4 M62.6 52.4 Q62.4 50.6 60.6 50.2"
          fill="none"
          stroke="#E5484D"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
      {(Object.keys(MOUTHS) as MascotMood[]).map((m) => (
        <g key={m} style={fade(m === mood)}>
          {MOUTHS[m]}
        </g>
      ))}
    </>
  );
}

const cheeks = (mood: MascotMood) => (mood === "shy" ? 0.62 : mood === "angry" ? 0.5 : mood === "laugh" || mood === "happy" ? 0.38 : 0.22);

export function Mascot({ size = 120, className, mood = "idle", still = false }: { size?: number; className?: string; mood?: MascotMood; still?: boolean }) {
  // Unique per size, so several mascots on a page keep their own gradients.
  const id = `simone-${size}`;
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
          <g className="fauve-cat-mood">
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
          {/* Cheeks: rosier when she laughs, red when cross, blushing when shy. */}
          <ellipse cx="36.8" cy="70.5" rx="3.2" ry="2" fill={mood === "angry" ? "#E5484D" : "#F2694E"} opacity={cheeks(mood)} style={{ transition: "opacity 260ms ease" }} />
          <ellipse cx="64" cy="70" rx="3.2" ry="2" fill={mood === "angry" ? "#E5484D" : "#F2694E"} opacity={cheeks(mood)} style={{ transition: "opacity 260ms ease" }} />
          <g fill="#5B3FD9" fillOpacity="0.1" stroke={INK} strokeWidth="1.2" strokeLinejoin="round">
            <path d="M36.6 65.8 H48.2 A5.8 4.8 0 0 1 36.6 65.8 Z" />
            <path d="M52.6 65.8 H64.2 A5.8 4.8 0 0 1 52.6 65.8 Z" />
          </g>
          <path d="M48.2 66.2 Q50.4 65 52.6 66.2" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          <Face mood={mood} />
          </g>
        </g>
      </svg>
    </span>
  );
}
