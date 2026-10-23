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

export const CONTRACT_PROMPT = `Tu lis la demande d'une personne pour un Reel et tu notes, sans rien ajouter, ce qu'elle a fixé elle-même. Rien de ce qu'elle n'a pas dit : un champ qu'elle n'a pas fixé reste vide (null, « libre », une liste vide).
- voice_text : les mots qu'elle veut entendre dans la voix off, tels qu'elle les a écrits (souvent entre guillemets, après « texte : », « la voix dit : ») ; null si elle n'a donné aucun texte. Des idées en vrac (« parle du prix ») ne sont pas un texte.
- voice_text_rest : quand elle n'écrit que le début de la voix et décrit la suite au lieu de l'écrire (« … et là tu parles de Simone », « puis la voix présente l'offre », « et tu expliques que… »), ce que la suite doit dire, dans ses mots ; null quand son texte est toute la voix. Son début reste dans voice_text, la suite décrite n'y entre jamais.
- voice_text_mode : « polish » quand elle demande de l'améliorer, de le reformuler, ou dit « dans l'idée », « genre » ; sinon « verbatim ».
- person : « je » quand elle veut parler en son nom ou que son texte est à la première personne ; « nous » ou « il_elle » si elle le dit ; sinon « libre ».
- voice_pace : « rapide » ou « lente » si elle le demande ; sinon « normale ». voice_gender : si elle dit une voix d'homme ou de femme.
- duration : la durée en secondes si elle la donne. layout : la mise en page qu'elle décrit (écran partagé, moitié-moitié, plan dans un cadre…), dans ses mots.
- screen_text : un texte à l'écran qu'elle donne mot pour mot. ending : la fin qu'elle décrit.
- call_to_action : « la_sienne » avec son texte si elle donne l'invitation ; « aucune » si elle n'en veut pas ; sinon « libre ».
- musts : tout le reste qu'elle demande explicitement pour ce Reel (une ambiance, un fond, un univers, un rythme, des éléments à montrer), dans ses mots, une chose par ligne.
- Une correction d'un Reel qui a déjà sa voix off reçoit aussi « Texte actuel de la voix ». Quand la demande change seulement une partie de ce texte (un mot, une prononciation, une phrase, la fin) ou n'en cite qu'un morceau, voice_text est le texte actuel EN ENTIER avec seulement ce changement fait, rien d'autre de coupé ni de réécrit (verbatim) : un morceau cité n'est jamais tout le texte. Seule une demande qui donne un texte complet nouveau, ou qui demande de le réécrire, le remplace. Quand elle dit que la voix s'arrête trop tôt, ne va pas jusqu'au bout ou doit en dire plus, voice_text est le texte actuel en entier et voice_text_rest ce qu'elle doit encore dire (ce que décrit sa demande d'origine et qui manque). Sans changement de la voix demandé, voice_text reste null.
- redraw : pour une correction, true seulement quand elle demande de changer ce que dessine la mise en page ou ses animations (la disposition, l'écran partagé, l'interface, un effet, un élément graphique, le fond, leur mouvement ou leur style) ; false quand elle ne touche que la voix, les sous-titres, les mots d'un texte, la musique, la durée, la légende, l'ordre ou le choix des plans. Pour un nouveau Reel : true.`;

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
