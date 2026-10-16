// How Simone's music sits under what is said in a Reel. Loudness in LUFS (EBU R128,
// measured by ffmpeg on the rendered video and on the music), turned into fixed
// gains: what is said (her voice note, Simone's voice, someone speaking in a clip)
// is brought to SPEECH_LUFS, the music to the level of its case, then it ducks
// under the speech (sidechain compressor). Measured on creators' Reels that work
// (about -14 LUFS overall, the music some 8 dB under the voice in its pauses and
// still heard while it speaks) and on ElevenLabs voices, which come out between
// -19 and -31 LUFS: before, the music fell 17 dB under the voice and vanished.

/** What is said in a Reel, at the loudness of a voice in a creator's Reel. */
export const SPEECH_LUFS = -14;

/** A music track as ElevenLabs composes it (the live preview cannot measure it). */
export const MUSIC_AS_COMPOSED_LUFS = -15;

export type MixCase = "music" | "voice_over" | "speech_in_clips";

export type Ducking = { threshold: number; ratio: number; attack: number; release: number };

export const MIX_CASES: Record<MixCase, { music: number; duck: Ducking | null; under: number }> = {
  /** Nothing said: the music alone, as loud as a creator's Reel. */
  music: { music: -14, duck: null, under: -14 },
  /** A voice over the whole Reel: the music lies under it and steps back a little while the voice speaks, never out of hearing. */
  voice_over: { music: -20, duck: { threshold: 0.03, ratio: 1.6, attack: 20, release: 600 }, under: -26 },
  /** Someone speaks in a few shots: the music keeps its level and ducks well under them. */
  speech_in_clips: { music: -15, duck: { threshold: 0.016, ratio: 8, attack: 20, release: 600 }, under: -33 },
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
 * and the ducking.
 */
export function mixGains(loudness: { speech: number | null; music: number | null }, voiceOver: boolean): {
  kind: MixCase;
  speechGain: number;
  musicGain: number;
  duck: Ducking | null;
} {
  const gain = speechGain(loudness.speech);
  const kind: MixCase = gain === null ? "music" : voiceOver ? "voice_over" : "speech_in_clips";
  const settings = MIX_CASES[kind];
  return {
    kind,
    speechGain: gain ?? 0,
    musicGain: measured(loudness.music) && loudness.music > -60 ? round1(clamp(settings.music - loudness.music, -30, 8)) : 0,
    duck: settings.duck,
  };
}

/**
 * The ffmpeg filter graph of a mix: [0:a] the video's own sound, [1:a] the music,
 * out as [a], faded out over 0.8 s from `fadeAt` (s; null when the length is unknown: no fade).
 */
export function mixFilter(gains: ReturnType<typeof mixGains>, fadeAt: number | null): string {
  const stereo = "aformat=sample_rates=44100:channel_layouts=stereo";
  const fade = fadeAt === null ? "" : `,afade=t=out:st=${Math.max(0, fadeAt).toFixed(2)}:d=0.8`;
  const limit = `alimiter=limit=${MIX_CEILING}:level=false`;
  const music = `[1:a]${stereo},volume=${gains.musicGain}dB`;
  if (!gains.duck) return `${music},${limit}${fade}[a]`;
  const d = gains.duck;
  return (
    `[0:a]${stereo},volume=${gains.speechGain}dB,asplit=2[key][own];${music}[m];` +
    `[m][key]sidechaincompress=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attack}:release=${d.release}[ducked];` +
    `[ducked][own]amix=inputs=2:duration=first:normalize=0,${limit}${fade}[a]`
  );
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
 * BEAT_STEP: its real beat (within 6 %) and when its first beat falls (s, under one
 * beat). The kicks are where the bass jumps up. Null when no steady beat stands out
 * (a soft piece, or one that does not keep the asked tempo): it is then left as it is.
 */
export function beatGrid(levels: number[], beat: number): { period: number; offset: number } | null {
  const power = levels.map(toPower);
  const onset = power.map((p, i) => (i ? Math.max(0, p - power[i - 1]!) : 0));
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
  return { period: Math.round(best.period * 10000) / 10000, offset: Math.round(best.offset * 1000) / 1000 };
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
