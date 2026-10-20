import { z } from "zod";
import { MAX_AVERAGE_SHOT, type QualityOptions } from "./critic.ts";
import { BEAT_STEP } from "./mix.ts";
import { OUTLINE_CHARS } from "./reel-model.ts";
import { clip, SIGNATURE_GRADES, type BrandSignature } from "./signature.ts";

// « Steal » (Tristan : « tu envoies le lien d'un Reel et il recopie la DA », « c'est one
// shot »): a Reel the manager likes (a link sent in the chat or on WhatsApp, a video she
// sends, a share to Simone on Instagram) is the model of one Reel of hers, the one she makes
// next, never a mode for all of them. What the frames cannot show is measured in the sandbox
// (its cuts, its tempo, its loudness); what they show is read once by Gemini (the form, the
// hook, the texts and how they are set, the effect, the light, the movement, the music it
// calls for). The style is kept on its inspiration and that Reel copies it (posts.inspiration_id):
// its look goes over her charter for that Reel only (titles, key words, the box under a phrase,
// the light, the movement, the music, and its font and colours when they make its style:
// Tristan, « il peut prendre des libertés sur la DA si le reel ou la demande nécessite cette
// liberté ») and its pace guides the editor and the critic (the form, a shot every so many
// seconds, the tempo, the amount of text, the effect, the ending). Never the other Reel's
// images, words or music.

/** What the sandbox measures on the Reel (ffprobe, ffmpeg's scene detection, EBU R128, its bass). */
export const reelMeasuresSchema = z.object({
  duration: z.number().nonnegative(),
  /** Times of the hard cuts (s). */
  cuts: z.array(z.number().nonnegative()).max(400),
  /** Beats per minute of its soundtrack, when a steady beat stands out. */
  bpm: z.number().min(50).max(200).nullable(),
  /** Its loudness (LUFS), null when silent. */
  lufs: z.number().nullable(),
});
export type ReelMeasures = z.infer<typeof reelMeasuresSchema>;

/** Seconds per shot, from the cuts (the length when there is none). */
export const secondsPerShot = (m: Pick<ReelMeasures, "duration" | "cuts">) => Math.round((m.duration / (m.cuts.length + 1)) * 100) / 100;

const FORMATS = ["raconte", "message", "pov", "collage", "autre"] as const;
const TEXT_AMOUNTS = ["aucun", "une ligne", "un message tenu", "plusieurs"] as const;
/** A Google Fonts family name, and a colour as the render takes it. */
const FONT_FAMILY = /^[A-Za-z0-9 ]{2,40}$/;
const HEX = /^#[0-9a-f]{6}$/;

