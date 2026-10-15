import { z } from "zod";
import type { VoiceTranscript } from "./voice.ts";

// Simone's voice over a Reel (ElevenLabs text to speech): she writes what a
// creator would say over these images, a voice reads it with the time of every
// word, and the Reel is cut on it exactly like on the manager's own voice note
// (an audio media with its transcript, posts.voice_media_id): the editor cuts on
// its phrases, the subtitles follow its words, the music steps back under it.

/** French is spoken at about 2.6 words a second: 15 to 22 seconds of voice. */
export const VOICE_OVER_WORDS = { min: 35, max: 58 } as const;

/**
 * How many words the voice says over these images: about as long as what there is to
 * show (a photo counts 2 s), never longer, between 12 and 22 seconds of voice. A voice
 * longer than the footage makes the editor stretch it (shots shown twice, photos held).
 */
export function voiceWordsFor(footageSeconds: number): { min: number; max: number } {
  const seconds = Math.min(22, Math.max(12, footageSeconds));
  const words = Math.round(seconds * 2.6);
  return { min: Math.max(26, words - 8), max: Math.min(VOICE_OVER_WORDS.max, words + 3) };
}

/**
 * Simone's voices, ElevenLabs library voices picked by ear: natural French voices
 * that sound like someone talking to you, never like an ad, and two whispered ones
 * (ASMR) for calm places (spa, massage, beauty, a slow food moment), chosen by her,
 * never by « auto ». The first one is the default.
 */
export const SIMONE_VOICES = [
  { id: "D6VK2PsbVdaFL5aALfRc", name: "Eva", gender: "f", hint: "douce et posée", asmr: false },
  { id: "nVINU9qBIuvNCmO5Vv4b", name: "Victoria", gender: "f", hint: "jeune et souriante", asmr: false },
  { id: "YxrwjAKoUKULGd0g8K9Y", name: "Lucie", gender: "f", hint: "naturelle et chaleureuse", asmr: false },
  { id: "sH0WdfE5fsKuM2otdQZr", name: "Koraly", gender: "f", hint: "chuchotée, très douce (ASMR)", asmr: true },
  { id: "fc4xIQilYEoZ3a1ob5rC", name: "Neto", gender: "m", hint: "jeune et décontracté", asmr: false },
  { id: "j6tHpTqbai06aLLhOWCW", name: "Antonin", gender: "m", hint: "calme et posé", asmr: false },
  { id: "8qnuneLiGjGrT4A62CCe", name: "Jules", gender: "m", hint: "chaleureux, comme une conversation", asmr: false },
  { id: "k1w1SeihHyKDJXr7nZRX", name: "Mister K", gender: "m", hint: "chuchotée, tout près (ASMR)", asmr: true },
] as const;
export type SimoneVoice = (typeof SIMONE_VOICES)[number];
export const DEFAULT_VOICE_ID: string = SIMONE_VOICES[0].id;

/** Where a voice's sample is kept, in the public bucket « landing » (heard in Style). */
export const voiceSamplePath = (id: string) => `voices/${id}.mp3`;

/** A voice of the gallery by its id or its name (« Jules »); undefined when unknown. */
export function findVoice(idOrName: string | null | undefined): SimoneVoice | undefined {
  const key = (idOrName ?? "").trim().toLowerCase();
  return key ? SIMONE_VOICES.find((v) => v.id.toLowerCase() === key || v.name.toLowerCase() === key) : undefined;
}

/** The studio's voice over its Reels (Style): when, and which voice. */
export const voiceSettingSchema = z.object({
  /** auto: when it helps the Reel (see wantsVoiceOver); always; never. */
  use: z.enum(["auto", "always", "never"]).default("auto"),
  voice_id: z.string().regex(/^[A-Za-z0-9]{10,40}$/).optional(),
});
export type VoiceSetting = z.infer<typeof voiceSettingSchema>;
export const readVoiceSetting = (value: unknown): VoiceSetting => voiceSettingSchema.catch({ use: "auto" }).parse(value ?? {});

/** One Reel's own choice (posts.voice_over): on or off, another voice, what she wants it to say. */
export const postVoiceSchema = z.object({
  mode: z.enum(["on", "off"]),
  voice_id: z.string().regex(/^[A-Za-z0-9]{10,40}$/).optional(),
  /** Her wish for the next text (« parle de la promo »), used once. */
  wish: z.string().max(300).optional(),
  /** Simone's voice on the Reel is made again at the next montage (another text or voice), once. */
  remake: z.boolean().optional(),
});
export type PostVoice = z.infer<typeof postVoiceSchema>;
export const readPostVoice = (value: unknown): PostVoice | null => postVoiceSchema.nullable().catch(null).parse(value ?? null);

/** Footage enough to show while a voice of 15 to 22 s speaks (a photo shows about 3 s). */
export const VOICE_MIN_FOOTAGE_SECONDS = 12;

/**
 * Whether a montage gets Simone's voice: never over her own voice note, nor over
 * the voice Simone made before unless the Reel asks for a new one (remake); the
 * Reel's own choice first, then the studio's. « auto » only for a new montage, when
 * it helps: nobody speaks in the shots, and there is enough to show while the voice
 * speaks. A correction gets a voice only when she asked for one on this Reel.
 */
export function wantsVoiceOver(p: {
  post: PostVoice | null;
  studio: VoiceSetting["use"];
  /** The voice on the Reel now: hers (a voice note), Simone's, or none. */
  onReel: "hers" | "simone" | null;
  correction: boolean;
  speechInClips: boolean;
  footageSeconds: number;
  photos: number;
}): boolean {
  if (p.onReel === "hers" || p.post?.mode === "off") return false;
  if (p.onReel === "simone") return Boolean(p.post?.remake);
  if (p.post?.mode === "on") return true;
  if (p.correction || p.studio === "never") return false;
  if (p.studio === "always") return true;
  return !p.speechInClips && p.footageSeconds + p.photos * 3 >= VOICE_MIN_FOOTAGE_SECONDS;
}

