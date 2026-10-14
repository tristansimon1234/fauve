import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, MOODBOARD_PROMPT, moodboardReadingSchema, type MoodboardReading } from "@fauve/agent";
import { anthropic, logClaudeCost } from "./run";

/**
 * Fauve reads the studio's moodboard (signed image URLs + the manager's notes)
 * and writes the art direction it implies. Runs once per moodboard change.
 */
export async function readMoodboard(
  studioId: string,
  studioName: string,
  /** By signed URL, or as bytes (a JPEG, e.g. a capture that is not kept). */
  images: ({ url: string; note?: string } | { jpeg: Buffer; note?: string })[],
  /** The site's look (onboarding) is read by Sonnet: half the price, plenty for describing images. */
  { model = CLAUDE_MODEL, intro }: { model?: string; intro?: string } = {},
): Promise<MoodboardReading> {
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 8000,
    output_config: { effort: "medium", format: betaZodOutputFormat(moodboardReadingSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: MOODBOARD_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: intro ?? `Moodboard du studio « ${studioName} » (${images.length} image${images.length > 1 ? "s" : ""}).` },
          ...images.flatMap((image, i) => [
            { type: "text" as const, text: `Image ${i + 1}${image.note ? ` — ${intro ? "" : "note de la gérante : "}${image.note}` : ""}` },
            "url" in image
              ? { type: "image" as const, source: { type: "url" as const, url: image.url } }
              : { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: image.jpeg.toString("base64") } },
          ]),
        ],
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, intro ? "site_look" : "moodboard", model);
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`moodboard reading failed (${response.stop_reason})`);
  }
  const { reading, palette } = response.parsed_output;
  return { reading: reading.slice(0, 2000), palette: [...new Set(palette.map((c) => c.toLowerCase()))].slice(0, 6) };
}
