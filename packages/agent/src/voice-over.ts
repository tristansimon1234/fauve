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

/** Who speaks in a Reel she copies (its reading, « Steal »). */
export type CopiedVoice = "voix off" | "quelqu'un parle" | "aucune";

type VoiceChoice = {
  post: PostVoice | null;
  studio: VoiceSetting["use"];
  /** The voice on the Reel now: hers (a voice note), Simone's, or none. */
  onReel: "hers" | "simone" | null;
  correction: boolean;
};

/** Simone decides (« auto »): a new montage, no voice on the Reel yet, no choice for it, her setting « auto ». */
export const voiceLeftToSimone = (p: VoiceChoice): boolean => !p.onReel && !p.post && !p.correction && p.studio === "auto";

/**
 * Whether a montage gets Simone's voice: never over her own voice note, nor over
 * the voice Simone made before unless the Reel asks for a new one (remake); the
 * Reel's own choice first, then the studio's. « auto » only for a new montage, when
 * it helps: the Reel she copies is told by a voice (one that is not gets none), nobody
 * speaks in the shots, and there is enough to show while the voice speaks. A
 * correction gets a voice only when she asked for one on this Reel.
 */
export function wantsVoiceOver(
  p: VoiceChoice & {
    speechInClips: boolean;
    footageSeconds: number;
    photos: number;
    /** Who speaks in the Reel she copies: in « auto », its form decides. */
    copied?: CopiedVoice;
  },
): boolean {
  if (p.onReel === "hers" || p.post?.mode === "off") return false;
  if (p.onReel === "simone") return Boolean(p.post?.remake);
  if (p.post?.mode === "on") return true;
  if (p.correction || p.studio === "never") return false;
  if (p.studio === "always") return true;
  if (p.copied && p.copied !== "voix off") return false;
  return !p.speechInClips && p.footageSeconds + p.photos * 3 >= VOICE_MIN_FOOTAGE_SECONDS;
}

const hooksField = z
  .array(z.string())
  .describe("4 premières phrases possibles, de formes différentes, 9 mots au plus chacune, qui mènent toutes à la suite ; ta préférée d'abord");
const restField = z.string().describe("Tout ce que la voix dit après la première phrase, tel qu'il sera lu, balises comprises");

/** What the writer answers: first sentences to choose from (the hook is judged), then all that follows. */
export const voiceOverScriptSchema = z.object({ hooks: hooksField, rest: restField });
export type VoiceOverDraft = z.infer<typeof voiceOverScriptSchema>;

/** The voice's text once its first sentence is chosen: the hook, and all it says from the hook on. */
export type VoiceOverScript = { hook: string; script: string };

/** The text read from a chosen first sentence and what follows it. */
export const scriptFrom = (hook: string, rest: string): VoiceOverScript => ({ hook: hook.trim(), script: `${hook.trim()} ${rest.trim()}`.trim() });

/** The two ways a Reel without anyone speaking works: told by a voice, or one key message with the music. */
export const reelFormatSchema = z.enum(["raconte", "message"]);
export type ReelFormat = z.infer<typeof reelFormatSchema>;

/** When Simone chooses (« auto »): the form first, then the words only if a voice tells it. */
export const voiceOverDecisionSchema = z.object({
  format: reelFormatSchema.describe("raconte : une voix qui raconte rend ce Reel meilleur ; message : un seul message clé à l'écran, avec la musique, sans voix"),
  why: z.string().describe("Pourquoi, en une phrase"),
  hooks: hooksField.describe(`${hooksField.description} ; vide avec message`),
  rest: restField.describe(`${restField.description} ; vide avec message`),
});
export type VoiceOverDecision = z.infer<typeof voiceOverDecisionSchema>;

/** Added to the writer's rules when it chooses the form (the business's setting is « auto »). */
export const VOICE_FORMAT_PROMPT = `Avant d'écrire, choisis la forme de ce Reel (« format ») : les Reels qui marchent font l'un ou l'autre, aucun n'est meilleur en soi.
- « raconte » : une voix qui raconte le rend meilleur : un lieu, un plat ou un geste à faire découvrir, des coulisses, un conseil, une histoire à dérouler sur ses images ;
- « message » : il porte mieux un seul message clé à l'écran, avec la musique et sans voix : une offre, une annonce, la rentrée, une ouverture, un événement, une ambiance à faire sentir.
Si sa demande dit déjà la forme (une voix qui raconte, pas de voix, un seul message), suis-la. Dans le doute : « message » pour une offre ou une annonce, « raconte » sinon. « why » en une phrase. Avec « message », laisse hooks et rest vides.`;

