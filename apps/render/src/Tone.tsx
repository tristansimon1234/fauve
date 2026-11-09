import type { ShotGrade } from "./types";

// Each of her shots brought to the Reel's light (packages/agent/src/shot-tone.ts): its colour matrix (its cast moved
// toward the Reel's), then its tone curve (its light lifted or calmed, its milky blacks brought down, its highlights
// pulled), then a small glow on its highlights. Laid on her footage only, before the Reel's look: the texts and the
// animations over it never change. Drawn from the plan alone, the render and the preview alike.

/** A short stable name for a grade's filter. */
export function toneId(tone: ShotGrade): string {
  const key = JSON.stringify([tone.matrix, tone.curve, tone.glow]);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return `fauve-tone-${(h >>> 0).toString(36)}`;
}

/** The CSS filter of a shot's grade (none without one). */
export const toneFilter = (tone: ShotGrade | undefined): string | undefined => (tone ? `url(#${toneId(tone)})` : undefined);

/**
 * A shot's own filter, in the order it applies: its grade, then the ambiance's light (none when she wants it as filmed),
 * then her light retouch.
 */
export function shotFilter(tone: ShotGrade | undefined, grade: string | undefined, asFilmed: boolean | undefined, retouch?: string): string | undefined {
  return [toneFilter(tone), asFilmed ? undefined : grade, retouch].filter(Boolean).join(" ") || undefined;
}

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** A light (0–1) through a grade's curve, as the render draws it (straight lines between its points). */
export function toneLight(curve: number[] | undefined, v: number): number {
  if (!curve?.length) return v;
  const x = Math.min(1, Math.max(0, v)) * (curve.length - 1);
  const i = Math.min(curve.length - 2, Math.floor(x));
  return curve[i]! + (curve[i + 1]! - curve[i]!) * (x - i);
}

/** A light reading ({ mean, high }) as the shot shows once graded. */
export function tonedLight<L extends { mean: number; high: number } | null>(light: L, curve: number[] | undefined): L {
  if (!light || !curve?.length) return light;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { ...light, mean: round(toneLight(curve, light.mean)), high: round(toneLight(curve, light.high)) };
}

/** The SVG filters of the Reel's grades, one per distinct grade (`k`: the frame's scale, for the glow's spread). */
export function ToneDefs({ tones, k }: { tones: (ShotGrade | undefined)[]; k: number }) {
  const seen = new Map<string, ShotGrade>();
  for (const tone of tones) if (tone && !seen.has(toneId(tone))) seen.set(toneId(tone), tone);
  if (!seen.size) return null;
  // The glow: in each colour, only what is brighter than 75 %, stretched back to the full range (a lamp blooms in its own
  // colour), blurred and added back.
  const bright = "4 0 0 0 -3  0 4 0 0 -3  0 0 4 0 -3  0 0 0 0 1";
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        {[...seen].map(([id, tone]) => {
          const table = tone.curve.join(" ");
          const plain = tone.matrix.every((v, i) => Math.abs(v - IDENTITY[i]!) < 1e-4);
          return (
            <filter key={id} id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
              {plain ? null : <feColorMatrix in="SourceGraphic" type="matrix" values={tone.matrix.join(" ")} result="balanced" />}
              <feComponentTransfer in={plain ? "SourceGraphic" : "balanced"} result="toned">
                <feFuncR type="table" tableValues={table} />
                <feFuncG type="table" tableValues={table} />
                <feFuncB type="table" tableValues={table} />
              </feComponentTransfer>
              {tone.glow > 0 ? (
                <>
                  <feColorMatrix in="toned" type="matrix" values={bright} result="bright" />
                  <feGaussianBlur in="bright" stdDeviation={(10 * k).toFixed(1)} result="bloom" />
                  <feComposite in="toned" in2="bloom" operator="arithmetic" k1="0" k2="1" k3={tone.glow.toFixed(3)} k4="0" />
                </>
              ) : null}
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}
