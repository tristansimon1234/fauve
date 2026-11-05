import { musicShapeGraph, readMusicShape, shapesMusic, type MusicGrid, type MusicShape } from "./music-shape.ts";

// How Edith's music sits under what is said in a Reel. Loudness in LUFS (EBU R128,
// measured by ffmpeg on the rendered video and on the music), turned into fixed
// gains: what is said (her voice note, Edith's voice, someone speaking in a clip)
// is brought to SPEECH_LUFS, the music to the level of its case, then it ducks
// under the speech (sidechain compressor). Measured on creators' Reels that work
// (about -14 LUFS overall, the music some 8 dB under the voice in its pauses and
// still heard while it speaks) and on ElevenLabs voices, which come out between
// -19 and -31 LUFS: before, the music fell 17 dB under the voice and vanished.

/** What is said in a Reel, at the loudness of a voice in a creator's Reel. */
export const SPEECH_LUFS = -14;

/** A music track as ElevenLabs composes it (the live preview cannot measure it). */
export const MUSIC_AS_COMPOSED_LUFS = -15;

export type MixCase = "music" | "voice_over" | "speech_in_clips" | "ambient" | "shot_sound";

/** The sound of her videos kept all along (finish.video_sound « all ») with nobody speaking: an ambience, under a voice's level. */
export const AMBIENT_LUFS = -21;

/** The own sound of a model's shots that keep it (a skill's `sound` shot: the metro under the title), nobody speaking: heard, a little under the music's level. */
export const SHOT_SOUND_LUFS = -18;

export type Ducking = { threshold: number; ratio: number; attack: number; release: number };

export const MIX_CASES: Record<MixCase, { music: number; duck: Ducking | null; under: number }> = {
  /** Nothing said: the music alone, as loud as a creator's Reel. */
  music: { music: -14, duck: null, under: -14 },
  /** A voice over the whole Reel: the music lies under it and steps back a little while the voice speaks, never out of hearing. */
  voice_over: { music: -20, duck: { threshold: 0.03, ratio: 1.6, attack: 20, release: 600 }, under: -26 },
  /** Someone speaks in a few shots: the music keeps its level and ducks well under them. */
  speech_in_clips: { music: -15, duck: { threshold: 0.016, ratio: 8, attack: 20, release: 600 }, under: -33 },
  /** The sound of her videos kept all along, nobody speaking: the music over the ambience, both heard, nothing ducks. */
  ambient: { music: -16, duck: null, under: -16 },
  /**
   * A few of a model's shots keep their own sound, nobody speaking (the metro, a tram, a door): the music keeps its level
   * and steps back under them (some 6 dB while they play, back over 400 ms), so that sound is heard on its shot.
   */
  shot_sound: { music: -15, duck: { threshold: 0.05, ratio: 2, attack: 15, release: 400 }, under: -21 },
};

/** Peaks of the mix held under -1 dBFS. */
export const MIX_CEILING = 0.891;

/** Under this, the video's own sound is silence (EBU R128 reports -70 for nothing). */
const SILENCE_LUFS = -45;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const measured = (n: number | null): n is number => n !== null && Number.isFinite(n);

/** The gain (dB) that brings a voice measured at `lufs` to SPEECH_LUFS; null for silence. Bounded, so a whisper is not blown up. */
export function speechGain(lufs: number | null): number | null {
  return measured(lufs) && lufs > SILENCE_LUFS ? round1(clamp(SPEECH_LUFS - lufs, -12, 20)) : null;
}

/**
 * The gains of a mix from the measured loudness of the video's own sound (null:
 * no sound track) and of the music: which case, how many dB each one moves,
 * and the ducking. `ambient`: her videos' sound kept all along with nobody speaking; « shots »: only a model's shots
 * that keep their own sound, nobody speaking in them.
 */
