import { z } from "zod";

// What she fixed for this Reel, read once from her request (Tristan, after his Edith Reel:
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
   * (« le voix off dis je vous présente Pauline… et là tu parles d'Edith ») ; null when her text is all of it.
   * Without it her start was read alone: 9 s of voice on a 20 s Reel (Tristan: « elle aurait dû comprendre »).
   */
  voice_text_rest: z.string().max(600).nullable().default(null),
  /** Who speaks: « je » when she asks to speak in the first person; libre when she did not say. */
  person: z.enum(["je", "nous", "il_elle", "libre"]),
  /** The voice's pace she asked for. */
  voice_pace: z.enum(["lente", "normale", "rapide"]),
  /** Woman or man, when she said it. */
  voice_gender: z.enum(["femme", "homme", "libre"]),
  /**
   * Her answer for this Reel's voice-over (« Avec une voix off », « Juste la musique »): asked by Edith before a new Reel, it
   * reached nothing when Edith did not set it on the post (the post did not exist yet), and the Reel came out without the
   * voice she asked for. libre: she did not say (« Fais comme tu le sens »), her setting decides.
   */
  voice_over: z.enum(["avec", "sans", "libre"]).default("libre"),
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
   * What she asked for the music of this Reel (« juste un piano classique, sans autre instrument »), in English for the
   * composer, faithful to her words; null when she said nothing of it. It is the composer's brief (Tristan: « il faut
   * juste qu'on écoute ma demande », after a « piano only » came out as lounge with drums and bass).
   */
  music: z.string().max(300).nullable().default(null),
  /**
   * A correction: whether it asks to redraw what the Reel's composition draws (its layout, its animations, its
   * interface, its effects, its background, how they move). False when it only touches the voice, the subtitles,
   * a text's words, the music, the length or the shots: the composition's code is kept, never written again
   * (Tristan: « pourquoi la correction refait tout, c'est une hérésie »). A job read before it had none: true.
   */
  redraw: z.boolean().default(true),
  /**
   * letterbox: her videos kept whole and horizontal, on black above and below (« la vidéo reste horizontale, noir au-dessus
   * et en dessous »): the engine draws it, never a composition (a 17 s Reel took 12 min to render that way).
   */
  frame: z.enum(["vertical", "letterbox"]).default("vertical"),
  /**
   * Sounds she asks to hear on what appears (« un petit clic léger à chaque mot qui apparaît »): on each text, or on
   * each cut, the sound in a few generic English words. The engine places them, whoever draws the texts (a Reel with
   * no animation had no one to place her clicks).
   */
  asked_sounds: z
    .array(z.object({ on: z.enum(["texts", "cuts"]), sound: z.string().max(60) }))
    .max(3)
    .default([]),
});
export type ReelContract = z.infer<typeof reelContractSchema>;

