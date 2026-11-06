import type { ClipAnalysis, ClipSpeech, EditPlan } from "./schemas.ts";
import { hasSpeech, isFiller, splitFillers } from "./speech.ts";
import { fitWords, skillTalk, TALK_MAX_SECONDS, type MontageSkill, type SkillFillAnswer, type SkillHeard, type SkillTalk } from "./skills.ts";
import type { VoiceTranscript, VoiceWord } from "./voice.ts";

// Her own recorded voice leading a model whose words are what its voice says (« Celui-là, celui-là… » v3; Tristan, on
// the voice that says the model's words: « Et on pourrait pas partir d'une voix d'un vocal aussi ou du son d'une
// vidéo ? », then « La voix je pensais plus à qq qui parle face cam ou qui enregistre sa propre voix, pourquoi on peut
// pas jouer celle-là ? »). Never her recording cut into words laid on the beats (a word cut out of a sentence keeps the
// next one's attack and the breath before it: it sounds choppy): her recording plays whole, as a creator cuts a voice
// (the silence before her first word and after her last trimmed, her « euh », false starts and long pauses cut by
// speechCuts, as everywhere: ownTalk), and the model follows it: its filler finds in what she says each of its said
// words (its opening words, its stop word, its word pointed at each product, its last word: « sa_voix », readHeard),
// its timeline cuts its shots on them and shows each of its words when she says it, written as she says it
// (MontageSkill.heard). What she says that does not make the model (she points at nothing one by one, says something
// else, longer than it plays): her voice is laid over it as any voice, with its subtitles (« Une voix sur un modèle »).
// Her voice is her voice note, or the sound of one of her videos where she speaks, taken once in the workshop and kept
// as an audio of hers (videoVoice). What decides and cuts is here; the workshop, the files and the database are
// apps/web/src/lib/own-voice.ts.

const round = (n: number) => Math.round(n * 100) / 100;

/** A silence this long between two of her words (s) is a pause, as the workshop's silencedetect finds them (d=0.25). */
const PAUSE_MIN = 0.25;

/**
 * The pauses of her recording read on her words' own times (Scribe's, her hesitations included): each silence of
 * PAUSE_MIN at least between two of them, before her first one and after her last (a voice note's silences are not
 * measured: its words are timed to the hundredth, which speechCuts needs).
 */
export function gapPauses(tokens: Pick<VoiceWord, "start" | "end">[], duration: number): { start: number; end: number }[] {
  const sorted = tokens.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start).sort((a, b) => a.start - b.start);
  const pauses: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const w of sorted) {
    if (w.start - cursor >= PAUSE_MIN) pauses.push({ start: round(cursor), end: round(w.start) });
    cursor = Math.max(cursor, w.end);
  }
  if (duration - cursor >= PAUSE_MIN) pauses.push({ start: round(cursor), end: round(duration) });
  return pauses.slice(0, 300);
}

/**
 * Her recording cut as a creator cuts a voice (skillTalk, the engine's cut of her filmed talk: from just before her first
 * word to just after her last, her « euh », false starts and long pauses out, speechCuts, a breath kept), its pieces and
 * her words on her talk's clock, `max` s at most (cut after the last word that fits). Null when she says fewer than three
 * words. Her words are her transcript's (Scribe reads a voice note verbatim: her hesitations among them, set apart here).
 */
export function ownTalk(mediaId: string, transcript: Pick<VoiceTranscript, "words" | "duration">, max = TALK_MAX_SECONDS): SkillTalk | null {
  const tokens = transcript.words.filter((w) => w.w.trim() && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start && w.start >= 0);
  const seconds = Math.max(transcript.duration || 0, ...tokens.map((w) => w.end));
  if (!(seconds > 0)) return null;
  const { words, fillers } = splitFillers(tokens);
  const speech: ClipSpeech = { source: "scribe", cleaned: false, floor: null, fillers: fillers.slice(0, 200), pauses: gapPauses(tokens, seconds) };
  return skillTalk({ clip: mediaId, seconds, words, speech }, { max });
}

/** Her last word on screen holds this long at least from when she says it (s): the model's own last word holds 0,93 s. */
export const HEARD_HOLD = 1;
/** An ending card's time after it (s): the engine's card lasts 1,6 s. */
export const HEARD_CARD = 1.65;

/**
 * Whether her own voice may lead this model, before its filler reads what she says (null: it may), else why not:
 * « model », it takes no voice of hers as its words (MontageSkill.heard, SkillSaysWords.hers); « words », fewer than three
 * words of hers; « long », longer than a Reel plays (45 s, her last word's hold and its ending card in it). `talk`: her
 * recording cut without a limit (ownTalk with Infinity). Her voice is laid over the model then, as any voice.
 */
