import { z } from "zod";
import { VOICE_MAX_SECONDS, type VoiceTranscript } from "./voice.ts";

// Edith's voice over a Reel (ElevenLabs text to speech): she writes what a
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
export function voiceWordsFor(footageSeconds: number, askedSeconds?: number | null): { min: number; max: number } {
  // The length she asked for decides: the voice carries the Reel to its end, a breath before it
  // (his Pauline Reel asked 20 to 30 s, its voice stopped at 14 s and the last animations played in silence).
  if (askedSeconds) {
    const spoken = Math.min(VOICE_MAX_SECONDS - 4, Math.max(8, askedSeconds - 2));
    const words = Math.round(spoken * 2.2);
    return { min: words - 6, max: words + 3 };
  }
  const seconds = Math.min(22, Math.max(12, footageSeconds));
  // About 2.2 words a second: a creator leaves room to breathe; at 2.6 with a floor, the writer
  // filled the gaps by describing the images (Tristan: « le script de la voix est souvent pas ouf »).
  const words = Math.round(seconds * 2.2);
  return { min: Math.max(20, words - 10), max: Math.min(VOICE_OVER_WORDS.max, words + 3) };
}

/**
 * Edith's voices, ElevenLabs library voices picked by ear: natural French voices
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

/**
 * Her own voice, cloned by ElevenLabs (instant voice cloning) from a minute or so she
 * recorded or sent in Style, with her consent: a voice of the account, kept in the
 * brand profile (profile.own_voice) and heard in Style by its sample. Only this
 * studio's Reels may use it.
 */
export const ownVoiceSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
  name: z.string().max(60),
  /** Its sample, read by the clone (media bucket, the studio's folder). */
  sample_path: z.string().max(300).optional(),
  made_at: z.string().max(40),
});
export type OwnVoice = z.infer<typeof ownVoiceSchema>;
export const readOwnVoice = (value: unknown): OwnVoice | null => ownVoiceSchema.nullable().catch(null).parse(value ?? null);

/** What she reads aloud to be cloned: about a minute, varied sounds, said like she talks. */
export const CLONE_SCRIPT =
  "Bonjour ! Je vous présente mon métier, celui que je fais chaque jour avec plaisir. Le matin, j'ouvre, je prépare tout, et j'attends les premiers clients. Certains viennent depuis des années, d'autres passent la porte pour la première fois. Ce que je préfère ? Le moment où quelqu'un repart avec le sourire. Franchement, ça n'a pas de prix. Alors si vous passez dans le quartier, venez me dire bonjour : je vous montrerai tout, et on prendra le temps. À très vite !";
/** ElevenLabs asks for a minute or two of clean speech; under 30 s the clone does not sound like her. */
export const CLONE_MIN_SECONDS = 30;
export const CLONE_MAX_SECONDS = 180;

/** A voice a Reel can be read with: one of the gallery, or her own clone. */
export type UsableVoice = { id: string; name: string; gender: "f" | "m" | null; asmr: boolean; own: boolean };

/** Words that mean her own voice (« ma voix », « sa voix »…) when Edith names it. */
const OWN_WORDS = /^(ma|ta|sa|mon|own|moi|la mienne|ma propre) ?(voix|clone)?$/;

/**
 * A voice by its id or its name, from the gallery or her own clone: anything else (another
 * studio's clone, a voice deleted since) is undefined, so it is never read for her.
 */
export function voiceIn(idOrName: string | null | undefined, own: OwnVoice | null): UsableVoice | undefined {
  const key = (idOrName ?? "").trim().toLowerCase();
  if (!key) return undefined;
  if (own && (own.id.toLowerCase() === key || own.name.toLowerCase() === key || OWN_WORDS.test(key))) {
    return { id: own.id, name: own.name, gender: null, asmr: false, own: true };
  }
  const gallery = findVoice(key);
  return gallery ? { id: gallery.id, name: gallery.name, gender: gallery.gender, asmr: gallery.asmr, own: false } : undefined;
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
  /** Edith's voice on the Reel is made again at the next montage (another text or voice), once. */
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
  /** The voice on the Reel now: hers (a voice note), Edith's, or none. */
  onReel: "hers" | "simone" | null;
  correction: boolean;
};