export const CONTRACT_PROMPT = `You read a person's request for a Reel and note, adding nothing, what they fixed themselves. Nothing they did not say: a field they did not fix stays empty (null, « libre », an empty list). What you note stays in their own words, in French. When the request holds their exchange with Edith, only their own messages fix something: Edith's replies, plan and brief are context, never a fixed point, even when they answered « oui » or « c'est parti » to them.
- voice_text: the words they want to hear in the voice-over, as they wrote them (often between quotes, after « texte : », « la voix dit : »); null if they gave no text. Loose ideas (« parle du prix ») are not a text. A request that describes the Reel is never a text to say, even a whole sentence in the first person (« Ce week-end, on part au marché aux puces. », « Je me présente : Héloïse, la fleuriste de l'Atelier Rose. »: what the Reel is about, voice_text null): only words they say the voice says (« la voix dit », « voix off : », « texte : », « fais-lui dire », their words between quotes for the voice).
- voice_text_rest: when they write only the beginning of the voice and describe the rest instead of writing it (« … et là tu parles d'Edith », « puis la voix présente l'offre », « et tu expliques que… »), what the rest must say, in their words; null when their text is the whole voice. Their beginning stays in voice_text; the rest described never goes into it.
- voice_text_mode: « polish » when they ask to improve it, to rephrase it, or say « dans l'idée », « genre »; otherwise « verbatim ».
- person: « je » when they want to speak in their own name or their text is in the first person; « nous » or « il_elle » if they say so; otherwise « libre ».
- voice_pace: « rapide » or « lente » if they ask for it; otherwise « normale ». voice_gender: if they say a man's or a woman's voice.
- voice_over: « avec » when they want a voice-over on this Reel (« avec une voix off », « mets une voix », « Avec une voix off » answered to Edith's question), « sans » when they want none (« juste la musique », « sans voix off », « Juste la musique »); otherwise « libre » (« fais comme tu le sens » included).
- duration: the length in seconds if they give it. layout: the layout they describe (split screen, half and half, a shot in a frame…), in their words; never the format alone (vertical, full screen, horizontal, in bands, their videos kept whole: that is « frame »), so « en vertical plein écran » leaves layout null.
- screen_text: an on-screen text they give word for word. ending: the ending they describe.
- Words they give for the screen (screen_text, call_to_action_text) keep their words and order but are always written right: spelling, accents, apostrophes and hyphens, capitals of names (WhatsApp, Instagram), French punctuation (« Parles en a Edith, ton IA sur whatapps » → « Parles-en à Edith, ton IA sur WhatsApp. »). Never one of their typos on screen.
- call_to_action: « la_sienne » with its text if they give the invitation; « aucune » if they don't want one; otherwise « libre ».
- musts: everything else they explicitly ask for this Reel (a mood, a background, a universe, a rhythm, things to show), in their words, one thing per line.
- A correction of a Reel that already has its voice-over also gets « Texte actuel de la voix ». When the request changes only part of this text (a word, a pronunciation, a sentence, the ending) or quotes only a piece of it, voice_text is the current text IN FULL with only that change made, nothing else cut or rewritten (verbatim): a quoted piece is never the whole text. Only a request that gives a whole new text, or asks for it to be rewritten, replaces it. When they say the voice stops too early, doesn't go to the end or must say more, voice_text is the current text in full and voice_text_rest what it must still say (what their original request describes and is missing). With no change to the voice asked for, voice_text stays null.
- music: what they ask for the music of this Reel (instruments, genre, mood, pace, what they leave out), written in English for a composer, faithful to their words, nothing added; null when they say nothing about the music.
- asked_sounds: sound effects they ask to hear each time something appears: on « texts » (each word or text that appears) or on « cuts » (each change of shot), the sound in a few generic English words (« light click », « soft whoosh »); empty when they ask for none.
- frame: « letterbox » when they want their videos to stay whole and horizontal, with black (or bands) above and below, instead of filling the vertical frame (« en horizontal », « en bande », « garde mes vidéos entières »); otherwise « vertical », also when they ask for vertical or full screen (the Reel's default). A format is never a layout nor a must.
- redraw: for a correction, true only when they ask to change what the layout or its animations draw (the arrangement, the split screen, the interface, an effect, a graphic element, the background, their motion or their style); false when they only touch the voice, the subtitles, the words of a text, the music, the length, the caption, the order or the choice of shots. For a new Reel: true.`;

export const EMPTY_CONTRACT: ReelContract = {
  voice_text: null,
  voice_text_mode: "verbatim",
  voice_text_rest: null,
  person: "libre",
  voice_pace: "normale",
  voice_gender: "libre",
  voice_over: "libre",
  duration: null,
  layout: null,
  screen_text: null,
  ending: null,
  call_to_action: "libre",
  call_to_action_text: null,
  musts: [],
  music: null,
  redraw: true,
  frame: "vertical",
  asked_sounds: [],
};

// A format she asks for is never a layout (bench of 6 November: « Défilé d'assiettes » asked « en vertical plein écran »
// left its model for the chain before its filler, the reader having noted it as a layout, and any layout takes a Reel out
// of its model, beyondSkills): read in her words, it goes to `frame`, and to a model's format setting (skills.ts,
// skillFramed). Her words, plain: lower case, no accents, apostrophes as spaces.
const plainWords = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, " ");

/** A band refused: still the vertical frame (« sans bandes noires »). */
const NO_BAND = /\b(sans|pas de|aucune?|jamais de|plus de|pas)( (les|des|de))? (bandes?( noires?)?|noir|bords? noirs?)\b/g;
/** Her videos whole in a band, on black. */
const BAND = /\b(bandes?( noires?)?|letterbox|entier(e|s|es)?|noir (au ?dessus|dessus) et (en dessous|au ?dessous|dessous)|(sur )?(du |fond )?noir|sans (les )?recadrer|ne (les )?recadre pas|sans recadrage|pas de recadrage)\b/g;
/** The whole vertical frame, said outright. */
const FULL = /\b(plein(e)? (ecran|cadre)|tout l ecran|full ?screen|9 ?[:/x] ?16)\b/g;
/** Vertical, horizontal: the frame's way, or her videos'. */
const UPRIGHT = /\b(verticale?s?(ment)?|verticaux|a la verticale|portrait|debout)\b/g;
const WIDE = /\b(horizonta(l|le|les|ux)(ment)?|a l horizontale|en largeur|paysage|16 ?[:/x] ?9|4 ?[:/x] ?3)\b/g;
/** The words around a format, which say nothing else (« garde mes vidéos », « tout en », « please »). */
const AROUND =
  /\b(le|la|les|l|un|une|des|de|du|d|en|au|aux|a|et|ou|mais|avec|sans|sur|dans|pour|par|tout|toute|toutes|tous|mes|ses|tes|ma|sa|ta|mon|son|ton|nos|vos|notre|votre|format|formats|cadre|ecran|image|images|video|videos|plan|plans|photo|photos|fichier|fichiers|reel|reels|montage|garde|garder|gardez|laisse|laisser|laissez|mets|mettre|met|mettez|fais|faire|faites|fait|refais|refaire|passe|passer|reste|rester|restent|pas|ne|n|stp|svp|s il te plait|s il vous plait|please|merci|comme|filme|filmee|filmees|filmes|plutot|bien|juste|seulement|uniquement|version|mode|meme|ce|cet|cette|ces|ci|oui|aussi|encore|fois|je|j|veux|voudrais|aimerais|prefere|il|faut|moi|que|qu|qui|est|c|serait|mieux)\b/g;

