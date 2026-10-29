import { planTimeline } from "./motion.ts";
import { isClipSegment, type ClipAnalysis, type ClipSegment, type ClipSpeech, type EditPlan, type PlanSegment } from "./schemas.ts";

// Someone speaking to the camera, as a good creator cuts it (CapCut's « Enhance voice » and its
// « Auto cut », done the engine's way): the sound of a video where someone speaks is cleaned once
// after its analysis (a neural denoiser, RNNoise in ffmpeg, only when the recording is noisy: a hair
// dryer, a kitchen hood, a shop), its words timed exactly (Scribe) with its hesitations and its
// pauses; then, in every Reel, the engine cuts the « euh », the false starts and the long silences
// out of the passages where someone speaks (jump cuts, a punch-in every other piece, each cut
// between two words) and never moves those cuts onto the beat. Deterministic: the editor picks
// whole sentences, this tightens them.

/** Videos longer than this keep their sound as it is (a talk, not a Reel's footage). */
export const SPEECH_MAX_SECONDS = 180;

/**
 * RNNoise's « voice / general noise » model (GregorR/rnnoise-models, leavened-quisling: speech and
 * laughter over any noise), pinned by its checksum. On a test voice over a hair dryer, the noise
 * between the words went from −25 to −42 dBFS and the voice stayed.
 */
export const RNNOISE_MODEL = {
  file: "lq.rnnn",
  url: "https://raw.githubusercontent.com/GregorR/rnnoise-models/master/leavened-quisling-2018-08-31/lq.rnnn",
  sha256: "1957528b752799fddf06270bc5469af7cf54c3badc358544ae2abed730943ff9",
};

/** A recording whose quietest moments stay under this (dBFS) is clean: only its rumble is cut, a denoiser would only dull it. */
export const CLEAN_FLOOR = -50;
/** Over this, it is noisy: the denoiser takes almost all the noise; between the two, most of it. */
const NOISY_FLOOR = -40;
/** RNNoise works on 10 ms frames and gives its sound back 10 ms late: moved back, the lips and the words stay together. */
const RNNOISE_DELAY = 0.01;

/** Whether someone speaks in a video (a few words at least): its sound is worth cleaning and its words timing. */
export function hasSpeech(analysis: Pick<ClipAnalysis, "words" | "transcript">): boolean {
  if ((analysis.words?.length ?? 0) >= 3) return true;
  return analysis.transcript.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length >= 3;
}

/**
 * The ffmpeg audio filter that cleans a voice, from the noise floor measured on it (`floor`,
 * dBFS, null when unknown): its rumble always (under 70 Hz: handling, traffic, a fan); the
 * denoiser only on a noisy recording, mixed with a little of the original so it never sounds
 * underwater, its 10 ms delay taken back. `model`: the model file in the sandbox.
 */
export function speechCleanFilter(floor: number | null, model: string): { filter: string; denoised: boolean } {
  const rumble = "highpass=f=70";
  if (floor === null || floor < CLEAN_FLOOR) return { filter: rumble, denoised: false };
  const mix = floor >= NOISY_FLOOR ? 0.9 : 0.7;
  return {
    filter: `${rumble},aresample=48000,arnndn=m=${model}:mix=${mix},atrim=start=${RNNOISE_DELAY},asetpts=PTS-STARTPTS,apad=pad_dur=${RNNOISE_DELAY}`,
    denoised: true,
  };
}

/**
 * The loudness of a recording as ffmpeg's astats prints it: its overall RMS level and its
 * trough (the quietest 50 ms: the noise floor between the words), in dBFS; null when absent or silent.
 */
export function parseAudioStats(stderr: string): { level: number | null; floor: number | null } {
  const read = (name: string) => {
    const match = new RegExp(`RMS ${name} dB:\\s*(-?[\\d.]+|-inf)`).exec(stderr);
    const value = match ? Number(match[1]) : NaN;
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
  };
  return { level: read("level"), floor: read("trough") };
}

/**
 * What counts as a pause for ffmpeg's silencedetect, from the voice's level and the floor of the
 * cleaned sound (dBFS): well above the noise left between the words (it flickers over its quietest
 * 50 ms), well under the words. A test voice cleaned of a hair dryer (level −22, floor −48) has its
 * pauses under −30, where −43 found none.
 */
