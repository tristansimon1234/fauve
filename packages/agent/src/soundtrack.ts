import { replaceSegments } from "./plan-edit.ts";
import { isClipSegment, isMotionSegment, type EditPlan, type MotionTemplate, type MusicSpec, type MusicStyle } from "./schemas.ts";

// Simone's soundtrack: a short piece synthesized from code (no file, no rights to
// clear) in one of three moods, with sound effects where the picture moves: a
// whoosh on each cut, a pop when a text appears, a chime on the end card. The
// tempo's beat is a whole number of frames, and the cuts are moved onto the beat
// (onBeat), so the montage plays in time. Pure and deterministic (seeded): the
// browser plays the same sound in the editor as the render puts in the video.

export const SAMPLE_RATE = 32000;
const FPS = 30;

export const MUSIC_LABELS: Record<MusicStyle, string> = { douce: "Douce", pechue: "Pêchue", chic: "Chic" };
const STYLE_OF_TEMPLATE: Record<MotionTemplate, MusicStyle> = { doux: "douce", dynamique: "pechue", chic: "chic" };
// 1800 / bpm is a whole number of frames at 30 fps: 24, 15 and 20 frames a beat.
const BPM: Record<MusicStyle, number> = { douce: 75, pechue: 120, chic: 90 };
// Keys that sit well for each mood (semitones above C).
const KEYS: Record<MusicStyle, number[]> = { douce: [0, 2, 5, 7], pechue: [9, 4, 2, 7], chic: [2, 5, 9, 0] };

/** The soundtrack of a style, its tempo and key drawn from the seed. */
export function musicSpec(style: MusicStyle, seed: number, options: { sfx?: boolean; chosen?: boolean } = {}): MusicSpec {
  const keys = KEYS[style];
  return {
    style,
    bpm: BPM[style],
    key: keys[seed % keys.length]!,
    seed: seed % 100_000,
    sfx: options.sfx ?? true,
    ...(options.chosen ? { chosen: true } : {}),
  };
}

