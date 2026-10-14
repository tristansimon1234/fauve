import "server-only";

import { EMOJI_CRITERIA, EMOJI_INSTRUCTIONS, MOOD_CRITERIA, MOOD_INSTRUCTIONS, emojiOf, isFunny, isSweet, moodOf, upsetLevel, usdToEur, type ReactionMood } from "@fauve/agent";
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Reaction = { mood: ReactionMood; emoji: string | null; by: "jev" | "rules" };

/** Jev's list price: input only, output tokens are free. */
const JEV_USD_PER_MILLION_INPUT = 0.042;

let client: TypeSafeClient | null | undefined;

/** One client per instance; null without TYPESAFE_API_KEY (the app then falls back to its rules). */
function jev(): TypeSafeClient | null {
  if (client === undefined) {
    // A reaction is worth something only while it is instant: one short attempt, no retries.
    client = process.env.TYPESAFE_API_KEY ? new TypeSafeClient({ timeout: 2500, retry: { maxRetries: 0 }, logLevel: "error" }) : null;
  }
  return client;
}

/** The keyword rules used before Jev, kept as the fallback. */
function byRules(text: string, previous: string | null): Reaction {
  const upset = upsetLevel(text);
  return { mood: upset ?? (isSweet(text) ? "shy" : isFunny(text) || isFunny(previous) ? "laugh" : "neutral"), emoji: null, by: "rules" };
}

/**
 * Brigitte's instant reaction to the manager's message: her face and, when it is
 * natural, an emoji on the message. Asked to Jev in parallel with the chat model,
 * so it lands in a fraction of a second; never throws.
 */
export async function reactTo(studioId: string, text: string, previous: string | null): Promise<Reaction> {
  const api = jev();
  if (!api || !text.trim()) return byRules(text, previous);
  try {
    const { answers, usage, model } = await api.systemOne({
      state: { message_de_la_gerante: text.slice(0, 2000), message_precedent_de_brigitte: previous?.slice(0, 600) ?? null },
      questions: {
        mood: choice(MOOD_INSTRUCTIONS, MOOD_CRITERIA),
        emoji: choice(EMOJI_INSTRUCTIONS, EMOJI_CRITERIA),
      },
    });
    const mood = moodOf(answers.mood);
    const usd = (usage.input_tokens * JEV_USD_PER_MILLION_INPUT) / 1_000_000;
    void supabaseAdmin()
      .from("cost_events")
      .insert({ studio_id: studioId, kind: "llm", provider: "typesafe", units: usage.input_tokens, cost_eur: usdToEur(usd, env("USD_TO_EUR")), meta: { model, purpose: "reaction", usage, cost_usd: usd } })
      .then(({ error }) => error && console.error("cost_events insert failed", error.message));
    return { mood, emoji: emojiOf(answers.emoji, mood), by: "jev" };
  } catch (error) {
    console.warn("jev reaction failed, using the rules", error instanceof Error ? error.message : error);
    return byRules(text, previous);
  }
}
