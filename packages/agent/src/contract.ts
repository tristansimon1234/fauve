import { z } from "zod";

// What she fixed for this Reel, read once from her request (Tristan, after his Simone Reel:
// three writers rewrote his text in the third person, added « Écris SIMONE en commentaire »
// and ignored « voix plus rapide »). Every step of the montage gets it as rules it never
// overrides: the editor, the voice-over writer, the hook judge. Nothing here is guessed:
// what she did not say stays empty and the usual defaults decide.

export const reelContractSchema = z.object({
  /** The words she wants the voice to say, as she wrote them (her quotes, « texte : … »); null when she gave none. */
  voice_text: z.string().max(1500).nullable(),
  /** verbatim: read as written (spelling fixed); polish: improved (« améliore », « dans l'idée ») keeping her meaning, her order and her person. */
  voice_text_mode: z.enum(["verbatim", "polish"]),
  /**
   * What the voice says after her words, when she wrote only its start and described the rest
   * (« le voix off dis je vous présente Pauline… et là tu parles de Simone ») ; null when her text is all of it.
   * Without it her start was read alone: 9 s of voice on a 20 s Reel (Tristan: « elle aurait dû comprendre »).
   */
  voice_text_rest: z.string().max(600).nullable().default(null),
  /** Who speaks: « je » when she asks to speak in the first person; libre when she did not say. */
  person: z.enum(["je", "nous", "il_elle", "libre"]),
  /** The voice's pace she asked for. */
  voice_pace: z.enum(["lente", "normale", "rapide"]),
  /** Woman or man, when she said it. */
  voice_gender: z.enum(["femme", "homme", "libre"]),
  /** The length she asked for, in seconds; null when she did not say. */
  duration: z.number().min(5).max(60).nullable(),
  /** The layout she asked for in her words (« écran partagé 50/50, l'animation en haut, moi en bas »); null when she did not say. */
  layout: z.string().max(240).nullable(),
  /** The text on screen she gave word for word (an opening line, a title); null when she gave none. */
  screen_text: z.string().max(240).nullable(),
  /** How it ends, when she said it (« finir sur plus de clients »). */
  ending: z.string().max(240).nullable(),
  /** The invitation at the end: the one she gave, none, or free when she said nothing. */
  call_to_action: z.enum(["libre", "aucune", "la_sienne"]),
  call_to_action_text: z.string().max(200).nullable(),
  /** Everything else she asked for explicitly (« fond papier », « bulles WhatsApp », « coupes rapides »), in her words. */
  musts: z.array(z.string().max(200)).max(10),
  /**
   * A correction: whether it asks to redraw what the Reel's composition draws (its layout, its animations, its
   * interface, its effects, its background, how they move). False when it only touches the voice, the subtitles,
   * a text's words, the music, the length or the shots: the composition's code is kept, never written again
   * (Tristan: « pourquoi la correction refait tout, c'est une hérésie »). A job read before it had none: true.
   */
  redraw: z.boolean().default(true),
});
export type ReelContract = z.infer<typeof reelContractSchema>;

export const CONTRACT_PROMPT = `You read a person's request for a Reel and note, adding nothing, what they fixed themselves. Nothing they did not say: a field they did not fix stays empty (null, « libre », an empty list). What you note stays in their own words, in French.
- voice_text: the words they want to hear in the voice-over, as they wrote them (often between quotes, after « texte : », « la voix dit : »); null if they gave no text. Loose ideas (« parle du prix ») are not a text.
- voice_text_rest: when they write only the beginning of the voice and describe the rest instead of writing it (« … et là tu parles de Simone », « puis la voix présente l'offre », « et tu expliques que… »), what the rest must say, in their words; null when their text is the whole voice. Their beginning stays in voice_text; the rest described never goes into it.
- voice_text_mode: « polish » when they ask to improve it, to rephrase it, or say « dans l'idée », « genre »; otherwise « verbatim ».
- person: « je » when they want to speak in their own name or their text is in the first person; « nous » or « il_elle » if they say so; otherwise « libre ».
- voice_pace: « rapide » or « lente » if they ask for it; otherwise « normale ». voice_gender: if they say a man's or a woman's voice.
- duration: the length in seconds if they give it. layout: the layout they describe (split screen, half and half, a shot in a frame…), in their words.
- screen_text: an on-screen text they give word for word. ending: the ending they describe.
- call_to_action: « la_sienne » with its text if they give the invitation; « aucune » if they don't want one; otherwise « libre ».
- musts: everything else they explicitly ask for this Reel (a mood, a background, a universe, a rhythm, things to show), in their words, one thing per line.
- A correction of a Reel that already has its voice-over also gets « Texte actuel de la voix ». When the request changes only part of this text (a word, a pronunciation, a sentence, the ending) or quotes only a piece of it, voice_text is the current text IN FULL with only that change made, nothing else cut or rewritten (verbatim): a quoted piece is never the whole text. Only a request that gives a whole new text, or asks for it to be rewritten, replaces it. When they say the voice stops too early, doesn't go to the end or must say more, voice_text is the current text in full and voice_text_rest what it must still say (what their original request describes and is missing). With no change to the voice asked for, voice_text stays null.
- redraw: for a correction, true only when they ask to change what the layout or its animations draw (the arrangement, the split screen, the interface, an effect, a graphic element, the background, their motion or their style); false when they only touch the voice, the subtitles, the words of a text, the music, the length, the caption, the order or the choice of shots. For a new Reel: true.`;

