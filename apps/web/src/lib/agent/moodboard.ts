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
  images: { url: string; note?: string }[],
): Promise<MoodboardReading> {
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
        content: [
          { type: "text", text: `Moodboard du studio « ${studioName} » (${images.length} image${images.length > 1 ? "s" : ""}).` },
          ...images.flatMap((image, i) => [
            { type: "text" as const, text: `Image ${i + 1}${image.note ? ` — note de la gérante : ${image.note}` : ""}` },
            { type: "image" as const, source: { type: "url" as const, url: image.url } },
          ]),
        ],
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, "moodboard");
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`moodboard reading failed (${response.stop_reason})`);
  }
  const { reading, palette } = response.parsed_output;
  return { reading: reading.slice(0, 2000), palette: [...new Set(palette.map((c) => c.toLowerCase()))].slice(0, 6) };
}
