import { z } from "zod";

// Her own voice on a Reel: a voice note (WhatsApp or the app) transcribed once,
// word by word with timings (ElevenLabs Scribe), kept on the media
// (media_assets.transcript). The editor cuts on her phrases, the subtitles follow
// her words, and the voice plays in the Reel from VOICE_AT seconds.

export const voiceWordSchema = z.object({ w: z.string(), start: z.number(), end: z.number() });
export type VoiceWord = z.infer<typeof voiceWordSchema>;

export const voiceTranscriptSchema = z.object({
  text: z.string(),
  /** Length of the recording, in seconds. */
  duration: z.number(),
  words: z.array(voiceWordSchema),
  language: z.string().nullable().optional(),
});
export type VoiceTranscript = z.infer<typeof voiceTranscriptSchema>;

/** Where her voice starts in the Reel (a breath before the first word). */
export const VOICE_AT = 0.3;

/** The longest voice note used on a Reel: past it, it would not fit (MAX_REEL_SECONDS with the end card). */
export const VOICE_MAX_SECONDS = 27;

const scribeSchema = z.object({
  text: z.string().catch(""),
  language_code: z.string().nullable().optional(),
  audio_duration_secs: z.number().nullable().optional(),
  words: z
    .array(z.object({ text: z.string(), type: z.string().optional(), start: z.number().nullable().optional(), end: z.number().nullable().optional() }))
    .catch([]),
});

/** ElevenLabs Scribe's answer → her words with their timings (spoken words only, no spaces or sounds). */
export function fromScribe(body: unknown): VoiceTranscript {
  const r = scribeSchema.parse(body);
  const words = r.words
    .filter((w) => (w.type ?? "word") === "word" && w.start != null && w.end != null && w.text.trim())
    .map((w) => ({ w: w.text.trim(), start: round(w.start!), end: round(Math.max(w.end!, w.start!)) }));
  return { text: r.text.trim(), duration: round(r.audio_duration_secs ?? words.at(-1)?.end ?? 0), words, language: r.language_code ?? null };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A pause this long, or a sentence's end, closes a phrase. */
const PHRASE_PAUSE = 0.35;

/**
 * Her phrases with their times in the Reel (the voice starts at `at`): where the
 * editor may cut. A phrase ends on a pause or a full stop.
 */
export function voicePhrases(t: VoiceTranscript, at = VOICE_AT): { text: string; start: number; end: number }[] {
  const phrases: { text: string; start: number; end: number }[] = [];
  let current: VoiceWord[] = [];
  const close = () => {
    if (!current.length) return;
    phrases.push({ text: current.map((w) => w.w).join(" "), start: round(current[0]!.start + at), end: round(current.at(-1)!.end + at) });
    current = [];
  };
  t.words.forEach((w, i) => {
    current.push(w);
    const next = t.words[i + 1];
    if (!next || next.start - w.end >= PHRASE_PAUSE || /[.!?…]$/.test(w.w)) close();
  });
  close();
  return phrases;
}

/** The voice note as the editor reads it: its length, its text and its phrases on the Reel's clock. */
export function voiceForEditor(t: VoiceTranscript, at = VOICE_AT) {
  const used = Math.min(t.duration, VOICE_MAX_SECONDS);
  return {
    starts_at: at,
    ends_at: round(at + used),
    text: t.text,
    phrases: voicePhrases({ ...t, words: t.words.filter((w) => w.end <= used) }, at),
  };
}