export function pauseThreshold(level: number | null, floor: number | null): number {
  if (level === null) return -40;
  const threshold = floor === null ? level - 18 : floor + 0.7 * (level - floor);
  return Math.round(Math.min(-26, Math.max(-50, threshold)));
}

/** The pauses ffmpeg's silencedetect printed (seconds of the recording); one still open at the end closes at `duration`. */
export function parseSilences(stderr: string, duration: number): { start: number; end: number }[] {
  const pauses: { start: number; end: number }[] = [];
  let open: number | null = null;
  for (const line of stderr.split("\n")) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (start) open = Math.max(0, Number(start[1]));
    const end = /silence_end:\s*([\d.]+)/.exec(line);
    if (end && open !== null) {
      pauses.push({ start: round(open), end: round(Number(end[1])) });
      open = null;
    }
  }
  if (open !== null && duration > open) pauses.push({ start: round(open), end: round(duration) });
  return pauses.filter((p) => p.end > p.start).slice(0, 300);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The bare letters of a word (no accents, no punctuation, lowercase). */
const bare = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z']/g, "");

/** Hesitations, in French and English: « euh », « heu », « hum », « hmm », « mmh », « uh », « um », « erm ». Never a real word. */
const FILLER = /^(?:e+u+h*|h+e+u+h*|e+u+m+|h+u+m+|h?m{2,}h*|m+h+|u+h+|u+m+|e+r+m+)$/;

export function isFiller(word: string): boolean {
  const letters = bare(word).replace(/'/g, "");
  return letters.length > 0 && FILLER.test(letters);
}

type Word = { w: string; start: number; end: number };

/** Her words without the hesitations, and the hesitations apart (the subtitles never show « euh »). */
export function splitFillers(words: Word[]): { words: Word[]; fillers: Word[] } {
  return { words: words.filter((w) => !isFiller(w.w)), fillers: words.filter((w) => isFiller(w.w)) };
}

/**
 * Small words a sentence restarts on (« je je », « le le », « on on »): said twice in a row, the
 * first one is a false start. A word repeated on purpose (« très très », « non non ») is never one of them.
 */
const RESTARTS = new Set(
  "je j tu il elle on nous vous ils elles le la les l un une des de du d et ou mais que qu qui c ce ca en a au aux y ne n se s me m te t mon ma mes ton ta tes son sa ses notre votre pour avec dans sur i the a an and to".split(" "),
);

/** What the engine knows of the speech in a clip: its words (without hesitations) and what was measured (speech.ts). */
export type SpeechFacts = { words: Word[]; speech: ClipSpeech };

/** The speech facts of her analysed videos, for those whose speech was read (analysis.speech). */
export function speechFacts(clips: { media_id: string; analysis: Pick<ClipAnalysis, "words" | "speech"> }[]): Record<string, SpeechFacts> {
  return Object.fromEntries(clips.flatMap((c) => (c.analysis.speech ? [[c.media_id, { words: c.analysis.words ?? [], speech: c.analysis.speech }]] : [])));
}

/** A pause longer than this is cut down; this much of it stays on each side (a breath, so the words never touch). */
const MAX_PAUSE = 0.4;
const BREATH = 0.12;
/** Silence before the first word of a passage, or after its last, that is trimmed (keeping a breath). */
const LEAD_MAX = 0.45;
const TAIL_MAX = 0.6;
/** Around a hesitation, so none of it is heard. */
const FILLER_PAD = 0.03;
/** A false start: the same small word again within this. */
const RESTART_GAP = 0.6;
/** A piece left between two cuts shorter than this, with no whole word in it, goes too. */
const MIN_PIECE = 0.25;

/** Words wholly inside [from, to]. */
const wordsIn = (words: Word[], from: number, to: number) => words.filter((w) => w.start >= from - 0.01 && w.end <= to + 0.01);

/**
 * What to cut out of the passage [from, to] of a clip where someone speaks: its long pauses
 * (down to a breath), the silence it opens on and the one it ends on (`tail`: not on the Reel's
 * last shot, which holds), all measured (silencedetect, exact whatever timed the words); and,
 * when its words are timed exactly (Scribe), its hesitations and false starts. Sorted, merged,
 * inside the passage.
 */
export function speechCuts(facts: SpeechFacts, from: number, to: number, options: { tail?: boolean } = {}): { start: number; end: number }[] {
  const words = wordsIn(facts.words, from, to);
  if (words.length < 2) return [];
  const cuts: { start: number; end: number }[] = [];
  for (const p of facts.speech.pauses) {
    const start = Math.max(p.start, from);
    const end = Math.min(p.end, to);
    if (end <= start) continue;
    const opens = start <= from + 0.05;
    const closes = end >= to - 0.05;
    if (opens && closes) continue;
    if (opens) {
      if (end - from > LEAD_MAX) cuts.push({ start: from, end: end - BREATH });
    } else if (closes) {
      if (options.tail !== false && to - start > TAIL_MAX) cuts.push({ start: start + BREATH * 1.5, end: to });
    } else if (end - start > MAX_PAUSE) cuts.push({ start: start + BREATH, end: end - BREATH });
  }
  const first = words[0]!.start;
  const last = words.at(-1)!.end;
  if (facts.speech.source === "scribe") {
    for (const f of facts.speech.fillers) {
      if (f.start < first || f.end > last) continue;
      // Never into a word next to it.
      const before = words.filter((w) => w.end <= f.start + 0.01).at(-1);
      const after = words.find((w) => w.start >= f.end - 0.01);
      cuts.push({ start: Math.max(f.start - FILLER_PAD, before?.end ?? from), end: Math.min(f.end + FILLER_PAD, after?.start ?? to) });
    }
    words.forEach((w, i) => {
      const next = words[i + 1];
      const said = bare(w.w);
      if (next && RESTARTS.has(said) && bare(next.w) === said && next.start - w.end < RESTART_GAP) cuts.push({ start: w.start, end: next.start });
    });
  }
  const sorted = cuts
    .map((c) => ({ start: round(Math.max(from, c.start)), end: round(Math.min(to, c.end)) }))
    .filter((c) => c.end - c.start >= 0.06)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const c of sorted) {
    const prev = merged.at(-1);
    if (prev && c.start <= prev.end + 0.08) prev.end = Math.max(prev.end, c.end);
    else merged.push({ ...c });
  }
  return merged;
}

