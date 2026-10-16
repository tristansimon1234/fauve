import { z } from "zod";
import { SIGNATURE_GUIDE, signatureReadingSchema } from "./signature.ts";

// Moodboard reading: Fauve looks at the manager's inspiration images once and
// turns them into a written art direction. The montage (editor and motion
// designer) only ever gets this text, never the images, to keep each montage cheap.

export const MOODBOARD_PROMPT = `Tu es la directrice artistique de Simone, qui monte les Reels Instagram d'un commerce de quartier (studio de sport, salon de coiffure ou de beauté, restaurant, boutique…).
La personne qui gère le commerce (femme ou homme : n'accorde rien de ce qui la concerne, n'écris ni « elle » ni « il » pour la désigner) t'envoie son moodboard : des images qui l'inspirent (captures de Reels, affiches, photos, marques qu'elle aime), parfois avec une note.

Écris ce que ce moodboard dit de l'identité visuelle à donner à ses Reels, pour un monteur et un motion designer qui ne verront jamais les images :
- ambiance et énergie (calme, nerveux, luxe, brut, solaire…) ;
- couleurs : dominantes, accents, contrastes (avec des codes hex) ;
- typographie : familles (serif, grotesque, script…), graisse, casse, taille, placement ; cite 1 ou 2 Google Fonts proches ;
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
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).describe("3 à 5 couleurs hex, la principale en premier"),
  fonts: z
    .object({
      display: z.string().regex(/^[A-Za-z0-9 ]{2,40}$/).describe("Police des titres : la famille Google Fonts exacte, ou la plus proche de la typographie vue (logo, titres)"),
      body: z.string().regex(/^[A-Za-z0-9 ]{2,40}$/).describe("Police du texte : la famille Google Fonts exacte, ou la plus proche, bien lisible"),
    })
    .describe("Les deux polices de la charte, en familles Google Fonts"),
  signature: signatureReadingSchema.describe("La même direction en réglages, appliqués à chaque Reel et chaque photo"),
});
export type MoodboardReading = z.infer<typeof moodboardReadingSchema>;

/** A hook and a line in the business's own words, drawn in its signature on one of its photos (the Style step). */
export const styleSampleSchema = z.object({
  hook: z.string().max(60).describe("Une accroche de Reel courte, avec un verbe, comme ce commerce parle (6 mots au plus)"),
  key: z.string().max(30).describe("Le mot de l'accroche qui ressort (un mot de hook, tel quel)"),
  band: z.string().max(50).describe("Une phrase courte posée sur la vidéo : une offre, une adresse ou une invitation vraie, tirée du site"),
});
export type StyleSample = z.infer<typeof styleSampleSchema>;

/** The reading of a site: the same, and which of its photos show the business itself. */
export const siteLookSchema = moodboardReadingSchema.extend({
  sample: styleSampleSchema.describe("Un exemple dans ses mots, pour lui montrer son style sur une de ses photos"),
  photos: z
    .array(z.number().int().min(1))
    .describe("Les numéros des photos du site (« photo N ») qui montrent vraiment le commerce, les plus belles et les plus parlantes d'abord, 8 au plus"),
});
export type SiteLookReading = z.infer<typeof siteLookSchema>;

/**
 * Her « Direction artistique » (Style) stays hers: Simone only fills it when it
 * is empty, with the short version of a reading (site or moodboard).
 */
export function withArtDirection<T extends { art_direction?: unknown }>(profile: T, direction: string | null | undefined): T {
  const current = typeof profile.art_direction === "string" ? profile.art_direction.trim() : "";
  const next = direction?.trim();
  return current || !next ? profile : { ...profile, art_direction: next.slice(0, 600) };
}
