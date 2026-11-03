import type { CSSProperties, ReactNode } from "react";

/**
 * Edith's mascot, the logo: a head drawn in thin lines, like a pen drawing. The hair is one line that curls
 * (loops along the head, then a fringe of smaller loops over the forehead), a potato of a face under it, eyes
 * looking over half-moon reading glasses, one eyebrow up, a smirk; the eyes blink, an eyebrow lifts now and then,
 * the head floats. Every line is the current text color (ink on paper, white on a photo or on black), as thin at
 * every size (non-scaling strokes). Moods change the face: fade for the mouth and the eyes, slide for the brows
 * and the look (.fauve-cat in globals.css); motion stops for reduced motion. Decorative: pair it with text.
 */

/** The hair: one line that loops around the head, from one jaw to the other (generated, see lot6/hair.mjs). */
export const HAIR_PATH =
  "M27.9 67C27.9 67.1 28 67.4 27.9 67.7C27.8 67.9 27.6 68.2 27.2 68.4C26.9 68.6 26.4 68.7 25.9 68.8C25.3 68.8 24.7 68.8 24.1 68.6C23.5 68.4 22.8 68.1 22.2 67.6C21.6 67.2 21 66.6 20.6 66C20.1 65.4 19.7 64.6 19.5 63.8C19.2 63.1 19.1 62.2 19.1 61.4C19.1 60.6 19.3 59.8 19.5 59.1C19.7 58.4 20.1 57.8 20.5 57.3C20.9 56.8 21.4 56.4 21.8 56.1C22.3 55.8 22.8 55.7 23.2 55.7C23.6 55.6 23.9 55.7 24.2 55.8C24.4 56 24.5 56.2 24.5 56.4C24.6 56.6 24.4 56.8 24.2 57C24 57.1 23.7 57.3 23.3 57.3C22.9 57.3 22.4 57.2 21.9 57C21.4 56.8 20.9 56.5 20.4 56C20 55.6 19.5 55 19.2 54.3C18.9 53.6 18.6 52.9 18.5 52.1C18.4 51.3 18.4 50.4 18.6 49.7C18.7 48.9 19 48.1 19.4 47.4C19.8 46.7 20.3 46 20.8 45.5C21.4 45 22 44.6 22.6 44.4C23.2 44.1 23.8 44 24.3 44C24.9 44 25.4 44.1 25.7 44.2C26.1 44.4 26.4 44.6 26.5 44.8C26.6 45 26.7 45.3 26.6 45.5C26.5 45.7 26.3 45.8 26 45.9C25.8 45.9 25.4 45.9 25.1 45.7C24.7 45.5 24.3 45.2 24 44.8C23.7 44.4 23.3 43.8 23.2 43.2C23 42.6 22.9 41.8 22.9 41.1C22.9 40.4 23.1 39.6 23.3 38.8C23.6 38.1 24 37.3 24.5 36.7C25 36.1 25.7 35.5 26.3 35C27 34.6 27.7 34.3 28.4 34.1C29.1 33.9 29.9 33.8 30.5 33.9C31.2 33.9 31.8 34.1 32.3 34.3C32.7 34.5 33.1 34.8 33.4 35.1C33.7 35.4 33.8 35.7 33.8 36C33.9 36.3 33.8 36.5 33.6 36.6C33.5 36.7 33.2 36.8 33 36.7C32.7 36.6 32.4 36.4 32.2 36.1C32 35.7 31.8 35.3 31.7 34.8C31.6 34.2 31.5 33.6 31.7 33C31.8 32.3 32 31.6 32.4 31C32.7 30.3 33.2 29.7 33.8 29.1C34.4 28.6 35.1 28.1 35.8 27.8C36.6 27.4 37.4 27.2 38.2 27.1C39 27 39.8 27 40.5 27.1C41.2 27.3 41.9 27.5 42.5 27.8C43.1 28.2 43.5 28.6 43.9 29C44.2 29.4 44.4 29.8 44.6 30.2C44.7 30.6 44.6 31 44.6 31.2C44.5 31.4 44.3 31.6 44.1 31.6C43.9 31.7 43.7 31.6 43.5 31.4C43.4 31.2 43.2 30.9 43.1 30.5C43.1 30.1 43.1 29.6 43.2 29.1C43.4 28.6 43.6 28 44 27.5C44.4 27 44.9 26.4 45.5 26C46.1 25.6 46.8 25.2 47.6 25C48.3 24.7 49.2 24.6 50 24.6C50.8 24.6 51.7 24.7 52.4 25C53.2 25.2 53.9 25.6 54.5 26C55.1 26.4 55.6 27 56 27.5C56.4 28 56.6 28.6 56.8 29.1C56.9 29.6 56.9 30.1 56.9 30.5C56.8 30.9 56.6 31.2 56.5 31.4C56.3 31.6 56.1 31.7 55.9 31.6C55.7 31.6 55.5 31.4 55.4 31.2C55.4 31 55.3 30.6 55.4 30.2C55.6 29.8 55.8 29.4 56.1 29C56.5 28.6 56.9 28.2 57.5 27.8C58.1 27.5 58.8 27.3 59.5 27.1C60.2 27 61 27 61.8 27.1C62.6 27.2 63.4 27.4 64.2 27.8C64.9 28.1 65.6 28.6 66.2 29.1C66.8 29.7 67.3 30.3 67.6 31C68 31.6 68.2 32.3 68.3 33C68.5 33.6 68.4 34.2 68.3 34.8C68.2 35.3 68 35.7 67.8 36.1C67.6 36.4 67.3 36.6 67 36.7C66.8 36.8 66.5 36.7 66.4 36.6C66.2 36.5 66.1 36.3 66.2 36C66.2 35.7 66.3 35.4 66.6 35.1C66.9 34.8 67.3 34.5 67.7 34.3C68.2 34.1 68.8 33.9 69.5 33.9C70.1 33.8 70.9 33.9 71.6 34.1C72.3 34.3 73 34.6 73.7 35C74.3 35.5 75 36.1 75.5 36.7C76 37.3 76.4 38.1 76.7 38.8C76.9 39.6 77.1 40.4 77.1 41.1C77.1 41.8 77 42.6 76.8 43.2C76.7 43.8 76.3 44.4 76 44.8C75.7 45.2 75.3 45.5 74.9 45.7C74.6 45.9 74.2 45.9 74 45.9C73.7 45.8 73.5 45.7 73.4 45.5C73.3 45.3 73.4 45 73.5 44.8C73.6 44.6 73.9 44.4 74.3 44.2C74.6 44.1 75.1 44 75.7 44C76.2 44 76.8 44.1 77.4 44.4C78 44.6 78.6 45 79.2 45.5C79.7 46 80.2 46.7 80.6 47.4C81 48.1 81.3 48.9 81.4 49.7C81.6 50.4 81.6 51.3 81.5 52.1C81.4 52.9 81.1 53.6 80.8 54.3C80.5 55 80 55.6 79.6 56C79.1 56.5 78.6 56.8 78.1 57C77.6 57.2 77.1 57.3 76.7 57.3C76.3 57.3 76 57.1 75.8 57C75.6 56.8 75.4 56.6 75.5 56.4C75.5 56.2 75.6 56 75.8 55.8C76.1 55.7 76.4 55.6 76.8 55.7C77.2 55.7 77.7 55.8 78.2 56.1C78.6 56.4 79.1 56.8 79.5 57.3C79.9 57.8 80.3 58.4 80.5 59.1C80.7 59.8 80.9 60.6 80.9 61.4C80.9 62.2 80.8 63.1 80.5 63.8C80.3 64.6 79.9 65.4 79.4 66C79 66.6 78.4 67.2 77.8 67.6C77.2 68.1 76.5 68.4 75.9 68.6C75.3 68.8 74.7 68.8 74.1 68.8C73.6 68.7 73.1 68.6 72.8 68.4C72.4 68.2 72.2 67.9 72.1 67.7C72 67.4 72.1 67.1 72.1 67";
