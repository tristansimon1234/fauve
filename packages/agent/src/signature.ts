import { z } from "zod";

// A business's art direction as the engine applies it. The written direction (art_direction,
// the moodboard's reading) guides the editor and the motion designer; the signature is the
// same direction as settings, read once from its site or its moodboard, that every Reel and
// every photo follows without having to be asked: its titles set like its site's titles, its
// key words standing out its way, the box under a statement, the light of its pictures, its
// screens light or dark, the movement of its animations, its music and the way it talks. A
// Reel's rhythm is chosen for that Reel (its tempo): a business has no ambiance to keep to.

export const SIGNATURE_GRADES = ["natural", "warm", "bright", "flash", "film", "moody", "cool"] as const;

/** The longest words of a signature: a stored profile keeps them within these. */
const SIGNATURE_CHARS = { music: 80, voice: 200, delivery: 140 } as const;
/** The voices of Simone's gallery a business can sound like (SIMONE_VOICES without the whispered ones). */
export const NARRATOR_NAMES = ["Eva", "Victoria", "Lucie", "Neto", "Antonin", "Jules"] as const;

export const narratorSchema = z
.object({
    voice: z
      .enum(NARRATOR_NAMES)
      .describe(
        "La voix de ses Reels qui sonne comme ce commerce : Eva (femme, douce et posée), Victoria (femme, jeune et souriante), Lucie (femme, naturelle et chaleureuse), Neto (homme, jeune et décontracté), Antonin (homme, calme et posé), Jules (homme, chaleureux, comme une conversation)",
      ),
    delivery: z.string().max(SIGNATURE_CHARS.delivery).describe("Son rythme et son intonation : énergie, débit, attitude (« cool et nonchalant, un brin rock », « posé et doux », « enjoué et rapide »), jamais un ton de pub"),
  })
  .describe("La voix off de ses Reels");

// A signature read before kept its « ambiance »: an unknown key, left out when it is parsed.
export const brandSignatureSchema = z.object({
  titles: z
    .object({
      font: z
        .enum(["display", "body"])
        .describe("display : la police de titre de son site ; body : sa police de texte (quand ses titres sont dans la même police, ou que sa police de titre est trop ornée pour une phrase)"),
      case: z.enum(["upper", "normal"]).describe("upper : ses titres sont en capitales ; normal : en casse normale"),
      weight: z.enum(["regular", "bold", "black"]).describe("La graisse de ses titres : regular (normale ou medium), bold (grasse), black (très grasse)"),
      align: z.enum(["center", "left"]).describe("L'alignement de ses titres"),
      tracking: z.enum(["tight", "normal", "wide"]).describe("L'espace entre les lettres de ses titres : serré, normal ou large"),
    })
    .describe("Ses titres, tels qu'ils sont sur son site"),
  stress: z
    .enum(["color", "block", "serif", "marker"])
    .describe(
      "Comment un mot clé ressort : color (dans sa couleur), block (sur un aplat de sa couleur), serif (dans une serif italique, quand son site mêle une serif italique à une police sans empattement), marker (entouré ou souligné d'un trait tracé à la main, quand son site a des traits dessinés)",
    ),
  band: z
    .enum(["white", "accent", "dark", "light", "outline"])
    .describe(
      "Le fond d'une phrase posée sur la vidéo : white (la boîte blanche d'Instagram, neutre), accent (un aplat de sa couleur), dark (un aplat de sa couleur sombre), light (un aplat de sa couleur claire : crème, lilas…), outline (un cadre fin, pour un style sobre)",
    ),
  grade: z
    .enum(SIGNATURE_GRADES)
    .describe("La lumière de ses images : natural, warm (chaude), bright (claire et aérée), flash (flash direct, contrasté), film (argentique, doux et chaud), moody (sombre et contrasté), cool (froide)"),
  base: z.enum(["light", "dark"]).describe("Ses écrans sans photo (fonds, écran de fin) : clairs ou sombres, comme les fonds de son site"),
  motion: z
    .enum(["epure", "chaleureux", "energique", "fait_main"])
    .describe("Le mouvement de ses animations : epure (lent, aéré, lignes fines), chaleureux (mots sur le temps, formes rondes), energique (franc, gros mots), fait_main (tracés, découpes)"),
  music: z
    .string()
    .max(SIGNATURE_CHARS.music)
    .describe(
      "Le son de ses Reels, en anglais pour le compositeur : le genre précis qui colle à son univers, celui que son lieu passerait et que ses clients écoutent (rock, garage, indie, punk, hip-hop, house, French touch, soul, jazz, bossa, électro, lo-fi, pop…), avec un ou deux mots de texture ; jamais de la musique de pub ni un genre par défaut",
    ),
  // Optional in a stored profile (signatures saved before it existed); every reading writes it (signatureReadingSchema).
  narrator: narratorSchema.optional(),
  voice: z
    .string()
    .max(SIGNATURE_CHARS.voice)
    .describe("Sa façon de parler, tirée des mots de son site : tutoiement ou vouvoiement, humour, longueur des phrases, ses mots à lui"),
});
export type BrandSignature = z.infer<typeof brandSignatureSchema>;