export const EMPTY_CONTRACT: ReelContract = {
  voice_text: null,
  voice_text_mode: "verbatim",
  voice_text_rest: null,
  person: "libre",
  voice_pace: "normale",
  voice_gender: "libre",
  duration: null,
  layout: null,
  screen_text: null,
  ending: null,
  call_to_action: "libre",
  call_to_action_text: null,
  musts: [],
  redraw: true,
};

/** Nothing fixed: the defaults decide everything. */
export const contractIsEmpty = (c: ReelContract | null | undefined): boolean =>
  !c ||
  (!c.voice_text &&
    c.person === "libre" &&
    c.voice_pace === "normale" &&
    c.voice_gender === "libre" &&
    c.duration === null &&
    !c.layout &&
    !c.screen_text &&
    !c.ending &&
    c.call_to_action === "libre" &&
    !c.musts.length);

/** The contract in plain lines, for the editor, the voice-over writer and the critic (only what she fixed). */
export function contractLines(c: ReelContract | null | undefined): string[] {
  if (!c || contractIsEmpty(c)) return [];
  return [
    c.voice_text
      ? `Texte de la voix (${c.voice_text_mode === "verbatim" ? "à dire tel quel" : "à améliorer en gardant son sens, son ordre et sa personne"}) : « ${c.voice_text} »${c.voice_text_rest ? `, puis la voix continue : ${c.voice_text_rest}` : ""}`
      : null,
    c.person !== "libre" ? `La voix parle ${c.person === "je" ? "à la première personne (« je »), en son nom" : c.person === "nous" ? "en « nous »" : "à la troisième personne"}` : null,
    c.voice_pace !== "normale" ? `Voix ${c.voice_pace === "rapide" ? "plus rapide" : "plus lente"}` : null,
    c.voice_gender !== "libre" ? `Voix d'${c.voice_gender === "homme" ? "homme" : "femme"}` : null,
    c.duration ? `Durée : ${c.duration} s environ` : null,
    c.layout ? `Mise en page : ${c.layout}` : null,
    c.screen_text ? `Texte à l'écran, mot pour mot : « ${c.screen_text} »` : null,
    c.ending ? `Fin : ${c.ending}` : null,
    c.call_to_action === "aucune" ? "Aucune invitation à la fin" : c.call_to_action === "la_sienne" && c.call_to_action_text ? `Invitation à la fin, la sienne : « ${c.call_to_action_text} »` : null,
    ...c.musts.map((m) => `Demandé : ${m}`),
    c.redraw === false ? "La mise en page et ses animations restent telles quelles (leur code est gardé) : ne change ni la forme du Reel ni le brief de sa composition" : null,
  ].filter((l): l is string => Boolean(l));
}

/** Her text as it was asked for, to tell whether the voice on the Reel already says it (its continuation included). */
export const ownTextKey = (c: ReelContract): string =>
  [verbatimScript(c.voice_text ?? ""), c.voice_text_rest ? `[suite : ${c.voice_text_rest.trim()}]` : ""].filter(Boolean).join(" ");

/** ElevenLabs' speed for the pace she asked (1 = the voice as it is). */
export const VOICE_SPEED: Record<ReelContract["voice_pace"], number> = { lente: 0.9, normale: 1, rapide: 1.12 };

/**
 * Her text, for a voice that reads it as written: spaces and line breaks tidied, its quotes
 * taken off; the words stay hers.
 */
export function verbatimScript(text: string): string {
  return text
    .replace(/^[\s«"“]+|[\s»"”]+$/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
