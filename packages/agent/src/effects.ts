import { z } from "zod";
import type { MontageQuote } from "./credits.ts";
import { MAX_REEL_SECONDS } from "./editor.ts";
import { CREDIT_VALUE_EUR, TARGET_MARGIN, TYPICAL_COST_EUR } from "./margin.ts";
import type { EditPlan } from "./schemas.ts";

// A Reel with an effect drawn on her footage, made by one agent alone (Managed Agents:
// Opus with a Linux container of its own, ffmpeg, MediaPipe, Pillow): it looks, measures
// what moves image by image (the fingertips, the hands, the body, the face), draws each
// image in code, looks at its result and corrects it, and a grader of its own checks it
// against a rubric. At the lab it beat the chain (editor, motion designer, critic) on the
// effects that hold to a gesture: a text growing between the fingers, a kamehameha from
// the hands (Tristan: « BCP MIEUX »). The chain keeps every other Reel; Simone's music, her
// voice over, the page and the publishing stay the chain's for both.

/** No session may spend more than this at list prices, in cents, whatever she can pay: the lab's kamehameha took $3.99 with one revision. */
export const EFFECTS_MAX_CENTS = 600;
/** The grader's rounds: a first take and one revision (each one about ten minutes). */
export const EFFECTS_MAX_ITERATIONS = 2;
/** Longest a session is waited for before the chain takes the Reel back. */
export const EFFECTS_TIMEOUT_MINUTES = 60;

// Its price is known once it is made (Tristan: « on peut pas calculer le débit après coup ? »): what the
// session really cost, at list prices, in credits that keep the margin, never under what the chain would
// have charged for the same Reel, never over a ceiling held while it works, and the session's own spending
// limit follows that ceiling, so it can never cost more than she can be charged.

/** What one credit pays of an effect's real cost, the margin kept (on the plan where a credit is worth least). */
export const EFFECT_EUR_PER_CREDIT = CREDIT_VALUE_EUR * (1 - TARGET_MARGIN);
/** The most an effect is charged, a new Reel or a correction (from the version she saw: usually one take). */
export const EFFECT_MAX_CREDITS = { reel: 40, fix: 25 } as const;
/** Below this ceiling (her credits are running out), the session's budget is too small for an effect: the chain makes it. */
export const EFFECT_MIN_CREDITS = { reel: 20, fix: 12 } as const;
/** Besides the agent: the render of its video with Simone's music (render-post). */
const EFFECT_EXTRAS_EUR = TYPICAL_COST_EUR.render;
/** A typical session at list prices, in euros (the fingers $1.65, the kamehameha $3.99 at the lab): when its cost cannot be read. */
export const EFFECT_TYPICAL_EUR = 2.4;

/**
 * An effect's price once it is made: its real cost (the agent, then the render and the music) in credits
 * that keep the margin, between the floor (what the chain would have charged) and the ceiling held.
 */
export function effectCredits(input: { agentEur: number | null; floor: number; ceiling: number }): number {
  const cost = Math.max(0, input.agentEur ?? EFFECT_TYPICAL_EUR) + EFFECT_EXTRAS_EUR;
  const credits = Math.ceil(cost / EFFECT_EUR_PER_CREDIT - 1e-9);
  return Math.max(input.floor, Math.min(input.ceiling, credits));
}

/** The session's spending limit for a ceiling, at list prices in cents (as Managed Agents takes it): what the ceiling pays for, less the render. */
export function effectsBudgetCents(ceiling: number, usdToEur: number): number {
  const eur = Math.max(0, ceiling * EFFECT_EUR_PER_CREDIT - EFFECT_EXTRAS_EUR);
  return Math.max(0, Math.min(EFFECTS_MAX_CENTS, Math.floor((eur / usdToEur) * 100)));
}

/**
 * The launched work, priced as an effect: the chain's price (`floor`) is the least it costs and the
 * ceiling the most; the real charge is effectCredits once it is made. Null: her credits do not leave
 * a ceiling big enough for an effect (the chain makes the Reel at its own price).
 */
