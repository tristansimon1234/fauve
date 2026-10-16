import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Film dust over the whole video, as creators add it in their apps: a few white specks,
// a fibre now and then and a rare scratch, changing every two frames like film, under
// the texts. Drawn from the frame number alone: the render and the live preview match.

/** A small seeded random generator (mulberry32): the same frame always draws the same dust. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function FilmDust({ k }: { k: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const rand = seeded(Math.floor(frame / 2) * 7919 + 13);
  const specks = Array.from({ length: 9 + Math.floor(rand() * 9) }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: (1.6 + rand() * 3.4) * k,
    o: 0.45 + rand() * 0.5,
  }));
  // A fibre (a short curl) one frame in three, a scratch (a long thin line) one in five.
  const fibre =
    rand() < 0.33 ? { x: rand() * width, y: rand() * height, dx: (rand() - 0.5) * 60 * k, dy: (16 + rand() * 36) * k, o: 0.45 + rand() * 0.35 } : null;
  const scratch = rand() < 0.2 ? { x: rand() * width, y: rand() * height * 0.7, len: (100 + rand() * 260) * k, bend: (rand() - 0.5) * 24 * k, o: 0.25 + rand() * 0.3 } : null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ filter: `blur(${(0.5 * k).toFixed(2)}px)` }}>
        {specks.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
        ))}
        {fibre ? (
          <path
            d={`M ${fibre.x} ${fibre.y} q ${fibre.dx} ${fibre.dy / 2} ${fibre.dx / 3} ${fibre.dy}`}
            stroke="#fff"
            strokeWidth={1.6 * k}
            strokeLinecap="round"
            fill="none"
            opacity={fibre.o}
          />
        ) : null}
        {scratch ? (
          <path d={`M ${scratch.x} ${scratch.y} q ${scratch.bend} ${scratch.len / 2} 0 ${scratch.len}`} stroke="#fff" strokeWidth={1.1 * k} fill="none" opacity={scratch.o} />
        ) : null}
      </svg>
    </AbsoluteFill>
  );
}
