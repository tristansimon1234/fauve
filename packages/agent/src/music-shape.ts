import { z } from "zod";

// The shape of a Reel's music (Tristan, of the originals that shape theirs: « les pauses et les coupures de sa musique
// (la phrase posée, puis la reprise) : oui pourquoi pas si c'est bien fait »). Edith's music is composed as one
// continuous loop and set on the cuts (music.ts: composed with breaks, they fell anywhere and were heard as the sound
// cutting out); a house model that shapes its music on purpose says where, on the Reel's clock, from its beats: where
// it stops dead and comes back on a downbeat (a phrase left alone, a break before the drop, a late start), where it plays
// muffled, out of a small speaker or without its bass and when it opens, where it ends (cut dead on a beat, or faded).
// The mix applies it by ffmpeg, sample by sample, on whatever music the Reel gets (composed again, the one she asked
// for), before its sound effects and the sound of her videos; the live preview plays its silences. Pure: the plan's
// field, its reading and its filter graph (lib/render/sandbox.ts runs it).

/** How a passage of the music is filtered: through a wall, out of a small speaker, without its bass. */
export const MUSIC_FILTERS = ["muffled", "radio", "thin"] as const;
export type MusicFilterKind = (typeof MUSIC_FILTERS)[number];

const time = z.number().min(0).max(120);

/**
 * A Reel's music shaped as its model plays it (times in seconds on the Reel's clock, from the model's beats): set by the
 * engine from a montage skill's timeline (skills.ts), kept on the plan, so a render again shapes it the same way.
 */
export const musicShapeSchema = z.object({
  /** No music at all (a sound effects breakdown): its sounds alone over her videos' own sound, unless she asks for a music. */
  none: z.boolean().optional(),
  /** Where it stops dead and comes back (`to`, a downbeat): a phrase left alone, a break before the drop, a late start (from 0). */
  pauses: z.array(z.object({ from: time, to: time })).max(32).optional(),
  /** Where it plays filtered, and when it is open again (`to`, reached over `open` s: at once on a beat, or slowly). */
  filters: z
    .array(z.object({ kind: z.enum(MUSIC_FILTERS), from: time, to: time, open: z.number().min(0).max(4).optional() }))
    .max(8)
    .optional(),
  /** Where it has ended (`at`): cut dead (12 ms) or faded over `fade` s, silent after; else the mix fades its last 0.8 s. */
  end: z.object({ at: time, fade: z.number().min(0).max(4).optional() }).optional(),
});
export type MusicShape = z.infer<typeof musicShapeSchema>;

/** A pause's edges (s): the music fades out over the 5 ms before it stops and back in over the 5 ms before its return, so the attack on the beat stays whole. */
export const PAUSE_EDGE = 0.005;
/** How long a filtered passage takes to close, and to open by default (s): at once, never a click. */
export const FILTER_EDGE = 0.02;
/** A cut at the end of the music (s): its last 12 ms faded. */
export const END_CUT = 0.012;
/** The shortest pause or filtered passage kept (s). */
const SHORTEST = 0.03;

/**
 * Each filter as ffmpeg runs it, set on what the originals measure: muffled, the night of « Une journée chez toi »
 * (−8 dB at 2 kHz, −15 at 3, −23 at 5 and more above, as through a wall); radio, the band of « Titre qui se décode »
 * (some 30 dB less under 150 Hz and over 4 kHz, a small speaker); thin, the bass gone (30 dB less at 85 Hz, the line over
 * 240 Hz kept, « basse et batterie s'arrêtent » of « Mots aux quatre coins »).
 */