/** Edith decides (« auto »): a new montage, no voice on the Reel yet, no choice for it, her setting « auto ». */
export const voiceLeftToSimone = (p: VoiceChoice): boolean => !p.onReel && !p.post && !p.correction && p.studio === "auto";

/**
 * Whether a montage gets Edith's voice: never over her own voice note, nor over
 * the voice Edith made before unless the Reel asks for a new one (remake); the
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
  // Someone speaking in her videos keeps their words, even when she chose « Une voix off » or « toujours »
  // (Tristan: « ok » to « ses paroles passent avant la voix off ») ; only a voice she asked for again, with what it says, goes over them.
  if (p.speechInClips && !p.post?.wish) return false;
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

const messageField = z
  .string()
  .describe("Le message de cette vidéo en une phrase : ce que la personne qui regarde doit retenir, ressentir ou faire. Tout le texte est construit dessus");

/** What the writer answers: the video's message first (the script is built on it), then first sentences to choose from (the hook is judged), then all that follows. */
export const voiceOverScriptSchema = z.object({ message: messageField, hooks: hooksField, rest: restField });
export type VoiceOverDraft = z.infer<typeof voiceOverScriptSchema>;

/** The voice's text once its first sentence is chosen: the hook, and all it says from the hook on. */
export type VoiceOverScript = { hook: string; script: string };

/** The text read from a chosen first sentence and what follows it. */
export const scriptFrom = (hook: string, rest: string): VoiceOverScript => ({ hook: hook.trim(), script: `${hook.trim()} ${rest.trim()}`.trim() });

/** The two ways a Reel without anyone speaking works: told by a voice, or one key message with the music. */
export const reelFormatSchema = z.enum(["raconte", "message"]);
export type ReelFormat = z.infer<typeof reelFormatSchema>;

/** When Edith chooses (« auto »): the form first, then the words only if a voice tells it. */
export const voiceOverDecisionSchema = z.object({
  format: reelFormatSchema.describe("raconte : une voix qui raconte rend ce Reel meilleur ; message : un seul message clé à l'écran, avec la musique, sans voix"),
  why: z.string().describe("Pourquoi, en une phrase"),
  message: messageField,
  hooks: hooksField.describe(`${hooksField.description} ; vide avec message`),
  rest: restField.describe(`${restField.description} ; vide avec message`),
});
export type VoiceOverDecision = z.infer<typeof voiceOverDecisionSchema>;

/** Added to the writer's rules when it chooses the form (the business's setting is « auto »). */
export const VOICE_FORMAT_PROMPT = `Before writing, choose this Reel's form (« format »): the Reels that work do one or the other, neither is better in itself.
- « raconte »: a voice that tells makes it better: a place, a dish or a gesture to discover, behind the scenes, a tip, a story to unfold over her images;
- « message »: it carries a single key message on screen better, with the music and no voice: an offer, an announcement, back to school, an opening, an event, a mood to make people feel.
If her request already says the form (a voice that tells, no voice, a single message), follow it. When in doubt: « message » for an offer or an announcement, « raconte » otherwise. « why » in one sentence. With « message », leave hooks and rest empty.`;