export function ownLeadMiss(skill: Pick<MontageSkill, "saysWords" | "heard">, talk: Pick<SkillTalk, "duration"> | null, options: { end?: boolean } = {}): "model" | "words" | "long" | null {
  if (!skill.saysWords?.hers || !skill.heard) return "model";
  if (!talk) return "words";
  return talk.duration + HEARD_HOLD + (options.end ? HEARD_CARD : 0) > TALK_MAX_SECONDS + 0.005 ? "long" : null;
}

/** A word of hers for one of the model's slots this many of her words long at most (« et voilà toute la série »). */
const HEARD_WORDS = 6;

/**
 * What her filler found of the model's words in what she says (« sa_voix »), read against her words: every number one of
 * hers, each run of her words in order and never overlapping the one before it, six words at most, of one of its said
 * slots, written as the filler wrote it (her own words when it wrote none) within its slot's most characters, as many
 * times as its slot takes at most (the first ones); null when it says her words are not the model's (« suit » false), or
 * when she says one of them fewer times than the model needs (its products pointed at: three at least).
 */
export function readHeard(skill: Pick<MontageSkill, "saysWords" | "texts">, talk: Pick<SkillTalk, "words" | "duration">, answer: SkillFillAnswer["sa_voix"]): SkillHeard | null {
  const says = skill.saysWords;
  const counts = says?.hers?.counts;
  const n = talk.words.length;
  if (!says || !counts || !answer?.suit || !n) return null;
  const index = (k: unknown) => (typeof k === "number" && Number.isFinite(k) && k >= 0 && k <= n - 1 + 0.5 ? Math.round(k) : null);
  const max = (slot: string) => skill.texts.find((t) => t.slot === slot)?.max ?? 16;
  const plain = (from: number, to: number) => talk.words.slice(from, to + 1).map((w) => w.w).join(" ");
  const words: SkillHeard["words"] = [];
  let last = -1;
  for (const m of [...(answer.mots ?? [])].sort((a, b) => (index(a.from) ?? 0) - (index(b.from) ?? 0))) {
    if (!says.slots.includes(m.slot)) continue;
    const from = index(m.from);
    const to = index(m.to);
    if (from === null || to === null || to < from || from <= last || to - from >= HEARD_WORDS) continue;
    if (words.filter((w) => w.slot === m.slot).length >= (counts[m.slot]?.[1] ?? 1)) continue;
    const text = fitWords(m.text ?? "", max(m.slot)) || fitWords(plain(from, to), max(m.slot));
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    words.push({ slot: m.slot, text, at: talk.words[from]!.start, end: talk.words[to]!.end });
    last = to;
  }
  for (const slot of says.slots) if (words.filter((w) => w.slot === slot).length < (counts[slot]?.[0] ?? 0)) return null;
  return words.length ? { words, duration: talk.duration } : null;
}

/** A short number from a text (FNV-1a), the same each time. */
function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** What her voice on the Reel plays (plan.voice_leads.key): her recording, its pieces, where her talk starts. Another key: its track is made again. */
export function ownVoiceKey(source: string, talk: Pick<SkillTalk, "pieces">, lead: number): string {
  const played = JSON.stringify([source, Math.round(lead * 1000), ...talk.pieces.map((p) => [Math.round(p.in * 1000), Math.round(p.out * 1000)])]);
  return `${fnv(played, 0x811c9dc5)}${fnv(played, 0x050c5d1f)}`;
}

/**
 * How her recording plays on the Reel: whole from `at` (s on the Reel's clock: her talk `lead` in, the silence before her
 * first word cut) when nothing inside her words is cut (one piece); else on a track of its own made once in the workshop
 * (her pieces one after the other from `lead`, ownTrackFilter), heard from the Reel's first image.
 */
export function ownVoicePlay(talk: Pick<SkillTalk, "pieces">, lead: number): { track: false; at: number } | { track: true } {
  const at = round(lead - (talk.pieces[0]?.in ?? 0));
  return talk.pieces.length === 1 && at >= -30 ? { track: false, at } : { track: true };
}

/** Each edge of a cut in her voice fades over this (s): a raw cut clicks, or chops a breath. */
const EDGE_FADE = 0.012;

/**
 * The ffmpeg filter graph of her voice's track, from her recording ([0:a]) to [out]: each of her pieces cut out of it in
 * order (its edges faded over 12 ms), one after the other, `lead` s of silence before them, padded or cut to the Reel's
 * `duration`, mono 44,1 kHz (the mix brings it to the level of a voice, as any voice).
 */
