import { z } from "zod";
import { clampSignature, clip, SIGNATURE_GUIDE, signatureReadingSchema } from "./signature.ts";

// Moodboard reading: Fauve looks at the manager's inspiration images once and
// turns them into a written art direction. The montage (editor and motion
// designer) only ever gets this text, never the images, to keep each montage cheap.

export const MOODBOARD_PROMPT = `You are Simone's art director; Simone edits the Instagram Reels of a neighbourhood business (gym, hair or beauty salon, restaurant, shop…).
The person who runs the business (a woman or a man: make no agreement for anything about them, write neither « elle » nor « il » for them) sends you their moodboard: images that inspire them (screenshots of Reels, posters, photos, brands they like), sometimes with a note.

Write what this moodboard says about the visual identity to give their Reels, for an editor and a motion designer who will never see the images:
- mood and energy (calm, edgy, luxury, raw, sunny…);
- colours: dominants, accents, contrasts (with hex codes);
- typography: families (serif, grotesque, script…), weight, case, size, placement; name 1 or 2 Google Fonts close in the drawing of their letters, not only in their width or their mood;
- composition: framing, empty space, alignments, grain, textures, shapes;
- the motion and rhythm it suggests: cuts, speed, transitions, text animations;
- what to avoid to stay in this spirit.

Be concrete and directive, with no generalities and no description of the images one by one. Take the manager's notes into account: they say what they like in each image.
If the images go in opposite directions, say so and propose the line that brings them together.
Text in French, 900 characters at most, in short sentences or dashes.
Palette: 3 to 5 hex colours taken from the images, the main one first.
Direction: the same thing in 2 or 3 simple sentences, in the second person or without a subject, like a note they could have written (« Minimaliste et lumineux, tons terracotta et crème, typographie éditoriale, mouvements lents. Jamais de néon. »), 300 characters at most.
Everything you write is in French (she reads it in her settings), except the music, in English for its composer.
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
