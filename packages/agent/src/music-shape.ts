import { z } from "zod";

// The shape of a Reel's music (Tristan, of the originals that shape theirs: « les pauses et les coupures de sa musique
// (la phrase posée, puis la reprise) : oui pourquoi pas si c'est bien fait »). Edith's music is composed as one
// continuous loop and set on the cuts (music.ts: composed with breaks, they fell anywhere and were heard as the sound
// cutting out); a house model that shapes its music on purpose says where, on the Reel's clock, from its beats: where
// its first strong beat lands, where it stops dead (or lets its sound ring and die away) and comes back on a beat (a
// phrase left alone, a break before the drop, a late start), where it plays muffled, out of a small speaker, without its
// bass or softer and when it opens (at once, or rising: a build-up), where it ends (cut dead on a beat, faded, on a hit
// whose tail rings, or slowing down to a stop like a tape). The mix applies it by ffmpeg, sample by sample, on whatever
// music the Reel gets (composed again, the one she asked for), before its sound effects and the sound of her videos; the
// live preview plays its silences and its volumes. Pure: the plan's field, its reading and its filter graph
// (lib/render/sandbox.ts runs it).

/** How a passage of the music is filtered: through a wall, out of a small speaker, without its bass, softer (`db`). */
export const MUSIC_FILTERS = ["muffled", "radio", "thin", "soft"] as const;
export type MusicFilterKind = (typeof MUSIC_FILTERS)[number];

const time = z.number().min(0).max(120);

/**
 * A Reel's music shaped as its model plays it (times in seconds on the Reel's clock, from the model's beats): set by the
 * engine from a montage skill's timeline (skills.ts), kept on the plan, so a render again shapes it the same way.
 */