export function ownTrackFilter(pieces: Pick<SkillTalk["pieces"][number], "in" | "out">[], options: { lead: number; duration: number }): string {
  const s = (x: number) => Math.max(0, x).toFixed(3);
  const n = pieces.length;
  if (!n) return `anullsrc=r=44100:cl=mono,atrim=end=${s(options.duration)}[out]`;
  const head = `[0:a]aformat=sample_rates=44100:channel_layouts=mono${n > 1 ? `,asplit=${n}${pieces.map((_, i) => `[a${i}]`).join("")}` : "[a0]"}`;
  const cut = pieces.map(
    (p, i) => `[a${i}]atrim=start=${s(p.in)}:end=${s(p.out)},asetpts=N/SR/TB,afade=t=in:st=0:d=${s(EDGE_FADE)},afade=t=out:st=${s(p.out - p.in - EDGE_FADE)}:d=${s(EDGE_FADE)}[p${i}]`,
  );
  const delay = options.lead > 0.0005 ? `,adelay=${Math.round(options.lead * 44100)}S:all=1` : "";
  return [head, ...cut, `${pieces.map((_, i) => `[p${i}]`).join("")}concat=n=${n}:v=0:a=1${delay},apad,atrim=end=${s(options.duration)}[out]`].join(";");
}

/** Her words on her track's clock (from the Reel's first image): what the preview ducks the music under, and what the page shows. */
export function ownTrackTranscript(talk: Pick<SkillTalk, "words" | "duration">, lead: number): VoiceTranscript {
  return {
    text: talk.words.map((w) => w.w).join(" "),
    duration: round(talk.duration + lead),
    words: talk.words.map((w) => ({ w: w.w, start: round(w.start + lead), end: round(w.end + lead) })),
    language: "fr",
  };
}

/** What a correction keeps of a Reel her voice led: her words on screen, in the order she says them (its filler keeps them but what her request changes). */
export const heardCurrent = (plan: Pick<EditPlan, "skill" | "texts">): string[] | undefined => (plan.skill?.heard ? plan.texts.map((t) => t.text) : undefined);

/** Before her first word and after her last in one of her videos (s): a breath, as a voice note opens and ends. */
const VIDEO_LEAD = 0.3;
const VIDEO_TAIL = 0.5;

/**
 * The part of one of her videos where she speaks, to take as her voice (« prends ma voix de la vidéo où je parle »): from
 * just before her first word to just after her last (s of the video); and, when her speech was read by Scribe, her words
 * on that recording's clock, her hesitations back among them (a voice note's transcript is verbatim, as Scribe reads it:
 * the engine sets them apart again), that video marked (VoiceTranscript.video); else none (Scribe reads the recording once
 * it is taken). Null when nobody speaks in it.
 */
export function videoVoice(analysis: Pick<ClipAnalysis, "duration" | "words" | "speech" | "transcript">, videoId: string): { from: number; to: number; transcript: VoiceTranscript | null } | null {
  if (!hasSpeech(analysis)) return null;
  const valid = (w: VoiceWord) => w.w.trim() && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start && w.start >= 0 && w.end <= analysis.duration + 0.05;
  const tokens = [...(analysis.words ?? []), ...(analysis.speech?.fillers ?? [])].filter(valid).sort((a, b) => a.start - b.start);
  // Its words not timed (an old reading): all of it, read by Scribe once taken.
  if (!tokens.length) return { from: 0, to: round(analysis.duration), transcript: null };
  const from = round(Math.max(0, tokens[0]!.start - VIDEO_LEAD));
  const to = round(Math.min(analysis.duration, tokens.at(-1)!.end + VIDEO_TAIL));
  if (analysis.speech?.source !== "scribe") return { from, to, transcript: null };
  return {
    from,
    to,
    transcript: {
      text: tokens.filter((w) => !isFiller(w.w)).map((w) => w.w).join(" "),
      duration: round(to - from),
      words: tokens.map((w) => ({ w: w.w, start: round(Math.max(0, w.start - from)), end: round(Math.max(0, w.end - from)) })),
      language: null,
      video: { media_id: videoId, from },
    },
  };
}

/**
 * Her files a montage shows when her voice is taken from one of them (VoiceTranscript.video): all but that video, where
 * her lips would not follow her voice laid elsewhere, unless it is her only file (the Reel needs images).
 */
export function withoutVoiceVideo(mediaIds: string[], voiceVideo: string | null | undefined): string[] {
  if (!voiceVideo) return mediaIds;
  const rest = mediaIds.filter((id) => id !== voiceVideo);
  return rest.length ? rest : mediaIds;
}