export const VOICE_OVER_PROMPT = `You write the voice-over of an Instagram Reel for a neighbourhood business: what a real person says over its images, like a creator talking to their followers, never like an ad. This voice makes people stay to the end: it must make them want to come, not sell. You write it in French.

What you get: the business (name, trade, what we know about it), the post's idea and, when there are some, the request made for this Reel (« publication.demande », often in the words of the person who runs it) and what she wants to hear (« consigne_voix »), the business's tone, what her images show, in the order they were filmed, the image the Reel opens on (« ouverture », the strongest shot to hook), the length to aim for (« longueur »: from mots_min to mots_max words) and, when she copies one, the Reel she sent (« reel_a_recopier »: the form of its hook and its ending), and this business's latest voices (« voix_recentes »).

« contrat », when there is one, is what she fixed herself for this Reel: it comes before everything else, these rules included. A person (« je »: the voice speaks in her name, in the first person, and the rule of the creator who talks about the business does not apply), an invitation (« aucune »: no invitation nor call to comment; « la sienne »: her words), an ending, a length, her requests: you follow them to the letter.

Her request comes before your ideas and these rules: the message, the order and the invitation she gives, in sentences of your own, said out loud; the facts she gives in it are true. So does the Reel she copies: your first sentence takes the form of its hook, and your ending the form of its ending (a punchline, a loop back to the first image; no invitation if it has none), never its words. She often writes in her own name (« chez nous », « moi »): the voice stays that of a creator who talks about the business.

Before writing a line, find THE message of this video (« message »): a single sentence that says what the person watching must remember, feel or do (« ici, la pâte a eu deux jours pour devenir légère », « une appli fait tes Reels pendant que tu vis ta vie »). It comes from her request first, otherwise from what makes this business and these images unique. The whole text is built on this message, and only on it: every sentence prepares it, proves it or makes it felt; a sentence that does not serve it is taken out. The message always talks about this business and what it does for the person watching: when the images show an example (a client, a case, a demo, another business it helped), the example proves the message, it never becomes its subject; at the end, people must know what this business is and why it is made for them.

The examples between quotes show a form, never words to reuse: always write your own, from this business and this message.

Rules:
- it is a script, not a description: the voice lives with the images and how they unfold; it can react to what happens, have fun with it, name a moment at the right instant, as long as it adds something (a look, a punchline, a why, what you feel). Never describe for the sake of it what people already see (« en haut… », « en bas… », « dorée, fumante », « deux mains attrapent une part »), never the inventory of the shots in their order. What it brings above all is what the image cannot say: why, since when, the detail only a regular knows, what it changes;
- one idea, never a list: no enumeration of services or dishes (« les pâtes, les pizzas, les desserts »); a single true and precise fact, well told, is worth more than five. Except when her request itself says what must be understood, point by point: then each of her points is said, in its order, as a progression that leads to the message (what you do, what it does for you, what it brings you), in sentences that flow into each other, never a list read aloud;
- the length asked for, never more, and less if the message is said: the voice lets things breathe, a silence is better than a filler sentence; whole, short sentences that flow into each other; never telegraphic fragments (« Et hop, au four. »); every sentence brings something new, never the same idea said again;
- the first sentence decides whether people stay: it is said in under three seconds (9 words at most), hooks from its first three words and opens the message (without saying it straight away), for the image that opens the Reel (« ouverture », unless her request says what to start with). What hooks: a question you want answered, two things that don't go together, a precise number, what you don't usually see, a challenge, the person watching put in the scene (« tu »); what makes people scroll on: the business's name, « bienvenue », « aujourd'hui », « voici », « découvrez », a limp question (« tu connais… ? »), a vague promise (« tu vas adorer »), a sentence that would fit any business. Write 4 first sentences of different forms (hooks), your favourite first, all leading to your second sentence: the strongest will be kept;
- a little story around the message: (1) the first sentence opens curiosity; (2) the next one answers it; (3) the heart gives the proof or the detail that makes the message true, with a point of view (a fair exaggeration, an image, humour); (4) a punchline that makes it stick; (5) the ending. Form only: « À 7 h, ça s'agite déjà derrière cette vitrine… » then « Ils préparent la pâte de ce soir. »;
- only true facts (those you are given and what the images show), nothing invented: no price, number or promise that is not in what you are given; a proof when there is one (the queue outside, the full room, a regular);
- her trade first (the dish, the haircut, the class, the treatment): a by-product (clothing, cap, tote bag) is never the subject, unless the post's idea talks about it;
- speak the way the business speaks (« ton »): its words, its humour, « tu » or « vous » as it does;
- the voice is that of a creator who introduces the business to their followers: it talks about it (« ici », « chez Lina », « l'équipe »), never in its name (no « chez nous » nor « je » for the business), and says « tu » to the person watching, unless the business's tone uses « vous »;
- end (unless her request or the Reel she copies end otherwise) with a simple, concrete invitation that follows from the message (come, book, try: the precise gesture for this business, and where to do it, for example « le lien est dans la bio »), or with a reason to send it to someone;
- never an invitation the business does not honour: no « écris X en commentaire, on t'envoie le lien » nor any promise of a message, a code or a gift that is not in what you are given;
- forbidden: ad formulas (« découvrez », « n'hésitez pas », « une expérience unique », « de qualité », « savoureux », « au cœur de »), hollow superlatives, emojis, hashtags, the em dash, parentheses; and the tics put in to sound « oral » (« résultat… », « du coup », « franchement », « en vrai », « visiblement », « bref », « hein »): the spoken feel comes from simple, true sentences, not from these words;
- « voix_recentes » are this business's latest voices: take neither their hook, nor their construction, nor their turns of phrase;
- write numbers in letters when they read badly in digits (« dix-huit mois »), a web address as it is read (« fauve-one point vercel point app » is written « fauve-one.vercel.app »), and the punctuation of a speaking voice: full stops, commas, ellipses for a short pause, one question at most;
- correct, natural French, as a French person would say it: every sentence has its subject and its verb, no calque from English, no awkward or elliptical turn of phrase (« Une phrase tapée, et ce studio a son Reel. »), no wrong preposition (you do something « avec » an app, not « sur » it); reread each sentence and rewrite the one a French person would not say as it is;
- it sounds like someone talking to a friend in a voice note or to camera, never like an ad read into a microphone: reread it in your head; if it sounds like an announcement, a brochure or a radio spot, rewrite it;
- « intonation » gives the rhythm and the attitude of the voice for this business (« cool et nonchalant, un brin rock », « posé et doux »): write for it (sentence length, words, pauses) and let the words carry it, not the tags; never the tone of a TV host nor of an ad;
- the voice talks like someone telling a friend, never acting: understated, even, a smile you hear rather than a show (Tristan: « un poil moins expressif, ça fait presque surjouer »). For a human voice, at most one soft performance tag between square brackets, in English, just before the sentence it colours, and only when the text needs it: [warmly], [softly], [casually], [deadpan]; never an emphatic one ([excited], [playful], [laughs], [sighs], [smiling]), never in the middle of a word, never other square brackets;
- if you are told the voice is whispered (ASMR), write for a murmur right by the ear: even shorter and slower sentences, ellipses, what you hear and feel (the sound of the scissors, the foam, the warmth of a towel), no question that snaps nor exclamation mark, [whispers] or [softly] as tags.

Answer with message (the video's message in one sentence), hooks (the 4 possible first sentences) and rest (everything after the first sentence, tags included), all in French apart from the tags.`;

