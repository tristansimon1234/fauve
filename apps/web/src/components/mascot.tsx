import type { CSSProperties, ReactNode } from "react";

/**
 * Edith's mascot, the logo (Tristan: « presque un gribouille de cheveux, ultra minimaliste »): a scribble of hair,
 * one loose pen line that loops over the head, the half-moon reading glasses under it and two dots for eyes; nothing
 * else at rest. Moods add only what they need (brows, a mouth, tears, a blush, the anger mark); the eyes blink, the
 * head floats. Every line is the current text color (ink on paper, white on a photo or on black), as thin at every
 * size (non-scaling strokes, .fauve-cat in globals.css); motion stops for reduced motion. Decorative: pair it with text.
 */

/** The hair: one scribbled line from one side of the head to the other (generated once, lot6/scribble.mjs). */
export const HAIR_PATH =
  "M27.1 59.7C27.1 59.8 27.3 60.3 27.2 60.6C27.1 60.9 27 61.3 26.8 61.5C26.5 61.8 26.2 62.1 25.8 62.2C25.4 62.4 25 62.5 24.5 62.5C24 62.5 23.5 62.4 22.9 62.3C22.4 62.1 21.8 61.8 21.3 61.5C20.8 61.1 20.3 60.6 19.9 60.1C19.5 59.6 19.1 58.9 18.8 58.3C18.5 57.6 18.2 56.9 18.1 56.2C18 55.5 17.9 54.7 18 54C18 53.3 18.1 52.5 18.3 51.9C18.5 51.2 18.8 50.6 19.1 50C19.5 49.5 19.9 49 20.3 48.6C20.7 48.2 21.2 47.9 21.6 47.7C22.1 47.4 22.6 47.3 23 47.3C23.4 47.2 23.8 47.3 24.1 47.3C24.5 47.4 24.8 47.6 25 47.8C25.2 48 25.4 48.2 25.4 48.5C25.5 48.7 25.5 49 25.4 49.2C25.3 49.4 25.2 49.6 25 49.8C24.8 50 24.5 50.1 24.2 50.1C23.9 50.2 23.5 50.2 23.1 50C22.8 49.9 22.4 49.8 22.1 49.5C21.7 49.2 21.4 48.9 21.1 48.5C20.8 48.1 20.5 47.5 20.3 47C20.1 46.5 20 45.8 20 45.2C19.9 44.6 19.9 43.9 20 43.3C20.1 42.6 20.3 41.9 20.6 41.3C20.8 40.7 21.2 40.1 21.6 39.5C22 39 22.4 38.5 22.9 38.1C23.4 37.6 23.9 37.3 24.5 37C25 36.8 25.6 36.6 26.1 36.5C26.6 36.4 27.1 36.4 27.6 36.4C28 36.4 28.4 36.6 28.8 36.7C29.1 36.9 29.4 37.1 29.6 37.3C29.9 37.6 30 37.8 30.1 38.1C30.1 38.3 30.1 38.6 30.1 38.8C30 39 29.9 39.2 29.7 39.3C29.5 39.4 29.2 39.5 28.9 39.6C28.6 39.6 28.2 39.5 27.9 39.4C27.5 39.3 27.1 39.1 26.8 38.8C26.4 38.5 26.1 38.1 25.8 37.6C25.5 37.1 25.2 36.5 25.1 35.9C24.9 35.3 24.9 34.6 24.9 33.9C25 33.2 25.2 32.4 25.4 31.7C25.7 30.9 26.1 30.2 26.5 29.5C27 28.8 27.6 28.1 28.3 27.5C28.9 26.9 29.7 26.4 30.5 26C31.3 25.5 32.2 25.2 33 25C33.9 24.9 34.8 24.8 35.6 24.9C36.4 24.9 37.2 25.1 37.9 25.4C38.6 25.7 39.3 26.1 39.8 26.6C40.3 27 40.7 27.6 41 28.2C41.2 28.7 41.3 29.4 41.3 30C41.3 30.6 41.2 31.2 40.9 31.7C40.6 32.2 40.2 32.7 39.7 33C39.3 33.3 38.6 33.6 38.1 33.7C37.6 33.8 37 33.7 36.5 33.6C36 33.4 35.5 33.1 35.2 32.7C34.8 32.3 34.5 31.8 34.4 31.2C34.2 30.7 34.2 30 34.3 29.4C34.4 28.7 34.7 28.1 35 27.4C35.4 26.8 35.9 26.2 36.5 25.6C37.1 25.1 37.8 24.6 38.6 24.2C39.3 23.9 40.2 23.5 41 23.4C41.9 23.2 42.8 23.1 43.7 23.1C44.5 23.2 45.4 23.3 46.2 23.5C47 23.8 47.8 24.1 48.4 24.5C49.1 24.9 49.7 25.4 50.2 25.9C50.6 26.5 51 27 51.3 27.6C51.6 28.1 51.7 28.7 51.8 29.2C51.9 29.8 51.9 30.3 51.8 30.7C51.8 31.2 51.6 31.6 51.4 31.9C51.2 32.2 51 32.5 50.7 32.7C50.5 32.9 50.2 33 50 33C49.8 33 49.5 33 49.3 32.8C49 32.7 48.8 32.5 48.6 32.2C48.4 31.9 48.2 31.6 48.1 31.2C48.1 30.8 48 30.3 48.1 29.9C48.2 29.4 48.4 28.8 48.6 28.3C48.9 27.8 49.3 27.3 49.7 26.9C50.2 26.4 50.8 26 51.4 25.6C52 25.3 52.8 24.9 53.6 24.8C54.3 24.6 55.2 24.5 56 24.5C56.8 24.5 57.7 24.6 58.6 24.9C59.4 25.1 60.2 25.4 60.9 25.8C61.7 26.2 62.4 26.6 63 27.1C63.6 27.6 64.1 28.2 64.4 28.8C64.8 29.4 65.1 30 65.2 30.6C65.3 31.2 65.2 31.8 65.1 32.4C65 32.9 64.7 33.4 64.3 33.7C64 34.1 63.5 34.4 63.1 34.5C62.6 34.6 62 34.7 61.5 34.5C60.9 34.4 60.3 34.1 59.9 33.7C59.4 33.4 59 32.9 58.7 32.3C58.4 31.7 58.2 31 58.2 30.4C58.2 29.7 58.3 28.9 58.5 28.2C58.8 27.5 59.2 26.8 59.7 26.2C60.2 25.6 60.9 25 61.7 24.5C62.5 24.1 63.4 23.7 64.3 23.5C65.3 23.3 66.3 23.2 67.4 23.3C68.4 23.3 69.5 23.6 70.5 23.9C71.5 24.2 72.5 24.7 73.4 25.3C74.2 25.9 75.1 26.7 75.8 27.4C76.5 28.2 77 29.1 77.5 30C77.9 30.8 78.2 31.8 78.4 32.7C78.5 33.5 78.5 34.4 78.4 35.2C78.3 36 77.9 36.9 77.5 37.6C77.1 38.2 76.5 38.8 75.9 39.3C75.4 39.7 74.7 40 74.1 40.2C73.5 40.4 72.8 40.4 72.2 40.3C71.6 40.2 71.1 40 70.6 39.7C70.2 39.4 69.8 38.9 69.5 38.5C69.3 38 69.1 37.5 69.1 37C69.1 36.5 69.3 36 69.5 35.6C69.7 35.2 70.1 34.8 70.6 34.5C71 34.2 71.6 34 72.2 33.9C72.8 33.9 73.5 33.9 74.1 34.1C74.8 34.2 75.5 34.5 76.1 34.9C76.8 35.3 77.4 35.9 77.9 36.5C78.5 37.1 79 37.8 79.3 38.6C79.7 39.3 80 40.2 80.2 41C80.4 41.8 80.4 42.7 80.4 43.5C80.3 44.3 80.2 45.2 80 45.9C79.7 46.6 79.4 47.3 79 47.9C78.6 48.5 78.1 49.1 77.6 49.5C77.2 49.9 76.6 50.2 76.1 50.4C75.6 50.7 75.1 50.8 74.6 50.8C74.1 50.9 73.7 50.8 73.3 50.7C73 50.6 72.7 50.4 72.6 50.2C72.4 50 72.2 49.8 72.2 49.5C72.1 49.3 72.2 49 72.3 48.8C72.4 48.6 72.5 48.3 72.8 48.1C73 47.9 73.3 47.7 73.7 47.6C74.1 47.5 74.5 47.4 74.9 47.5C75.4 47.5 75.9 47.6 76.3 47.8C76.8 48 77.3 48.3 77.8 48.7C78.2 49 78.7 49.5 79 50C79.4 50.5 79.7 51.2 80 51.8C80.2 52.4 80.4 53.2 80.5 53.9C80.6 54.6 80.6 55.3 80.5 56C80.4 56.7 80.2 57.5 80 58.1C79.7 58.8 79.4 59.4 79 59.9C78.6 60.4 78.1 60.9 77.7 61.3C77.2 61.6 76.7 61.9 76.2 62.1C75.7 62.3 75.2 62.4 74.7 62.4C74.3 62.4 73.9 62.3 73.5 62.1C73.2 61.9 72.9 61.7 72.7 61.4C72.5 61.2 NaN NaN 72.3 60.5CNaN NaN NaN NaN NaN NaN";