/**
 * What a reading (site or moodboard) writes: the signature with its voice. Structured outputs
 * do not enforce lengths: its words are taken as written, then clamped (clampSignature), so one
 * long line never loses the whole reading (a 90-character music brief lost a site's whole look).
 */
export const signatureReadingSchema = brandSignatureSchema.extend({
  music: z.string().describe(brandSignatureSchema.shape.music.description ?? ""),
  voice: z.string().describe(brandSignatureSchema.shape.voice.description ?? ""),
  narrator: narratorSchema.extend({ delivery: z.string().describe(narratorSchema.shape.delivery.description ?? "") }).describe(narratorSchema.description ?? ""),
});
export type SignatureReading = z.infer<typeof signatureReadingSchema>;

/** A text cut to `max` characters at a word, without a dangling comma. */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  // At the last space that fits: a word is not cut in two when it can be helped.
  const space = t.lastIndexOf(" ", max);
  return (space >= max / 2 ? t.slice(0, space) : t.slice(0, max)).replace(/[\s,;:–-]+$/, "");
}

/** A reading's signature within the lengths a stored profile keeps. */
export function clampSignature<T extends SignatureReading>(signature: T): T {
  return {
    ...signature,
    music: clip(signature.music, SIGNATURE_CHARS.music),
    voice: clip(signature.voice, SIGNATURE_CHARS.voice),
    narrator: { ...signature.narrator, delivery: clip(signature.narrator.delivery, SIGNATURE_CHARS.delivery) },
  };
}

/** What the reading writes about the signature (moodboard or site), appended to its prompt. */
export const SIGNATURE_GUIDE = `Signature: the same choices as settings, which the engine applies to every Reel and every photo without being asked. Start from what you see (and from the measurements when you have them), never from a habit:
- titles: the font (display or body), the case, the weight, the alignment and the letter spacing of her real titles;
- stress: how her important words stand out on her site (marker only if there are hand-drawn strokes, serif only if it mixes in an italic serif);
- band: the background that will go under a sentence laid on a video, in her colours (white if nothing imposes itself);
- grade: the light of her photos;
- base: light or dark, like her site's backgrounds;
- motion, music, voice: her motion, her music and her way of speaking;
- narrator: the voice-over that sounds like her (a rock business does not get a soft spa voice) and how it plays.`;

/** The signature as a few plain lines, for the editor, the motion designer and the critic. */
export function signatureLines(signature: BrandSignature | undefined): string | undefined {
  if (!signature) return undefined;
  const t = signature.titles;
  // The hand-drawn stroke is its gesture, not a tic: on every word, it was the same animation all over the Reel.
  const stress = {
    color: "dans sa couleur",
    block: "sur un aplat de sa couleur",
    serif: "dans une serif italique",
    marker: "entouré ou souligné à la main, une seule fois par Reel, sur le mot clé de l'accroche ; ailleurs, dans sa couleur",
  }[signature.stress];
  return [
    `Titres : police ${t.font === "display" ? "des titres" : "du texte"}, ${t.case === "upper" ? "en capitales" : "en casse normale"}, ${{ regular: "graisse normale", bold: "gras", black: "très gras" }[t.weight]}, ${t.align === "left" ? "alignés à gauche" : "centrés"}`,
    `Mot clé : ${stress}`,
    `Phrases sur la vidéo : ${{ white: "boîte blanche", accent: "aplat de sa couleur", dark: "aplat sombre", light: "aplat clair", outline: "cadre fin" }[signature.band]}`,
    `Lumière : ${{ natural: "naturelle", warm: "chaude", bright: "claire et aérée", flash: "flash direct", film: "argentique", moody: "sombre et contrastée", cool: "froide" }[signature.grade]} ; écrans ${signature.base === "dark" ? "sombres" : "clairs"}`,
    `Mouvement : ${{ epure: "épuré", chaleureux: "chaleureux", energique: "énergique", fait_main: "fait main" }[signature.motion]} ; musique : ${signature.music}`,
    `Sa façon de parler : ${signature.voice}`,
    ...(signature.narrator ? [`Voix off : ${signature.narrator.voice}, ${signature.narrator.delivery}`] : []),
  ].join("\n");
}
