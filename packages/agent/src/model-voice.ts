import { MIX_CEILING, speechGain } from "./mix.ts";
import type { EditPlan } from "./schemas.ts";
import { skillSettings, skillWordsOf, type MontageSkill, type SkillSaysWords, type SkillTimeline } from "./skills.ts";
import { findVoice, readingVoice, spokenWords, type CopiedVoice, type OwnVoice, type PostVoice, type VoiceSetting } from "./voice-over.ts";
import type { VoiceTranscript } from "./voice.ts";

// A model whose words are what its voice says (« Celui-là, celui-là… »: its original's man's voice scans its words on the
// beats, « Heeeey… Stop! Stop! Stop! This… this… aaand… this »; Tristan: « par défaut voix off et le user peut changer de
// voix »). Its skill declares it (MontageSkill.saysWords) and its timeline says when each word is said (`says`); once her
// plan is built, each distinct word is read once by the voice chosen (ElevenLabs with its timing, in one go: one call,
// one voice, one level), cut out of that reading on its own sound (its breath and its silences left out), levelled like a
// voice, and laid at each of its moments on one track of the Reel's length, exactly when the word lands on screen: the
// plan's voice (subtitles off, its words are on screen), her music under it as under any voice (the voice_over mix). A
// word longer than its moment never runs into the next one: sped up a little, else shortened between two syllables; a
// word said again while it still sounds (a stop word three times in 0,4 s) is left out. What decides, cuts and lays is
// here; the reading, the sandbox and the files are lib/model-voice.ts.

/** The least silence left between two words of its voice (s): each one heard as its own. */
export const SAID_GAP = 0.04;

/** The most its voice is sped up to say a word in its time (pitch kept): beyond, it sounds rushed. */
export const SAID_SPEED_MAX = 1.35;

/** The most moments one Reel's voice says a word. */
const SAID_MAX = 60;