/** The reading as Gemini writes it: words taken as written, clamped after (stolenLook). */
export const stolenLookReadingSchema = z.object({
  name: z.string().describe("Un nom court pour ce style, 2 à 4 mots, sans nom de personne ni de marque (ex. « message clé rétro », « visite en plans serrés »)"),
  format: z
    .enum(FORMATS)
    .describe(
      "raconte : une voix raconte ; message : un seul message clé posé à l'écran presque tout le Reel, sans voix ; pov : une visite ou un point de vue avec une petite ligne au début ; collage : du motion design fait main (papiers, découpes) ; autre",
    ),
  voice: z.enum(["voix off", "quelqu'un parle", "aucune"]).describe("Qui parle : une voix off, quelqu'un à l'écran, ou personne"),
  hook: z.object({
    kind: z.enum(["question", "chiffre", "pov", "promesse", "mystère", "geste", "aucun"]).describe("La forme de l'accroche des 2 premières secondes"),
    what: z.string().describe("Ce qui accroche, en une phrase (l'image et le texte), sans recopier ses mots"),
  }),
  text: z.object({
    amount: z.enum(TEXT_AMOUNTS).describe("Combien de texte posé sur la vidéo (hors sous-titres)"),
    composition: z.string().describe("Comment le texte est composé : niveaux (titre, sous-titre, détails), tailles relatives, place à l'écran, sans recopier ses mots"),
    case: z.enum(["upper", "normal"]).describe("Les titres en capitales (upper) ou en casse normale (normal)"),
    weight: z.enum(["regular", "bold", "black"]).describe("La graisse des titres : regular, bold (gras), black (très gras)"),
    tracking: z.enum(["tight", "normal", "wide"]).describe("L'espacement des lettres des titres : tight (serré), normal, wide (aéré)"),
    align: z.enum(["left", "center"]).describe("L'alignement des textes"),
    stress: z
      .enum(["color", "block", "serif", "marker", "none"])
      .describe("Comment un mot clé ressort : color (dans une couleur), block (sur un aplat), serif (en serif italique), marker (entouré ou souligné à la main), none (rien ne ressort)"),
    band: z
      .enum(["white", "accent", "dark", "light", "outline", "none"])
      .describe("Le fond sous une phrase posée sur la vidéo : white (la boîte blanche d'Instagram), accent (un aplat de couleur vive), dark (un aplat sombre), light (un aplat clair), outline (un cadre fin), none (le texte nu sur l'image)"),
    subtitles: z.boolean().describe("Des sous-titres de ce qui est dit"),
    font: z
      .string()
      .describe(
        "Seulement si la police de ses titres fait son style (on ne reconnaîtrait pas ce Reel avec une autre : très condensée, manuscrite, de bande dessinée, rétro, à forts empattements…) : la famille Google Fonts qui lui ressemble le plus à l'œil, au nom exact (ex. « Anton », « Bangers »). Sinon une chaîne vide : un sans-serif ordinaire ne fait pas un style",
      ),
  }),
  colors: z
    .array(z.string())
    .describe(
      "Seulement si les couleurs de ses textes et de ses formes font son style (un jaune cerné de noir, un néon, une palette rétro…) : 1 à 3 couleurs hex (#RRGGBB), la plus visible d'abord. Sinon une liste vide : les couleurs de ses images ne comptent pas, ni un texte blanc ou noir ordinaire",
    ),
  effect: z.enum(["dust", "grain", "none"]).describe("Un effet sur toute la vidéo : dust (poussière et rayures de pellicule), grain, none"),
  grade: z
    .enum(SIGNATURE_GRADES)
    .describe("La lumière et les couleurs de ses images : natural, warm (chaude), bright (claire et aérée), flash (flash direct), film (argentique), moody (sombre et contrastée), cool (froide)"),
  motion: z
    .enum(["epure", "chaleureux", "energique", "fait_main"])
    .describe("Le mouvement de ses textes et animations : epure (lent, aéré), chaleureux (mots sur le temps, formes rondes), energique (franc, gros mots qui claquent), fait_main (tracés, découpes)"),
  camera: z.enum(["fixe", "à la main", "stabilisée", "mixte"]).describe("Comment c'est filmé"),
  transitions: z.enum(["coupes nettes", "fondus", "effets"]).describe("Comment les plans s'enchaînent"),
  music: z.string().describe("La musique en anglais, pour un compositeur : genre, énergie, instruments (ex. « upbeat deep house, warm bass »), jamais un titre ni un artiste"),
  ending: z.string().describe("Comment il finit (un plan, un texte, une boucle), sans recopier ses mots"),
  why: z.string().describe("Pourquoi il marche, en une ou deux phrases"),
});
export type StolenLookReading = z.infer<typeof stolenLookReadingSchema>;

/** The longest words of a stolen look, as it is kept. */
const LOOK_CHARS = { name: 40, what: 200, composition: 240, music: 80, ending: 160, why: 300 } as const;

/**
 * A stolen look as it is kept: the reading within its lengths. Its font and colours only when
 * they make its style (a look read before they were read has neither).
 */
export const stolenLookSchema = stolenLookReadingSchema.extend({
  name: z.string().max(LOOK_CHARS.name),
  hook: stolenLookReadingSchema.shape.hook.extend({ what: z.string().max(LOOK_CHARS.what) }),
  text: stolenLookReadingSchema.shape.text.extend({ composition: z.string().max(LOOK_CHARS.composition), font: z.string().regex(FONT_FAMILY).optional() }),
  colors: z.array(z.string().regex(HEX)).min(1).max(3).optional(),
  music: z.string().max(LOOK_CHARS.music),
  ending: z.string().max(LOOK_CHARS.ending),
  why: z.string().max(LOOK_CHARS.why),
});
export type StolenLook = z.infer<typeof stolenLookSchema>;