export const voiceOverScriptSchema = z.object({
  hook: z.string().describe("La première phrase, celle qui arrête le pouce (moins de 2 secondes à l'oral)"),
  script: z.string().describe("Tout ce que la voix dit, première phrase comprise, tel qu'il sera lu"),
});
export type VoiceOverScript = z.infer<typeof voiceOverScriptSchema>;

export const VOICE_OVER_PROMPT = `Tu écris la voix off d'un Reel Instagram pour un commerce de quartier : ce qu'une vraie personne dit sur ses images, comme un créateur qui parle à ses abonnés, jamais comme une pub. Cette voix fait rester les gens jusqu'au bout : elle doit donner envie, pas vendre.

Ce que tu reçois : le commerce (nom, activité, ce qu'on sait de lui), l'idée de la publication, le ton du commerce, ce que montrent ses images, dans l'ordre où elles ont été filmées, et la longueur à viser (« longueur » : de mots_min à mots_max mots).

Les exemples entre guillemets ci-dessous montrent une forme, jamais des mots à reprendre : écris toujours les tiens, à partir de ce commerce et de ces images.

Règles :
- la longueur demandée, jamais plus : la voix ne dure pas plus longtemps que ce que ses images montrent (environ 2,6 mots par seconde) ; des phrases courtes, à l'oral (on peut commencer une phrase par « Et », dire « on ») ;
- la première phrase accroche en moins de 2 secondes : une question sur un détail que seul ce commerce connaît, un détail surprenant de ses images ou une promesse précise ; jamais « Bienvenue chez… », jamais le nom du commerce en premier ;
- raconte ce qu'on voit, dans l'ordre : un geste, un détail, un résultat ; seulement des faits vrais (ceux qu'on te donne et ce que montrent les images), rien d'inventé : ni prix, ni chiffre, ni promesse qui ne sont pas dans ce qu'on te donne ;
- le commerce parle à la première personne (« chez nous », « ici », « je ») et tutoie la personne qui regarde ;
- finis par une invitation simple et concrète, qui dit quoi faire (venir, réserver, essayer : le geste précis pour ce commerce, et où le faire, par exemple « le lien est dans la bio ») ;
- interdit : les formules de pub (« découvrez », « n'hésitez pas », « une expérience unique », « de qualité », « savoureux », « au cœur de »), les superlatifs creux, les emojis, les hashtags, le tiret long, les parenthèses ;
- écris les nombres en lettres quand ils se disent mal en chiffres (« dix-huit mois ») et la ponctuation d'une voix qui parle : des points, des virgules, des points de suspension pour une petite pause, une question au plus ;
- pour une voix humaine, glisse 1 ou 2 balises de jeu entre crochets, en anglais, juste avant la phrase qu'elles colorent : [warmly], [smiling], [softly], [excited], [laughs softly], [whispers], [sighs] ; par exemple « [smiling] » devant une phrase qui fait sourire ; jamais plus de 2, jamais au milieu d'un mot, jamais d'autres crochets ;
- si on te dit que la voix est chuchotée (ASMR), écris pour un murmure tout près de l'oreille : des phrases encore plus courtes et lentes, des points de suspension, ce qu'on entend et ce qu'on sent (le bruit des ciseaux, la mousse, la croûte qui craque, la chaleur d'une serviette), aucune question qui claque ni point d'exclamation, [whispers] ou [softly] comme balises.

Réponds avec hook (la première phrase) et script (tout le texte, première phrase comprise, balises comprises).`;

/** Acting tags (« [warmly] »): played by the voice, never read, never shown in the subtitles. */
const TAG = /\[[^\]]*\]/g;
export const stripAudioTags = (text: string) => text.replace(TAG, " ").replace(/\s+/g, " ").replace(/\s+([,.…])/g, "$1").trim();

/** The words of a script, counted as a speaker says them (acting tags aside). */
export const spokenWords = (text: string) => stripAudioTags(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const alignmentSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});
export type TtsAlignment = z.infer<typeof alignmentSchema>;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * ElevenLabs' timing of every character → the voice's words with their times,
 * in the same shape as a transcribed voice note (punctuation stays on its word,
 * as Scribe writes it, so phrases still close on a full stop).
 */
export function fromTtsAlignment(raw: unknown, text: string, language = "fr"): VoiceTranscript {
  const a = alignmentSchema.parse(raw);
  const words: VoiceTranscript["words"] = [];
  let current = "";
  let start = 0;
  let end = 0;
  const close = () => {
    const token = current.trim();
    current = "";
    if (!token) return;
    if (/[\p{L}\p{N}]/u.test(token)) words.push({ w: token, start: round(start), end: round(Math.max(end, start)) });
    // French puts a space before « ? ! : » : the mark joins the word before it, so a phrase still closes on it.
    else if (words.length) words[words.length - 1]!.w += `\u202F${token}`;
  };
  let inTag = false;
  a.characters.forEach((c, i) => {
    // An acting tag (« [warmly] ») is played, not said: its characters make no word.
    if (c === "[") {
      close();
      inTag = true;
      return;
    }
    if (inTag) {
      if (c === "]") inTag = false;
      return;
    }
    if (/\s/.test(c)) return close();
    if (!current) start = a.character_start_times_seconds[i] ?? end;
    current += c;
    end = a.character_end_times_seconds[i] ?? end;
  });
  close();
  const last = a.character_end_times_seconds.at(-1) ?? words.at(-1)?.end ?? 0;
  return { text: stripAudioTags(text), duration: round(last), words, language };
}