/**
 * The frame a text asks for when it says nothing but a format (« en vertical plein écran », « garde mes vidéos
 * entières », « en horizontal », « sans bandes noires »): « letterbox » for her videos whole in a band (a band, her
 * videos whole, black above and below, or horizontal without a word of vertical), else « vertical »; null when it says
 * anything else (a split screen, a text at the top, a frame in the frame: a layout of hers).
 */
export function formatAsked(text: string | null | undefined): "vertical" | "letterbox" | null {
  const plain = plainWords(text ?? "").replace(/[^a-z0-9:/ ]+/g, " ");
  const noBand = plain.match(NO_BAND)?.length ?? 0;
  const rest1 = plain.replace(NO_BAND, " ");
  const band = rest1.match(BAND)?.length ?? 0;
  const rest2 = rest1.replace(BAND, " ");
  const full = rest2.match(FULL)?.length ?? 0;
  const rest3 = rest2.replace(FULL, " ");
  const upright = rest3.match(UPRIGHT)?.length ?? 0;
  const rest4 = rest3.replace(UPRIGHT, " ");
  const wide = rest4.match(WIDE)?.length ?? 0;
  const left = rest4.replace(WIDE, " ").replace(AROUND, " ").replace(/[^a-z0-9]+/g, "");
  if (left || !(noBand + band + full + upright + wide)) return null;
  if (band) return "letterbox";
  if (noBand || full || upright) return "vertical";
  return "letterbox";
}

/** The vertical frame asked outright, somewhere in her request. */
const FULL_ASKED = /\b(en vertical|format vertical|a la verticale|verticalement|tout vertical|vertical plein|plein(e)? (ecran|cadre)|tout l ecran|full ?screen)\b/;

/**
 * Her request asks for the whole vertical frame (« remets-le en vertical plein écran », « sans bandes noires »), never for
 * her videos whole: a correction of a Reel the chain laid on black then fills the frame again (the contract's frame is
 * « vertical » whether she said it or not).
 */
export function fullFrameAsked(text: string | null | undefined): boolean {
  const plain = plainWords(text ?? "").replace(/[^a-z0-9:/ ]+/g, " ");
  const refused = NO_BAND.test(plain);
  NO_BAND.lastIndex = 0;
  const band = plain.replace(NO_BAND, " ").match(BAND);
  return (refused || FULL_ASKED.test(plain)) && !band;
}

/** A text that only says a format (formatAsked): never a layout of hers. */
export const formatOnly = (text: string | null | undefined): boolean => formatAsked(text) !== null;

/**
 * The contract with its format where it belongs: a layout or a must that only says a format leaves them for `frame`
 * (« letterbox » when one of them asks for her videos whole in a band, else « vertical »), so that it never takes a Reel
 * out of its model (beyondSkills) and the chain still honours it (plan.frame).
 */
export function settleFrame(c: ReelContract): ReelContract {
  const asked = [c.layout, ...c.musts].map(formatAsked).filter((f): f is "vertical" | "letterbox" => f !== null);
  if (!asked.length) return c;
  return {
    ...c,
    layout: formatOnly(c.layout) ? null : c.layout,
    musts: c.musts.filter((m) => !formatOnly(m)),
    frame: asked.includes("letterbox") ? "letterbox" : "vertical",
  };
}