/** A colour as written (« #FFD400 », « #fd0 »), as the render takes it (« #ffd400 »), or null. */
function hexColor(written: string): string | null {
  const c = written.trim().toLowerCase();
  if (HEX.test(c)) return c;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  return short ? `#${short[1]!.repeat(2)}${short[2]!.repeat(2)}${short[3]!.repeat(2)}` : null;
}

/** Structured outputs do not enforce lengths: the reading is taken as written, then clamped. */
export function clampLook(reading: StolenLookReading): StolenLook {
  const { colors: written, text: { font: named, ...text }, ...rest } = reading;
  const font = named.trim();
  const colors = [...new Set(written.flatMap((c) => hexColor(c) ?? []))].slice(0, 3);
  return {
    ...rest,
    name: clip(reading.name, LOOK_CHARS.name) || "son style",
    hook: { ...reading.hook, what: clip(reading.hook.what, LOOK_CHARS.what) },
    text: { ...text, composition: clip(reading.text.composition, LOOK_CHARS.composition), ...(FONT_FAMILY.test(font) ? { font } : {}) },
    ...(colors.length ? { colors } : {}),
    music: clip(reading.music, LOOK_CHARS.music),
    ending: clip(reading.ending, LOOK_CHARS.ending),
    why: clip(reading.why, LOOK_CHARS.why),
  };
}

/**
 * A stolen style as it is kept on its inspiration (inspirations.style): the reading and the
 * measures; for one of her own Reels kept as a model (reel-model.ts), its plan's structure too.
 */
export const stolenStyleSchema = z.object({ look: stolenLookSchema, measures: reelMeasuresSchema, outline: z.string().max(OUTLINE_CHARS).optional() });
export type StolenStyle = z.infer<typeof stolenStyleSchema>;

export const STEAL_PROMPT = `Tu es la directrice artistique de Simone, qui monte les Reels Instagram d'un commerce de quartier (studio, salon, restaurant, boutique…). La personne qui gère le commerce veut reprendre le style de ce Reel pour les siens : lis-le comme une monteuse pro qui veut en refaire le style, pas le contenu.
Regarde tout le Reel, image par image, avec le son : la forme (raconté par une voix, un message clé tenu, une visite, du collage), l'accroche des 2 premières secondes, le texte posé sur la vidéo (combien, comment il est composé : niveaux, tailles, casse, graisse, espacement des lettres, mot clé, fond sous la phrase, place, alignement ; sa police et ses couleurs seulement quand elles font son style), les sous-titres, l'effet sur la vidéo (poussière de pellicule, grain), la lumière, le mouvement des textes, la caméra, les transitions, la musique (genre et énergie, pour un compositeur), la fin.
Ne recopie ni ses mots, ni ses images, ni le nom de sa musique : décris une forme réutilisable par un autre commerce. N'accorde rien au féminin ou au masculin pour la personne qui gère. En français, sauf « music » en anglais.`;

/** The style one Reel copies (from its inspiration's stolen style): its look and its pace. */
export const followedStyleSchema = z.object({
  inspiration_id: z.uuid(),
  look: stolenLookSchema,
  /** Seconds per shot of the stolen Reel, and its tempo, when measured. */
  average_shot: z.number().min(0.2).max(30).nullable(),
  bpm: z.number().min(50).max(200).nullable(),
  /** One of her own Reels, kept as a model: redone with her new images, its structure known. */
  own: z.boolean().optional(),
  outline: z.string().max(OUTLINE_CHARS).optional(),
});
export type FollowedStyle = z.infer<typeof followedStyleSchema>;

/** The style a Reel copies, from a kept stolen style (a single shot of minutes counts as 30 s). `own`: one of her Reels, kept as a model. */
export function followedFrom(inspirationId: string, style: StolenStyle, own = false): FollowedStyle {
  return {
    inspiration_id: inspirationId,
    look: style.look,
    average_shot: style.measures.duration > 0 ? Math.min(30, Math.max(0.2, secondsPerShot(style.measures))) : null,
    bpm: style.measures.bpm === null ? null : Math.round(style.measures.bpm),
    ...(own ? { own: true } : {}),
    ...(style.outline ? { outline: style.outline } : {}),
  };
}


