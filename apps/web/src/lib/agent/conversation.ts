import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { orderReplies } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runFauve, type RunFauveResult } from "./run";

// Shared by every channel (WhatsApp webhook, web test chat): rebuild the
// conversation from stored messages and let Fauve answer the last one.

const HISTORY_LIMIT = 24;
/** Long messages (video captions, links) are cut in the history: the model rarely needs them whole. */
const MESSAGE_MAX_CHARS = 700;

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
    const label = row.direction === "inbound" ? mediaLabels[row.type] : undefined;
    const text = [label && `[${label}${row.media_id ? ` · media_id ${row.media_id}` : ""}]`, row.body]
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    const short = text.length > MESSAGE_MAX_CHARS ? `${text.slice(0, MESSAGE_MAX_CHARS)}…` : text;
    const last = history.at(-1);
    if (last?.role === role && typeof last.content === "string") {
      last.content = `${last.content}\n${short}`;
    } else {
      history.push({ role, content: short });
    }
  }
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

export async function replyInConversation(params: {
  studioId: string;
  memberId: string;
  /** Web chat: the conversation being answered. Default: the studio's latest one. */
  conversationId?: string;
  /** Web chat: the manager's message, so Fauve can react to it. */
  reactToRowId?: string;
  /** WhatsApp only: lets Fauve react to the manager's last message. */
  waId?: string;
  replyToMessageId?: string;
}): Promise<RunFauveResult> {
  const db = supabaseAdmin();
  // A chat the manager started fresh in the web app is its own context (and
  // costs fewer tokens); otherwise Fauve keeps the studio's recent history.
  let conversations = db
    .from("conversations")
    .select("id, started_by")
    .eq("studio_id", params.studioId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false })
    .limit(1);
  if (params.conversationId) conversations = conversations.eq("id", params.conversationId);
  const conversation = (await conversations).data?.[0];
  let messages = db
    .from("whatsapp_messages")
    .select("direction, type, body, media_id, wa_message_id, payload")
    .eq("studio_id", params.studioId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (conversation?.started_by === "web") messages = messages.eq("conversation_id", conversation.id);

  const [studio, member, rows, instagram] = await Promise.all([
    db.from("studios").select("name, timezone, onboarding_step").eq("id", params.studioId).single(),
    db.from("members").select("first_name").eq("id", params.memberId).single(),
    messages,
    db.from("social_accounts").select("handle").eq("studio_id", params.studioId).eq("platform", "instagram").eq("status", "connected").maybeSingle(),
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
    return { reply: null, reactions: [], extras: {}, usage: { input_tokens: 0, output_tokens: 0 }, afterReply: [] };
  }

  return runFauve({
    studioId: params.studioId,
    memberId: params.memberId,
    waId: params.waId,
    replyToMessageId: params.replyToMessageId,
    reactToRowId: params.reactToRowId,
    timezone: studio.data.timezone,
    reactions: [],
    extras: {},
    afterReply: [],
    history,
    studio: {
      name: studio.data.name,
      timezone: studio.data.timezone,
      onboardingStep: studio.data.onboarding_step,
      firstName: member.data?.first_name ?? null,
      instagram: (instagram.data?.handle as string | null | undefined) ?? null,
    },
  });
}