export function quoteEffect(input: { correction: boolean; floor: number; available: number }): MontageQuote | null {
  const kind = input.correction ? "fix" : "reel";
  const ceiling = Math.min(EFFECT_MAX_CREDITS[kind], Math.floor(input.available));
  if (ceiling < Math.max(input.floor, EFFECT_MIN_CREDITS[kind])) return null;
  const lines = [{ label: input.correction ? "Correction de l’effet" : "Effet image par image", credits: input.floor }];
  return { lines, base: input.floor, max: ceiling, maxNewScenes: 0, fixRounds: 0 };
}

/** Who makes the Reel: the agent when her request draws on what moves in her video, else the chain. */
export const effectRouteSchema = z.object({
  agent: z.boolean(),
  /** The effect, in a few words (« le texte grossit entre ses doigts »); empty for the chain. */
  effect: z.string(),
  why: z.string(),
});
export type EffectRoute = z.infer<typeof effectRouteSchema>;

export const EFFECT_ROUTER_PROMPT = `Tu décides qui fait le prochain Reel d'une gérante de commerce de quartier, d'après ce qu'elle demande.

La chaîne de montage de Simone (par défaut) coupe et ordonne ses plans, pose des textes natifs, des sous-titres, une voix off, une musique, et des animations de motion design par-dessus sa vidéo : textes animés, formes, cadres, compteurs, collage, son détourage posé sur un plan. Ces animations suivent une main ou un visage de loin, sans plus.

L'atelier d'effets travaille image par image sur sa vidéo : il mesure ce qui bouge (le bout des doigts, les mains, le corps, le visage) et dessine un effet qui y est accroché à chaque image, comme un monteur d'effets spéciaux : un texte qui naît et grossit entre ses doigts, une boule d'énergie dans ses mains et un rayon qui part vers la caméra, un objet tenu qui suit son geste, une aura autour d'elle, un univers de dessin animé ou de film sur elle. Il coûte plus cher et prend 10 à 30 minutes.

Réponds agent = true seulement quand sa demande contient un effet de ce genre, accroché à ce qui bouge dans ses images ou qui demande de dessiner sur elle image par image. Sinon false : une ambiance, une offre, une visite, un texte animé, un collage, une voix qui raconte, une animation posée sur la vidéo restent à la chaîne, même avec des mots comme « effet » ou « animation ». Sans vidéo, toujours false. Dans le doute, false.

effect : l'effet en quelques mots quand c'est l'atelier, sinon vide. why : une phrase.`;

/** What the agent is given for her Reel. */
export type EffectsTaskInput = {
  /** Her request (what she imagines, Simone's brief, a correction). */
  request: string;
  studio: { name: string; business: string | null; facts: string[]; tone: string | null };
  /** Her charter: colours, the main one first, and fonts (titles, then text); her signature as lines. */
  brand: { colors: string[]; fonts: string[]; signature?: string };
  /** Her files, as mounted in the container, with what each one shows when it was read. */
  files: { name: string; kind: "video" | "photo"; seconds?: number | null; about?: string | null }[];
  /** A voice over the Reel (hers or Simone's), with its words timed in a JSON file. */
  voice?: { name: string; words: string; seconds: number; text: string } | null;
  /** The Reel she copies (« Steal »): its style, in lines; never its words nor its images. */
  copied?: string | null;
  /** A correction: the version she saw, to rework rather than redo. */
  previous?: { name: string } | null;
  /** The MediaPipe models, as mounted. */
  models: string[];
  /** What the session may spend, at list prices (its spending limit stops it there). */
  budgetUsd: number;
};

/** Where the session's files are mounted: a mount path is rooted there. */
export const UPLOADS = "/mnt/session/uploads";
export const OUTPUTS = "/mnt/session/outputs";