/** French words for the manager and the editor. */
const FORMAT_WORDS: Record<StolenLook["format"], string> = {
  raconte: "raconté par une voix",
  message: "un seul message clé tenu à l'écran, sans voix",
  pov: "une visite en point de vue, une petite ligne au début",
  collage: "du motion design fait main",
  autre: "son propre format",
};
const EFFECT_WORDS: Record<StolenLook["effect"], string> = { dust: "une poussière de pellicule", grain: "du grain", none: "" };

const seconds = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);

/** Its pace in words: « un plan toutes les 1,4 s, coupé sur une musique à 118 BPM ». */
function paceWords(averageShot: number | null, bpm: number | null, cuts?: number): string {
  const pace = averageShot === null || cuts === 0 ? "un seul plan" : `un plan toutes les ${seconds(averageShot)} s`;
  return `${pace}${bpm ? `, coupé sur une musique à ${Math.round(bpm)} BPM` : ""}`;
}

/**
 * What Simone tells the manager she takes from the Reel (3 short lines), before she
 * asks whether her next Reels follow it.
 */
export function stolenStyleLines(style: StolenStyle): string[] {
  const { look, measures } = style;
  const effect = EFFECT_WORDS[look.effect];
  return [
    `La forme : ${FORMAT_WORDS[look.format]}, ${paceWords(secondsPerShot(measures), measures.bpm, measures.cuts.length)}.`,
    `Le texte : ${look.text.composition.replace(/[.\s]+$/, "")}${look.text.subtitles ? ", avec des sous-titres" : ""}.`,
    [`L'ambiance : ${look.music}`, effect, look.why.replace(/[.\s]+$/, "")].filter(Boolean).join(" ; ") + ".",
  ];
}

/** What the sandbox measured, for Gemini: exact numbers it should not count again. */
export function measuresLine(measures: ReelMeasures): string {
  const cuts = measures.cuts.length;
  return [
    `durée ${seconds(measures.duration)} s`,
    cuts ? `${cuts} coupe${cuts > 1 ? "s" : ""} franche${cuts > 1 ? "s" : ""} (un plan toutes les ${seconds(secondsPerShot(measures))} s)` : "aucune coupe franche (un seul plan, ou des fondus)",
    measures.bpm ? `un rythme régulier à ${Math.round(measures.bpm)} BPM` : "pas de rythme régulier dans le son (une voix, une ambiance)",
    ...(measures.lufs !== null ? [`volume ${Math.round(measures.lufs)} LUFS`] : ["pas de son"]),
  ].join(" ; ");
}

/** What her Reel keeps of hers: her images always, her fonts and colours unless the copied Reel's make its style. */
function keptWords(look: StolenLook): string {
  const font = Boolean(look.text.font);
  const colors = Boolean(look.colors?.length);
  if (font && colors) return "Avec tes images, et une police et des couleurs comme les siennes (elles font son style)";
  if (font) return "Avec tes couleurs et tes images, et une police comme la sienne (elle fait son style)";
  if (colors) return "Avec tes polices et tes images, et ses couleurs (elles font son style)";
  return "Avec tes couleurs, tes polices et tes images";
}

/**
 * What Simone sends once she has read the Reel: what she takes from it for hers. `making`: her
 * Reel is already on its way in this style; else she is asked for her videos or photos.
 */
export function stolenStyleMessage(style: StolenStyle, making: boolean): string {
  return [
    `J’ai regardé ce Reel 👀 Voilà ce que je reprends pour ${making ? "le tien" : "ton prochain Reel"} :`,
    stolenStyleLines(style).join("\n"),
    `${keptWords(style.look)} : sa façon de faire, jamais ses images ni ses mots. ${
      making ? "Ton Reel arrive dans quelques minutes." : "Envoie-moi tes vidéos ou tes photos (ou dis-moi lesquelles prendre) et je te fais le tien comme ça."
    }`,
  ].join("\n\n");
}

