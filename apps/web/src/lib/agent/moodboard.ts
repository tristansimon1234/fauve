import "server-only";
import { brandLookSchema, clampBrandLook, clampSiteLook, CLAUDE_MODEL, MOODBOARD_PROMPT, siteLookSchema, type BrandLookReading, type SiteLookReading } from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "./run";

export type ReadImage = { url: string; note?: string } | { jpeg: Buffer; note?: string };

/** The images as one user message: each one numbered, with its note. */
function imagesMessage<T extends ReadImage>(intro: string, images: T[], label: (i: number, image: T) => string) {
  return [
    { type: "text" as const, text: intro },
    ...images.flatMap((image, i) => [
      { type: "text" as const, text: label(i, image) },
      "url" in image
        ? { type: "image" as const, source: { type: "url" as const, url: image.url } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: image.jpeg.toString("base64") } },
    ]),
  ];
}

/**
 * Fauve reads the studio's brand from what it shows (lib/brand-read.ts): its logo, its moodboard
 * (signed image URLs + the manager's notes), or an ambiance it picked, all said in the intro; and
 * writes the art direction it implies, the same direction as settings (its signature), its palette,
 * its fonts and an example in its words. Runs once per change.
 */
export async function readBrandImages(studioId: string, intro: string, images: (ReadImage & { label: string })[]): Promise<BrandLookReading> {
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: outputFormat(brandLookSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: MOODBOARD_PROMPT,
    messages: [{ role: "user", content: imagesMessage(intro, images, (_, image) => image.label) }],
  });
  await logClaudeCost(studioId, response.usage, "moodboard", CLAUDE_MODEL);
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`brand reading failed (${response.stop_reason})`);
  return clampBrandLook(response.parsed_output);
}

/**
 * The look of a business's site (onboarding): captures of its pages and its photos, with
 * what was measured on the page (its fonts, its colours) in the intro. Read by Sonnet, half
 * the price, plenty for describing images; it also picks the photos that show the business.
 */
export async function readSiteImages(studioId: string, intro: string, pages: Buffer[], photos: Buffer[], model: string): Promise<SiteLookReading> {
  const images: ReadImage[] = [...pages.map((jpeg) => ({ jpeg })), ...photos.map((jpeg) => ({ jpeg }))];
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 9000,
    output_config: { effort: "medium", format: outputFormat(siteLookSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: MOODBOARD_PROMPT,
    messages: [
      {
        role: "user",
        content: imagesMessage(intro, images, (i) =>
          i < pages.length
            ? i === 0
              ? "Capture du haut de sa page d'accueil, telle qu'un visiteur la voit"
              : "Toute sa page d'accueil, en petit (mise en page, enchaînement des couleurs)"
            : `Photo ${i - pages.length + 1} de son site`,
        ),
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, "site_look", model);
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`site look reading failed (${response.stop_reason})`);
  const read = clampSiteLook(response.parsed_output);
  return { ...read, photos: [...new Set(read.photos.filter((n) => n >= 1 && n <= photos.length))].slice(0, 8) };
}