export function mixGains(loudness: { speech: number | null; music: number | null }, voiceOver: boolean, ambient: boolean | "shots" = false): {
  kind: MixCase;
  speechGain: number;
  musicGain: number;
  duck: Ducking | null;
} {
  const voiced = speechGain(loudness.speech);
  const kind: MixCase = voiced === null ? "music" : voiceOver ? "voice_over" : ambient === "shots" ? "shot_sound" : ambient ? "ambient" : "speech_in_clips";
  // An ambience sits under a voice's level, bounded like a voice; a shot's own sound a little higher, on its shot only.
  const own = kind === "ambient" ? AMBIENT_LUFS : kind === "shot_sound" ? SHOT_SOUND_LUFS : null;
  const gain = own !== null && measured(loudness.speech) ? round1(clamp(own - loudness.speech, -12, 20)) : voiced;
  const settings = MIX_CASES[kind];
  return {
    kind,
    speechGain: gain ?? 0,
    musicGain: measured(loudness.music) && loudness.music > -60 ? round1(clamp(settings.music - loudness.music, -30, 8)) : 0,
    duck: settings.duck,
  };
}

/** How long the mix fades over the end of a Reel (s). */
export const MIX_FADE = 0.8;

/** Its fade when the music ends by its own shape (s): the whole mix only loses its last 20 ms, never a click on the loop. */
const MIX_EDGE = 0.02;

/**
 * The ffmpeg filter graph of a mix: [0:a] the video's own sound, [1:a] the music,
 * out as [a], faded out over 0.8 s from `fadeAt` (s; null when the length is unknown: no fade).
 * `shaped`: the music's shape (music-shape.ts: its pauses, its filtered passages, its end), the Reel's length and the
 * music's beats once set on the cuts (its returns land on them): the music is shaped before anything joins it; when it
 * ends by its own shape, the mix only fades its last 20 ms.
 */
export function mixFilter(
  gains: ReturnType<typeof mixGains>,
  fadeAt: number | null,
  sounds: SoundInMix[] = [],
  shaped?: { shape: MusicShape | null | undefined; duration: number; grid?: MusicGrid | null },
): string {
  const read = shaped ? readMusicShape(shaped.shape, shaped.duration) : null;
  const shape = shapesMusic(read) ? read : null;
  const fade =
    fadeAt === null
      ? ""
      : shape?.end
        ? `,afade=t=out:st=${Math.max(0, fadeAt + MIX_FADE - MIX_EDGE).toFixed(3)}:d=${MIX_EDGE}`
        : `,afade=t=out:st=${Math.max(0, fadeAt).toFixed(2)}:d=${MIX_FADE}`;
  const limit = `alimiter=limit=${MIX_CEILING}:level=false`;
  const music = `[1:a]${STEREO},volume=${gains.musicGain}dB${shape ? `[ms_in];${musicShapeGraph(shape, "ms_in", "ms_out", shaped!.duration, shaped!.grid)};[ms_out]anull` : ""}`;
  // The sound effects (inputs 2…), added to the mix before its limiter and its fade.
  const end = sounds.length ? `[pre];${soundChains(sounds, 2)};[pre]${sounds.map((_, i) => `[x${i}]`).join("")}amix=inputs=${sounds.length + 1}:duration=first:normalize=0,` : ",";
  // The ambience of her videos under the music, both as they are.
  if (gains.kind === "ambient") return `[0:a]${STEREO},volume=${gains.speechGain}dB[own];${music}[m];[m][own]amix=inputs=2:duration=first:normalize=0${end}${limit}${fade}[a]`;
  if (!gains.duck) return `${music}${end}${limit}${fade}[a]`;
  const d = gains.duck;
  return (
    `[0:a]${STEREO},volume=${gains.speechGain}dB,asplit=2[key][own];${music}[m];` +
    `[m][key]sidechaincompress=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attack}:release=${d.release}[ducked];` +
    `[ducked][own]amix=inputs=2:duration=first:normalize=0${end}${limit}${fade}[a]`
  );
}

const STEREO = "aformat=sample_rates=44100:channel_layouts=stereo";

/**
 * A sound effect as the mix takes it (sfx.ts placeSounds): its attack at `at` (s), its gain (dB), the part of its file
 * played (s); `burst`: the same sound laid again at each of `times` (s after `at`, the first at 0), each at its own gain
 * (dB, from `gain`): a clicking, a roll, denser than a frame.
 */