/** Why it could not be read, and what she can do instead. `handle`: Simone's Instagram account, when there is one. */
export function stealMissMessage(miss: "unreachable" | "too_long" | "not_video" | "unreadable" | "not_found", handle?: string | null): string {
  const share = handle ? `, ou partage-le à @${handle} sur Instagram (bouton Partager)` : "";
  switch (miss) {
    case "unreachable":
      return `Je n’arrive pas à ouvrir ce Reel depuis son lien (Instagram et TikTok ne me laissent pas toujours entrer). Enregistre-le et envoie-moi la vidéo ici${share} : je le regarde aussitôt.`;
    case "too_long":
      return "Cette vidéo dure plus de 3 minutes : envoie-moi un Reel plus court, ou juste le passage qui te plaît.";
    case "not_video":
      return "Je n’y trouve pas de vidéo : Instagram ne me laisse pas ouvrir un carrousel par son lien. Envoie-moi une vidéo où tu le fais défiler (enregistrement d’écran), ou des captures : je recopie sa mise en page et son style.";
    case "unreadable":
      return "Je n’ai pas réussi à le regarder cette fois. Tu veux que je réessaie ?";
    case "not_found":
      return "Je ne retrouve pas cette vidéo. Tu peux me la renvoyer ?";
  }
}

/** Her charter with a followed style's look over it: its titles, key words, box, light, movement and music. */
export function followedSignature(signature: BrandSignature | undefined, look: StolenLook): BrandSignature {
  const base: BrandSignature = signature ?? {
    titles: { font: "display", case: "normal", weight: "bold", align: "center", tracking: "normal" },
    stress: "color",
    band: "white",
    grade: "natural",
    base: "light",
    motion: "chaleureux",
    music: "",
    voice: "",
  };
  return {
    ...base,
    // How the titles are set; which font is hers, or the copied Reel's when it makes its style (followedLook, on the plan).
    titles: { ...base.titles, case: look.text.case, weight: look.text.weight, align: look.text.align, tracking: look.text.tracking },
    ...(look.text.stress !== "none" ? { stress: look.text.stress } : {}),
    ...(look.text.band !== "none" ? { band: look.text.band } : {}),
    grade: look.grade,
    motion: look.motion,
    ...(look.music.trim() ? { music: clip(look.music, LOOK_CHARS.music) } : {}),
  };
}

/** The signature the engine applies: her charter, under the style she follows. */
export function signatureOf(profile: { signature?: BrandSignature; followed?: FollowedStyle } | null | undefined): BrandSignature | undefined {
  if (!profile) return undefined;
  return profile.followed ? followedSignature(profile.signature, profile.followed.look) : profile.signature;
}

/**
 * The copied Reel's font and colours, when they make its style: this Reel takes them over her
 * charter's (its titles in that font, its key words in that colour), set on the plan so the
 * render, the live preview and the animations agree. A font this request chose stays.
 */
export function followedLook(
  plan: { fonts?: { display?: string; body?: string }; colors?: string[] },
  followed: FollowedStyle | undefined,
): { fonts?: { display?: string; body?: string }; colors?: string[] } {
  const font = followed?.look.text.font;
  const colors = followed?.look.colors;
  return {
    ...(font && !plan.fonts?.display ? { fonts: { ...plan.fonts, display: font } } : {}),
    ...(colors?.length && !plan.colors?.length ? { colors } : {}),
  };
}

/** The copied Reel's font and colours in words (what this Reel takes from them), or null. */
function takenLook(look: StolenLook): string | null {
  const taken = [look.text.font && `sa police (${look.text.font})`, look.colors?.length && `ses couleurs (${look.colors.join(", ")})`].filter(Boolean);
  return taken.length ? `${taken.join(" et ")} : ${taken.length > 1 ? "elles font" : "elle fait"} son style, ce Reel les prend à la place de celles de sa charte` : null;
}

/** A followed tempo as a plan holds it (60 to 140 BPM): a faster beat is cut at half time, on the same kicks. */
export const followedTempo = (bpm: number) => Math.round(bpm > 140 ? bpm / 2 : bpm);