export const MUSIC_FILTER_GRAPHS: Record<MusicFilterKind, string> = {
  muffled: "lowpass=f=1300",
  radio: "highpass=f=400,highpass=f=400,lowpass=f=1800,lowpass=f=1800",
  thin: "highpass=f=220,highpass=f=220",
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Its shape read against the Reel's length: every time within it, its pauses in order (two that touch are one), its
 * filtered passages in order (one starts once the previous one has opened; two of a kind that touch are one), nothing
 * shaped after its end. Null when nothing is left; `none` stands alone.
 */
export function readMusicShape(shape: MusicShape | null | undefined, duration: number): MusicShape | null {
  if (!shape || !(duration > 0)) return null;
  if (shape.none) return { none: true };
  const clamp = (t: number) => round3(Math.min(duration, Math.max(0, t)));
  let end: MusicShape["end"];
  if (shape.end) {
    const at = clamp(shape.end.at);
    if (at >= 0.1) end = { at, fade: round3(Math.min(at, Math.max(END_CUT, shape.end.fade ?? END_CUT))) };
  }
  const until = end ? end.at - end.fade! : duration;
  const pauses: { from: number; to: number }[] = [];
  for (const p of [...(shape.pauses ?? [])].sort((a, b) => a.from - b.from)) {
    // One that starts with the Reel is a late start.
    const from = p.from < SHORTEST ? 0 : clamp(p.from);
    const to = clamp(p.to);
    if (to - from < SHORTEST || from >= until) continue;
    const last = pauses.at(-1);
    // Too close to come back between them: one pause.
    if (last && from - last.to < 2 * PAUSE_EDGE) last.to = Math.max(last.to, to);
    else pauses.push({ from, to });
  }
  const filters: { kind: MusicFilterKind; from: number; to: number; open: number }[] = [];
  for (const f of [...(shape.filters ?? [])].sort((a, b) => a.from - b.from)) {
    const to = clamp(f.to);
    let from = f.from < SHORTEST ? 0 : clamp(f.from);
    const last = filters.at(-1);
    if (last && last.kind === f.kind && from - last.to < FILTER_EDGE) {
      if (to > last.to) Object.assign(last, { to, open: round3(Math.min(to - last.from, Math.max(0.005, f.open ?? FILTER_EDGE))) });
      continue;
    }
    if (last) from = Math.max(from, round3(last.to + FILTER_EDGE));
    if (to - from < SHORTEST || from >= until) continue;
    filters.push({ kind: f.kind, from, to, open: round3(Math.min(to - from, Math.max(0.005, f.open ?? FILTER_EDGE))) });
  }
  if (!pauses.length && !filters.length && !end) return null;
  return { ...(pauses.length ? { pauses } : {}), ...(filters.length ? { filters } : {}), ...(end ? { end } : {}) };
}

/** Whether its shape changes the music in the mix (a model without music has none to change). */
export const shapesMusic = (shape: MusicShape | null | undefined): shape is MusicShape =>
  Boolean(shape && !shape.none && (shape.pauses?.length || shape.filters?.length || shape.end));

/** Its shape `lead` seconds later (a plan held on its first image, leadPlan): a late start still starts at 0. */
export function shiftMusicShape(shape: MusicShape, lead: number): MusicShape {
  if (!(lead > 0) || shape.none) return shape;
  const later = (t: number) => round3(t + lead);
  return {
    ...(shape.pauses ? { pauses: shape.pauses.map((p) => ({ from: p.from > 0 ? later(p.from) : 0, to: later(p.to) })) } : {}),
    ...(shape.filters ? { filters: shape.filters.map((f) => ({ ...f, from: f.from > 0 ? later(f.from) : 0, to: later(f.to) })) } : {}),
    ...(shape.end ? { end: { ...shape.end, at: later(shape.end.at) } } : {}),
  };
}

/** The mix's sample rate (mix.ts sets every input to it). */
const RATE = 44100;
const samples = (t: number) => Math.max(0, Math.round(t * RATE));

/** A part of a stream kept (s; `to` null: to its end), faded in over its first `fadeIn` s and out over its last `fadeOut`. */
type Kept = { from: number; to: number | null; fadeIn: number; fadeOut: number };

/**
 * The graph that keeps only those parts of [input], silent elsewhere, out as [output]: each part cut at its own samples
 * (atrim) and faded at its own (afade), silence between them, laid end to end (concat), as long as the music or `length`
 * s at least (the mix lasts as long as the video). Sample accurate: a pause starts and ends where its beat is.
 */
function gate(input: string, output: string, kept: Kept[], length: number): string[] {
  if (!kept.length) return [`[${input}]volume=0[${output}]`];
  if (kept.length === 1 && kept[0]!.from <= 0 && kept[0]!.to === null && !kept[0]!.fadeIn) return [`[${input}]anull[${output}]`];
  const graph = [`[${input}]asplit=${kept.length}${kept.map((_, i) => `[${output}_s${i}]`).join("")}`];
  const order: string[] = [];
  let cursor = 0;
  const silence = (n: number, label: string) => {
    if (n <= 0) return;
    graph.push(`anullsrc=r=${RATE}:cl=stereo,atrim=end_sample=${n}[${label}]`);
    order.push(`[${label}]`);
  };
  kept.forEach((k, i) => {
    const a = samples(k.from);
    const b = k.to === null ? null : samples(k.to);
    silence(a - cursor, `${output}_z${i}`);
    const trim = [a > 0 ? `start_sample=${a}` : "", b !== null ? `end_sample=${b}` : ""].filter(Boolean).join(":");
    const fadeIn = samples(k.fadeIn);
    const fadeOut = b === null ? 0 : Math.min(samples(k.fadeOut), b - a - fadeIn);
    const fades = [fadeIn > 0 ? `afade=t=in:ns=${fadeIn}` : "", fadeOut > 0 ? `afade=t=out:ss=${b! - a - fadeOut}:ns=${fadeOut}` : ""].filter(Boolean);
    graph.push(`[${output}_s${i}]${trim ? `atrim=${trim},` : ""}asetpts=PTS-STARTPTS${fades.map((f) => `,${f}`).join("")}[${output}_k${i}]`);
    order.push(`[${output}_k${i}]`);
    cursor = b ?? Number.POSITIVE_INFINITY;
  });
  // Stopped before the end of the Reel: silent to it.
  if (Number.isFinite(cursor)) silence(samples(length) - cursor, `${output}_zend`);
  graph.push(`${order.join("")}concat=n=${order.length}:v=0:a=1[${output}]`);
  return graph;
}

/**
 * The ffmpeg graph that shapes the music [input] (stereo at 44.1 kHz, at its level), out as [output]; `duration`, the
 * Reel's (s). Its filtered passages first: the music split in its dry sound and one filtered copy per kind, each kept on
 * its own passages and crossfaded at their edges (closed over 20 ms, opened over `open`), then mixed back; then its pauses
 * (the music gated, 5 ms edges); then its end (afade on its own samples). Labels start with `ms_`. Its shape read first.
 */
export function musicShapeGraph(shape: MusicShape, input: string, output: string, duration: number): string {
  const read = readMusicShape(shape, duration);
  if (!shapesMusic(read)) return `[${input}]anull[${output}]`;
  const length = duration + 0.5;
  const graph: string[] = [];
  let at = input;
  const filters = read.filters ?? [];
  if (filters.length) {
    const kinds = [...new Set(filters.map((f) => f.kind))];
    // The dry sound between the passages: closed into each one, opened out of it.
    const dry: Kept[] = [];
    let from = 0;
    let fadeIn = 0;
    for (const f of filters) {
      const edge = Math.min(FILTER_EDGE, f.from);
      if (f.from > from) dry.push({ from, to: f.from, fadeIn, fadeOut: edge });
      from = f.to - (f.open ?? FILTER_EDGE);
      fadeIn = f.open ?? FILTER_EDGE;
    }
    const last = filters.at(-1)!;
    if (last.to < duration) dry.push({ from, to: null, fadeIn, fadeOut: 0 });
    const branches = [...(dry.length ? ["dry"] : []), ...kinds];
    graph.push(`[${at}]asplit=${branches.length}${branches.map((b) => `[ms_${b}]`).join("")}`);
    const mixed: string[] = [];
    if (dry.length) {
      graph.push(...gate("ms_dry", "ms_dryk", dry, length));
      mixed.push("[ms_dryk]");
    }
    for (const kind of kinds) {
      const wet = filters
        .filter((f) => f.kind === kind)
        .map((f): Kept => ({ from: Math.max(0, f.from - FILTER_EDGE), to: f.to < duration ? f.to : null, fadeIn: Math.min(FILTER_EDGE, f.from), fadeOut: f.to < duration ? (f.open ?? FILTER_EDGE) : 0 }));
      graph.push(`[ms_${kind}]${MUSIC_FILTER_GRAPHS[kind]}[ms_${kind}f]`, ...gate(`ms_${kind}f`, `ms_${kind}k`, wet, length));
      mixed.push(`[ms_${kind}k]`);
    }
    graph.push(mixed.length > 1 ? `${mixed.join("")}amix=inputs=${mixed.length}:normalize=0[ms_filtered]` : `${mixed[0]}anull[ms_filtered]`);
    at = "ms_filtered";
  }
  const pauses = read.pauses ?? [];
  if (pauses.length) {
    const kept: Kept[] = [];
    let from = 0;
    let fadeIn = 0;
    for (const p of pauses) {
      if (p.from > from) kept.push({ from, to: p.from, fadeIn, fadeOut: Math.min(PAUSE_EDGE, p.from) });
      from = Math.max(0, p.to - PAUSE_EDGE);
      fadeIn = p.to - from;
    }
    if (pauses.at(-1)!.to < duration) kept.push({ from, to: null, fadeIn, fadeOut: 0 });
    graph.push(...gate(at, "ms_paused", kept, length));
    at = "ms_paused";
  }
  if (read.end) {
    const fade = samples(read.end.fade ?? END_CUT);
    graph.push(`[${at}]afade=t=out:ss=${Math.max(0, samples(read.end.at) - fade)}:ns=${Math.max(1, fade)}[ms_ended]`);
    at = "ms_ended";
  }
  graph.push(`[${at}]anull[${output}]`);
  return graph.join(";");
}

/**
 * The music's volume in the live preview (frames → 0 to 1), as its shape sets it: silent in its pauses and after its
 * end, faded over its end's fade; its filters are the render's only. Points to draw straight lines between (frame,
 * volume), in order; empty when nothing changes.
 */
export function musicEnvelope(shape: MusicShape | null | undefined, duration: number, fps: number): [number, number][] {
  const read = readMusicShape(shape, duration);
  if (!shapesMusic(read)) return [];
  const f = (t: number) => Math.round(t * fps);
  const points: [number, number][] = [];
  for (const p of read.pauses ?? []) {
    const from = f(p.from);
    const to = Math.max(from + 1, f(p.to));
    points.push([Math.max(0, from - 1), 1], [from, 0], [to - 1, 0], [to, 1]);
  }
  if (read.end) {
    const at = f(read.end.at);
    const from = Math.min(at - 1, f(read.end.at - (read.end.fade ?? END_CUT)));
    points.push([Math.max(0, from), 1], [at, 0], [f(duration) + 1, 0]);
  }
  // A late start: silent from the first frame.
  if (points[0]?.[0] === 0 && points[1]?.[0] === 0) points.shift();
  return points.sort((a, b) => a[0] - b[0]);
}