export type SoundInMix = { at: number; gain: number; onset: number; end: number; burst?: { times: number[]; gains: number[] } };

/**
 * Each sound effect's chain, its file the input `first + i`, out as [x0], [x1]…: trimmed to its
 * attack and its fade, at its gain, faded in 5 ms and out 40 ms (no click), delayed to its moment.
 * A burst is its one file split, each copy delayed to its own sample and at its own gain, mixed back into [xi].
 */
export function soundChains(sounds: SoundInMix[], first: number): string {
  return sounds
    .map((s, i) => {
      const length = Math.max(0.05, s.end - s.onset);
      const out = Math.max(0, length - 0.04);
      const delay = Math.max(0, Math.round(s.at * 1000));
      const head = `[${first + i}:a]atrim=start=${s.onset.toFixed(3)}:end=${s.end.toFixed(3)},asetpts=PTS-STARTPTS,${STEREO},volume=${s.gain}dB,afade=t=in:d=0.005,afade=t=out:st=${out.toFixed(3)}:d=0.04`;
      const hits = s.burst?.times.length ?? 0;
      if (hits < 2) return `${head},adelay=${delay}:all=1[x${i}]`;
      const copies = s.burst!.times.map((t, k) => `[x${i}b${k}]adelay=${Math.max(0, Math.round((s.at + t) * 44100))}S:all=1${s.burst!.gains[k] ? `,volume=${s.burst!.gains[k]}dB` : ""}[x${i}d${k}]`);
      return [
        `${head},asplit=${hits}${s.burst!.times.map((_, k) => `[x${i}b${k}]`).join("")}`,
        ...copies,
        `${s.burst!.times.map((_, k) => `[x${i}d${k}]`).join("")}amix=inputs=${hits}:duration=longest:normalize=0[x${i}]`,
      ].join(";");
    })
    .join(";");
}

/**
 * The sound effects over a Reel without Edith's music: over its own sound as it is (`hasAudio`),
 * else over silence of its `duration`; the effects are the inputs 1…, out as [a], peaks under -1 dBFS.
 * `speechGain` (dB): a voice laid over a model that plays without music (her voice note, levelled nowhere else) brought
 * to the level of a voice (speechGain of its measured loudness), with or without effects over it.
 */
export function soundsOnlyFilter(hasAudio: boolean, duration: number, sounds: SoundInMix[], speechGain = 0): string {
  const gain = hasAudio && speechGain ? `,volume=${speechGain}dB` : "";
  const base = hasAudio ? `[0:a]${STEREO}${gain}[pre]` : `anullsrc=r=44100:cl=stereo,atrim=duration=${duration.toFixed(2)}[pre]`;
  const limit = `alimiter=limit=${MIX_CEILING}:level=false[a]`;
  if (!sounds.length) return `${base};[pre]${limit}`;
  return `${base};${soundChains(sounds, 1)};[pre]${sounds.map((_, i) => `[x${i}]`).join("")}amix=inputs=${sounds.length + 1}:duration=first:normalize=0,${limit}`;
}

/** The ffmpeg filter that prints a voice's level (RMS, dB) every `step` seconds (its rumble left out). */
export const speechLevelsFilter = (step: number) =>
  `highpass=f=80,aresample=16000,asetnsamples=n=${Math.round(16000 * step)}:p=0,` +
  "astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level";

/** How far from the timing of a sentence's end a breath may move to find the voice's silence (s). */
export const PAUSE_REACH = 0.15;

/** A voice this far under its loud level (dB) is between two words: a cut there chops nothing. */
const QUIET_UNDER_DB = 28;

/**
 * Where to open each breath between two sentences: at the quietest moment of the voice
 * within PAUSE_REACH of where its timing puts it (levels every `step` s). ElevenLabs' timing
 * of a sentence read in one go is approximate: cut there, « légendes… » lost its end in
 * 10 ms, right on a cut of Tristan's Reel. A breath with no quiet moment near it is left
 * out: better two sentences run together than a word chopped.
 */