/** The followed style as the editor reads it: its form and pace, never its images, words or music. */
export function followedForEditor(followed: FollowedStyle) {
  const { look } = followed;
  return {
    nom: look.name,
    ...(followed.own ? { origine: "un de ses Reels à elle, qu'elle a gardé comme modèle : refais-le avec ses nouvelles images et de nouveaux mots" } : {}),
    // Its plan, when it is one of hers: the same build, shot for shot and text for text, cut to her new images.
    ...(followed.outline ? { structure: followed.outline } : {}),
    forme: FORMAT_WORDS[look.format],
    voix: look.voice,
    rythme: paceWords(followed.average_shot, followed.bpm),
    ...(followed.average_shot !== null ? { plan_moyen_s: followed.average_shot } : {}),
    ...(followed.bpm !== null ? { tempo_bpm: followedTempo(followed.bpm) } : {}),
    accroche: `${look.hook.kind} : ${look.hook.what}`,
    texte: `${look.text.amount} ; ${look.text.composition}${look.text.subtitles ? " ; des sous-titres" : ""}`,
    // Already set on the plan by the engine (followedLook): the editor and the animations follow it.
    ...(takenLook(look) ? { police_et_couleurs: takenLook(look)! } : {}),
    ...(look.effect !== "none" ? { effet: EFFECT_WORDS[look.effect] } : {}),
    camera: look.camera,
    transitions: look.transitions,
    fin: look.ending,
    pourquoi: look.why,
  };
}

/** The followed style in one line, for the critic: the Reel must follow it, its ending and its voice too. */
export function followedLine(followed: FollowedStyle): string {
  const { look } = followed;
  return [
    `Reel à recopier (${followed.own ? "un de ses Reels, gardé comme modèle" : "un Reel qu'elle a envoyé"}, « ${look.name} ») : ${FORMAT_WORDS[look.format]}, ${paceWords(followed.average_shot, followed.bpm)}`,
    `accroche ${look.hook.kind}`,
    `texte : ${look.text.amount}`,
    // With a voice, whether its words are written on screen: a copy may speak without subtitles.
    look.voice === "aucune" ? "voix : aucune" : `voix : ${look.voice}, ${look.text.subtitles ? "avec" : "sans"} sous-titres`,
    ...(takenLook(look) ? [takenLook(look)!] : []),
    ...(look.effect !== "none" ? [EFFECT_WORDS[look.effect]] : []),
    `transitions : ${look.transitions}`,
    `fin : ${look.ending.replace(/[.\s]+$/, "")}`,
  ].join(" ; ");
}

/**
 * What the Reel she copies changes in the quality checks (Tristan: « mais si par exemple elle
 * veut copier un autre reel ? »): its pace, a hook without written words (it opens on a gesture,
 * or has no text at all), several texts. Our defaults never ask a Reel to be what it copies is not.
 */
export function followedChecks(followed: FollowedStyle | undefined): QualityOptions {
  if (!followed) return {};
  const { text, hook } = followed.look;
  return {
    paceCeiling: paceCeiling(MAX_AVERAGE_SHOT, followed),
    wordlessHook: text.amount === "aucun" || hook.kind === "geste" || hook.kind === "aucun",
    manyTexts: text.amount === "plusieurs",
  };
}

/** The longest average shot a Reel may have, with a followed style that takes its time (a posed Reel, a told one). */
export function paceCeiling(base: number, followed: FollowedStyle | undefined): number {
  return followed?.average_shot ? Math.max(base, Math.min(4, Math.round(followed.average_shot * 1.25 * 10) / 10)) : base;
}