export const musicShapeSchema = z.object({
  /** No music at all (a sound effects breakdown): its sounds alone over her videos' own sound, unless she asks for a music. */
  none: z.boolean().optional(),
  /**
   * Where the music's first strong beat lands (its beat 0, the first beat of its first bar): the composed piece is cut or
   * held back so it falls there, its next beats on the model's. Default: where a late start ends (the music comes in on
   * its downbeat), else 0. A model whose beats are counted from a pickup gives it (« Mots aux quatre coins »: half a beat).
   */
  downbeat: time.optional(),
  /**
   * Where it stops dead and comes back (`to`, on a beat: the music's nearest beat is moved onto it): a phrase left alone, a
   * break before the drop, a late start (from 0). `tail`: its sound rings on and dies away over that many seconds instead
   * of stopping dead (the last hit's tail over a calm shot), silent by its return.
   */
  pauses: z.array(z.object({ from: time, to: time, tail: z.number().min(0).max(4).optional() })).max(32).optional(),
  /**
   * Where it plays filtered, and when it is open again (`to`, reached over `open` s: at once on a beat, or slowly). `soft`:
   * `db` under its level (−24 to −1, default −8); opened slowly, its level rises back: a build-up into the drop.
   */
  filters: z
    .array(z.object({ kind: z.enum(MUSIC_FILTERS), from: time, to: time, open: z.number().min(0).max(4).optional(), db: z.number().min(-24).max(-1).optional() }))
    .max(8)
    .optional(),
  /**
   * Where it has ended (`at`): cut dead (12 ms) or faded over `fade` s, silent after; `tail`: stopped on its last hit at
   * `at`, its sound ringing on and dying away over `tail` s (never a loop faded out); `stop`: slowing down to a halt over its
   * last `stop` s before `at`, pitch and pace falling together like a tape stopped. Absent: the mix fades its last 0,8 s.
   */
  end: z
    .object({ at: time, fade: z.number().min(0).max(4).optional(), tail: z.number().min(0).max(6).optional(), stop: z.number().min(0).max(4).optional() })
    .optional(),
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
/** A softer passage's level when its model gives none (dB). */
export const SOFT_DB = -8;
/** The shortest tail and tape stop kept (s). */
const SHORTEST_TAIL = 0.05;
const SHORTEST_STOP = 0.1;
/** What rings on in a tail: the reverb of the music's last quarter of a second before it stops (s). */
export const TAIL_GRAB = 0.25;
/** A tail's level: its reverb at this share of the music's (0,7: 3 dB under it as it stops, then dying away). */
export const TAIL_WET = 0.7;
/** The darkest a tail's sound gets: its reverb loses what is above this (Hz), as a room does. */
const TAIL_LOWPASS = 6000;
/** A tape stop's steps: each this long (s) at one speed, 8 to 60 of them, the speed falling evenly to nothing. */
const STOP_STEP = 0.03;
/** A tape stop's sound fades over its last share (the pitch drops out of hearing). */
const STOP_FADE = 0.4;

/**
 * Each filter as ffmpeg runs it, set on what the originals measure: muffled, the night of « Une journée chez toi »
 * (−8 dB at 2 kHz, −15 at 3, −23 at 5 and more above, as through a wall); radio, the band of « Titre qui se décode »
 * (some 30 dB less under 150 Hz and over 4 kHz, a small speaker); thin, the bass gone (30 dB less at 85 Hz, the line over
 * 240 Hz kept, « basse et batterie s'arrêtent » of « Mots aux quatre coins »); soft, its level only (its `db`: the same
 * sound, so opened slowly it rises without hollowing anything).
 */
export const MUSIC_FILTER_GRAPHS: Record<Exclude<MusicFilterKind, "soft">, string> = {
  muffled: "lowpass=f=1300",
  radio: "highpass=f=400,highpass=f=400,lowpass=f=1800,lowpass=f=1800",
  thin: "highpass=f=220,highpass=f=220",
};

const filterGraph = (kind: MusicFilterKind, db: number | undefined) => (kind === "soft" ? `volume=${db ?? SOFT_DB}dB` : MUSIC_FILTER_GRAPHS[kind]);

const round3 = (n: number) => Math.round(n * 1000) / 1000;

type ReadPause = { from: number; to: number; tail?: number };
type ReadFilter = { kind: MusicFilterKind; from: number; to: number; open: number; db?: number };
type ReadEnd = { at: number; fade: number } | { at: number; tail: number } | { at: number; stop: number };

/**
 * Its shape read against the Reel's length: every time within it, its pauses in order (two that touch are one; a tail
 * dies within its pause, never in a late start), its filtered passages in order (one starts once the previous one has
 * opened; two of a kind and level that touch are one), its end as one way of ending (a stop, else a tail, else a fade or
 * a cut), nothing shaped after it. Null when nothing is left; `none` stands alone.
 */
export function readMusicShape(shape: MusicShape | null | undefined, duration: number): MusicShape | null {
  if (!shape || !(duration > 0)) return null;
  if (shape.none) return { none: true };
  const clamp = (t: number) => round3(Math.min(duration, Math.max(0, t)));
  let end: ReadEnd | undefined;
  if (shape.end) {
    const at = clamp(shape.end.at);
    if (at >= 0.1) {
      const stop = shape.end.stop && shape.end.stop >= SHORTEST_STOP ? round3(Math.min(shape.end.stop, at)) : 0;
      const tail = shape.end.tail && shape.end.tail >= SHORTEST_TAIL ? round3(Math.min(shape.end.tail, duration - at)) : 0;
      end = stop ? { at, stop } : tail >= SHORTEST_TAIL ? { at, tail } : { at, fade: round3(Math.min(at, Math.max(END_CUT, shape.end.fade ?? END_CUT))) };
    }
  }
  // Nothing is shaped once it has started ending.
  const until = !end ? duration : "stop" in end ? end.at - end.stop : "tail" in end ? end.at : end.at - end.fade;
  const pauses: ReadPause[] = [];
  for (const p of [...(shape.pauses ?? [])].sort((a, b) => a.from - b.from)) {
    // One that starts with the Reel is a late start.
    const from = p.from < SHORTEST ? 0 : clamp(p.from);
    const to = clamp(p.to);
    if (to - from < SHORTEST || from >= until) continue;
    const last = pauses.at(-1);
    // Too close to come back between them: one pause (its tail, the first's).
    if (last && from - last.to < 2 * PAUSE_EDGE) {
      last.to = Math.max(last.to, to);
      if (last.tail) last.tail = round3(Math.min(last.tail, last.to - last.from));
      continue;
    }
    // A tail dies within its pause; a late start has nothing to ring.
    const tail = from > 0 && p.tail && p.tail >= SHORTEST_TAIL ? round3(Math.min(p.tail, to - from)) : 0;
    pauses.push({ from, to, ...(tail >= SHORTEST_TAIL ? { tail } : {}) });
  }
  const filters: ReadFilter[] = [];
  for (const f of [...(shape.filters ?? [])].sort((a, b) => a.from - b.from)) {
    const to = clamp(f.to);
    let from = f.from < SHORTEST ? 0 : clamp(f.from);
    const db = f.kind === "soft" ? Math.round(Math.min(-1, Math.max(-24, f.db ?? SOFT_DB)) * 10) / 10 : undefined;
    const last = filters.at(-1);
    if (last && last.kind === f.kind && last.db === db && from - last.to < FILTER_EDGE) {
      if (to > last.to) Object.assign(last, { to, open: round3(Math.min(to - last.from, Math.max(0.005, f.open ?? FILTER_EDGE))) });
      continue;
    }
    if (last) from = Math.max(from, round3(last.to + FILTER_EDGE));
    if (to - from < SHORTEST || from >= until) continue;
    filters.push({ kind: f.kind, from, to, open: round3(Math.min(to - from, Math.max(0.005, f.open ?? FILTER_EDGE))), ...(db !== undefined ? { db } : {}) });
  }
  const downbeat = shape.downbeat !== undefined ? { downbeat: clamp(shape.downbeat) } : {};
  if (!pauses.length && !filters.length && !end && shape.downbeat === undefined) return null;
  return { ...downbeat, ...(pauses.length ? { pauses } : {}), ...(filters.length ? { filters } : {}), ...(end ? { end } : {}) };
}

/** Whether its shape changes the music in the mix (a model without music has none to change; where its beat lands is set before). */
export const shapesMusic = (shape: MusicShape | null | undefined): shape is MusicShape =>
  Boolean(shape && !shape.none && (shape.pauses?.length || shape.filters?.length || shape.end));

/** When its music is first heard (s, the Reel's clock): where a late start ends, else 0. */
export function musicHeard(shape: MusicShape | null | undefined, duration: number): number {
  const read = readMusicShape(shape, duration);
  const first = read?.pauses?.[0];
  return first && first.from === 0 ? first.to : 0;
}

/**
 * Where its music's first strong beat lands (s, the Reel's clock): the model's downbeat, else where a late start ends (the
 * music comes in on its downbeat: « Titre derrière le décor » on its hit, « Titre qui se décode » with its band), else 0.
 */
export function musicDownbeat(shape: MusicShape | null | undefined, duration: number): number {
  const read = readMusicShape(shape, duration);
  return read?.downbeat ?? musicHeard(read, duration);
}

/** Its shape `lead` seconds later (a plan held on its first image, leadPlan): a late start still starts at 0. */
export function shiftMusicShape(shape: MusicShape, lead: number): MusicShape {
  if (!(lead > 0) || shape.none) return shape;
  const later = (t: number) => round3(t + lead);
  return {
    ...(shape.downbeat !== undefined ? { downbeat: later(shape.downbeat) } : {}),
    ...(shape.pauses ? { pauses: shape.pauses.map((p) => ({ ...p, from: p.from > 0 ? later(p.from) : 0, to: later(p.to) })) } : {}),
    ...(shape.filters ? { filters: shape.filters.map((f) => ({ ...f, from: f.from > 0 ? later(f.from) : 0, to: later(f.to) })) } : {}),
    ...(shape.end ? { end: { ...shape.end, at: later(shape.end.at) } } : {}),
  };
}

/** The mix's sample rate (mix.ts sets every input to it). */
const RATE = 44100;
const samples = (t: number) => Math.max(0, Math.round(t * RATE));

/**
 * A part of a stream kept (s; `to` null: to its end), faded in over its first `fadeIn` s and out over its last `fadeOut`;
 * `shift`: it plays that much later than it is in the stream (a return moved onto a beat), its source `from − shift`.
 */
type Kept = { from: number; to: number | null; fadeIn: number; fadeOut: number; shift?: number };

/**
 * The graph that keeps only those parts of [input], silent elsewhere, out as [output]: each part cut at its own samples
 * (atrim) and faded at its own (afade), silence between them, laid end to end (concat), as long as the music or `length`
 * s at least (the mix lasts as long as the video). Sample accurate: a pause starts and ends where its beat is.
 */
function gate(input: string, output: string, kept: Kept[], length: number): string[] {
  if (!kept.length) return [`[${input}]volume=0[${output}]`];
  if (kept.length === 1 && kept[0]!.from <= 0 && kept[0]!.to === null && !kept[0]!.fadeIn && !kept[0]!.shift) return [`[${input}]anull[${output}]`];
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
    // Its source: where it is in the stream (a part moved later plays from earlier in it).
    const source = samples(k.from - (k.shift ?? 0));
    const trim = [source > 0 ? `start_sample=${source}` : "", b !== null ? `end_sample=${source + b - a}` : ""].filter(Boolean).join(":");
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
 * A sound ringing on and dying away (a tail): the reverb of `[input]`'s last TAIL_GRAB s before `at` (its own clock
 * `at − shift`), a room made of stereo noise falling 60 dB over `seconds` and darkened, at TAIL_WET of the music, out as
 * [output] from `at − PAUSE_EDGE` (fading in while the music fades out) to `at + seconds` (or `until`, faded over its last
 * 20 ms), silent elsewhere. Deterministic: the same noise every render.
 */
function tailGraph(input: string, output: string, at: number, seconds: number, options: { grab: number; shift: number; until: number }): string[] {
  const grab = Math.max(0.02, Math.min(TAIL_GRAB, options.grab));
  const end = Math.min(at + seconds, options.until);
  const source = at - options.shift;
  const ir = seconds.toFixed(3);
  // The reverb's own output from the slice's start: what follows the stop starts `grab` in, kept a hair before it.
  const from = samples(grab - PAUSE_EDGE);
  const length = Math.max(1, samples(end - at + PAUSE_EDGE));
  const out = Math.min(samples(FILTER_EDGE), Math.max(1, length - samples(PAUSE_EDGE)));
  return [
    `[${input}]atrim=start_sample=${samples(source - grab)}:end_sample=${samples(source)},asetpts=PTS-STARTPTS,afade=t=in:ns=${samples(0.01)},apad=pad_dur=${(seconds + 0.05).toFixed(3)}[${output}_x]`,
    `aevalsrc=exprs='(2*random(0)-1)*exp(-6.9*t/${ir})|(2*random(1)-1)*exp(-6.9*t/${ir})':s=${RATE}:d=${ir},lowpass=f=${TAIL_LOWPASS}[${output}_ir]`,
    `[${output}_x][${output}_ir]afir=irnorm=2:wet=${TAIL_WET}[${output}_w]`,
    `[${output}_w]atrim=start_sample=${from}:end_sample=${from + length},asetpts=PTS-STARTPTS,afade=t=in:ns=${samples(PAUSE_EDGE)},afade=t=out:ss=${length - out}:ns=${out},adelay=${samples(at - PAUSE_EDGE)}S:all=1[${output}]`,
  ];
}

/**
 * A tape stop on [input], out as [output]: as it is until `at − seconds`, then slowing down to a halt at `at` (its speed
 * falling evenly from 1 to 0, so pitch and pace fall together: its last `seconds` play `seconds / 2` of the music), each
 * step of STOP_STEP resampled from a little more than its own samples (its edges trimmed off: no click between steps), its
 * sound fading over the last STOP_FADE of it, silent after, to `length` s.
 */
function stopGraph(input: string, output: string, at: number, seconds: number, length: number): string[] {
  const steps = Math.max(8, Math.min(60, Math.round(seconds / STOP_STEP)));
  const step = seconds / steps;
  const start = at - seconds;
  const margin = 0.01;
  const graph = [`[${input}]asplit=${steps + 1}[${output}_h]${Array.from({ length: steps }, (_, k) => `[${output}_c${k}]`).join("")}`];
  graph.push(`[${output}_h]atrim=end_sample=${samples(start)},asetpts=PTS-STARTPTS[${output}_head]`);
  let at0 = start;
  for (let k = 0; k < steps; k++) {
    const speed = 1 - (k + 0.5) / steps;
    const from = samples(at0 - margin);
    const to = samples(at0 + speed * step + margin);
    // Its own first sample, once resampled: the margin before it trimmed off.
    const skip = Math.round(((at0 - from / RATE) / speed) * RATE);
    graph.push(
      `[${output}_c${k}]atrim=start_sample=${from}:end_sample=${to},asetpts=PTS-STARTPTS,asetrate=${Math.max(1, Math.round(RATE * speed))},aresample=${RATE},` +
        `atrim=start_sample=${skip}:end_sample=${skip + samples(step)},asetpts=PTS-STARTPTS[${output}_d${k}]`,
    );
    at0 += speed * step;
  }
  const fade = samples(seconds * STOP_FADE);
  graph.push(
    `[${output}_head]${Array.from({ length: steps }, (_, k) => `[${output}_d${k}]`).join("")}concat=n=${steps + 1}:v=0:a=1,` +
      `afade=t=out:ss=${samples(at) - fade}:ns=${fade},apad=whole_len=${samples(length)}[${output}]`,
  );
  return graph;
}

/** The music's beats on the Reel's clock, once set on its cuts (music.ts): a beat's length and where its first strong beat lands. */
export type MusicGrid = { beat: number; downbeat: number };

/**
 * How much later the music plays after each pause (s), so that it comes back on one of its beats: the beat nearest each
 * return moved onto it (a model whose sections are not counted on the music's grid, « Titre qui se décode » after its
 * breath), carried on to the next ones. Zero without a grid (a piece whose beats were not found is left as it is).
 */
export function pauseShifts(pauses: { from: number; to: number }[], grid: MusicGrid | null | undefined, duration: number): number[] {
  let shift = 0;
  return pauses.map((p) => {
    if (!grid || !(grid.beat > 0) || p.to >= duration) return shift;
    const n = Math.round((p.to - grid.downbeat - shift) / grid.beat);
    const moved = p.to - (grid.downbeat + shift + n * grid.beat);
    if (Math.abs(moved) >= 0.003) shift = round3(shift + moved);
    // Never from before the start of the piece.
    while (p.to - PAUSE_EDGE - shift < 0) shift = round3(shift - grid.beat);
    return shift;
  });
}

/**
 * The ffmpeg graph that shapes the music [input] (stereo at 44.1 kHz, at its level), out as [output]; `duration`, the
 * Reel's (s); `grid`, its beats once set on the cuts (its pauses come back on them). Its filtered passages first: the
 * music split in its dry sound and one filtered copy per kind (and level), each kept on its own passages and crossfaded
 * at their edges (closed over 20 ms, opened over `open`), then mixed back; then its pauses (the music gated, 5 ms edges,
 * each return moved onto the music's beat; a tail, the reverb of what it stopped on, dying away in the pause); then its
 * end (afade on its own samples, a tail ringing after its last hit, or a tape stop). Labels start with `ms_`. Its shape
 * read first.
 */
export function musicShapeGraph(shape: MusicShape, input: string, output: string, duration: number, grid?: MusicGrid | null): string {
  const read = readMusicShape(shape, duration);
  if (!shapesMusic(read)) return `[${input}]anull[${output}]`;
  const length = duration + 0.5;
  const graph: string[] = [];
  let at = input;
  const pauses = (read.pauses ?? []) as ReadPause[];
  const shifts = pauseShifts(pauses, grid, duration);
  // Where a moment of the Reel is in the music once its returns are moved onto its beats (the shift since the last return).
  const source = (t: number) => {
    let shift = 0;
    pauses.forEach((p, k) => {
      if (p.to <= t + 1e-9) shift = shifts[k]!;
    });
    return round3(t - shift);
  };
  // A passage that is still filtered as the music stops opens in the silence, on its return: opened before the stop, its
  // last 20 ms let the full music through (its bass) just as it stopped, and into the tail that rings on.
  const passages = (read.filters ?? []) as ReadFilter[];
  const filters = passages.map((f, i) => {
    const stop = pauses.find((p) => f.to >= p.from - FILTER_EDGE && f.to < p.to && p.from > f.from);
    const next = passages[i + 1];
    const to = stop && stop.to < duration && (!next || next.from >= stop.to + FILTER_EDGE) ? stop.to : f.to;
    return { ...f, from: f.from > 0 ? source(f.from) : 0, to: to < duration ? source(to) : to };
  });
  if (filters.length) {
    const key = (f: ReadFilter) => (f.kind === "soft" ? `soft${Math.round(-(f.db ?? SOFT_DB) * 10)}` : f.kind);
    const kinds = [...new Map(filters.map((f) => [key(f), f])).values()];
    // The dry sound between the passages: closed into each one, opened out of it.
    const dry: Kept[] = [];
    let from = 0;
    let fadeIn = 0;
    for (const f of filters) {
      const edge = Math.min(FILTER_EDGE, f.from);
      if (f.from > from) dry.push({ from, to: f.from, fadeIn, fadeOut: edge });
      from = f.to - f.open;
      fadeIn = f.open;
    }
    const last = filters.at(-1)!;
    if (last.to < duration) dry.push({ from, to: null, fadeIn, fadeOut: 0 });
    const branches = [...(dry.length ? ["dry"] : []), ...kinds.map(key)];
    graph.push(`[${at}]asplit=${branches.length}${branches.map((b) => `[ms_${b}]`).join("")}`);
    const mixed: string[] = [];
    if (dry.length) {
      graph.push(...gate("ms_dry", "ms_dryk", dry, length));
      mixed.push("[ms_dryk]");
    }
    for (const kind of kinds) {
      const k = key(kind);
      const wet = filters
        .filter((f) => key(f) === k)
        .map((f): Kept => ({ from: Math.max(0, f.from - FILTER_EDGE), to: f.to < duration ? f.to : null, fadeIn: Math.min(FILTER_EDGE, f.from), fadeOut: f.to < duration ? f.open : 0 }));
      graph.push(`[ms_${k}]${filterGraph(kind.kind, kind.db)}[ms_${k}f]`, ...gate(`ms_${k}f`, `ms_${k}k`, wet, length));
      mixed.push(`[ms_${k}k]`);
    }
    graph.push(mixed.length > 1 ? `${mixed.join("")}amix=inputs=${mixed.length}:normalize=0[ms_filtered]` : `${mixed[0]}anull[ms_filtered]`);
    at = "ms_filtered";
  }
  if (pauses.length) {
    const kept: Kept[] = [];
    let from = 0;
    let fadeIn = 0;
    let shift = 0;
    pauses.forEach((p, k) => {
      if (p.from > from) kept.push({ from, to: p.from, fadeIn, fadeOut: Math.min(PAUSE_EDGE, p.from), ...(shift ? { shift } : {}) });
      shift = shifts[k]!;
      from = Math.max(0, p.to - PAUSE_EDGE);
      fadeIn = p.to - from;
    });
    if (pauses.at(-1)!.to < duration) kept.push({ from, to: null, fadeIn, fadeOut: 0, ...(shift ? { shift } : {}) });
    const tails = pauses.flatMap((p, k) => (p.tail ? [{ p, k }] : []));
    if (!tails.length) graph.push(...gate(at, "ms_paused", kept, length));
    else {
      // What each tail rings is the music it stopped on, as it sounded (filtered): the same stream, its own clock.
      graph.push(`[${at}]asplit=${tails.length + 1}[ms_pg]${tails.map((_, i) => `[ms_pt${i}]`).join("")}`);
      graph.push(...gate("ms_pg", "ms_pgk", kept, length));
      tails.forEach(({ p, k }, i) => {
        const before = k ? pauses[k - 1]!.to : 0;
        graph.push(...tailGraph(`ms_pt${i}`, `ms_tail${i}`, p.from, p.tail!, { grab: p.from - before, shift: k ? shifts[k - 1]! : 0, until: p.to - PAUSE_EDGE }));
      });
      graph.push(`[ms_pgk]${tails.map((_, i) => `[ms_tail${i}]`).join("")}amix=inputs=${tails.length + 1}:duration=first:normalize=0[ms_paused]`);
    }
    at = "ms_paused";
  }
  const end = read.end as ReadEnd | undefined;
  if (end && "stop" in end) {
    graph.push(...stopGraph(at, "ms_ended", end.at, end.stop, length));
    at = "ms_ended";
  } else if (end && "tail" in end) {
    // Stopped on its last hit (cut dead), its sound ringing on after it.
    const before = pauses.at(-1)?.to ?? 0;
    graph.push(`[${at}]asplit=2[ms_eg][ms_et]`);
    graph.push(`[ms_eg]afade=t=out:ss=${Math.max(0, samples(end.at) - samples(END_CUT))}:ns=${Math.max(1, samples(END_CUT))}[ms_egk]`);
    graph.push(...tailGraph("ms_et", "ms_etail", end.at, end.tail, { grab: end.at - before, shift: 0, until: duration }));
    graph.push(`[ms_egk][ms_etail]amix=inputs=2:duration=first:normalize=0[ms_ended]`);
    at = "ms_ended";
  } else if (end) {
    const fade = samples(end.fade);
    graph.push(`[${at}]afade=t=out:ss=${Math.max(0, samples(end.at) - fade)}:ns=${Math.max(1, fade)}[ms_ended]`);
    at = "ms_ended";
  }
  graph.push(`[${at}]anull[${output}]`);
  return graph.join(";");
}

/**
 * The music's volume in the live preview (frames → 0 to 1), as its shape sets it: silent in its pauses (a tail fading out
 * over half its length), softer in its soft passages (rising back over their opening), silent after its end, faded over
 * its end's fade, its tail or its tape stop; its filters are the render's only. Points to draw straight lines between
 * (frame, volume), in order; empty when nothing changes.
 */
export function musicEnvelope(shape: MusicShape | null | undefined, duration: number, fps: number): [number, number][] {
  const read = readMusicShape(shape, duration);
  if (!shapesMusic(read)) return [];
  const f = (t: number) => Math.round(t * fps);
  // Each factor as straight lines between its own points; the volume their product, at every one of their points.
  const factors: [number, number][][] = [];
  for (const p of (read.pauses ?? []) as ReadPause[]) {
    const from = f(p.from);
    const to = Math.max(from + 1, f(p.to));
    // A late start: silent from the first frame. A tail: the music fades out over half of it (the preview has no reverb).
    if (p.from === 0) factors.push([[0, 0], [to - 1, 0], [to, 1]]);
    else if (p.tail) factors.push([[from, 1], [Math.min(to - 1, Math.max(from + 1, f(p.from + p.tail / 2))), 0], [to - 1, 0], [to, 1]]);
    else factors.push([[Math.max(0, from - 1), 1], [from, 0], [to - 1, 0], [to, 1]]);
  }
  for (const s of ((read.filters ?? []) as ReadFilter[]).filter((x) => x.kind === "soft")) {
    const low = Math.round(10 ** ((s.db ?? SOFT_DB) / 20) * 100) / 100;
    const from = f(s.from);
    const opens = Math.max(from, f(s.to - s.open));
    factors.push([...(s.from > 0 ? ([[Math.max(0, from - 1), 1]] as [number, number][]) : []), [from, low], [opens, low], [Math.max(opens + 1, f(s.to)), 1]]);
  }
  const end = read.end as ReadEnd | undefined;
  if (end) {
    const at = f(end.at);
    const fade = "stop" in end ? end.stop : "tail" in end ? -end.tail / 2 : end.fade;
    const last = f(duration) + 1;
    if (fade >= 0) factors.push([[Math.max(0, Math.min(at - 1, f(end.at - fade))), 1], [at, 0], [last, 0]]);
    else factors.push([[at, 1], [Math.max(at + 1, f(end.at - fade)), 0], [last, 0]]);
  }
  const value = (points: [number, number][], frame: number) => {
    if (frame <= points[0]![0]) return frame < points[0]![0] && points[0]![0] > 0 ? 1 : points[0]![1];
    for (let i = 1; i < points.length; i++) {
      const [b, vb] = points[i]!;
      if (frame > b) continue;
      const [a, va] = points[i - 1]!;
      return b === a ? vb : va + ((vb - va) * (frame - a)) / (b - a);
    }
    return points.at(-1)![1];
  };
  const frames = [...new Set(factors.flat().map(([frame]) => frame))].sort((a, b) => a - b);
  const points = frames.map((frame): [number, number] => [frame, Math.round(factors.reduce((v, points) => v * value(points, frame), 1) * 1000) / 1000]);
  // Points that change nothing between their neighbours are left out.
  return points.filter((p, i) => i === 0 || i === points.length - 1 || !(points[i - 1]![1] === p[1] && points[i + 1]![1] === p[1]));
}
