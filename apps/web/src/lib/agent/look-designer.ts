import "server-only";
import { CHAT_MODEL, LOOK_DESIGNER_PROMPT, lookChoice, lookDesignSchema, lookFromDesign, type ReelLook } from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "./run";

// A look in her words made into its settings (looks.ts in @fauve/agent): « façon Polaroid », « pellicule
// Kodak des années 70 », « comme un film de Wes Anderson », or the filter Gemini saw on a Reel she copies.
// Sonnet, effort low, about a cent; the presets need no model. A look never redraws her images: asked for
// that (a cartoon, a painting), the designer makes the closest grade and says so (`note`), for Edith to tell her.

/** Her words as a look's settings, with what it could not do; null when the designer fails. `copied`: the filter of a Reel she copies. */
export async function designLook(studioId: string, words: string, options: { copied?: boolean } = {}): Promise<{ look: ReelLook; note: string } | null> {
  const said = words.trim().slice(0, 400);
  if (!said) return null;
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: outputFormat(lookDesignSchema) },
      system: LOOK_DESIGNER_PROMPT,
      messages: [{ role: "user", content: options.copied ? `Le filtre du Reel qu'elle veut recopier, tel qu'il a été vu : « ${said} »` : `Le look qu'elle demande : « ${said} »` }],
    });
    await logClaudeCost(studioId, response.usage, "look", CHAT_MODEL);
    return response.parsed_output ? lookFromDesign(readAnswer(lookDesignSchema, response.parsed_output)) : null;
  } catch (error) {
    console.warn("look not designed", error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  }
}

/**
 * A look as Edith, the editor or the app name it: « none » (no look), a preset (its key or its name), or her
 * words, designed. `missed` when her words could not be made into a look (the designer failed).
 */
export async function resolveLook(studioId: string, words: string | null | undefined): Promise<{ look: ReelLook | null; note: string } | { missed: true }> {
  const choice = lookChoice(words);
  if (!choice) return { missed: true };
  if ("look" in choice) return { look: choice.look, note: "" };
  const designed = await designLook(studioId, choice.design);
  return designed ?? { missed: true };
}