/** The template's own soundtrack (doux → douce, dynamique → pêchue, chic → chic). */
export function defaultMusic(template: string, seed: number): MusicSpec {
  return musicSpec(STYLE_OF_TEMPLATE[template as MotionTemplate] ?? "douce", seed);
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** A seed from any text (a post id): the same post keeps the same melody. */
export function seedOf(text: string): number {
  return parseInt(hash(text), 36) % 100_000;
}

/**
 * The soundtrack of a new version: the one chosen (or turned off) by hand stays;
 * otherwise the template's (a correction that changes the template changes the
 * music with it), on the same seed.
 */
export function carrySoundtrack(plan: EditPlan, previous: EditPlan | null, seed: number): EditPlan {
  const before = previous?.music;
  if (before?.chosen || before?.muted) return { ...plan, music: before };
  // Off unless she picks one: the synthesized music is not good enough to play by default yet.
  const fresh = { ...defaultMusic(plan.template, before?.seed ?? seed), muted: true };
  return { ...plan, music: before ? { ...fresh, sfx: before.sfx } : fresh };
}

/**
 * A soundtrack set by hand (or asked for): a style, kept from then on, or off;
 * with or without sound effects. The cuts move onto the new beat.
 */
export function withSoundtrack(plan: EditPlan, style: MusicStyle | "off", sfx: boolean, seed: number): EditPlan {
  const music: MusicSpec =
    style === "off"
      ? { ...(plan.music ?? defaultMusic(plan.template, seed)), sfx, muted: true }
      : musicSpec(style, plan.music?.seed ?? seed, { sfx, chosen: true });
  return onBeat({ ...plan, music });
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Seconds of one beat, a whole number of frames. */
export function beatSeconds(bpm: number): number {
  return Math.max(1, Math.round((FPS * 60) / bpm)) / FPS;
}

/**
 * Moves the cuts onto the beat: each scene lasts a whole number of beats (a clip
 * is only shortened, never past its end; a scene is rounded within its bounds).
 * Texts follow their scene. Without music, the plan is unchanged.
 */
export function onBeat(plan: EditPlan): EditPlan {
  if (!plan.music || plan.music.muted) return plan;
  const unit = beatSeconds(plan.music.bpm);
  // With fades, a cut sits a fade earlier: each scene but the last carries it on top of its beats.
  const fade = plan.transitions === "fade" && plan.segments.length > 1 ? Math.round(0.35 * FPS) / FPS : 0;
  const last = plan.segments.length - 1;
  const segments = plan.segments.map((s, i) => {
    const extra = i < last ? fade : 0;
    if (isClipSegment(s)) {
      const length = s.out - s.in;
      const beats = Math.floor((length - extra) / unit + 1e-6);
      return beats >= 1 && beats * unit + extra >= 0.5 ? { ...s, out: round(s.in + beats * unit + extra) } : s;
    }
    const max = isMotionSegment(s) ? 8 : 6;
    let beats = Math.max(1, Math.round((s.duration - extra) / unit));
    while (beats > 1 && beats * unit + extra > max) beats--;
    return { ...s, duration: round(beats * unit + extra) };
  });
  return replaceSegments(plan, segments);
}

// ---------------------------------------------------------------------------
// Where the sound effects go, from the Reel as it plays.
// ---------------------------------------------------------------------------

export type SoundCue = { at: number; kind: "whoosh" | "pop" | "chime" };

type TimedProps = {
  fps: number;
  durationInFrames: number;
  fadeFrames: number;
  segments: { startAt: number }[];
  texts: { from: number }[];
  endCard: { from: number } | null;
  music?: MusicSpec | null;
};

export function soundCues(props: TimedProps): SoundCue[] {
  const cues: SoundCue[] = [];
  const cuts = props.segments.slice(1).map((s) => (s.startAt + props.fadeFrames / 2) / props.fps);
  for (const at of cuts) cues.push({ at, kind: "whoosh" });
  let lastPop = -1;
  for (const t of [...props.texts].sort((a, b) => a.from - b.from)) {
    const at = t.from / props.fps;
    // Not on the very first frame, not on a cut, not twice in a breath.
    if (at < 0.2 || at - lastPop < 0.4 || cuts.some((c) => Math.abs(c - at) < 0.2)) continue;
    cues.push({ at, kind: "pop" });
    lastPop = at;
  }
  if (props.endCard) cues.push({ at: props.endCard.from / props.fps + 0.15, kind: "chime" });
  return cues.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------
// The synthesizer.
// ---------------------------------------------------------------------------

function random(seed: number) {
  let a = seed + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;

type Quality = "maj" | "min" | "maj7" | "min7" | "dom7";
const CHORD: Record<Quality, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] };
// Chord roots (semitones above the key) and qualities, one chord a bar.
const PROGRESSIONS: Record<MusicStyle, [number, Quality][][]> = {
  douce: [
    [[0, "maj"], [9, "min"], [5, "maj"], [7, "maj"]],
    [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]],
    [[5, "maj"], [0, "maj"], [7, "maj"], [9, "min"]],
  ],
  pechue: [
    [[0, "min"], [8, "maj"], [3, "maj"], [10, "maj"]],
    [[0, "min"], [10, "maj"], [8, "maj"], [10, "maj"]],
    [[8, "maj"], [3, "maj"], [10, "maj"], [0, "min"]],
  ],
  chic: [
    [[2, "min7"], [7, "dom7"], [0, "maj7"], [9, "min7"]],
    [[0, "maj7"], [9, "min7"], [2, "min7"], [7, "dom7"]],
    [[9, "min7"], [2, "min7"], [7, "dom7"], [0, "maj7"]],
  ],
};

/** The chord's notes around middle C, and its bass note. */
function voicing(key: number, root: number, quality: Quality): { notes: number[]; bass: number } {
  const base = 57 + ((key + root) % 12);
  const notes = CHORD[quality].map((i) => {
    let n = base + i;
    while (n > 72) n -= 12;
    return n;
  });
  return { notes, bass: 36 + ((key + root) % 12) };
}

class Track {
  readonly data: Float32Array;
  readonly length: number;
  constructor(length: number) {
    this.length = length;
    this.data = new Float32Array(length);
  }
  /** Writes a sound from `start` (seconds) for `seconds`, sample by sample: fn(t since start, i). */
  write(start: number, seconds: number, fn: (t: number, i: number) => number) {
    const from = Math.max(0, Math.round(start * SAMPLE_RATE));
    const to = Math.min(this.length, from + Math.round(seconds * SAMPLE_RATE));
    for (let s = from, i = 0; s < to; s++, i++) this.data[s]! += fn(i / SAMPLE_RATE, i);
  }
}

function kick(track: Track, at: number, amp: number) {
  let phase = 0;
  track.write(at, 0.42, (t) => {
    phase += (45 + 110 * Math.exp(-t * 28)) / SAMPLE_RATE;
    return amp * Math.sin(TAU * phase) * Math.exp(-t * 7.5);
  });
}

function noiseHit(track: Track, at: number, seconds: number, amp: number, decay: number, r: () => number, highpass = 0.92) {
  let prev = 0;
  let low = 0;
  track.write(at, seconds, (t) => {
    const x = r() * 2 - 1;
    // Crude high-pass: the noise minus its low end.
    low += (x - low) * (1 - highpass);
    const y = x - low - prev * 0.2;
    prev = y;
    return amp * y * Math.exp(-t * decay);
  });
}

function clap(track: Track, at: number, amp: number, r: () => number) {
  for (const d of [0, 0.011, 0.022]) noiseHit(track, at + d, 0.03, amp * 0.8, 160, r, 0.7);
  noiseHit(track, at + 0.03, 0.22, amp, 16, r, 0.7);
}

function rim(track: Track, at: number, amp: number, r: () => number) {
  track.write(at, 0.05, (t) => amp * (Math.sin(TAU * 1750 * t) * Math.exp(-t * 110) + (r() * 2 - 1) * 0.3 * Math.exp(-t * 220)));
}

/** A plucked string (Karplus-Strong): warm, like a harp or a nylon guitar. */
function pluck(track: Track, at: number, midi: number, seconds: number, amp: number, r: () => number) {
  const n = Math.max(2, Math.round(SAMPLE_RATE / hz(midi)));
  const line = new Float32Array(n);
  // A softened burst: a gentler attack.
  let s = 0;
  for (let i = 0; i < n; i++) line[i] = s = s * 0.5 + (r() * 2 - 1) * 0.5;
  let idx = 0;
  track.write(at, seconds, (t) => {
    const a = line[idx]!;
    const b = line[(idx + 1) % n]!;
    line[idx] = (a + b) * 0.5 * 0.995;
    idx = (idx + 1) % n;
    return amp * a * Math.min(1, (seconds - t) * 12);
  });
}

/** A soft pad: two detuned saws through a low-pass, slow in and out. */
function pad(track: Track, at: number, midi: number, seconds: number, amp: number, cutoff: number, duck?: (t: number) => number) {
  const f = hz(midi);
  let p1 = 0;
  let p2 = 0.37;
  let low = 0;
  const k = 1 - Math.exp((-TAU * cutoff) / SAMPLE_RATE);
  const release = 0.5;
  track.write(at, seconds + release, (t) => {
    p1 = (p1 + (f * 1.003) / SAMPLE_RATE) % 1;
    p2 = (p2 + (f * 0.997) / SAMPLE_RATE) % 1;
    const x = (p1 * 2 - 1 + (p2 * 2 - 1)) * 0.5;
    low += (x - low) * k;
    const env = Math.min(1, t / 0.35) * (t > seconds ? Math.exp(-((t - seconds) / release) * 4) : 1);
    return amp * low * env * (duck ? duck(at + t) : 1);
  });
}

function bass(track: Track, at: number, midi: number, seconds: number, amp: number, saw: boolean, duck?: (t: number) => number) {
  const f = hz(midi);
  let p = 0;
  let low = 0;
  const k = 1 - Math.exp((-TAU * 320) / SAMPLE_RATE);
  track.write(at, seconds + 0.06, (t) => {
    p = (p + f / SAMPLE_RATE) % 1;
    let x: number;
    if (saw) {
      low += (p * 2 - 1 - low) * k;
      x = low * 1.6;
    } else x = Math.sin(TAU * p) + 0.25 * Math.sin(TAU * 2 * p);
    const env = Math.min(1, t / 0.005) * (t > seconds ? Math.exp(-(t - seconds) * 60) : 0.75 + 0.25 * Math.exp(-t * 6));
    return amp * x * env * (duck ? duck(at + t) : 1);
  });
}

/** An electric piano (FM): a bright attack that mellows. */
function keys(track: Track, at: number, midi: number, seconds: number, amp: number) {
  const f = hz(midi);
  track.write(at, seconds, (t) => {
    const index = 1.4 * Math.exp(-t * 5);
    return amp * Math.sin(TAU * f * t + index * Math.sin(TAU * f * t)) * Math.exp(-t * 1.6) * Math.min(1, (seconds - t) * 8);
  });
}

function whoosh(track: Track, at: number, amp: number, r: () => number) {
  const rise = 0.32;
  const fall = 0.2;
  let low = 0;
  let band = 0;
  track.write(at - rise, rise + fall, (t) => {
    const u = t - rise;
    const fc = u < 0 ? 400 * 10 ** (1 + u / rise) : 4000 * Math.exp(-u * 5);
    const f = 2 * Math.sin((Math.PI * Math.min(fc, 6000)) / SAMPLE_RATE);
    const high = r() * 2 - 1 - low - 0.7 * band;
    band += f * high;
    low += f * band;
    const env = u < 0 ? (1 + u / rise) ** 2 : Math.exp(-u * 14);
    return amp * band * env;
  });
}

function pop(track: Track, at: number, amp: number) {
  let phase = 0;
  track.write(at, 0.09, (t) => {
    phase += (380 + 900 * (1 - Math.exp(-t * 60))) / SAMPLE_RATE;
    return amp * Math.sin(TAU * phase) * Math.exp(-t * 45) * Math.min(1, t / 0.002);
  });
}

function chime(track: Track, at: number, key: number, amp: number) {
  [72 + key, 79 + key].forEach((midi, n) => {
    const f = hz(midi);
    track.write(at + n * 0.12, 1.8, (t) =>
      amp * (Math.sin(TAU * f * t) * Math.exp(-t * 1.6) + 0.4 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 3) + 0.2 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 6)),
    );
  });
}

