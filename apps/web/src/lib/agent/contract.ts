import "server-only";
import { CHAT_MODEL, CONTRACT_PROMPT, EMPTY_CONTRACT, reelContractSchema, type ReelContract } from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "./run";

/**
 * What she fixed for this Reel, read once from her request (her words, Simone's brief or
 * « Ce que tu imagines »). Never blocks the montage: unreadable, nothing is fixed and the
 * usual defaults decide.
 */
export async function readContract(studioId: string, brief: string | undefined): Promise<ReelContract> {
  if (!brief?.trim()) return EMPTY_CONTRACT;
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: outputFormat(reelContractSchema) },
      system: CONTRACT_PROMPT,
      messages: [{ role: "user", content: brief.slice(0, 4000) }],
    });
    await logClaudeCost(studioId, response.usage, "contract", CHAT_MODEL);
    return response.parsed_output ? readAnswer(reelContractSchema, response.parsed_output) : EMPTY_CONTRACT;
  } catch (error) {
    console.warn("contract not read, the defaults decide", error);
    return EMPTY_CONTRACT;
  }
}