export const VOICE_OVER_PROMPT = `Tu écris la voix off d'un Reel Instagram pour un commerce de quartier : ce qu'une vraie personne dit sur ses images, comme un créateur qui parle à ses abonnés, jamais comme une pub. Cette voix fait rester les gens jusqu'au bout : elle doit donner envie, pas vendre.

Ce que tu reçois : le commerce (nom, activité, ce qu'on sait de lui), l'idée de la publication et, quand il y en a, la demande faite pour ce Reel (« publication.demande », souvent dans les mots de la personne qui gère) et ce qu'elle veut entendre (« consigne_voix »), le ton du commerce, ce que montrent ses images, dans l'ordre où elles ont été filmées, l'image sur laquelle le Reel s'ouvre (« ouverture », le plan le plus fort pour accrocher), la longueur à viser (« longueur » : de mots_min à mots_max mots) et, quand elle en recopie un, le Reel qu'elle a envoyé (« reel_a_recopier » : la forme de son accroche et sa fin).

Sa demande passe avant tes idées et ces règles : le message, l'ordre et l'invitation qu'elle donne, avec des phrases à toi, dites à l'oral ; les faits qu'elle y donne sont vrais. Le Reel qu'elle recopie aussi : ta première phrase prend la forme de son accroche, et ta fin la sienne (une chute, une boucle sur la première image ; sans invitation s'il n'en a pas), jamais ses mots. Elle écrit souvent en son nom (« chez nous », « moi ») : la voix, elle, reste celle d'un créateur qui parle du commerce.

Les exemples entre guillemets ci-dessous montrent une forme, jamais des mots à reprendre : écris toujours les tiens, à partir de ce commerce et de ces images.

Règles :
- la longueur demandée, jamais plus : la voix ne dure pas plus longtemps que ce que ses images montrent (environ 2,6 mots par seconde) ; des phrases entières et courtes, à l'oral, qui s'enchaînent (« Et », « Alors », « À ce stade », « Visiblement », dire « on ») ; jamais des bouts de phrase télégraphiques (« Et hop, au four. ») ; chaque phrase apporte quelque chose de nouveau : ne redis jamais avec d'autres mots une idée déjà dite ;
- la première phrase décide si on reste : elle se dit en moins de trois secondes (9 mots au plus) et accroche dès ses trois premiers mots, sur l'image qui ouvre le Reel (« ouverture », sauf si sa demande dit par quoi commencer). Ce qui accroche : une question qu'on veut voir résolue, deux choses qui ne vont pas ensemble, un chiffre précis, ce qu'on ne voit pas d'habitude, un défi, la personne qui regarde mise dans la scène (« tu ») ; ce qui fait passer : le nom du commerce, « bienvenue », « aujourd'hui », « voici », « découvrez », une question molle (« tu connais… ? »), une promesse vague (« tu vas adorer »), une phrase qui irait à n'importe quel commerce. Écris 4 premières phrases de formes différentes (hooks), ta préférée d'abord, qui mènent toutes à ta deuxième phrase : la plus forte sera gardée ;
- une petite histoire, jamais une liste : (1) la première phrase ouvre la curiosité ; (2) la suivante y répond ou dévoile le commerce ; (3) le milieu monte d'un cran sur ce que montrent les images, avec un regard : une exagération juste, une image, de l'humour, ce qu'on se demande en le voyant ; (4) une chute qui fait sourire ou un fait qui marque ; (5) la fin. Formes seulement : « À 7 h, ça s'agite déjà derrière cette vitrine… » puis « Ils préparent la pâte de ce soir. » ; « À ce stade, la question n'est plus de savoir si c'est bon, mais comment le finir. » ;
- après l'ouverture, suis ses images dans l'ordre et dis ce qu'on voit avec un regard : nommer un plat, un geste ou un détail est permis si la phrase y ajoute quelque chose (encore et encore, une quantité folle, presque trop) ; une suite de noms de plats, d'objets ou de pièces sans regard est interdite (« le croque qui file, la salade, le gâteau », « douche, canapé, néon »), pas le décor pour le décor ; seulement des faits vrais (ceux qu'on te donne et ce que montrent les images), rien d'inventé : ni prix, ni chiffre, ni promesse qui ne sont pas dans ce qu'on te donne ;
- une preuve quand les images la montrent : la file devant, la salle pleine, quelqu'un qui goûte ou qui sourit, un habitué ;
- son métier d'abord (le plat, la coupe, le cours, le soin) : un produit dérivé (vêtement, casquette, tote bag) n'est jamais le sujet, sauf si l'idée de la publication en parle ;
- parle comme le commerce parle (« ton ») : ses mots, son humour, tutoiement ou vouvoiement comme lui ;
- la voix est celle d'un créateur qui fait découvrir le commerce à ses abonnés : elle en parle (« ici », « chez Lina », « l'équipe »), jamais en son nom (pas de « chez nous » ni de « je » pour le commerce), et tutoie la personne qui regarde, sauf si le ton du commerce vouvoie ;
- finis (sauf si sa demande ou le Reel qu'elle recopie finissent autrement) par une invitation simple et concrète, qui dit quoi faire (venir, réserver, essayer : le geste précis pour ce commerce, et où le faire, par exemple « le lien est dans la bio »), ou par une raison de l'envoyer à quelqu'un (« si tu as une gourmande autour de toi, tu sais à qui l'envoyer ») ;
- interdit : les formules de pub (« découvrez », « n'hésitez pas », « une expérience unique », « de qualité », « savoureux », « au cœur de »), les superlatifs creux, les emojis, les hashtags, le tiret long, les parenthèses ;
- écris les nombres en lettres quand ils se disent mal en chiffres (« dix-huit mois ») et la ponctuation d'une voix qui parle : des points, des virgules, des points de suspension pour une petite pause, une question au plus ;
- ça s'écoute comme quelqu'un qui parle, jamais comme une pub lue au micro : écris comme on parle à un ami dans une note vocale ou face caméra, avec les tournures de l'oral (« t'as », « y a », « c'est », « franchement », « en vrai », « du coup », « bref ») quand elles collent au ton du commerce, une phrase qui se reprend ou une petite hésitation de temps en temps (« enfin… »), des phrases qui ne sont pas toutes parfaites ; relis-la dans ta tête : si on dirait une annonce, une plaquette ou un spot radio, réécris-la ;
- « intonation » dit le rythme et l'attitude de la voix pour ce commerce (« cool et nonchalant, un brin rock », « posé et doux ») : écris pour elle (longueur des phrases, mots, pauses) et choisis tes balises de jeu pour la porter ; jamais un ton d'animatrice ni de pub ;
- pour une voix humaine, glisse 1 ou 2 balises de jeu entre crochets, en anglais, juste avant la phrase qu'elles colorent : [warmly], [smiling], [softly], [excited], [casually], [confident], [playful], [deadpan], [laughs softly], [whispers], [sighs] ; par exemple « [casually] » devant une phrase lâchée l'air de rien ; jamais plus de 2, jamais au milieu d'un mot, jamais d'autres crochets ;
- si on te dit que la voix est chuchotée (ASMR), écris pour un murmure tout près de l'oreille : des phrases encore plus courtes et lentes, des points de suspension, ce qu'on entend et ce qu'on sent (le bruit des ciseaux, la mousse, la croûte qui craque, la chaleur d'une serviette), aucune question qui claque ni point d'exclamation, [whispers] ou [softly] comme balises.

Réponds avec hooks (les 4 premières phrases possibles) et rest (tout ce qui suit la première phrase, balises comprises).`;

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
 * The least silence between two sentences of Simone's voice (s): read in one breath,
 * the end of one sentence is heard as the start of the next.
 */
