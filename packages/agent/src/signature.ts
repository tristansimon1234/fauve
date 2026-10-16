import { z } from "zod";

// A business's art direction as the engine applies it. The written direction (art_direction,
// the moodboard's reading) guides the editor and the motion designer; the signature is the
// same direction as settings, read once from its site or its moodboard, that every Reel and
// every photo follows without having to be asked: its titles set like its site's titles, its
// key words standing out its way, the box under a statement, the light of its pictures, its
// screens light or dark, the movement of its animations, its music and the way it talks. The
// ambiance (template) only keeps the rhythm, the transitions and the entrances.

export const SIGNATURE_GRADES = ["natural", "warm", "bright", "flash", "film", "moody", "cool"] as const;
/** The ambiances (MOTION_TEMPLATES in schemas.ts, which imports this file: written out here). */
const AMBIANCE_KEYS = ["doux", "dynamique", "chic", "collage"] as const;

export const brandSignatureSchema = z.object({
  ambiance: z.enum(AMBIANCE_KEYS).describe(
    "L'ambiance de ses Reels (le rythme) : doux (calme et lumineux, coupes posées), dynamique (coupes rapides, énergie), chic (sobre et élégant, lent), collage (fait main, papier, créatif)",
  ),
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
  music: z.string().max(80).describe("La musique qui lui ressemble : un genre de créateur en quelques mots (« house légère », « funk de quartier », « lo-fi jazzy »…), jamais de la musique de pub"),
  voice: z
    .string()
    .max(200)
    .describe("Sa façon de parler, tirée des mots de son site : tutoiement ou vouvoiement, humour, longueur des phrases, ses mots à lui"),
});
export type BrandSignature = z.infer<typeof brandSignatureSchema>;

/** What the reading writes about the signature (moodboard or site), appended to its prompt. */
export const SIGNATURE_GUIDE = `Signature : les mêmes choix en réglages, que le moteur applique à chaque Reel et à chaque photo sans qu'on le lui demande. Pars de ce que tu vois (et des mesures quand tu les as), jamais d'une habitude :
- ambiance : le rythme qui lui ressemble ;
- titles : la police (display ou body), la casse, la graisse, l'alignement et l'interlettrage de ses vrais titres ;
- stress : comment ses mots importants ressortent sur son site (marker seulement s'il y a des traits dessinés à la main, serif seulement s'il mêle une serif italique) ;
- band : le fond qui ira sous une phrase posée sur une vidéo, dans ses couleurs (white si rien ne s'impose) ;
- grade : la lumière de ses photos ;
- base : clair ou sombre, comme les fonds de son site ;
- motion, music, voice : son mouvement, sa musique et sa façon de parler.`;

/** The signature as a few plain lines, for the editor, the motion designer and the critic. */
export function signatureLines(signature: BrandSignature | undefined): string | undefined {
  if (!signature) return undefined;
  const t = signature.titles;
  const stress = { color: "dans sa couleur", block: "sur un aplat de sa couleur", serif: "dans une serif italique", marker: "entouré ou souligné à la main" }[signature.stress];
  return [
    `Titres : police ${t.font === "display" ? "des titres" : "du texte"}, ${t.case === "upper" ? "en capitales" : "en casse normale"}, ${{ regular: "graisse normale", bold: "gras", black: "très gras" }[t.weight]}, ${t.align === "left" ? "alignés à gauche" : "centrés"}`,
    `Mot clé : ${stress}`,
    `Phrases sur la vidéo : ${{ white: "boîte blanche", accent: "aplat de sa couleur", dark: "aplat sombre", light: "aplat clair", outline: "cadre fin" }[signature.band]}`,
    `Lumière : ${{ natural: "naturelle", warm: "chaude", bright: "claire et aérée", flash: "flash direct", film: "argentique", moody: "sombre et contrastée", cool: "froide" }[signature.grade]} ; écrans ${signature.base === "dark" ? "sombres" : "clairs"}`,
    `Mouvement : ${{ epure: "épuré", chaleureux: "chaleureux", energique: "énergique", fait_main: "fait main" }[signature.motion]} ; musique : ${signature.music}`,
    `Sa façon de parler : ${signature.voice}`,
  ].join("\n");
}
