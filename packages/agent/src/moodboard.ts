import { z } from "zod";
import { clampSignature, clip, SIGNATURE_GUIDE, signatureReadingSchema } from "./signature.ts";

// Moodboard reading: Fauve looks at the manager's inspiration images once and
// turns them into a written art direction. The montage (editor and motion
// designer) only ever gets this text, never the images, to keep each montage cheap.

export const MOODBOARD_PROMPT = `Tu es la directrice artistique de Simone, qui monte les Reels Instagram d'un commerce de quartier (studio de sport, salon de coiffure ou de beauté, restaurant, boutique…).
La personne qui gère le commerce (femme ou homme : n'accorde rien de ce qui la concerne, n'écris ni « elle » ni « il » pour la désigner) t'envoie son moodboard : des images qui l'inspirent (captures de Reels, affiches, photos, marques qu'elle aime), parfois avec une note.

Écris ce que ce moodboard dit de l'identité visuelle à donner à ses Reels, pour un monteur et un motion designer qui ne verront jamais les images :
- ambiance et énergie (calme, nerveux, luxe, brut, solaire…) ;
- couleurs : dominantes, accents, contrastes (avec des codes hex) ;
- typographie : familles (serif, grotesque, script…), graisse, casse, taille, placement ; cite 1 ou 2 Google Fonts proches par le dessin de leurs lettres, pas seulement par leur largeur ou leur ambiance ;
- composition : cadrages, espace vide, alignements, grain, textures, formes ;
- mouvement et rythme suggérés : coupes, vitesse, transitions, animations du texte ;
- ce qu'il faut éviter pour rester dans cet esprit.

Sois concrète et directive, sans généralités ni paraphrase des images une par une. Tiens compte des notes de la gérante : elles disent ce qu'elle aime dans chaque image.
Si les images partent dans des directions opposées, dis-le et propose la ligne qui les réunit.
Texte en français, 900 caractères au maximum, en phrases courtes ou tirets.
Palette : 3 à 5 couleurs hex tirées des images, la principale en premier.
Direction : la même chose en 2 ou 3 phrases simples, à la deuxième personne ou sans sujet, comme une note qu'elle pourrait avoir écrite (« Minimaliste et lumineux, tons terracotta et crème, typographie éditoriale, mouvements lents. Jamais de néon. »), 300 caractères au maximum.
${SIGNATURE_GUIDE}`;

export const moodboardReadingSchema = z.object({
  reading: z.string().describe("La direction artistique tirée du moodboard, 900 caractères au maximum"),
  direction: z
    .string()
    .describe("La même direction en 2 ou 3 phrases simples, comme la personne qui gère l'écrirait elle-même dans son profil (ambiance, couleurs, typographie, mouvements, ce qu'on évite), 300 caractères au maximum"),
  // Read as written, then cleaned (clampReading): structured outputs do not enforce patterns nor lengths.
  palette: z.array(z.string()).describe("3 à 5 couleurs hex (#rrggbb), la principale en premier"),
  fonts: z
    .object({
      display: z
        .string()
        .describe(
          "Police des titres : la famille Google Fonts exacte ; si celle du site n'y est pas, la plus proche par le dessin des lettres (structure grotesque, géométrique, humaniste ou serif à contraste, largeur, graisse, forme du a et du e), une famille sobre et bien dessinée ; une police aux formes inhabituelles seulement si celle du site en a",
        ),
      body: z
        .string()
        .describe("Police du texte : la famille Google Fonts exacte ; sinon la plus proche par le dessin des lettres, sobre et bien lisible en petit"),
    })
    .describe("Les deux polices de la charte, en familles Google Fonts"),
  signature: signatureReadingSchema.describe("La même direction en réglages, appliqués à chaque Reel et chaque photo"),
});
export type MoodboardReading = z.infer<typeof moodboardReadingSchema>;

const SAMPLE_CHARS = { hook: 60, key: 30, band: 50 } as const;
const SAMPLE_WORDS = {
  hook: "Une accroche de Reel courte, avec un verbe, comme ce commerce parle (6 mots au plus)",
  key: "Le mot de l'accroche qui ressort (un mot de hook, tel quel)",
  band: "Une phrase courte posée sur la vidéo : une offre, une adresse ou une invitation vraie, tirée du site",
} as const;

/** A hook and a line in the business's own words, drawn in its signature on one of its photos (the Style step). */
export const styleSampleSchema = z.object({
  hook: z.string().max(SAMPLE_CHARS.hook).describe(SAMPLE_WORDS.hook),
  key: z.string().max(SAMPLE_CHARS.key).describe(SAMPLE_WORDS.key),
  band: z.string().max(SAMPLE_CHARS.band).describe(SAMPLE_WORDS.band),
});
export type StyleSample = z.infer<typeof styleSampleSchema>;

/** A family name as Google Fonts and the render take it (letters, digits, spaces), or null. */
const familyOf = (name: string): string | null => {
  const clean = name.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return clean.length >= 2 ? clean : null;
};

/**
 * A reading within what a profile keeps: a palette of real hex colours, family names the
 * render can load, the signature's words clamped. Taken as written by the model, a single
 * overlong or odd value must never throw the whole reading away.
 */
export function clampReading<T extends MoodboardReading>(reading: T): T {
  const display = familyOf(reading.fonts.display);
  const body = familyOf(reading.fonts.body);
  return {
    ...reading,
    reading: reading.reading.slice(0, 2000),
    direction: reading.direction.slice(0, 600),
    palette: [...new Set(reading.palette.map((c) => c.trim().toLowerCase()).filter((c) => /^#[0-9a-f]{6}$/.test(c)))].slice(0, 6),
    fonts: { display: display ?? body ?? "Inter", body: body ?? display ?? "Inter" },
    signature: clampSignature(reading.signature),
  };
}

/** The reading of a site: the same, and which of its photos show the business itself. */
export const siteLookSchema = moodboardReadingSchema.extend({
  sample: z
    .object({ hook: z.string().describe(SAMPLE_WORDS.hook), key: z.string().describe(SAMPLE_WORDS.key), band: z.string().describe(SAMPLE_WORDS.band) })
    .describe("Un exemple dans ses mots, pour lui montrer son style sur une de ses photos"),
  photos: z
    .array(z.number().int().min(1))
    .describe("Les numéros des photos du site (« photo N ») qui montrent vraiment le commerce, les plus belles et les plus parlantes d'abord, 8 au plus"),
});
export type SiteLookReading = z.infer<typeof siteLookSchema>;

/** A site's reading within what a profile keeps (its example in its words too). */
export function clampSiteLook(reading: SiteLookReading): SiteLookReading {
  const sample = { hook: clip(reading.sample.hook, SAMPLE_CHARS.hook), key: clip(reading.sample.key, SAMPLE_CHARS.key), band: clip(reading.sample.band, SAMPLE_CHARS.band) };
  return { ...clampReading(reading), sample };
}

/**
 * Her « Direction artistique » (Style) stays hers: Simone only fills it when it
 * is empty, with the short version of a reading (site or moodboard).
 */
export function withArtDirection<T extends { art_direction?: unknown }>(profile: T, direction: string | null | undefined): T {
  const current = typeof profile.art_direction === "string" ? profile.art_direction.trim() : "";
  const next = direction?.trim();
  return current || !next ? profile : { ...profile, art_direction: next.slice(0, 600) };
}
