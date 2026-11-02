// Light sound effects, the way a creator punctuates a Reel: a pop when a card lands, a
// whoosh on a fast change, a click on a list item. Who places them is the AI (the
// motion designer for what its animations do, the editor for its cuts and texts, the
// reading of a copied Reel for what its model plays); what this file does is structural
// only: how far apart they may fall, never under speech when light, and how loud each
// one is, from measures. Each sound is made once (ElevenLabs Sound Effects) and kept in
// a library shared by every business (lib/render/sfx.ts), measured once: its loudness
// (the loudest 400 ms, EBU R128 momentary), its peak, where its attack starts and where
// it fades out, so it lands on the frame of what it punctuates and sits at its level.

import type { EditPlan, SfxCue, SfxLevel } from "./schemas.ts";
import { isMotionSegment } from "./schemas.ts";
import type { MixCase } from "./mix.ts";

/** A sound's length when its writer gives none (s). */
export const SFX_DEFAULT_SECONDS = 1;

/** The most distinct sounds one Reel may ask the library for (a new one costs about a cent). */
export const SFX_MAX_NEW = 8;

/** What the level means: how far apart (s), how many per second at most, the cap, under speech (dB more, or never), and the loudness aimed at by mix. */
export const SFX_RULES: Record<Exclude<SfxLevel, "off">, { gap: number; perSecond: number; max: number; underSpeech: number | null; target: Record<MixCase, number> }> = {
  // About 8 LU under the music, 10 under a voice: heard, never on top.
  // Measured on a test mix (music at -14 LUFS): the Reel's loudness moves 0.1 LU, its peaks stay far under -1 dBFS.
  light: { gap: 1.5, perSecond: 1 / 2.5, max: 6, underSpeech: null, target: { music: -20, voice_over: -23, speech_in_clips: -20 } },
  // Present like a creator who punctuates everything, still under the voice.
  more: { gap: 0.35, perSecond: 1 / 1.2, max: 14, underSpeech: -8, target: { music: -16, voice_over: -20, speech_in_clips: -17 } },
};

/** A sound's peak after its gain (dBFS): the mix's limiter (-1 dBFS) never has to squash it. */
export const SFX_PEAK = -4;

/** Its edges: a fade in of 5 ms and out of 40 ms (no click), 3 s at most. */
export const SFX_EDGE = { fadeIn: 0.005, fadeOut: 0.04, max: 3 };

/** How far an editor's sound is pulled onto the cut or text it was meant for (the engine snaps cuts on the beat afterwards). */
export const SFX_SNAP = 0.3;

/** What the library knows of a sound, measured once. */
export type SoundFacts = {
  /** Its loudest 400 ms (LUFS, momentary); null when not measured. */
  lufs: number | null;
  /** Its sample peak (dBFS); null when not measured. */
  peak: number | null;
  /** Where its attack starts in the file (s): it is trimmed there, so it lands on its frame. */
  onset: number;
  /** Where it has faded out in the file (s). */
  end: number;
  /** Where it is loudest in the file (s): that moment lands on what it punctuates (a whoosh builds up to the cut). Absent: its onset. */
  hit?: number;
};

/** The longest build-up a sound may have before its loudest moment (s). */
export const SFX_LEAD_MAX = 0.6;