export const EFFECTS_SYSTEM = `Tu es le monteur et motion designer de Simone, l'assistante qui fait les réseaux sociaux des commerces de quartier. Tu travailles seul, dans un conteneur Linux, sur les vraies vidéos d'une gérante, pour faire le Reel qu'elle imagine avec son effet. Tu as bash, Python 3, ffmpeg, MediaPipe, OpenCV, Pillow et numpy ; les polices de Google Fonts se téléchargent (fonts.googleapis.com, fonts.gstatic.com), rien d'autre sur le réseau. Personne ne répond pendant le travail : ne pose aucune question, décide.

Ta façon de travailler, celle d'un bon motion designer :
- regarde d'abord : des planches d'images de ses vidéos (et de la version d'avant pour une correction) aux moments qui comptent ;
- mesure ce dont l'effet a besoin, image par image (le bout des doigts, les mains, le corps, le visage, la silhouette), avec les modèles MediaPipe fournis, et vérifie la mesure en dessinant des repères sur quelques images ;
- dessine chaque image en code par-dessus sa vidéo, sans aucune image ni vidéo générée par une IA ;
- regarde le résultat sur des images clés, pendant chaque geste, et corrige jusqu'à ce que ce soit juste : place, taille, timing, lisibilité, style.

Ce qui compte : l'effet qu'elle demande, fidèle à son idée et à ce qui bouge dans sa vidéo, dans un Reel qui accroche dès la première image, avec un rendu natif, comme un créateur qui monte ses propres Reels, jamais une pub ni un flyer.`;

