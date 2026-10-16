import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, HOOK_JUDGE_PROMPT, hookChoiceSchema, pickHook, type HookJudgeInput } from "@fauve/agent";
import { anthropic, logClaudeCost } from "./run";

/**
 * The strongest of several hooks: the judge adds its own ideas, scores them all with
 * one question (does the thumb stop?) and keeps the best that holds. Null when it could
 * not answer: the first hook given stays, the Reel never waits on it.
 */
export async function judgeHooks(studioId: string, input: HookJudgeInput): Promise<ReturnType<typeof pickHook> | null> {
  if (!input.accroches.some((a) => a.trim())) return null;
  try {
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      output_config: { effort: "medium", format: betaZodOutputFormat(hookChoiceSchema) },
      system: HOOK_JUDGE_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(studioId, response.usage, "hook");
    return response.parsed_output ? pickHook(input.accroches, response.parsed_output, input.type) : null;
  } catch (error) {
    console.warn("hook judge failed, the first hook stays", error);
    return null;
  }
}