export function quietPauses(pauses: { at: number; add: number }[], levels: number[], step = BEAT_STEP): { at: number; add: number }[] {
  if (!levels.length) return pauses;
  const sorted = [...levels].filter(Number.isFinite).sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? -20;
  const quiet = loud - QUIET_UNDER_DB;
  return pauses.flatMap((p) => {
    const from = Math.max(0, Math.floor((p.at - PAUSE_REACH) / step));
    const to = Math.min(levels.length - 1, Math.ceil((p.at + PAUSE_REACH) / step));
    let best = -1;
    for (let i = from; i <= to; i++) if (best < 0 || levels[i]! < levels[best]! || (levels[i] === levels[best] && Math.abs((i + 0.5) * step - p.at) < Math.abs((best + 0.5) * step - p.at))) best = i;
    if (best < 0 || levels[best]! > quiet) return [];
    // The middle of that silence, so both words keep their whole sound.
    let start = best;
    let end = best;
    while (start > 0 && levels[start - 1]! <= quiet) start--;
    while (end < levels.length - 1 && levels[end + 1]! <= quiet) end++;
    return [{ at: Math.round(((start + end + 1) / 2) * step * 1000) / 1000, add: p.add }];
  });
}

/** How long each edge of a cut in a voice fades (s): long enough to never click, too short to hear. */
const EDGE_FADE = 0.012;

/**
 * The ffmpeg filter graph that opens a breath of silence in a voice at each pause
 * (sentencePauses), then goes on with `after` (its level), out as [out].
 */
export function pauseFilter(pauses: { at: number; add: number }[], after: string | null): string {
  const n = pauses.length;
  const s = (x: number) => x.toFixed(3);
  const graph = [`[0:a]aformat=sample_rates=44100:channel_layouts=mono,asplit=${n + 1}${Array.from({ length: n + 1 }, (_, i) => `[a${i}]`).join("")}`];
  let order = "";
  for (let i = 0; i <= n; i++) {
    const from = i ? pauses[i - 1]!.at : 0;
    const trim = [i ? `start=${s(from)}` : "", i < n ? `end=${s(pauses[i]!.at)}` : ""].filter(Boolean).join(":");
    // Each edge of a cut fades over a few milliseconds: a raw cut clicked, or chopped a breath, right where the shot changes.
    const fades = [i ? `afade=t=in:st=0:d=${s(EDGE_FADE)}` : "", i < n ? `afade=t=out:st=${s(Math.max(0, pauses[i]!.at - from - EDGE_FADE))}:d=${s(EDGE_FADE)}` : ""].filter(Boolean);
    graph.push(`[a${i}]atrim=${trim},asetpts=N/SR/TB${fades.length ? `,${fades.join(",")}` : ""}[p${i}]`);
    order += `[p${i}]`;
    if (i < n) {
      graph.push(`aevalsrc=0:c=mono:s=44100:d=${s(pauses[i]!.add)}[s${i}]`);
      order += `[s${i}]`;
    }
  }
  graph.push(`${order}concat=n=${2 * n + 1}:v=0:a=1${after ? `,${after}` : ""}[out]`);
  return graph.join(";");
}

/**
 * A composer writes a whole piece, its ending included: over the last 2 to 5 s the
 * beat stops and the sound dies away (10 of the lab's 11 Reels), heard as the sound
 * cutting out on the last shots. The piece is composed this much longer than the
 * Reel (the one that watches the video sees the Reel then its first seconds, as
 * Instagram loops it), so that ending falls after the Reel, where the mix cuts it.
 */
export const MUSIC_TAIL_SECONDS = 6;

/** Seconds composed after the end of the Reel. */
export const musicTail = (duration: number): number => round1(clamp(duration, 0, MUSIC_TAIL_SECONDS));

/** The beat is read in the bass (30–150 Hz) every half second; a groove has a kick or a bass note in every second. */
export const GROOVE_STEP = 0.5;

/** A second this far under the music's loud level has lost its beat: a groove stays within 5 dB of it. */
export const GROOVE_DROP_DB = 10;