/** The task of one session: her request, her business, her files, the Reel's rules and what to write out. */
export function effectsTask(input: EffectsTaskInput): string {
  const files = input.files.map((f) => {
    const what = [f.kind === "video" ? "vidéo" : "photo", f.seconds ? `${Math.round(f.seconds * 10) / 10} s` : "", f.about?.trim() ?? ""].filter(Boolean).join(", ");
    return `- ${UPLOADS}/${f.name} (${what})`;
  });
  const voice = input.voice;
  return [
    `Ce qu'elle demande :\n${input.request.trim()}`,
    "",
    `Le commerce : ${input.studio.name}${input.studio.business ? ` (${input.studio.business})` : ""}.${input.studio.facts.length ? ` Ce qui est vrai : ${input.studio.facts.join(" ; ")}.` : ""}${input.studio.tone ? ` Son ton : ${input.studio.tone}.` : ""}`,
    `Sa charte, un point de départ, pas une cage : couleurs ${input.brand.colors.join(", ") || "à choisir"} ; polices ${input.brand.fonts.join(" (titres), ") || "à choisir"}${input.brand.fonts.length > 1 ? " (texte)" : ""}.${input.brand.signature ? ` Sa signature : ${input.brand.signature}` : ""} Quand sa demande ou le Reel qu'elle recopie appelle un autre univers (un dessin animé, un manga, un film, un autre lettrage, d'autres couleurs), prends-le avec ses codes.`,
    ...(input.copied ? [`Le Reel qu'elle recopie (son style seulement, jamais ses mots ni ses images) : ${input.copied}`] : []),
    "",
    `Ses fichiers (lecture seule ; s'il en manque un, cherche-le avec find ${UPLOADS}) :`,
    ...files,
    "Un iPhone filme souvent en HDR (HLG, 10 bits) : passe ses vidéos en SDR avant de dessiner (zscale + tonemap), sinon les couleurs sortent délavées.",
    `Les modèles MediaPipe Tasks : ${input.models.map((m) => `${UPLOADS}/models/${m}`).join(", ")} (mains à 21 points, corps à 33 points, visages).`,
    ...(input.previous
      ? ["", `C'est une correction : la version qu'elle a vue est ${UPLOADS}/${input.previous.name}. Garde ce qui marche, change ce qu'elle demande, et rien d'autre.`]
      : []),
    "",
    `Ton budget : ${input.budgetUsd.toFixed(2).replace(".", ",")} $ pour tout le Reel, à prix catalogue (chaque appel compte, chaque image regardée aussi) ; à la limite, la session s'arrête net. Dès que tu as une version finie, garde-la dans ${OUTPUTS}/reel.mp4 avec message.txt, puis améliore-la. Pour tenir : regarde des planches de petites images plutôt qu'une image à la fois, fais tes essais en petit (540×960, sur le passage du geste) et ne rends en 1080×1920 que les versions à garder.`,
    ...(voice
      ? [
          "",
          `Sa voix off : ${UPLOADS}/${voice.name} (${Math.round(voice.seconds * 10) / 10} s ; ses mots et leurs temps dans ${UPLOADS}/${voice.words}). Ce qu'elle dit : « ${voice.text.trim()} »`,
          "Pose-la entière et telle quelle, son premier mot vers 0,2 s, sans la couper, la ralentir ni la retoucher ; le Reel dure la voix plus 1 à 2 s. Cale tes coupes et ton effet sur ses phrases. Écris ses mots en sous-titres, 2 ou 3 mots à la fois, petits et lisibles comme les sous-titres d'Instagram, dans le style du Reel, au-dessus des 320 px du bas ; la voix porte le message, peu d'autre texte.",
        ]
      : []),
    "",
    "Le Reel :",
    `- 1080×1920, recadré sur ce qui compte, sans bandes ; 30 i/s ; H.264 yuv420p (CRF 18) avec une piste son AAC ; 7 à ${MAX_REEL_SECONDS} s (7 à 15 s pour un effet ou une annonce, plus quand une voix raconte) ;`,
    "- il accroche dès la première image : l'effet, ou ce qui intrigue, commence tout de suite ; coupe les secondes d'attente avant le geste et ce qui ne sert pas ;",
    "- les textes se lisent sur un téléphone et restent dans la zone sûre d'Instagram : rien d'important dans les 320 px du bas ni les 140 px de droite. Peu de texte, des phrases courtes de créateur, en français, avec les espaces insécables avant : ; ! ? % ; jamais une pub ni un flyer ;",
    "- un visage reste dégagé, sauf quand l'effet le demande (un texte né entre ses doigts devant son visage, un effet posé sur elle) ;",
    // The mix that lays the music brings the video's own sound to a voice's level: a quiet room tone left in would come up with it.
    `- le son : ${voice ? "sa voix off" : "la voix de quelqu'un qui parle dans ses vidéos"} reste claire ; le reste du son d'origine se coupe : une musique est posée sous le Reel après toi, n'en mets pas. Des bruitages seulement quand l'effet les appelle (un dessin animé, une explosion), discrets.`,
    "",
    `À écrire dans ${OUTPUTS}/, à plat, sans sous-dossier :`,
    "- reel.mp4 ;",
    "- 6 à 10 images JPEG du Reel final aux moments qui comptent, nommées par leur temps : frame-03.40s.jpg… ;",
    "- notes.md : ce que tu as mesuré, comment l'effet suit la vidéo, ce que tu as corrigé après avoir regardé, en quelques lignes ;",
    "- message.txt : deux phrases pour elle, en la tutoyant, sans jargon : ce que tu as fait de son idée, et, si un moment manquait dans ses vidéos pour que l'effet soit parfait, ce qu'elle peut filmer en quelques secondes.",
  ].join("\n");
}

/** The grader's rubric: each point checked on its own, the voice's only when there is one. */
export function effectsRubric({ voice }: { voice: boolean }): string {
  const points = [
    `${OUTPUTS}/reel.mp4 existe et se lit : 1080×1920, 30 i/s, H.264, une piste son AAC, 7 à ${MAX_REEL_SECONDS} s.`,
    "L'effet qu'elle demande est dans la vidéo, dessiné par-dessus ses vraies images (aucune image générée).",
    "L'effet suit ce à quoi il est accroché dans sa vidéo, à chaque image où il en dépend (place, taille, angle ou timing) : vérifié sur les images des moments où ça bouge.",
    "Il se passe quelque chose dès la première seconde : l'effet ou ce qui intrigue, pas des secondes d'attente.",
    "6 à 10 images frame-<temps>.jpg du Reel final, qui couvrent chaque moment de l'effet.",
    "Sur ces images, chaque texte est entier dans le cadre, lisible à la taille d'un téléphone, et hors des 320 px du bas et des 140 px de droite.",
    "Le style va avec sa demande, ou avec le Reel qu'elle recopie : rien qui fasse pub ou flyer (étoile promo, badge de soldes), sauf si elle l'a demandé ou si l'univers qu'elle nomme le fait lui-même (des traits de vitesse dans un manga, une explosion dans un dessin animé).",
    ...(voice ? ["Sa voix off est entière et intacte, son premier mot vers 0,2 s, et ses mots sont sous-titrés, lisibles, hors des 320 px du bas."] : []),
    "notes.md dit ce qui a été mesuré, comment l'effet suit la vidéo et ce qui a été corrigé après avoir regardé ; message.txt lui parle en deux phrases.",
  ];
  return ["# Critères, chacun noté à part", ...points.map((p, i) => `${i + 1}. ${p}`)].join("\n");
}