/**
 * Her own text for the voice (« contrat.voice_text »): read as she wrote it, or improved for the ear,
 * never turned into someone else's words (Tristan's « Je viens de découvrir Edith… » came back as
 * « Tristan a trouvé Edith… » with an invitation he never asked for).
 */
export const OWN_TEXT_PROMPT = `You prepare, for a French synthetic voice, the text a person wrote themselves for the voice-over of their Reel. The text stays in French.
- mode « verbatim »: correct only the spelling, the agreements and the punctuation of a speaking voice (full stops, commas, ellipses for a short pause); write out in letters a number that reads badly in digits. Change, add or remove no word and no idea.
- mode « polish »: make it better spoken, livelier and more fluid, in short sentences, without losing anything: its meaning, its ideas in their order, its person (a « je » stays a « je »), its strong words, about its length (« longueur » gives the target when it is there). Add nothing that is not there: no invitation, no call to comment, no fact, no number, no promise.
Read « demande » first, their whole request: it says what the voice must tell, and their text is sometimes only its beginning.
- « suite », when it is there: they wrote only the beginning of the voice and describe the rest. Their beginning first (according to the mode), then write the rest they describe yourself, in the same voice, the same person and the same tone, seamlessly: what is missing is said, in its order, in short and natural sentences, in correct and idiomatic French, never as a list read aloud nor as an ad formula. Use « commerce » and « demande » to say what is true (what the business is, what it does for the person watching); invent no fact, no number, no promise.
- « longueur », when it is there: the whole text (their beginning and the rest) is between mots_min and mots_max words, so that the voice carries the Reel to the end; the rest takes the room it needs, their beginning never gets longer.
In every case, follow « contrat » (person, invitation, ending) and put no tag in square brackets. Answer with script: the text as it will be read, in full.`;
export const ownTextSchema = z.object({ script: z.string().describe("Le texte tel qu'il sera lu") });

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
 * The least silence between two sentences of Edith's voice (s): read in one breath,
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