/** The fringe: smaller loops over the forehead, from one temple to the other. */
export const FRINGE_PATH =
  "M65.9 48.3C66.1 48.4 66.4 48.7 66.7 48.8C67 48.9 67.3 48.9 67.7 48.7C68 48.6 68.3 48.3 68.6 48C68.8 47.7 69 47.2 69.1 46.7C69.2 46.3 69.2 45.7 69.1 45.2C69 44.7 68.8 44.1 68.4 43.7C68.1 43.2 67.7 42.8 67.2 42.5C66.8 42.1 66.2 41.9 65.6 41.8C65.1 41.6 64.5 41.6 64 41.7C63.5 41.7 62.9 41.9 62.5 42.1C62.1 42.4 61.8 42.7 61.5 43C61.3 43.3 61.1 43.7 61.1 44C61 44.3 61.1 44.7 61.2 44.9C61.3 45.1 61.5 45.3 61.7 45.4C61.9 45.5 62.1 45.5 62.4 45.4C62.6 45.3 62.8 45.1 63 44.8C63.2 44.5 63.3 44.1 63.3 43.7C63.3 43.4 63.3 42.9 63.1 42.4C63 42 62.7 41.5 62.4 41.1C62 40.7 61.6 40.3 61.1 40C60.6 39.7 60 39.4 59.4 39.3C58.8 39.2 58.2 39.1 57.6 39.2C57 39.2 56.4 39.4 55.9 39.6C55.5 39.8 55 40.2 54.6 40.5C54.3 40.8 54 41.2 53.8 41.6C53.7 41.9 53.6 42.3 53.6 42.6C53.6 42.9 53.7 43.2 53.8 43.4C53.9 43.6 54.1 43.7 54.3 43.7C54.4 43.7 54.7 43.7 54.8 43.5C55 43.4 55.1 43.1 55.2 42.8C55.2 42.5 55.2 42.1 55.1 41.7C55 41.3 54.8 40.9 54.5 40.5C54.2 40.1 53.8 39.7 53.4 39.4C52.9 39 52.4 38.8 51.8 38.6C51.3 38.4 50.6 38.3 50 38.3C49.4 38.3 48.7 38.4 48.2 38.6C47.6 38.8 47.1 39 46.6 39.4C46.2 39.7 45.8 40.1 45.5 40.5C45.2 40.9 45 41.3 44.9 41.7C44.8 42.1 44.8 42.5 44.8 42.8C44.9 43.1 45 43.4 45.2 43.5C45.3 43.7 45.6 43.7 45.7 43.7C45.9 43.7 46.1 43.6 46.2 43.4C46.3 43.2 46.4 42.9 46.4 42.6C46.4 42.3 46.3 41.9 46.2 41.6C46 41.2 45.7 40.8 45.4 40.5C45 40.2 44.5 39.8 44.1 39.6C43.6 39.4 43 39.2 42.4 39.2C41.8 39.1 41.2 39.2 40.6 39.3C40 39.4 39.4 39.7 38.9 40C38.4 40.3 38 40.7 37.6 41.1C37.3 41.5 37 42 36.9 42.4C36.7 42.9 36.7 43.4 36.7 43.7C36.7 44.1 36.8 44.5 37 44.8C37.2 45.1 37.4 45.3 37.6 45.4C37.9 45.5 38.1 45.5 38.3 45.4C38.5 45.3 38.7 45.1 38.8 44.9C38.9 44.7 39 44.3 38.9 44C38.9 43.7 38.7 43.3 38.5 43C38.2 42.7 37.9 42.4 37.5 42.1C37.1 41.9 36.5 41.7 36 41.7C35.5 41.6 34.9 41.6 34.4 41.8C33.8 41.9 33.2 42.1 32.8 42.5C32.3 42.8 31.9 43.2 31.6 43.7C31.2 44.1 31 44.7 30.9 45.2C30.8 45.7 30.8 46.3 30.9 46.7C31 47.2 31.2 47.7 31.4 48C31.7 48.3 32 48.6 32.3 48.7C32.7 48.9 33 48.9 33.3 48.8C33.6 48.7 33.9 48.4 34.1 48.3";
