import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, MOODBOARD_PROMPT, moodboardReadingSchema, siteLookSchema, type MoodboardReading, type SiteLookReading } from "@fauve/agent";
import { anthropic, logClaudeCost } from "./run";

type ReadImage = { url: string; note?: string } | { jpeg: Buffer; note?: string };

/** The images as one user message: each one numbered, with its note. */
function imagesMessage(intro: string, images: ReadImage[], label: (i: number, image: ReadImage) => string) {
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

const tidy = <T extends MoodboardReading>(r: T): T => ({
  ...r,
  reading: r.reading.slice(0, 2000),
  direction: r.direction.slice(0, 600),
  palette: [...new Set(r.palette.map((c) => c.toLowerCase()))].slice(0, 6),
});

/**
 * Fauve reads the studio's moodboard (signed image URLs + the manager's notes)
 * and writes the art direction it implies, and the same direction as settings
 * (its signature). Runs once per moodboard change.
 */
export async function readMoodboard(studioId: string, studioName: string, images: ReadImage[]): Promise<MoodboardReading> {
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: betaZodOutputFormat(moodboardReadingSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: MOODBOARD_PROMPT,
    messages: [
      {
        role: "user",
        content: imagesMessage(`Moodboard du studio « ${studioName} » (${images.length} image${images.length > 1 ? "s" : ""}).`, images, (i, image) =>
          `Image ${i + 1}${image.note ? ` — note de la gérante : ${image.note}` : ""}`,
        ),
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, "moodboard", CLAUDE_MODEL);
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`moodboard reading failed (${response.stop_reason})`);
  return tidy(response.parsed_output);
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
    output_config: { effort: "medium", format: betaZodOutputFormat(siteLookSchema) },
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
  const read = tidy(response.parsed_output);
  return { ...read, photos: [...new Set(read.photos.filter((n) => n >= 1 && n <= photos.length))].slice(0, 8) };
}