/** Nothing fixed: the defaults decide everything. */
export const contractIsEmpty = (c: ReelContract | null | undefined): boolean =>
  !c ||
  (!c.voice_text &&
    c.person === "libre" &&
    c.voice_pace === "normale" &&
    c.voice_gender === "libre" &&
    (c.voice_over ?? "libre") === "libre" &&
    c.duration === null &&
    !c.layout &&
    !c.screen_text &&
    !c.ending &&
    c.call_to_action === "libre" &&
    !c.musts.length &&
    !c.music &&
    c.frame !== "letterbox" &&
    !c.asked_sounds?.length);

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
    c.voice_over === "avec" ? "Une voix off sur ce Reel" : c.voice_over === "sans" ? "Pas de voix off sur ce Reel : juste la musique" : null,
    c.duration ? `Durée : ${c.duration} s environ` : null,
    c.frame === "letterbox"
      ? "Cadre : ses vidéos entières et horizontales, sur du noir au-dessus et en dessous ; le moteur les pose ainsi (form montage, jamais une composition pour ça), les textes restent les tiens"
      : null,
    c.layout ? `Mise en page : ${c.layout}` : null,
    ...(c.asked_sounds ?? []).map((s) => `Bruitage demandé : « ${s.sound} » à ${s.on === "texts" ? "chaque texte qui apparaît" : "chaque coupe"} (posé par le moteur)`),
    c.screen_text ? `Texte à l'écran, mot pour mot (orthographe corrigée) : « ${c.screen_text} »` : null,
    c.ending ? `Fin : ${c.ending}` : null,
    c.call_to_action === "aucune" ? "Aucune invitation à la fin" : c.call_to_action === "la_sienne" && c.call_to_action_text ? `Invitation à la fin, la sienne : « ${c.call_to_action_text} »` : null,
    ...c.musts.map((m) => `Demandé : ${m}`),
    c.music ? `Musique demandée : ${c.music}` : null,
    c.redraw === false ? "La mise en page et ses animations restent telles quelles (leur code est gardé) : ne change ni la forme du Reel ni le brief de sa composition" : null,
  ].filter((l): l is string => Boolean(l));
}

/**
 * What says that words are to be heard: a voice named (« la voix dit », « voix off : », « en off », « narration »), words
 * to say or to read (« dis », « fais-lui dire », « à lire », « qu'on entende »), a text given (« texte : », « script »,
 * « mot pour mot »). Never « lis » nor « lit » (a florist's lilies, a bed).
 */
const SPOKEN_ASKED =
  /(?<![\p{L}])(?:voix|voice(?:-?over)?|vo|off|narrat\w*|raconte\w*|dis|dit|dise|disent|dites|dire|disant|lire|lise|lisez|prononce\w*|entend\w*|script|texte\s*:|mot pour mot|mot à mot)(?![\p{L}])/iu;

/** Letters and digits only, lower case, for comparing her quotes with a text. */
const bare = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Whether her request asks for this text to be said: it speaks of a voice, of words to say or read, of a text, or it
 * holds the words between quotes. A request that only describes the Reel, even a first-person sentence (« Ce week-end,
 * on part au marché aux puces. », « Je me présente : Héloïse… »), asks for none: the contract reader had taken both
 * for her words to say, and a voice-over nobody asked for was laid on « Le grand départ » and « Présente-toi ».
 */
export function asksSpokenText(request: string, text: string): boolean {
  if (SPOKEN_ASKED.test(request.normalize("NFC"))) return true;
  const said = bare(text);
  if (said.length < 4) return false;
  const quotes = [...request.matchAll(/«\s*([^»]+?)\s*»|“([^”]+)”|"([^"]+)"/g)].map((m) => bare(m[1] ?? m[2] ?? m[3] ?? ""));
  // Her quotes hold the text (or most of it): a name quoted inside a description (« Au Procope ») is no text to say.
  return quotes.some((q) => q.length >= 4 && (q.includes(said.slice(0, 40)) || (said.includes(q) && q.length * 2 >= said.length)));
}

/**
 * Her contract with a text to say only when her request asks for one (asksSpokenText); otherwise its text and its
 * continuation are taken out, the rest kept. A correction of a voice on the Reel keeps what the reader made of it (her
 * change to the current text, which her request may not quote).
 */
export function keepAskedVoice(contract: ReelContract, request: string, currentVoice?: string | null): ReelContract {
  if (!contract.voice_text && !contract.voice_text_rest) return contract;
  if (currentVoice?.trim()) return contract;
  if (asksSpokenText(request, `${contract.voice_text ?? ""} ${contract.voice_text_rest ?? ""}`)) return contract;
  return { ...contract, voice_text: null, voice_text_rest: null, voice_text_mode: "verbatim" };
}

/**
 * Her answer for this Reel's voice-over as a post's own choice (« Avec une voix off »: on; « Juste la musique »: off), for
 * when nothing set one on the post: the code applies it, Edith never has to remember to.
 */
export const contractVoice = (c: ReelContract | null | undefined): { mode: "on" | "off" } | null =>
  c?.voice_over === "avec" ? { mode: "on" } : c?.voice_over === "sans" ? { mode: "off" } : null;

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