/** A link to a Reel, a TikTok or a YouTube Short in a message, and where it is from (without its share parameters, which change at each share). */
export function reelLink(text: string): { url: string; platform: "instagram" | "tiktok" | "youtube" } | null {
  const patterns: [RegExp, "instagram" | "tiktok" | "youtube"][] = [
    [/https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/[\w-]+\/?(?:\?[^\s]*)?/i, "instagram"],
    [/https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i, "tiktok"],
    [/https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/[\w-]+(?:\?[^\s]*)?/i, "youtube"],
    [/https?:\/\/youtu\.be\/[\w-]+(?:\?[^\s]*)?/i, "youtube"],
  ];
  for (const [pattern, platform] of patterns) {
    const found = pattern.exec(text)?.[0];
    // A link closed by punctuation or a bracket in the sentence keeps none of it.
    if (found) return { url: found.replace(/[?#].*$/, "").replace(/[)\].,;!?»"']+$/, ""), platform };
  }
  return null;
}

/** The hard cuts ffmpeg's scene detection printed (« lavfi.scd.time: 1.234 »), at least `gap` s apart, inside the Reel. */
export function parseSceneCuts(log: string, duration: number, gap = 0.2): number[] {
  const times = [...log.matchAll(/lavfi\.scd\.time:\s*([0-9.]+)/g)].map((m) => Number(m[1])).filter((t) => Number.isFinite(t) && t > 0.1 && t < duration - 0.1);
  const cuts: number[] = [];
  for (const t of times.sort((a, b) => a - b)) if (!cuts.length || t - cuts.at(-1)! >= gap) cuts.push(Math.round(t * 100) / 100);
  return cuts.slice(0, 400);
}

/** How regularly a soundtrack's attacks come back, at least, to have a beat (see tempoOf). */
export const BEAT_STRENGTH = 0.2;

/**
 * The tempo of a soundtrack from its bass levels (dB every BEAT_STEP, as the sandbox reads
 * them for the music), between 70 and 160 BPM, or null under 4 s or without a steady beat.
 * Its attacks (the rises of the bass the beat grid reads) must come back on one period:
 * their autocorrelation there is at least BEAT_STRENGTH. Measured on real Reels: a house
 * track 0.45 to 0.54, a slower groove 0.23 to 0.28, a voice over music 0.05 to 0.07, and
 * syllables at random never above 0.15 (the best grid alone found a tempo in all of them).
 * Twice as fast meets the same kicks and the ones between: the faster when it holds up.
 * Then the exact tempo: the grid meeting the strongest attacks within 3 % of that period.
 */
export function tempoOf(levels: number[]): number | null {
  if (levels.length * BEAT_STEP < 4) return null;
  const loud = [...levels].sort((a, b) => a - b)[Math.floor(0.9 * (levels.length - 1))]!;
  // A silence held 40 dB under its loud level; each attack spread over ±10 ms (a beat a step early meets itself).
  const db = levels.map((v) => Math.max(Number.isFinite(v) ? v : -120, loud - 40));
  const rise = db.map((v, i) => (i ? Math.min(12, Math.max(0, v - db[i - 1]!)) : 0));
  const onset = rise.map((_, i) => Math.max(rise[i - 1] ?? 0, rise[i]!, rise[i + 1] ?? 0));
  const mean = onset.reduce((a, b) => a + b, 0) / onset.length;
  const centred = onset.map((v) => v - mean);
  const energy = centred.reduce((a, b) => a + b * b, 0);
  if (!energy) return null;
  const back = (lag: number) => {
    let sum = 0;
    for (let i = 0; i + lag < centred.length; i++) sum += centred[i]! * centred[i + lag]!;
    return sum / energy;
  };
  const steps = (bpm: number) => Math.round(60 / bpm / BEAT_STEP);
  let best = { lag: 0, strength: 0 };
  for (let lag = steps(160); lag <= steps(70); lag++) {
    const strength = back(lag);
    if (strength > best.strength) best = { lag, strength };
  }
  if (best.strength < BEAT_STRENGTH) return null;
  const half = Math.round(best.lag / 2);
  if (half >= steps(160)) {
    const strength = back(half);
    if (strength >= 0.8 * best.strength) best = { lag: half, strength };
  }
  const at = (t: number) => onset[Math.round(t / BEAT_STEP)] ?? 0;
  const length = levels.length * BEAT_STEP;
  // A tempo's grid at its best offset: the mean attack on its beats.
  const grid = (bpm: number) => {
    const period = 60 / bpm;
    let top = 0;
    for (let offset = 0; offset < period; offset += BEAT_STEP) {
      let score = 0;
      let beats = 0;
      for (let t = offset; t < length - BEAT_STEP; t += period, beats++) score += at(t);
      top = Math.max(top, beats ? score / beats : 0);
    }
    return top;
  };
  const around = 60 / (best.lag * BEAT_STEP);
  let tempo = { bpm: around, top: -1 };
  for (let bpm = Math.max(70, Math.ceil(around * 0.97 * 2) / 2); bpm <= Math.min(160, around * 1.03); bpm += 0.5) {
    const top = grid(bpm);
    if (top > tempo.top) tempo = { bpm, top };
  }
  return Math.round(tempo.bpm);
}
