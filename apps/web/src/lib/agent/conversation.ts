import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { orderReplies } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runFauve, type RunFauveResult } from "./run";

// Shared by every channel (WhatsApp webhook, web test chat): rebuild the
// conversation from stored messages and let Fauve answer the last one.

const HISTORY_LIMIT = 40;

export type StoredMessage = {
  direction: "inbound" | "outbound";
  type: string;
  body: string | null;
  media_id: string | null;
};

const mediaLabels: Record<string, string> = {
  video: "Vidéo reçue",
  image: "Photo reçue",
  document: "Fichier reçu",
  audio: "Message vocal reçu",
  sticker: "Sticker reçu",
};

/** Rebuilds the conversation for the model from stored messages (text only). */
export function toModelHistory(rows: StoredMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const history: Anthropic.Beta.BetaMessageParam[] = [];
  for (const row of rows) {
    const role = row.direction === "inbound" ? "user" : "assistant";
    const label = mediaLabels[row.type];
    const text = [label && `[${label}${row.media_id ? ` · media_id ${row.media_id}` : ""}]`, row.body]
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    const last = history.at(-1);
    if (last?.role === role && typeof last.content === "string") {
      last.content = `${last.content}\n${text}`;
    } else {
      history.push({ role, content: text });
    }
  }
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

export async function replyInConversation(params: {
  studioId: string;
  memberId: string;
  /** WhatsApp only: lets Fauve react to the manager's last message. */
  waId?: string;
  replyToMessageId?: string;
}): Promise<RunFauveResult> {
  const db = supabaseAdmin();
  const [studio, member, rows] = await Promise.all([
    db.from("studios").select("name, timezone, onboarding_step").eq("id", params.studioId).single(),
    db.from("members").select("first_name").eq("id", params.memberId).single(),
    db
      .from("whatsapp_messages")
      .select("direction, type, body, media_id, wa_message_id, payload")
      .eq("studio_id", params.studioId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (studio.error) throw new Error(studio.error.message);
  if (rows.error) throw new Error(rows.error.message);

  const stored = rows.data.reverse().map((r) => ({
    ...(r as StoredMessage & { wa_message_id: string | null }),
    reply_to: (r.payload as { reply_to?: string } | null)?.reply_to ?? null,
  }));
  const history = toModelHistory(orderReplies(stored));
  // Every message has already been answered (e.g. a retried delivery): nothing to say.
  if (history.at(-1)?.role !== "user") {
    return { reply: null, reactions: [], usage: { input_tokens: 0, output_tokens: 0 } };
  }

  return runFauve({
    studioId: params.studioId,
    memberId: params.memberId,
    waId: params.waId,
    replyToMessageId: params.replyToMessageId,
    reactions: [],
    history,
    studio: {
      name: studio.data.name,
      timezone: studio.data.timezone,
      onboardingStep: studio.data.onboarding_step,
      firstName: member.data?.first_name ?? null,
    },
  });
}