/** Half-moon reading glasses and their bridge. */
export const GLASSES_PATH = "M37.6 64.8 H48.2 A5.3 4.4 0 0 1 37.6 64.8 Z M52.6 64.8 H63.2 A5.3 4.4 0 0 1 52.6 64.8 Z M48.2 65.2 Q50.4 64 52.6 65.2";
/** The eyes, above the glasses. */
export const EYES = [
  { cx: 43.2, cy: 59 },
  { cx: 57.8, cy: 58.4 },
] as const;

/** What Edith feels: at rest, writing (thinking), laughing, pleased, surprised, sad, in tears, cross, shy (a compliment). */
export type MascotMood = "idle" | "thinking" | "laugh" | "happy" | "surprised" | "sad" | "cry" | "angry" | "shy";

/** Brows, drawn only when a mood needs them. */
const BROWS: Record<MascotMood, string> = {
  idle: "M40.4 54 Q43.2 53 46 53.8 M55 53.4 Q57.8 52.4 60.6 53.2",
  happy: "M40.4 54 Q43.2 53 46 53.8 M55 53.4 Q57.8 52.4 60.6 53.2",
  thinking: "M40.4 54 Q43.2 53 46 53.8 M55 52.6 Q57.8 50.8 60.6 52.2",
  laugh: "M40.2 52.6 Q43.2 51 46.2 52.4 M54.8 52 Q57.8 50.4 60.8 51.8",
  surprised: "M40.2 51.6 Q43.2 49.6 46.2 51.2 M54.8 51 Q57.8 49 60.8 50.6",
  // Worried: the inner ends up.
  sad: "M40.4 55 Q43.2 54.6 46 52.6 M55 52.2 Q57.8 54 60.6 54.6",
  cry: "M40.4 54.8 Q43.2 54.4 46 52 M55 51.6 Q57.8 53.6 60.6 54.2",
  // Cross: the inner ends down, frowning.
  angry: "M40.2 52 Q43.2 52.6 46.2 55 M54.8 54.6 Q57.8 52 60.8 51.4",
  shy: "M40.4 53.6 Q43.2 52.4 46 53.2 M55 52.8 Q57.8 51.6 60.6 52.6",
};
const SHOWS_BROWS: MascotMood[] = ["thinking", "surprised", "sad", "cry", "angry"];