/**
 * A passage where someone speaks, cut like a creator cuts it: its edges never inside a word
 * (moved to a silence), its cuts made (speechCuts), each piece a shot of its own; every other
 * piece punches in (a tight reframe held), so the jump reads as meant. A passage with no words,
 * at another speed, or with nothing to cut stays one shot.
 */
export function jumpCut(segment: ClipSegment, facts: SpeechFacts | undefined, options: { clipDuration?: number; last?: boolean } = {}): ClipSegment[] {
  if (!facts || (segment.speed && Math.abs(segment.speed - 1) > 0.01)) return [segment];
  const max = options.clipDuration ?? Infinity;
  let { in: from, out: to } = segment;
  // Its edges on silences: a word under its start begins it, one under its end ends it (or ends before it, when long).
  const atStart = facts.words.find((w) => w.start < from && w.end > from + 0.03);
  if (atStart) from = Math.max(0, atStart.start - 0.05);
  const atEnd = facts.words.find((w) => w.start < to - 0.03 && w.end > to);
  if (atEnd) {
    const before = facts.words.filter((w) => w.end <= atEnd.start + 0.01).at(-1);
    if (atEnd.end + 0.1 - to <= 0.6 && atEnd.end + 0.1 <= max) to = atEnd.end + 0.1;
    else if (before && before.end + 0.1 > from + 0.5) to = before.end + 0.1;
  }
  from = round(from);
  to = round(Math.min(to, max));
  if (wordsIn(facts.words, from, to).length < 2) return [segment];
  const cuts = speechCuts(facts, from, to, { tail: !options.last });
  // The pieces between the cuts; a sliver with no whole word in it goes too.
  const pieces: { start: number; end: number }[] = [];
  let cursor = from;
  for (const c of [...cuts, { start: to, end: to }]) {
    if (c.start > cursor) pieces.push({ start: cursor, end: c.start });
    cursor = Math.max(cursor, c.end);
  }
  const kept = pieces.filter((p) => p.end - p.start >= MIN_PIECE || wordsIn(facts.words, p.start, p.end).length > 0);
  if (!kept.length) return [segment];
  const base = { ...segment, zoom: "none" as const };
  if (kept.length === 1) {
    if (Math.abs(kept[0]!.start - segment.in) < 0.01 && Math.abs(kept[0]!.end - segment.out) < 0.01) return [segment];
    return [{ ...base, in: round(kept[0]!.start), out: round(kept[0]!.end) }];
  }
  const own = segment.move ?? (segment.zoom === "light" ? "in" : "none");
  const steady = own === "punch" ? "none" : own;
  return kept.map((p, k) => {
    const { accent, ...rest } = base;
    return {
      ...rest,
      in: round(p.start),
      out: round(p.end),
      move: k % 2 === 1 ? "punch" : steady,
      ...(k === 0 && accent ? { accent } : {}),
    };
  });
}