/** Her two sentences from message.txt, cleaned and bounded (null when the agent wrote none). */
export function effectsMessage(text: string | null | undefined): string | null {
  const clean = (text ?? "")
    .replace(/[#*_`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  if (clean.length <= 500) return clean;
  const cut = clean.slice(0, 500);
  const end = cut.lastIndexOf(". ");
  return end > 200 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

/** The length of an MP4 (s), read in its movie header (moov › mvhd); null when it is not found. */
export function mp4Duration(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) => String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
  /** The boxes between start and end: offset of each box, its type and where it ends. */
  const boxes = function* (start: number, end: number) {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return;
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return;
      yield { at, kind: type(at), body: at + header, end: at + size };
      at += size;
    }
  };
  for (const box of boxes(0, bytes.length)) {
    if (box.kind !== "moov") continue;
    for (const child of boxes(box.body, box.end)) {
      if (child.kind !== "mvhd" || child.body + 32 > child.end) continue;
      const v1 = bytes[child.body] === 1;
      const timescale = view.getUint32(child.body + (v1 ? 20 : 12));
      const duration = v1 ? Number(view.getBigUint64(child.body + 24)) : view.getUint32(child.body + 16);
      return timescale ? Math.round((duration / timescale) * 1000) / 1000 : null;
    }
  }
  return null;
}

/** A correction of her effect that takes its voice out (the voice is mixed into the agent's video). */
export const EFFECT_VOICE_OUT = "Retire la voix off et ses sous-titres de ce Reel ; garde l'effet, les plans, les textes et le rythme tels quels.";

const BLUR_WORDS: Record<string, string> = { face: "les visages", plate: "les plaques d'immatriculation", screen: "les écrans", document: "les papiers et documents", other: "ce qu'il faut cacher" };

/** A correction of her effect that blurs what she asked for (her blur is drawn by the agent, the engine's would not reach its video). */
export function effectBlurBrief(kinds: string[]): string {
  if (!kinds.length) return "Retire le flou de ce Reel ; garde l'effet et tout le reste tels quels.";
  const what = [...new Set(kinds.map((k) => BLUR_WORDS[k] ?? BLUR_WORDS.other))].join(", ");
  return `Floute ${what} dans ce Reel, partout où on les voit (un flou qui suit chaque image), sans toucher à l'effet ; garde tout le reste tel quel.`;
}

/** A Reel the agent made: kept as a plan of one shot (its video), marked as made outside the engine. */
export function effectPlan(input: { mediaId: string; seconds: number; session: string; voice?: EditPlan["voice"] }): EditPlan {
  const seconds = Math.max(3, Math.min(90, Math.round(input.seconds * 1000) / 1000));
  return {
    format: "9:16",
    duration: seconds,
    template: "libre",
    segments: [{ clip_id: input.mediaId, in: 0, out: seconds, zoom: "none" }],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    baked: { by: "agent", session: input.session },
    ...(input.voice ? { voice: input.voice } : {}),
  };
}

/** A plan whose video was made by the effects agent: played as it is, its texts are in the image. */
export const isBaked = (plan: Pick<EditPlan, "baked"> | null | undefined): boolean => Boolean(plan?.baked);