export const SENTENCE_GAP = 0.35;

/** A spoken word that closes a sentence (its punctuation stays on it: « maître. », « toi\u202f? »). */
const SENTENCE_END = /[.!?…]["»]?$/;

/**
 * Where a voice needs a breath between two sentences, and how much silence to open
 * there (cut in the middle of the gap it left), so the sentences are heard as two.
 */
export function sentencePauses(words: VoiceTranscript["words"], gap = SENTENCE_GAP): { at: number; add: number }[] {
  const pauses: { at: number; add: number }[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i]!;
    const next = words[i + 1]!;
    if (!SENTENCE_END.test(word.w)) continue;
    const silence = next.start - word.end;
    if (silence >= gap - 0.02) continue;
    pauses.push({ at: round(silence > 0 ? word.end + silence / 2 : next.start), add: round(gap - Math.max(0, silence)) });
  }
  return pauses;
}

/** A voice's words once those silences are opened: each word later by the silences before it. */
export function withPauses(transcript: VoiceTranscript, pauses: { at: number; add: number }[]): VoiceTranscript {
  if (!pauses.length) return transcript;
  const shift = (t: number) => round(t + pauses.reduce((sum, p) => (p.at <= t ? sum + p.add : sum), 0));
  return {
    ...transcript,
    duration: round(transcript.duration + pauses.reduce((sum, p) => sum + p.add, 0)),
    words: transcript.words.map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) })),
  };
}

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
