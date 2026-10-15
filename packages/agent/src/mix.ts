// How Simone's music sits under what is said in a Reel. Loudness in LUFS (EBU R128,
// measured by ffmpeg on the rendered video and on the music), turned into fixed
// gains: what is said (her voice note, Simone's voice, someone speaking in a clip)
// is brought to SPEECH_LUFS, the music to the level of its case, then it ducks
// under the speech (sidechain compressor). Set by ear and by measure on ElevenLabs
// voices, which come out between -19 and -31 LUFS, over the music of a lab Reel
// (about -15): before, the music could be 9 dB louder than a quiet voice; now it
// sits about 17 dB under the voice while it speaks.

/** What is said in a Reel, at the loudness of a voice in a creator's Reel. */
export const SPEECH_LUFS = -16;

/** A music track as ElevenLabs composes it (the live preview cannot measure it). */
export const MUSIC_AS_COMPOSED_LUFS = -15;

export type MixCase = "music" | "voice_over" | "speech_in_clips";

export type Ducking = { threshold: number; ratio: number; attack: number; release: number };

export const MIX_CASES: Record<MixCase, { music: number; duck: Ducking | null; under: number }> = {
  /** Nothing said: the music alone. */
  music: { music: -15, duck: null, under: -15 },
  /** A voice over the whole Reel: the music lies under it, and steps back again while the voice speaks. */
  voice_over: { music: -23, duck: { threshold: 0.03, ratio: 3, attack: 20, release: 600 }, under: -33 },
  /** Someone speaks in a few shots: the music keeps its level and ducks under them. */
  speech_in_clips: { music: -16, duck: { threshold: 0.016, ratio: 8, attack: 20, release: 600 }, under: -33 },
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
