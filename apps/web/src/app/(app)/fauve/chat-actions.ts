"use server";

import { EFFORTS, effortSchema, type Effort } from "@fauve/agent";
import { quoteCharges, quoteFailed, quoteState, type CardQuote } from "@/lib/chat-cards";
import { acceptQuote, pricedAsEffect, type QuoteStage } from "@/lib/credits";
import { startMontage } from "@/lib/montage-start";
import { setReaction } from "@/lib/reactions";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chatTurn, current, list, messagesOf, owns, UUID, type Attachment, type ChatAbout, type ChatMessage, type ConversationSummary, type SendResult } from "@/lib/chat";

// The in-app chat: the same Fauve as on WhatsApp. Messages from both channels
// are grouped into conversations (see the conversations migration): the web app
// lists them, opens one, or starts a new one. The turn itself is in lib/chat.ts
// (also streamed live by api/chat/turn).

export type { Attachment, ChatAbout, ChatMessage, ConversationSummary, SendResult } from "@/lib/chat";

/** Sends a message to Fauve and returns the conversation with her answer (see chatTurn). */
export async function sendToFauve(text: string, conversationId: string | null, attachments: Attachment[] = [], about?: ChatAbout): Promise<SendResult> {
  return chatTurn(text, conversationId, attachments, about);
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const ctx = await current();
  return ctx ? list(ctx.studioId) : [];
}

export async function loadConversation(conversationId: string): Promise<ChatMessage[] | null> {
  const ctx = await current();
  if (!ctx || !(await owns(ctx.studioId, conversationId))) return null;
  return messagesOf(ctx.studioId, conversationId);
}

/** Hides a conversation from the list (messages stay, for the history and the agent). */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const ctx = await current();
  if (!ctx || !(await owns(ctx.studioId, conversationId))) return false;
  const { error } = await supabaseAdmin()
    .from("conversations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("studio_id", ctx.studioId);
  return !error;
}

/** What the chat drawer is about: a publication, and maybe one scene of its montage. */

export async function openPostChat(postId: string): Promise<{ conversationId: string | null; messages: ChatMessage[]; timezone: string; studioId: string } | null> {
  if (!UUID.test(postId)) return null;
  const { member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("id")
    .eq("studio_id", studioId)
    .eq("post_id", postId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const conversationId = (data?.id as string | undefined) ?? null;
  return { conversationId, messages: conversationId ? await messagesOf(studioId, conversationId) : [], timezone: member.studio.timezone, studioId };
}

/**
 * « Lancer » on a quote card: starts the montage at once, without asking Fauve
 * again. The manager's yes and Fauve's « c'est parti » are written to the
 * conversation so the history (and Fauve's memory) stays coherent.
 */
export async function launchQuote(quoteId: string, conversationId: string, effort?: Effort): Promise<SendResult> {
  const ctx = await current();
  if (!ctx) return { ok: false, error: "Ton numéro n’est relié à aucun studio.", conversationId };
  const level = effortSchema.optional().safeParse(effort);
  if (!UUID.test(quoteId) || !level.success || !(await owns(ctx.studioId, conversationId))) {
    return { ok: false, error: "Ce montage n’est plus disponible.", conversationId };
  }
  // The level picked on the card, at the price it showed.
  const quote = await acceptQuote(ctx.studioId, quoteId, new Date(), { effort: level.data });
  if ("error" in quote) return { ok: false, error: quote.error, conversationId };

  const db = supabaseAdmin();
  try {
    await startMontage(ctx.studioId, quote);
  } catch (error) {
    console.error("launchQuote: montage not queued", error);
    // Not started: the quote can be launched again.
    await db.from("credit_quotes").update({ used_at: null }).eq("id", quote.id);
    return { ok: false, error: "Le montage n’a pas pu démarrer. Réessaie dans un instant.", conversationId };
  }
  // What Fauve says depends on the level: it matches the card's steps and time.
  const { minutes } = EFFORTS[quote.effort ?? "rapide"];
  const started =
    quote.effort === "max"
      ? `C’est parti ! Je prépare deux versions, je garde la meilleure et je la peaufine, puis je t’ouvre sa page (${minutes} minutes).`
      : quote.effort === "soigne"
        ? `C’est parti ! Je monte ta vidéo, je la regarde et la corrige si besoin, puis je t’ouvre sa page (${minutes} minutes).`
        : `C’est parti ! Je monte ta vidéo et je t’ouvre sa page dès qu’elle est prête (${minutes} minutes).`;
  // One after the other, so they keep their order in the conversation.
  await db
    .from("whatsapp_messages")
    .insert({
      studio_id: ctx.studioId,
      conversation_id: conversationId,
      channel: "web",
      direction: "inbound",
      phone_e164: ctx.phone,
      type: "text",
      body: quote.effort ? `Oui, lance (${EFFORTS[quote.effort].label})` : "Oui, lance",
    });
  await db.from("whatsapp_messages").insert(
    {
      studio_id: ctx.studioId,
      conversation_id: conversationId,
      channel: "web",
      direction: "outbound",
      type: "text",
      body: started,
      payload: { notes: [`montage lancé (quote_id=${quote.id}${quote.effort ? `, ${EFFORTS[quote.effort].label}` : ""})`] },
    },
  );
  const [messages, conversations] = await Promise.all([messagesOf(ctx.studioId, conversationId), list(ctx.studioId)]);
  return { ok: true, conversationId, messages, conversations };
}

/** Where a quote card's montage is, without reloading the conversation (media links stay as they are). */
export type QuoteProgress = Pick<CardQuote, "id" | "state" | "stage" | "stageAt" | "startedAt" | "effort" | "failed" | "charged" | "effect">;

/** The launched montages the chat is showing, polled every few seconds while they run (use-quote-progress.ts). */
export async function quoteProgress(ids: string[]): Promise<QuoteProgress[]> {
  const wanted = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, 10);
  if (!wanted.length) return [];
  const ctx = await current();
  if (!ctx) return [];
  const { data } = await supabaseAdmin()
    .from("credit_quotes")
    .select("id, effort, stage, stage_at, used_at, charged_at, expires_at, params")
    .eq("studio_id", ctx.studioId)
    .in("id", wanted);
  const charges = await quoteCharges(
    ctx.studioId,
    (data ?? []).filter((q) => q.charged_at).map((q) => q.id as string),
  ).catch(() => new Map<string, number>());
  return (data ?? []).map((q) => ({
    id: q.id as string,
    state: quoteState(q),
    stage: (q.stage as QuoteStage | null) ?? null,
    stageAt: (q.stage_at as string | null) ?? null,
    startedAt: (q.used_at as string | null) ?? null,
    effort: effortSchema.nullable().catch(null).parse(q.effort ?? null),
    failed: quoteFailed(q),
    charged: charges.get(q.id as string) ?? null,
    effect: pricedAsEffect(q.params),
  }));
}

/** Emojis the manager can react with in the app (one per message; the same one again removes it). */
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "🔥", "😂", "😮", "🙏"]);

export async function reactToMessage(messageId: string, emoji: string | null): Promise<boolean> {
  const ctx = await current();
  if (!ctx || !UUID.test(messageId) || (emoji !== null && !ALLOWED_REACTIONS.has(emoji))) return false;
  const { data } = await supabaseAdmin().from("whatsapp_messages").select("id").eq("id", messageId).eq("studio_id", ctx.studioId).maybeSingle();
  if (!data) return false;
  await setReaction({ id: messageId }, "me", emoji);
  return true;
}