/** The ffmpeg filter that prints the bass level (RMS, dB) of each `step` seconds of a track. */
export const bassLevelsFilter = (step: number) =>
  `highpass=f=30,lowpass=f=150,lowpass=f=150,aresample=8000,asetnsamples=n=${Math.round(8000 * step)}:p=0,` +
  "astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level";

/** Every GROOVE_STEP: where the beat holds (grooveGaps). */
export const BASS_LEVELS_FILTER = bassLevelsFilter(GROOVE_STEP);

/** Every 10 ms: where each beat lands (beatGrid). */
export const BEAT_STEP = 0.01;

const toPower = (db: number) => 10 ** ((Number.isFinite(db) ? db : -120) / 10);

/** Levels (dB) every `step` read as levels every `step × factor` (their mean power). */
export function coarser(levels: number[], factor: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + factor <= levels.length; i += factor) {
    const mean = levels.slice(i, i + factor).reduce((sum, db) => sum + toPower(db), 0) / factor;
    out.push(10 * Math.log10(mean));
  }
  return out;
}

/**
 * The beat grid of a piece asked at `beat` seconds a beat, from its bass levels every
 * BEAT_STEP: its real beat (within 6 %) and when its first beat starts (s, under one
 * beat). The kicks are where the bass rises, read in dB: the biggest jump in power is
 * the loudest step of an attack, 20 to 50 ms after it starts (the cuts of Culte's
 * collage fell 50 ms after its beats). A first grid within a step, then each kick
 * found near it and a line drawn through them, to a few milliseconds. Null when no
 * steady beat stands out (a soft piece, or one that does not keep the asked tempo):
 * it is then left as it is.
 */
export function beatGrid(levels: number[], beat: number): { period: number; offset: number } | null {
  if (!levels.length) return null;
  const onset = bassOnsets(levels);
  // A kick read within one step either side.
  const at = (t: number) => {
    const i = Math.round(t / BEAT_STEP);
    return Math.max(onset[i - 1] ?? 0, onset[i] ?? 0, onset[i + 1] ?? 0);
  };
  const length = levels.length * BEAT_STEP;
  let best: { period: number; offset: number; score: number; mean: number } | null = null;
  const [low, high] = [beat * 0.94, beat * 1.06];
  for (let period = low; period <= high; period += 0.0005) {
    const scores: { offset: number; score: number }[] = [];
    for (let offset = 0; offset < period; offset += BEAT_STEP) {
      let score = 0;
      let beats = 0;
      for (let t = offset; t < length - BEAT_STEP; t += period) {
        score += at(t);
        beats++;
      }
      scores.push({ offset, score: beats ? score / beats : 0 });
    }
    const top = scores.reduce((a, b) => (b.score > a.score ? b : a));
    const mean = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    if (!best || top.score > best.score) best = { period, offset: top.offset, score: top.score, mean };
  }
  // One found at the edge of the search is another tempo reaching in.
  if (!best || !best.mean || best.score < 2 * best.mean || best.period < low + 0.001 || best.period > high - 0.001) return null;
  // A steady beat: a kick on at least every other beat of the grid (the strong jumps, as many as it has beats).
  // Another tempo only meets a kick now and then.
  const strongest = [...onset].sort((a, b) => b - a).slice(0, Math.max(1, Math.floor(length / beat)));
  const strong = strongest.reduce((sum, o) => sum + o, 0) / strongest.length;
  let hits = 0;
  let beats = 0;
  for (let t = best.offset; t < length - BEAT_STEP; t += best.period, beats++) if (at(t) >= 0.3 * strong) hits++;
  if (!beats || hits / beats < 0.5) return null;
  // Each kick near that grid: the step where the bass rises most within 30 ms (its attack starts
  // in it, half a step in on average), when it rises half as much as the strong kicks.
  const kicks: [number, number][] = [];
  for (let n = 0, t = best.offset; t < length - BEAT_STEP; n++, t += best.period) {
    const center = Math.round(t / BEAT_STEP);
    let top = 0;
    for (let i = Math.max(1, center - 3); i <= Math.min(onset.length - 1, center + 3); i++) if (!top || onset[i]! > onset[top]!) top = i;
    if (top && onset[top]! >= 0.5 * strong) kicks.push([n, (top + 0.5) * BEAT_STEP]);
  }
  let { period, offset } = best;
  if (kicks.length >= 4 && kicks.at(-1)![0] - kicks[0]![0] >= 4) {
    const mean = (f: (kick: [number, number]) => number) => kicks.reduce((sum, kick) => sum + f(kick), 0) / kicks.length;
    const [n0, t0] = [mean(([n]) => n), mean(([, t]) => t)];
    const slope = mean(([n, t]) => (n - n0) * (t - t0)) / mean(([n]) => (n - n0) ** 2);
    const start = t0 - slope * n0;
    // A line far from the first grid is drawn through other hits: the first grid holds.
    if (Math.abs(slope - period) < 0.002 && Math.abs(start - offset) < 0.03) [period, offset] = [slope, start];
  }
  if (offset >= period) offset -= period;
  // A first beat a hair before the start of the file is on it; further back, the next one is the first.
  if (offset < 0) offset = offset > -2 * BEAT_STEP ? 0 : offset + period;
  return { period: Math.round(period * 10000) / 10000, offset: Math.round(offset * 1000) / 1000 };
}