const MOUTHS: Record<MascotMood, ReactNode> = {
  idle: null,
  happy: <path d="M46.6 73.6 Q50.5 77.4 54.4 73.4" />,
  thinking: <path d="M48.2 74.6 Q50.4 74 52.8 74.4" />,
  laugh: <path d="M45.8 72.8 Q50.4 73.4 55 72.4 Q54.2 78.4 50.2 78.4 Q46.4 78.4 45.8 72.8 Z" fill="currentColor" />,
  surprised: <ellipse cx="50.4" cy="74.6" rx="1.8" ry="2.3" />,
  sad: <path d="M47 75.6 Q50.4 73.2 53.8 75.4" />,
  cry: <path d="M46.4 76 Q50.4 72.4 54.4 75.8" />,
  // A tight pout.
  angry: <path d="M47.2 75.6 Q48.8 74.2 50.4 74.9 Q52 74.2 53.6 75.6" />,
  // A small closed smile, to one side.
  shy: <path d="M48.2 74 Q50.6 75.6 52.8 73.6" />,
};

/**
 * The face, every expression drawn at once and only the current one shown: changing
 * mood cross-fades the mouth, the brows and the eyes, and slides the look.
 */
function Face({ mood }: { mood: MascotMood }) {
  const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transition: "opacity 220ms ease" });
  // Thinking: she looks up and aside. Surprised: eyes wide open.
  // Shy: she looks down and aside. Cross: a stare, eyes a bit narrowed.
  const look =
    mood === "thinking"
      ? "translate(-0.9px, -1.1px)"
      : mood === "surprised"
        ? "scale(1.2)"
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
        style={{ d: `path("${BROWS[mood]}")`, transition: "d 260ms ease, opacity 220ms ease", opacity: SHOWS_BROWS.includes(mood) ? 1 : 0 } as CSSProperties}
      />
      <g style={{ ...fade(mood !== "laugh"), transform: look, transformBox: "fill-box", transformOrigin: "center", transition: "opacity 220ms ease, transform 260ms ease" }}>
        <g className="fauve-cat-eyes" fill="currentColor" stroke="none">
          {EYES.map((e) => (
            <ellipse key={e.cx} cx={e.cx} cy={e.cy} rx="1.5" ry="1.9" />
          ))}
        </g>
      </g>
      {/* Shut tight with laughter: two happy arcs. */}
      <path d="M40.6 59.6 Q43.2 56.6 45.8 59.6 M55.2 59 Q57.8 56 60.4 59" style={fade(mood === "laugh")} />
      {/* Tears: drawn drops that run from under the glasses and fall again and again. */}
      <g style={fade(mood === "cry")}>
        <path className="fauve-cat-tear" d="M39.4 66.8 Q36.8 71.2 39.4 73 Q42 71.2 39.4 66.8 Z" />
        <path className="fauve-cat-tear fauve-cat-tear-b" d="M61.4 66.4 Q58.8 70.8 61.4 72.6 Q64 70.8 61.4 66.4 Z" />
      </g>
      {/* Shy (and laughing): little hatched blush on the cheeks. */}
      <path d="M35.8 69.4 L36.8 71.2 M38 69.2 L39 71 M62 69 L63 70.8 M64.2 68.8 L65.2 70.6" style={fade(mood === "shy" || mood === "laugh")} />
      {/* Cross: the anger mark at her temple, throbbing. */}
      <g style={fade(mood === "angry")}>
        <path className="fauve-cat-vein" d="M62.6 47.4 Q64.4 47 64.6 45.2 M67.4 45.2 Q67.6 47 69.4 47.4 M69.4 50.2 Q67.6 50.6 67.4 52.4 M64.6 52.4 Q64.4 50.6 62.6 50.2" />
      </g>
      {(Object.keys(MOUTHS) as MascotMood[]).map((m) =>
        MOUTHS[m] ? (
          <g key={m} style={fade(m === mood)}>
            {MOUTHS[m]}
          </g>
        ) : null,
      )}
    </>
  );
}

/** Its line, in px on screen: thin at every size, never a hairline that disappears. */
export const mascotStroke = (size: number) => Math.min(1.6, Math.max(1, size / 100));

export function Mascot({ size = 120, className, mood = "idle", still = false }: { size?: number; className?: string; mood?: MascotMood; still?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`fauve-cat fauve-cat-${mood}${still ? " fauve-cat-still" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--cat": `${size}px` } as CSSProperties}
    >
      <svg viewBox="13 11 74 74" overflow="visible">
        <g className="fauve-cat-float" fill="none" stroke="currentColor" strokeWidth={mascotStroke(size)} strokeLinecap="round" strokeLinejoin="round">
          <g className="fauve-cat-mood">
            <path d={HAIR_PATH} />
            <path d={GLASSES_PATH} />
            <Face mood={mood} />
          </g>
        </g>
      </svg>
    </span>
  );
}
