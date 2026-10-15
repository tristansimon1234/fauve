import { z } from "zod";
import type { VoiceTranscript } from "./voice.ts";

// Simone's voice over a Reel (ElevenLabs text to speech): she writes what a
// creator would say over these images, a voice reads it with the time of every
// word, and the Reel is cut on it exactly like on the manager's own voice note
// (an audio media with its transcript, posts.voice_media_id): the editor cuts on
// its phrases, the subtitles follow its words, the music steps back under it.

/** French is spoken at about 2.6 words a second: 15 to 22 seconds of voice. */
export const VOICE_OVER_WORDS = { min: 35, max: 58 } as const;

export const voiceOverScriptSchema = z.object({
  hook: z.string().describe("La première phrase, celle qui arrête le pouce (moins de 2 secondes à l'oral)"),
  script: z.string().describe("Tout ce que la voix dit, première phrase comprise, tel qu'il sera lu"),
});
export type VoiceOverScript = z.infer<typeof voiceOverScriptSchema>;

export const VOICE_OVER_PROMPT = `Tu écris la voix off d'un Reel Instagram pour un commerce de quartier : ce qu'une vraie personne dit sur ses images, comme un créateur qui parle à ses abonnés, jamais comme une pub. Cette voix fait rester les gens jusqu'au bout : elle doit donner envie, pas vendre.

Ce que tu reçois : le commerce (nom, activité, ce qu'on sait de lui), l'idée de la publication, le ton du commerce, et ce que montrent ses images, dans l'ordre où elles ont été filmées.

Règles :
- 15 à 22 secondes à l'oral : ${VOICE_OVER_WORDS.min} à ${VOICE_OVER_WORDS.max} mots, des phrases courtes, à l'oral (on peut commencer une phrase par « Et », dire « on ») ;
- la première phrase accroche en moins de 2 secondes : une question qui intrigue, un détail surprenant ou une promesse précise (« Tu sais pourquoi notre pâte repose quarante-huit heures ? ») ; jamais « Bienvenue chez… », jamais le nom du commerce en premier ;
- raconte ce qu'on voit, dans l'ordre : un geste, un détail, un résultat ; seulement des faits vrais (ceux qu'on te donne et ce que montrent les images), rien d'inventé : ni prix, ni chiffre, ni promesse qui ne sont pas dans ce qu'on te donne ;
- le commerce parle à la première personne (« chez nous », « ici », « je ») et tutoie la personne qui regarde ;
- finis par une invitation simple et concrète, qui dit quoi faire (« Viens goûter ce soir, le lien est dans la bio. ») ;
- interdit : les formules de pub (« découvrez », « n'hésitez pas », « une expérience unique », « de qualité », « savoureux », « au cœur de »), les superlatifs creux, les emojis, les hashtags, le tiret long, les parenthèses ;
- écris les nombres en lettres quand ils se disent mal en chiffres (« quarante-huit heures ») et la ponctuation d'une voix qui parle : des points, des virgules, des points de suspension pour une petite pause, une question au plus ;
- pour une voix humaine, glisse 1 ou 2 balises de jeu entre crochets, en anglais, juste avant la phrase qu'elles colorent : [warmly], [smiling], [softly], [excited], [laughs softly], [whispers], [sighs] ; par exemple « [smiling] Cette pizza, on l'a commencée avant-hier. » ; jamais plus de 2, jamais au milieu d'un mot, jamais d'autres crochets.

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