/** A rise of the bass under this (dB) is a held note's ripple across the 10 ms windows (a 55 Hz note beats with them), never an attack. */
const RIPPLE_DB = 3;

/**
 * Where the bass rises, every BEAT_STEP (dB, 0 to 12): silence held 40 dB under the loud level, a rise counted 12 dB at
 * most, so the first sound after a silent start is not worth ten kicks, and none under RIPPLE_DB (a bass held under the
 * kicks made a rise every other window, and its grid stood out no more than twice from the others: never found).
 */
function bassOnsets(levels: number[]): number[] {
  const loud = [...levels].sort((a, b) => a - b)[Math.floor(0.9 * (levels.length - 1))]!;
  const db = levels.map((v) => Math.max(Number.isFinite(v) ? v : -120, loud - 40));
  return db.map((v, i) => {
    const rise = i ? Math.min(12, Math.max(0, v - db[i - 1]!)) : 0;
    return rise < RIPPLE_DB ? 0 : rise;
  });
}

/** The mean of the strongest rises of a piece, as many as it has beats: what a kick is. */
function strongRise(onset: number[], beats: number): number {
  const strongest = [...onset].sort((a, b) => b - a).slice(0, Math.max(1, Math.floor(beats)));
  return strongest.reduce((sum, o) => sum + o, 0) / strongest.length;
}

/** A bar, in beats: a model counts its downbeats every four (its phrases of 8 and 16). */
export const BAR_BEATS = 4;

/** Its bars tell their first beat when that beat's kicks are this much stronger than any other beat's (a bass note that starts each bar, a kick on its 1 only). */
const DOWNBEAT_LEAD = 1.25;

/**
 * The first strong beat of a piece on its grid (beatGrid), from its bass levels every BEAT_STEP (s on its own clock):
 * the first beat whose kick is strong (an intro or a pickup before it is not its beat 0), moved on to the first beat of
 * its bars when they tell it (four bars at least, the strongest kicks a quarter stronger on one beat of four than on any
 * other: a bass note that starts each bar, a kick on its 1 only); a piece whose beats all hit alike (four on the floor)
 * keeps its first strong one, the composer's start. Null when no beat of the grid has a kick.
 */