/** Whether a shot is someone speaking (a word of theirs in it): its cuts are between two words, never moved onto the beat. */
export function spokenShot(s: PlanSegment, facts: Record<string, SpeechFacts> | undefined): boolean {
  if (!facts || !isClipSegment(s) || (s.speed && Math.abs(s.speed - 1) > 0.01)) return false;
  return Boolean(facts[s.clip_id]?.words.some((w) => w.end > s.in + 0.02 && w.start < s.out - 0.02));
}

/**
 * The plan with the hesitations and long pauses cut out of the passages where someone speaks
 * (jumpCut), its texts and animations over several shots moved with the picture they were on.
 * Unchanged under a voice over the Reel (the clips are muted then) or with nothing to cut. With
 * jump cuts, the cuts are clean (a crossfade between two pieces of one sentence reads as a glitch).
 */
export function applySpeechCuts(plan: EditPlan, facts: Record<string, SpeechFacts> | undefined, clipDurations: Record<string, number>): EditPlan {
  if (plan.voice || !facts || !Object.keys(facts).length) return plan;
  const before = planTimeline(plan);
  const lastClip = plan.segments.map(isClipSegment).lastIndexOf(true);
  const map: { from: number; to: number; length: number }[] = [];
  let changed = false;
  let split = false;
  const segments = plan.segments.flatMap((s, i): PlanSegment[] => {
    const at = before.segments[i]!;
    if (!isClipSegment(s)) {
      map.push({ from: at.start, to: at.start + at.length, length: at.length });
      return [s];
    }
    const pieces = jumpCut(s, facts[s.clip_id], { clipDuration: clipDurations[s.clip_id], last: i === lastClip });
    if (pieces.length > 1) split = true;
    if (pieces.length !== 1 || pieces[0] !== s) changed = true;
    for (const p of pieces) map.push({ from: at.start + (p.in - s.in), to: at.start + (p.out - s.in), length: p.out - p.in });
    return pieces;
  });
  if (!changed) return plan;
  const transitions = split ? ("cut" as const) : plan.transitions;
  // Where each piece now starts (one entry of the map per new segment).
  const after = planTimeline({ segments, transitions });
  const placed = map.map((m, k) => ({ ...m, start: after.segments[k]!.start }));
  const cursor = after.duration;
  // A moment of the old Reel on the new one: inside a piece it moves with it; in a cut, a start goes to the next piece, an end to the previous one.
  const moved = (t: number, side: "start" | "end") => {
    const inside = placed.find((m) => t >= m.from - 0.001 && t <= m.to + 0.001);
    if (inside) return round(inside.start + Math.min(inside.length, Math.max(0, t - inside.from)));
    if (side === "start") {
      const next = placed.find((m) => m.from > t);
      return round(next ? next.start : cursor);
    }
    const prev = [...placed].reverse().find((m) => m.to < t);
    return round(prev ? prev.start + prev.length : 0);
  };
  const duration = round(cursor);
  return {
    ...plan,
    segments,
    transitions,
    duration: Math.max(3, duration),
    texts: plan.texts.map((t) => ({ ...t, from: moved(t.from, "start"), to: Math.min(duration, moved(t.to, "end")) })).filter((t) => t.to > t.from),
    ...(plan.layers ? { layers: plan.layers.map((l) => ({ ...l, from: moved(l.from, "start"), to: Math.min(duration, l.compose ? duration : moved(l.to, "end")) })) } : {}),
  };
}