/** The soundtrack as samples (mono, SAMPLE_RATE), for a video of `seconds`. */
export function synthesize(spec: MusicSpec, seconds: number, cues: SoundCue[]): Float32Array {
  const length = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
  const music = new Track(length);
  const fx = new Track(length);
  const r = random(spec.seed + 1);
  const beat = beatSeconds(spec.bpm);
  const bar = beat * 4;
  const progressions = PROGRESSIONS[spec.style];
  const progression = progressions[spec.seed % progressions.length]!;
  const endCard = cues.find((c) => c.kind === "chime")?.at ?? seconds;
  // Pêchue breathes with the kick (sidechain): pad and bass dip on each beat.
  const duck = spec.style === "pechue" ? (t: number) => 1 - 0.55 * Math.exp(-((t % beat) * 10)) : undefined;

  for (let b = 0; b * bar < seconds; b++) {
    const at = b * bar;
    const [root, quality] = progression[b % progression.length]!;
    const { notes, bass: low } = voicing(spec.key, root, quality);
    const drums = at < endCard - 0.2;
    switch (spec.style) {
      case "douce": {
        for (const n of notes) pad(music, at, n, bar, 0.035, 900);
        bass(music, at, low, beat * 2 - 0.05, 0.28, false);
        bass(music, at + beat * 2, low + 7, beat * 2 - 0.05, 0.22, false);
        // Arpeggio in eighths, up then down.
        const arp = [...notes, notes[1]! + 12, ...[...notes].reverse()];
        for (let e = 0; e < 8; e++) pluck(music, at + (e * beat) / 2, arp[e % arp.length]! + 12, beat * 1.6, 0.16, r);
        if (drums) {
          kick(music, at, 0.35);
          kick(music, at + beat * 2, 0.25);
          for (let e = 0; e < 8; e++) noiseHit(music, at + (e * beat) / 2, 0.06, e % 2 ? 0.05 : 0.03, 70, r);
        }
        break;
      }
      case "pechue": {
        for (const n of notes) pad(music, at, n, bar, 0.025, 1400, duck);
        for (let e = 0; e < 8; e++) bass(music, at + (e * beat) / 2, low + (e % 2 ? 12 : 0), beat * 0.42, 0.24, true, duck);
        for (const e of [1, 3, 4, 6]) for (const n of notes) pluck(music, at + (e * beat) / 2, n + 12, beat * 0.5, 0.07, r);
        if (drums) {
          for (let q = 0; q < 4; q++) kick(music, at + q * beat, 0.85);
          clap(music, at + beat, 0.32, r);
          clap(music, at + beat * 3, 0.32, r);
          for (let e = 0; e < 8; e++) if (e % 2) noiseHit(music, at + (e * beat) / 2, 0.05, 0.13, 90, r);
        }
        break;
      }
      case "chic": {
        for (const n of notes) keys(music, at, n, beat * 2.5, 0.075);
        for (const n of notes) keys(music, at + beat * 2.5, n, beat * 1.4, 0.05);
        bass(music, at, low, beat * 1.4, 0.32, false);
        bass(music, at + beat * 2, low + 7, beat * 1.4, 0.26, false);
        if (drums) {
          kick(music, at, 0.6);
          kick(music, at + beat * 1.5, 0.45);
          rim(music, at + beat, 0.22, r);
          rim(music, at + beat * 3, 0.22, r);
          // Sixteenth hats, lightly swung.
          for (let s = 0; s < 16; s++) noiseHit(music, at + (s * beat) / 4 + (s % 2 ? beat * 0.04 : 0), 0.04, s % 4 === 0 ? 0.06 : 0.035, 110, r);
        }
        break;
      }
    }
  }

  if (spec.sfx) {
    for (const cue of cues) {
      if (cue.kind === "whoosh") whoosh(fx, cue.at, 0.22, r);
      if (cue.kind === "pop") pop(fx, cue.at, 0.22);
      if (cue.kind === "chime") chime(fx, cue.at, spec.key, 0.09);
    }
  }

  // Mix: the music fades in briefly and out over the last second, a soft clip, then a safe peak.
  const out = new Float32Array(length);
  const fadeIn = 0.03 * SAMPLE_RATE;
  const fadeOut = Math.min(1.2, seconds / 3) * SAMPLE_RATE;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const gain = Math.min(1, i / fadeIn) * Math.min(1, (length - i) / fadeOut);
    const x = Math.tanh((music.data[i]! * 0.8 * gain + fx.data[i]! * Math.min(1, (length - i) / (0.05 * SAMPLE_RATE))) * 1.3) / Math.tanh(1.3);
    out[i] = x;
    peak = Math.max(peak, Math.abs(x));
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < length; i++) out[i]! *= norm;
  return out;
}

/** 16-bit PCM WAV of mono samples. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), true);
  return new Uint8Array(buffer);
}

/** The Reel's soundtrack as a WAV file, or null without music. */
export function soundtrackWav(props: TimedProps): Uint8Array | null {
  if (!props.music || props.music.muted) return null;
  return encodeWav(synthesize(props.music, props.durationInFrames / props.fps, soundCues(props)));
}

/** A short key naming one soundtrack (style, tempo, seed, effects, and where they fall): the same sound is made once. */
export function soundtrackKey(props: TimedProps): string | null {
  if (!props.music || props.music.muted) return null;
  const text = JSON.stringify([props.music, props.durationInFrames, soundCues(props).map((c) => [c.kind, Math.round(c.at * 100)])]);
  return `${hash(text)}${hash(`${text}~`)}`;
}