export function firstDownbeat(levels: number[], grid: { period: number; offset: number }): number | null {
  if (!levels.length || !(grid.period > 0)) return null;
  const onset = bassOnsets(levels);
  const length = levels.length * BEAT_STEP;
  // A beat's kick: the strongest rise within 30 ms of it (its attack starts in that step).
  const kick = (t: number) => {
    const c = Math.round(t / BEAT_STEP);
    let top = 0;
    for (let i = Math.max(1, c - 3); i <= Math.min(onset.length - 1, c + 3); i++) top = Math.max(top, onset[i]!);
    return top;
  };
  const beats: number[] = [];
  for (let t = grid.offset; t < length - BEAT_STEP; t += grid.period) beats.push(kick(t));
  if (!beats.length) return null;
  const strong = strongRise(onset, length / grid.period);
  const first = beats.findIndex((k) => k >= 0.5 * strong);
  if (first < 0) return null;
  // Its bars: the mean kick on each of four beats from the first strong one.
  const counted = beats.length - first;
  let phase = 0;
  if (counted >= 4 * BAR_BEATS) {
    const means = Array.from({ length: BAR_BEATS }, (_, p) => {
      const on = beats.slice(first).filter((_, n) => n % BAR_BEATS === p);
      return on.reduce((sum, k) => sum + k, 0) / on.length;
    });
    const best = means.indexOf(Math.max(...means));
    const others = Math.max(...means.filter((_, p) => p !== best));
    if (means[best]! >= DOWNBEAT_LEAD * others) phase = best;
  }
  return Math.round((grid.offset + (first + phase) * grid.period) * 1000) / 1000;
}

/** A piece set on the cuts is cut this long (s) before its first attack: the attack stays whole and lands on the cut. */
export const ATTACK_LEAD = 0.005;

/** Under this (s), a cut or a silence before the music is not worth making. */
const NOT_WORTH = 0.015;

/**
 * Where the composed piece starts so its first strong beat lands on the Reel's `mark` (s; its attack ATTACK_LEAD after
 * it, as on every cut): `trim` s of the piece cut off (on its own clock, before its tempo is set to the grid's by `tempo`,
 * its beat / the grid's), or `delay` s of silence before it (on the Reel's clock) when the music is not heard until then
 * anyway (`heard`: where a late start ends). A mark in music already heard takes the piece from a later downbeat (a bar at
 * a time, `bar` s on its clock), so a pickup plays before it rather than a silence.
 */
export function musicStart(input: { downbeat: number; tempo: number; bar: number; mark: number; heard: number }): { trim: number; delay: number } {
  const tempo = input.tempo > 0 ? input.tempo : 1;
  const trim = input.downbeat - (input.mark + ATTACK_LEAD) * tempo;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  if (trim >= 0) return { trim: trim < NOT_WORTH ? 0 : round(trim), delay: 0 };
  const silence = -trim / tempo;
  if (silence < NOT_WORTH) return { trim: 0, delay: 0 };
  // (Its attack ATTACK_LEAD after the late start ends, as the gate opens.)
  if (silence <= input.heard + ATTACK_LEAD + 0.001) return { trim: 0, delay: round(silence) };
  if (!(input.bar > 0)) return { trim: 0, delay: 0 };
  return { trim: round(trim + Math.ceil(-trim / input.bar - 1e-9) * input.bar), delay: 0 };
}

/**
 * How a composed piece is set on a Reel (its bass levels every BEAT_STEP over all of it): on its beat grid (beatGrid at
 * the Reel's `beat`), its first strong beat (firstDownbeat) on `mark`, its tempo held to the grid's (`aligned`); without a
 * steady beat, left as it is, but for a late start (`heard`) it is held back to (the piece then starts with the music).
 */
export function musicSetting(levels: number[], beat: number | null, mark: number, heard: number): { trim: number; delay: number; tempo: number; aligned: boolean } {
  const grid = beat && levels.length ? beatGrid(levels, beat) : null;
  if (!grid || !beat) return { ...musicStart({ downbeat: 0, tempo: 1, bar: 0, mark, heard }), tempo: 1, aligned: false };
  const tempo = Math.round((grid.period / beat) * 10000) / 10000;
  const downbeat = firstDownbeat(levels, grid) ?? grid.offset;
  return { ...musicStart({ downbeat, tempo, bar: BAR_BEATS * grid.period, mark, heard }), tempo, aligned: true };
}

/**
 * Where the beat falls away in what is heard of a Reel's music (s, the Reel's clock): its gaps (grooveGaps) read on the
 * piece as the mix plays it (`start`: cut by `trim` s, held back `delay` s, its tempo moved by `tempo`), less where its
 * model's shape silences it (a late start, a pause, after its end): a gap the music never plays there is not worth
 * composing again. Those that keep a second heard.
 */