/** The face below the fringe: a potato, lumpier and lower on one side. */
export const FACE_PATH = "M33.6 52 C32 57 31 63 30.8 69.5 C30.5 77.5 37 82.5 45 83.5 C52.5 84.5 61.5 82.5 66.5 76 C71 69.5 69 61.5 67.6 54.5 C67.3 52.6 66.8 51 66 49.6";
/** Half-moon reading glasses, low on the nose, and their bridge. */
export const GLASSES_PATH = "M36.6 65.8 H48.2 A5.8 4.8 0 0 1 36.6 65.8 Z M52.6 65.8 H64.2 A5.8 4.8 0 0 1 52.6 65.8 Z M48.2 66.2 Q50.4 65 52.6 66.2";

/** What Edith feels: at rest, writing (thinking), laughing, pleased, surprised, sad, in tears, cross, shy (a compliment). */
export type MascotMood = "idle" | "thinking" | "laugh" | "happy" | "surprised" | "sad" | "cry" | "angry" | "shy";

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
  idle: <path d="M46.4 76 Q50.5 78 54.4 75.4" />,
  happy: <path d="M45.4 75 Q50.5 79.6 55.4 74.6" />,
  thinking: <path d="M47.6 76.6 Q50.4 75.8 53.4 76.4" />,
  laugh: <path d="M44.8 74.2 Q50.4 74.8 56 73.6 Q55 80.6 50.2 80.6 Q45.6 80.6 44.8 74.2 Z" fill="currentColor" />,
  surprised: <ellipse cx="50.4" cy="76.4" rx="2" ry="2.6" />,
  sad: <path d="M46.4 77.4 Q50.4 74.6 54.4 77.2" />,
  cry: <path d="M45.6 78 Q50.4 73.8 55.2 77.8" />,
  // A tight pout.
  angry: <path d="M46.8 77.6 Q48.6 76 50.4 76.8 Q52.2 76 54 77.6" />,
  // A small closed smile, to one side.
  shy: <path d="M47.8 75.8 Q50.6 77.6 53.2 75.4" />,
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
      <path className="fauve-cat-brows" d={BROWS[mood]} style={{ d: `path("${BROWS[mood]}")`, transition: "d 260ms ease" } as CSSProperties} />
      <g style={{ ...fade(mood !== "laugh"), transform: look, transformBox: "fill-box", transformOrigin: "center", transition: "opacity 220ms ease, transform 260ms ease" }}>
        <g className="fauve-cat-eyes" fill="currentColor" stroke="none">
          <ellipse cx="42.6" cy="59" rx="1.7" ry="2.2" />
          <ellipse cx="57.6" cy="58.4" rx="1.7" ry="2.2" />
        </g>
      </g>
      {/* Shut tight with laughter: two happy arcs. */}
      <path d="M39.8 60 Q42.6 56.6 45.4 60 M54.8 59.4 Q57.6 56 60.4 59.4" style={fade(mood === "laugh")} />
      {/* Tears: drawn drops that run from under the glasses and fall again and again. */}
      <g style={fade(mood === "cry")}>
        <path className="fauve-cat-tear" d="M38.6 67.6 Q35.8 72.4 38.6 74.4 Q41.4 72.4 38.6 67.6 Z" />
        <path className="fauve-cat-tear fauve-cat-tear-b" d="M61.8 67 Q59 71.8 61.8 73.8 Q64.6 71.8 61.8 67 Z" />
      </g>
      {/* Shy (and laughing): little hatched blush on the cheeks. */}
      <path
        d="M34.6 70.4 L35.6 72.4 M36.8 70.2 L37.8 72.2 M39 70 L40 72 M61.8 69.8 L62.8 71.8 M64 69.6 L65 71.6 M66.2 69.4 L67.2 71.4"
        style={fade(mood === "shy" || mood === "laugh")}
      />
      {/* Cross: the anger mark on her forehead, throbbing. */}
      <g style={fade(mood === "angry")}>
        <path
          className="fauve-cat-vein"
          d="M60.6 47.4 Q62.4 47 62.6 45.2 M65.4 45.2 Q65.6 47 67.4 47.4 M67.4 50.2 Q65.6 50.6 65.4 52.4 M62.6 52.4 Q62.4 50.6 60.6 50.2"
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

/** Its line, in px on screen: thin at every size, never a hairline that disappears. */
export const mascotStroke = (size: number) => Math.min(1.7, Math.max(1, size / 100));

export function Mascot({ size = 120, className, mood = "idle", still = false }: { size?: number; className?: string; mood?: MascotMood; still?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`fauve-cat fauve-cat-${mood}${still ? "fauve-cat-still" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--cat": `${size}px` } as CSSProperties}
    >
      <svg viewBox="14 18 72 76" overflow="visible">
        {/* A soft shadow on the ground: it stays put and narrows as she floats up. */}
        <ellipse className="fauve-cat-shadow" cx="50" cy="90" rx="14" ry="1.8" fill="currentColor" opacity="0.1" />
        <g
          className="fauve-cat-float"
          fill="none"
          stroke="currentColor"
          strokeWidth={mascotStroke(size)}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="fauve-cat-mood">
            <path d={HAIR_PATH} />
            <path d={FACE_PATH} />
            <path d={FRINGE_PATH} />
            {/* She looks over her reading glasses, one eyebrow up: the knowing look of a pro. */}
            <path d={GLASSES_PATH} />
            <Face mood={mood} />
          </g>
        </g>
      </svg>
    </span>
  );
}