/** A sound placed on the Reel: its library key, when the part of its file played starts (s), its gain (dB) and that part (s in the file). */
export type SoundPlacement = { key: string; at: number; gain: number; onset: number; end: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A sound's length as the library keeps it (half seconds, 0.5 to 3). */
export const soundSeconds = (seconds?: number) => clamp(Math.round((seconds ?? SFX_DEFAULT_SECONDS) * 2) / 2, 0.5, 3);

/** Its words as the library's key: lower case, plain letters, single spaces, its length after « @ ». */
export function soundKey(sound: string, seconds?: number): string {
  const words = sound
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
  return `${words}@${soundSeconds(seconds)}`;
}

/**
 * Every sound a plan asks for, on the Reel's clock, in order: each animation's from its own start
 * (`starts`, the start and length of each segment, from planTimeline), the editor's pulled onto the
 * cut or the text it was meant for when one is near (its cuts are snapped on the beat after it writes).
 */
export function planCues(
  plan: Pick<EditPlan, "segments" | "texts" | "layers" | "sounds" | "duration">,
  starts: { start: number; length: number }[],
): (SfxCue & { key: string; from: "animation" | "editor" })[] {
  const events = [...starts.map((s) => s.start).filter((t) => t > 0), ...plan.texts.map((t) => t.from)];
  const snap = (at: number) => {
    const near = events.reduce((best, t) => (Math.abs(t - at) < Math.abs(best - at) ? t : best), Number.POSITIVE_INFINITY);
    return Math.abs(near - at) <= SFX_SNAP ? near : at;
  };
  const cues: (SfxCue & { key: string; from: "animation" | "editor" })[] = [];
  const add = (c: SfxCue, at: number, from: "animation" | "editor") => {
    if (!c.sound?.trim() || !Number.isFinite(at)) return;
    const key = soundKey(c.sound, c.seconds);
    if (key.startsWith("@")) return;
    cues.push({ at: round3(at), sound: c.sound.trim(), seconds: soundSeconds(c.seconds), key, from });
  };
  for (const c of plan.sounds ?? []) add(c, snap(c.at), "editor");
  plan.segments.forEach((s, i) => {
    const span = starts[i];
    if (!isMotionSegment(s) || !span) return;
    for (const c of s.motion.sounds ?? []) if (c.at < span.length) add(c, span.start + c.at, "animation");
  });
  for (const l of plan.layers ?? []) for (const c of l.motion.sounds ?? []) if (l.from + c.at < l.to) add(c, l.from + c.at, "animation");
  return cues.filter((c) => c.at >= 0 && c.at < plan.duration - 0.15).sort((a, b) => a.at - b.at);
}

/**
 * The cues kept at a level, in order: far enough apart, a few per second at most, none while
 * someone speaks when light (`speech`: spans in seconds); `under` marks one kept under speech.
 */
export function pickCues<C extends { at: number }>(cues: C[], options: { level: SfxLevel; duration: number; speech: [number, number][] }): (C & { under: boolean })[] {
  if (options.level === "off") return [];
  const rules = SFX_RULES[options.level];
  const cap = Math.min(rules.max, Math.max(1, Math.round(options.duration * rules.perSecond)));
  const kept: (C & { under: boolean })[] = [];
  for (const cue of [...cues].sort((a, b) => a.at - b.at)) {
    if (kept.length >= cap) break;
    const under = options.speech.some(([from, to]) => cue.at >= from - 0.15 && cue.at <= to + 0.15);
    if (under && rules.underSpeech === null) continue;
    const last = kept.at(-1);
    if (last && cue.at - last.at < rules.gap) continue;
    kept.push({ ...cue, under });
  }
  return kept;
}

/** The gain (dB) that sets a sound at its level in a mix: its loudest 400 ms on the target, its peak under SFX_PEAK. */
export function sfxGain(facts: Pick<SoundFacts, "lufs" | "peak">, mix: MixCase, level: Exclude<SfxLevel, "off">, under = false): number {
  const rules = SFX_RULES[level];
  const target = rules.target[mix] + (under ? (rules.underSpeech ?? 0) : 0);
  let gain = target - (facts.lufs !== null && Number.isFinite(facts.lufs) ? facts.lufs : -16);
  if (facts.peak !== null && Number.isFinite(facts.peak)) gain = Math.min(gain, SFX_PEAK - facts.peak);
  return round1(clamp(gain, -40, 12));
}

/**
 * The sounds of a Reel as they are mixed (and played by the live preview): its cues picked at its
 * level, each one the library has, at its gain for the mix, its attack on its moment.
 */
export function placeSounds(
  cues: { at: number; key: string }[],
  options: { level: SfxLevel; mix: MixCase; duration: number; speech: [number, number][]; library: Record<string, SoundFacts> },
): SoundPlacement[] {
  if (options.level === "off") return [];
  const level = options.level;
  const known = cues.filter((c) => options.library[c.key]);
  return pickCues(known, { level, duration: options.duration, speech: options.speech }).map((c) => {
    const facts = options.library[c.key]!;
    // Its loudest moment on the event: it starts that much before (a build-up cut short at the Reel's start).
    const lead = clamp((facts.hit ?? facts.onset) - facts.onset, 0, SFX_LEAD_MAX);
    const start = c.at - lead;
    const onset = facts.onset + Math.max(0, -start);
    const at = Math.max(0, start);
    const end = Math.min(facts.end, onset + SFX_EDGE.max, onset + Math.max(0.05, options.duration - at));
    return { key: c.key, at: round3(at), gain: sfxGain(facts, options.mix, level, c.under), onset: round3(onset), end: round3(Math.max(onset + 0.05, end)) };
  });
}

/** The ffmpeg filter that prints a sound's level (RMS, dB) every `step` seconds. */
export const soundLevelsFilter = (step: number) =>
  `aresample=16000,asetnsamples=n=${Math.round(16000 * step)}:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level`;

/** Where a sound starts, is loudest and has faded, from its levels every `step` s: 24 dB under its loudest, its loudest, 45 dB under it. */
export function soundSpan(levels: number[], step: number): { onset: number; end: number; hit: number } {
  const usable = levels.map((l) => (Number.isFinite(l) ? l : -120));
  const loudest = Math.max(-120, ...usable);
  if (loudest <= -90) return { onset: 0, end: round3(usable.length * step), hit: 0 };
  const first = usable.findIndex((l) => l >= loudest - 24);
  const peak = usable.indexOf(loudest);
  let last = usable.length - 1;
  while (last > first && usable[last]! < loudest - 45) last--;
  const onset = Math.max(0, first * step - 0.005);
  const end = Math.min(usable.length * step, (last + 1) * step + 0.05);
  return { onset: round3(onset), end: round3(Math.min(end, onset + SFX_EDGE.max)), hit: round3(peak * step) };
}

/** The loudest momentary loudness and the sample peak in ffmpeg's ebur128 output (null when absent). */
export function soundLoudness(output: string): { lufs: number | null; peak: number | null } {
  const momentary = [...output.matchAll(/\bM:\s*(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n > -70);
  const peaks = [...output.matchAll(/Peak:\s*(-?\d+(?:\.\d+)?|-inf)\s*dBFS/g)].map((m) => Number(m[1]));
  const peak = peaks.length && Number.isFinite(peaks.at(-1)) ? peaks.at(-1)! : null;
  return { lufs: momentary.length ? Math.max(...momentary) : null, peak };
}

/** For the writers of the sounds (the motion designer, the editor): how to place them, in English. */
export const SFX_PROMPT =
  "Sound effects: you may add light ones, each { at, sound, seconds }: sound is a short, generic English description of one sound " +
  "(« soft pop », « paper whoosh », « light click », « camera shutter », « marker squeak », « bubble pop », « glass clink »), seconds its length (0.5 to 2). " +
  "Only on something the viewer sees happen and would expect to hear: an element landing, a card flipping, a word slamming, a fast swipe. " +
  "Never one per element, never a bed of sound under everything, never under someone speaking; fewer is better, a quiet Reel has none. " +
  "Reuse a name from ready_sounds when one fits (it is already made). The engine levels them under the music and the voice.";