export function heardGaps(levels: number[], duration: number, start: { trim: number; delay: number; tempo: number }, shape?: MusicShape | null): { from: number; to: number }[] {
  const tempo = start.tempo > 0 ? start.tempo : 1;
  // The piece's steps on the Reel's clock: before it starts (its delay), silence.
  const steps = Math.round(duration / BEAT_STEP);
  const reel = Array.from({ length: steps }, (_, i) => {
    const t = (i * BEAT_STEP - start.delay) * tempo + start.trim;
    return t < 0 ? -120 : (levels[Math.round(t / BEAT_STEP)] ?? -120);
  });
  const gaps = grooveGaps(coarser(reel, Math.round(GROOVE_STEP / BEAT_STEP)), duration);
  const read = readMusicShape(shape, duration);
  const silent: { from: number; to: number }[] = [
    ...(start.delay > 0 ? [{ from: 0, to: start.delay }] : []),
    ...(read?.pauses ?? []),
    ...(read?.end ? [{ from: read.end.at, to: duration }] : []),
  ];
  return gaps.flatMap((g) => {
    // The gap less every silent span: what is left of it, heard.
    let parts = [g];
    for (const s of silent) parts = parts.flatMap((p) => (s.to <= p.from || s.from >= p.to ? [p] : [...(s.from > p.from ? [{ from: p.from, to: s.from }] : []), ...(s.to < p.to ? [{ from: s.to, to: p.to }] : [])]));
    return parts.filter((p) => p.to - p.from >= 1 - 1e-6);
  });
}

/**
 * Where the beat falls away in a Reel's music (seconds), from its bass levels
 * every GROOVE_STEP: a second or more that stays GROOVE_DROP_DB under the loud
 * level of the music, before the mix's fade on its last 0.8 s. A break on a calm
 * shot or an ending that comes too early: heard as the sound cutting out.
 */
export function grooveGaps(levels: number[], duration: number): { from: number; to: number }[] {
  const power = levels.map(toPower);
  // Seconds read every half second: a beat every 0.8 s still lands in each one.
  const seconds = power.slice(0, -1).map((p, i) => 10 * Math.log10((p + power[i + 1]!) / 2));
  if (seconds.length < 3) return [];
  const loud = [...seconds].sort((a, b) => a - b)[Math.floor(0.9 * (seconds.length - 1))]!;
  const fade = duration - 0.8;
  const gaps: { from: number; to: number }[] = [];
  seconds.forEach((level, i) => {
    const from = i * GROOVE_STEP;
    const to = from + 2 * GROOVE_STEP;
    if (level >= loud - GROOVE_DROP_DB || to > fade + 1e-6) return;
    const last = gaps.at(-1);
    if (last && from <= last.to) last.to = to;
    else gaps.push({ from, to });
  });
  return gaps;
}

/** Volume (0–1) of a level in the live preview, for music as composed. */
const previewVolume = (lufs: number) => round2(clamp(10 ** ((lufs - MUSIC_AS_COMPOSED_LUFS) / 20), 0, 1));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The music in the live preview of a Reel (the editors, the page /v), close to the
 * render's mix: its volume, and the lower one while someone speaks, in `windows`
 * (frames). Nothing said: the music as it is.
 */
export function previewMusic(kind: MixCase, windows: [number, number][]): { volume: number; duck?: { volume: number; windows: [number, number][] } } {
  const settings = MIX_CASES[kind];
  const volume = previewVolume(settings.music);
  return kind === "music" || !windows.length ? { volume } : { volume, duck: { volume: previewVolume(settings.under), windows } };
}

/**
 * Spans of speech from timed words (frames): a pause shorter than `gap` frames
 * does not let the music come back up between two words.
 */
export function speechWindows(words: { from: number; to: number }[], gap: number): [number, number][] {
  const spans = [...words].sort((a, b) => a.from - b.from);
  const windows: [number, number][] = [];
  for (const w of spans) {
    const last = windows.at(-1);
    if (last && w.from - last[1] <= gap) last[1] = Math.max(last[1], w.to);
    else windows.push([w.from, Math.max(w.to, w.from + 1)]);
  }
  return windows;
}
