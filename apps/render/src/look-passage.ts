import type { ComposeShot, ReelLookDraw } from "./types";

// A ready look laid on one passage of a composition (Look, PassageLook.tsx): which of the engine's presets its code
// names, and when it is on. Pure, so it is tested without a renderer (packages/agent/src/features.test.ts).

/** The ready looks the engine gives a Reel, by key (looks.ts, LOOK_PRESETS), each with the date its camera prints. */
export type PassageLooks = Record<string, { look: ReelLookDraw; stamp?: string }>;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The ready look a composition names: by its key (« vhs », « bw »), else by its name (« Cassette VHS », « noir et blanc »); null when there is none. */
export function passageLook(looks: PassageLooks | null | undefined, preset: unknown): { look: ReelLookDraw; stamp?: string } | null {
  if (!looks || typeof preset !== "string" || !preset.trim()) return null;
  const asked = fold(preset);
  if (looks[asked]) return looks[asked];
  return Object.values(looks).find((l) => fold(l.look.name) === asked) ?? null;
}

/**
 * Whether a look laid on a passage is on at a frame of the composition: while its shot plays (`shot`, shots[i]: from
 * its first frame to its last), within `from` (included) and `to` (excluded) when given, frames of the composition;
 * with neither, all along.
 */
export function passageLookOn(frame: number, span: { from?: number; to?: number; shot?: Pick<ComposeShot, "from" | "durationInFrames"> }): boolean {
  const from = Math.max(span.shot ? span.shot.from : Number.NEGATIVE_INFINITY, Number.isFinite(span.from) ? span.from! : Number.NEGATIVE_INFINITY);
  const to = Math.min(span.shot ? span.shot.from + span.shot.durationInFrames : Number.POSITIVE_INFINITY, Number.isFinite(span.to) ? span.to! : Number.POSITIVE_INFINITY);
  return frame >= from && frame < to;
}