/** A word its voice says on the Reel: its slot, its words, when (s, the Reel's clock), until when it may sound (the next word, or the Reel's end). */
export type SaidCue = { slot: string; text: string; at: number; until: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A word as its voice says it: one line, its spaces plain (a French non-breaking space before « ! » included). */
const spokenText = (text: string) => text.replace(/[\s  ]+/g, " ").trim().slice(0, 80);

/**
 * The words its voice says and when, from its timeline's `says` and her words by slot (a moment's own `text` first):
 * only its said slots, within the Reel (none in its last 0,1 s), in order, each one's room up to the next word (or the
 * Reel's end). `lead`: the Reel's first image held that long (a sound she follows), every moment later by it.
 */
export function saidCues(skill: Pick<MontageSkill, "saysWords">, line: Pick<SkillTimeline, "says">, words: Record<string, string>, duration: number, lead = 0): SaidCue[] {
  const says = skill.saysWords;
  if (!says) return [];
  const cues = (line.says ?? [])
    .flatMap((m) => {
      const text = spokenText(m.text ?? words[m.slot] ?? "");
      const at = round3(m.at + lead);
      return says.slots.includes(m.slot) && /[\p{L}\p{N}]/u.test(text) && Number.isFinite(at) && at >= 0 && at < duration - 0.1 ? [{ slot: m.slot, text, at }] : [];
    })
    .sort((a, b) => a.at - b.at)
    .slice(0, SAID_MAX);
  return cues.map((c, i) => ({ ...c, until: round3(Math.min(duration, cues[i + 1]?.at ?? duration)) }));
}

/**
 * What its voice says on a plan made on it: its timeline for the plan's shots, tempo, ending and settings, with the
 * plan's words (her words changed by hand included), later by the plan's lead. Null when the skill says no words, when
 * another version of it made the plan, when the plan's length is no longer its timeline's (its cut changed), or when
 * her own voice led it (its cuts on her words, MontageSkill.heard: no voice says its words on its beats there).
 */
export function skillSaysOn(skill: MontageSkill, plan: Pick<EditPlan, "skill" | "segments" | "texts" | "tempo" | "end_card" | "beat_at" | "duration">): SaidCue[] | null {
  if (!skill.saysWords || plan.skill?.key !== skill.key || plan.skill.version !== skill.version || plan.skill.heard) return null;
  const lead = plan.beat_at ?? 0;
  const bpm = plan.tempo && Math.abs(plan.tempo - skill.bpm) > 0.005 ? plan.tempo : undefined;
  const settings = skillSettings(skill, plan.skill.settings);
  const words = skillWordsOf(skill, plan.texts);
  const line = skill.timeline(plan.segments.length, { end: Boolean(plan.end_card), ...(bpm ? { bpm } : {}), ...(Object.keys(settings).length ? { settings } : {}), words });
  if (Math.abs(round2(line.duration) + lead - plan.duration) > 1 / 30 + 0.005) return null;
  return saidCues(skill, line, words, plan.duration, lead);
}

/** A short number from a text (FNV-1a), the same each time. */
function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** What a track says: its voice, its words and their moments (to the millisecond). Another key: the track is made again. */
export function saidKey(voiceId: string, cues: Pick<SaidCue, "text" | "at">[]): string {
  const said = JSON.stringify([voiceId, ...cues.map((c) => [c.text, Math.round(c.at * 1000)])]);
  return `${fnv(said, 0x811c9dc5)}${fnv(said, 0x050c5d1f)}`;
}

/**
 * What its voice reads, in one go: each word once, in the order it is first said, each its own sentence (closed by its
 * own punctuation, else a full stop): one call, the same voice and level for all, a silence between two words to cut in.
 */
export function saidReading(cues: Pick<SaidCue, "text">[]): { text: string; words: string[] } {
  const words = [...new Set(cues.map((c) => c.text))];
  return { text: words.map((w) => (/[.!?…]["»]?$/u.test(w) ? w : `${w}.`)).join(" "), words };
}

/**
 * Each word of the reading on ElevenLabs' timing: from its first spoken token to its last (fromTtsAlignment's words, in
 * the reading's order, a word of three tokens taking three). Null when they do not match it.
 */
export function readingSpans(words: string[], transcript: Pick<VoiceTranscript, "words">): { start: number; end: number }[] | null {
  const tokens = transcript.words;
  const spans: { start: number; end: number }[] = [];
  let k = 0;
  for (const w of words) {
    const count = spokenWords(w);
    const mine = tokens.slice(k, k + count);
    if (!count || mine.length < count) return null;
    spans.push({ start: mine[0]!.start, end: Math.max(...mine.map((t) => t.end)) });
    k += count;
  }
  return spans;
}

/** A word of the reading as its voice lays it: where its sound starts and ends in the reading (s), and its dips between two syllables. */
export type SaidSpan = { in: number; out: number; dips: number[] };

/** Its sound: within this many dB of the word's loudest moment. */
const SOUND_DB = 30;
/** Two sounds this close (s) are one word (a plosive's closure, « a-ttends »). */
const WORD_JOIN = 0.15;
/** A quiet sound alone at a word's edge (this many dB under its loudest, apart by SPLIT s at least) is a breath: left out. */
const BREATH_DB = 18;
const SPLIT = 0.06;
/** A dip this many dB under its loudest, between two of its sounds, is where it breathes between two syllables. */
const DIP_DB = 12;

/**
 * Each word of the reading cut to its own sound, on the reading's levels every `step` s (speechLevelsFilter): within half
 * the silence to its neighbours, its sounds within SOUND_DB of its loudest moment, joined across a plosive's closure,
 * a breath alone at its edge left out, a hair kept before its attack and after its release; its dips noted (where it may
 * be shortened without cutting a syllable). Without levels, ElevenLabs' timing with a small margin.
 */
export function saidSpans(aligned: { start: number; end: number }[], levels: number[], step = 0.01): SaidSpan[] {
  const total = levels.length ? levels.length * step : (aligned.at(-1)?.end ?? 0) + 0.5;
  return aligned.map((w, k) => {
    const lo = k ? Math.max(0, (aligned[k - 1]!.end + w.start) / 2) : 0;
    const hi = k + 1 < aligned.length ? Math.max(lo + 0.05, (w.end + aligned[k + 1]!.start) / 2) : total;
    const plain = { in: round3(Math.max(lo, w.start - 0.03)), out: round3(Math.min(hi, w.end + 0.06)), dips: [] };
    if (!levels.length) return plain;
    const from = Math.max(0, Math.floor(lo / step));
    const to = Math.min(levels.length - 1, Math.ceil(hi / step) - 1);
    const at = (i: number) => (Number.isFinite(levels[i]) ? levels[i]! : -120);
    let loudest = from;
    for (let i = from; i <= to; i++) if (at(i) > at(loudest)) loudest = i;
    const peak = at(loudest);
    if (to < from || peak < -70) return plain;
    // Its sounds: runs of windows within SOUND_DB of its loudest.
    const runs: { a: number; b: number; max: number }[] = [];
    for (let i = from; i <= to; i++) {
      if (at(i) < peak - SOUND_DB) continue;
      const last = runs.at(-1);
      if (last && i - last.b <= 1) {
        last.b = i;
        last.max = Math.max(last.max, at(i));
      } else runs.push({ a: i, b: i, max: at(i) });
    }
    const main = runs.findIndex((r) => loudest >= r.a && loudest <= r.b);
    if (main < 0) return plain;
    let first = main;
    let last = main;
    const joins = (gap: number, run: { max: number }) => gap <= WORD_JOIN / step && (run.max >= peak - BREATH_DB || gap < SPLIT / step);
    while (first > 0 && joins(runs[first]!.a - runs[first - 1]!.b, runs[first - 1]!)) first--;
    while (last + 1 < runs.length && joins(runs[last + 1]!.a - runs[last]!.b, runs[last + 1]!)) last++;
    const start = runs[first]!.a * step;
    const end = (runs[last]!.b + 1) * step;
    // Its dips: the quietest window between two of its sounds, far enough under its loudest, away from its edges.
    const dips: number[] = [];
    for (let r = first; r < last; r++) {
      let low = runs[r]!.b;
      for (let i = runs[r]!.b; i <= runs[r + 1]!.a; i++) if (at(i) < at(low)) low = i;
      if (at(low) <= peak - DIP_DB) dips.push(round3((low + 0.5) * step));
    }
    // And within its sounds, the quiet moments between two syllables (a consonant between two vowels).
    for (let i = runs[first]!.a + 5; i <= runs[last]!.b - 5; i++) {
      if (at(i) < peak - SOUND_DB) continue;
      const around = [i - 3, i - 2, i - 1, i + 1, i + 2, i + 3].map(at);
      if (at(i) <= peak - DIP_DB && around.every((v) => v >= at(i)) && Math.max(...around) - at(i) >= 6 && !dips.some((d) => Math.abs(d - (i + 0.5) * step) < 0.08)) dips.push(round3((i + 0.5) * step));
    }
    return { in: round3(Math.max(lo, start - 0.015)), out: round3(Math.min(hi, end + 0.03)), dips: dips.sort((a, b) => a - b) };
  });
}

/**
 * A word laid on the track: its words, its moment (s, the Reel's clock), the part of the reading it plays (s), its speed
 * (1, or a little faster to be said in its time), `cut` when it had to be shortened all the same.
 */
export type SaidPlacement = { text: string; at: number; in: number; out: number; speed: number; cut?: boolean };

/**
 * Each word at its moments: the same word again while it still sounds left out (it rings on through that moment), each
 * one kept within its room (up to the next word laid, SAID_GAP before it, or the Reel's end): sped up to SAID_SPEED_MAX
 * at most, then, still too long, shortened at its last dip between two syllables that leaves most of it (else at its room).
 */
export function saidPlacements(cues: SaidCue[], spans: Record<string, SaidSpan>, duration: number): SaidPlacement[] {
  const kept: { cue: SaidCue; span: SaidSpan }[] = [];
  for (const cue of cues) {
    const span = spans[cue.text];
    if (!span || !(span.out - span.in > 0.02)) continue;
    const prev = kept.at(-1);
    if (prev && prev.cue.text === cue.text && cue.at < prev.cue.at + (prev.span.out - prev.span.in) / SAID_SPEED_MAX + SAID_GAP - 1e-6) continue;
    kept.push({ cue, span });
  }
  // The last one may sound until the last moment's end (the Reel's, or the end its cues were given).
  const end = Math.min(duration, cues.at(-1)?.until ?? duration);
  return kept.map(({ cue, span }, k) => {
    const next = kept[k + 1]?.cue.at ?? end;
    const room = Math.max(0.05, next - SAID_GAP - cue.at);
    const length = span.out - span.in;
    const speed = length > room ? Math.min(SAID_SPEED_MAX, length / room) : 1;
    if (length / speed <= room + 0.005) return { text: cue.text, at: round3(cue.at), in: span.in, out: span.out, speed: round3(speed) };
    const limit = span.in + room * speed;
    const dip = [...span.dips].reverse().find((d) => d <= limit && d >= span.in + 0.5 * length);
    return { text: cue.text, at: round3(cue.at), in: span.in, out: round3(dip ?? limit), speed: round3(speed), cut: true };
  });
}

/** How long a laid word sounds on the Reel (s). */
const sounds = (p: Pick<SaidPlacement, "in" | "out" | "speed">) => (p.out - p.in) / p.speed;

/**
 * The ffmpeg filter graph of its track, from the reading ([0:a]) to [out]: levelled like a voice (`gain` dB, its peaks
 * held under −1 dBFS), each word cut out of it, sped up when it must (its pitch kept), faded in 5 ms and out 30 ms (60 ms
 * when shortened), delayed to its moment to the sample, all mixed on silence for `duration` s, mono 44,1 kHz.
 */
export function saidTrackFilter(placements: SaidPlacement[], options: { gain: number; duration: number }): string {
  const d = options.duration.toFixed(3);
  const limit = `alimiter=limit=${MIX_CEILING}:level=false`;
  if (!placements.length) return `anullsrc=r=44100:cl=mono,atrim=end=${d}[out]`;
  const n = placements.length;
  const head = `[0:a]aformat=sample_rates=44100:channel_layouts=mono${options.gain ? `,volume=${options.gain}dB` : ""}`;
  const split = n > 1 ? `${head},asplit=${n}${placements.map((_, i) => `[w${i}]`).join("")}` : `${head}[w0]`;
  const words = placements.map((p, i) => {
    const fade = p.cut ? 0.06 : 0.03;
    const tempo = Math.abs(p.speed - 1) > 0.001 ? `,atempo=${p.speed.toFixed(3)}` : "";
    return `[w${i}]atrim=start=${p.in.toFixed(3)}:end=${p.out.toFixed(3)},asetpts=PTS-STARTPTS${tempo},afade=t=in:d=0.005,afade=t=out:st=${Math.max(0, sounds(p) - fade).toFixed(3)}:d=${fade},adelay=${Math.round(p.at * 44100)}S:all=1[d${i}]`;
  });
  const mix = n > 1 ? `${placements.map((_, i) => `[d${i}]`).join("")}amix=inputs=${n}:duration=longest:normalize=0,` : "[d0]";
  return [split, ...words, `${mix}apad,atrim=end=${d},${limit}[out]`].join(";");
}

/** Its track's words as a voice's transcript (the Reel's clock, from 0): what the preview ducks the music under, and what the page shows it says. */
export function saidTranscript(placements: SaidPlacement[], duration: number): VoiceTranscript {
  return {
    text: placements.map((p) => p.text).join(" "),
    duration: round2(duration),
    words: placements.map((p) => ({ w: p.text, start: round2(p.at), end: round2(p.at + sounds(p)) })),
    language: "fr",
  };
}

/**
 * The voice that says a model's words on her Reel, or null: none on a model that says none, under a voice of hers laid
 * over it (her voice note, the words she gives a voice to say: one voice at a time), on a Reel that takes the sound of
 * the Reel it copies in Instagram (it replaces the video's own), nor when she took it away (« Sans voix »: this Reel's
 * choice off). Asked for this Reel (« Une voix off ») or for all her Reels (« Sur tous mes Reels »), she has it; else not
 * when her business never wants one (« Jamais »), nor on a Reel she copies that has no voice (what it does not have, hers
 * does not have), nor on a model that does not say them by default. The voice: this Reel's, else her business's, her own
 * clone kept, one of the gender she asked for (« une voix d'homme »), else Edith's default (readingVoice).
 */
export function modelVoiceChoice(p: {
  says: SkillSaysWords | undefined;
  post: PostVoice | null;
  studio: VoiceSetting;
  own: OwnVoice | null;
  gender?: "femme" | "homme" | "libre" | null;
  laid?: boolean;
  keptSound?: boolean;
  /** Who speaks in the Reel she copies, when a model plays her copy of it. */
  copied?: CopiedVoice;
}): string | null {
  if (!p.says || p.laid || p.keptSound || p.post?.mode === "off") return null;
  const asked = p.post?.mode === "on";
  if (!asked && (p.studio.use === "never" || p.copied === "aucune" || !p.says.default)) return null;
  return readingVoice(p.post?.voice_id ?? p.studio.voice_id, p.own, p.gender);
}

/** A voice's name as she reads it: « ta voix » for her clone, the gallery's name, else none. */
export const saidVoiceName = (voiceId: string | null | undefined, ownId?: string | null): string | null =>
  voiceId && ownId && voiceId === ownId ? "ta voix" : (findVoice(voiceId)?.name ?? null);

/** A cost of saying its words, as cost_events keeps it (kind voice, like every voice; its studio and scope added by the caller). */
export type SaidCost = { kind: "voice"; provider: "elevenlabs" | "vercel_sandbox"; units: number; cost_eur: number; meta: Record<string, unknown> };

/** What saying a model's words needs from outside (lib/model-voice.ts: ElevenLabs, the workshop, the database). */
export type SayWordsIO = {
  /** ElevenLabs reads the text with this voice: its audio, its words timed (fromTtsAlignment), the model and voice used. */
  speak: (text: string, voiceId: string) => Promise<{ mp3: Uint8Array; transcript: Pick<VoiceTranscript, "words">; model: string; voiceId: string }>;
  /** The workshop measures the reading, then lays its words with the filter `compose` makes of what it measured. */
  lay: (
    reading: Uint8Array,
    compose: (measured: { lufs: number | null; levels: number[] }) => { filter: string; laid: SaidPlacement[] },
  ) => Promise<{ mp3: Uint8Array; lufs: number | null; laid: SaidPlacement[]; seconds: number }>;
  /** Logs a cost. */
  cost: (row: SaidCost) => Promise<void>;
  /** Keeps the track as an audio of hers (source ai): its media id. */
  keep: (track: { mp3: Uint8Array; transcript: VoiceTranscript; ai: Record<string, unknown> }) => Promise<string>;
};

/**
 * Its words said: read once by the voice (its cost logged by the character as soon as it is read, even when what
 * follows fails), each cut out of the reading on its own sound and laid at its moments on one track of the Reel's length,
 * levelled like a voice (the workshop's seconds logged), kept with its words on the Reel's clock. `prices`: ElevenLabs'
 * dollars by 1 000 characters, their euros, the workshop's euros for its seconds (pricing.ts, the environment).
 */
export async function sayWords(
  io: SayWordsIO,
  input: { cues: SaidCue[]; voiceId: string; duration: number; key: string; prices: { usdPerKchar: number; eur: (usd: number) => number; sandboxEur: (seconds: number) => number } },
): Promise<{ mediaId: string; laid: SaidPlacement[] }> {
  const reading = saidReading(input.cues);
  const started = Date.now();
  const spoken = await io.speak(reading.text, input.voiceId);
  await io.cost({
    kind: "voice",
    provider: "elevenlabs",
    units: reading.text.length,
    cost_eur: input.prices.eur((reading.text.length / 1000) * input.prices.usdPerKchar),
    meta: { purpose: "said_words", model: spoken.model, voice_id: spoken.voiceId, words: reading.words.length, ms: Date.now() - started },
  });
  const aligned = readingSpans(reading.words, spoken.transcript);
  if (!aligned) throw new Error(`said words: its reading's timing does not match its words (${spoken.transcript.words.length} timed for « ${reading.text} »)`);
  const made = await io.lay(spoken.mp3, ({ lufs, levels }) => {
    const spans = saidSpans(aligned, levels);
    const laid = saidPlacements(input.cues, Object.fromEntries(reading.words.map((w, i) => [w, spans[i]!])), input.duration);
    return { filter: saidTrackFilter(laid, { gain: speechGain(lufs) ?? 0, duration: input.duration }), laid };
  });
  await io.cost({ kind: "voice", provider: "vercel_sandbox", units: Math.round(made.seconds), cost_eur: input.prices.sandboxEur(made.seconds), meta: { purpose: "said_words", laid: made.laid.length } });
  if (!made.laid.length) throw new Error("said words: none could be laid");
  const mediaId = await io.keep({
    mp3: made.mp3,
    transcript: saidTranscript(made.laid, input.duration),
    ai: { mode: "said_words", voice_id: spoken.voiceId, model: spoken.model, lufs: made.lufs, key: input.key },
  });
  return { mediaId, laid: made.laid };
}
