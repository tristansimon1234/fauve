import "server-only";
import { BRIEF_MAX, CHAT_MODEL, CONTRACT_PROMPT, EMPTY_CONTRACT, reelContractSchema, type ReelContract } from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "./run";

/**
 * What she fixed for this Reel, read once from her request (her words, Edith's brief or
 * « Ce que tu imagines »). Never blocks the montage: unreadable, nothing is fixed and the
 * usual defaults decide.
 */
export async function readContract(studioId: string, brief: string | undefined, currentVoice?: string | null): Promise<ReelContract> {
  if (!brief?.trim()) return EMPTY_CONTRACT;
  // A correction's voice: the whole text on the Reel now, so that a quoted fragment edits it instead of
  // replacing it (Edith quoted the first sentence to fix « plus », and his 24 s voice became 8 s, the Reel 13 s).
  const content = currentVoice?.trim() ? `${brief.slice(0, BRIEF_MAX)}\n\nTexte actuel de la voix : « ${currentVoice.trim().slice(0, 1500)} »` : brief.slice(0, BRIEF_MAX);
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: outputFormat(reelContractSchema) },
      system: CONTRACT_PROMPT,
      messages: [{ role: "user", content }],
    });
    await logClaudeCost(studioId, response.usage, "contract", CHAT_MODEL);
    return response.parsed_output ? readAnswer(reelContractSchema, response.parsed_output) : EMPTY_CONTRACT;
  } catch (error) {
    console.warn("contract not read, the defaults decide", error);
    return EMPTY_CONTRACT;
  }
}
