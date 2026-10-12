"use server";

import { replyInConversation } from "@/lib/agent/conversation";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The in-app chat: the same Fauve as on WhatsApp. Messages from both channels
// are grouped into conversations (see the conversations migration): the web app
// lists them, opens one, or starts a new one.

export type ChatMessage = {
  id: string;
  from: "me" | "fauve";
  channel: "whatsapp" | "web";
  type: string;
  body: string | null;
  at: string;
  videoUrl: string | null;
};

export type ConversationSummary = { id: string; title: string | null; lastAt: string };

const MESSAGES_PER_CONVERSATION = 200;
const CONVERSATIONS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function current(): Promise<{ studioId: string; memberId: string; phone: string } | null> {
  const { member } = await getStudioContext();
  return member ? { studioId: member.studio.id, memberId: member.id, phone: member.phone_e164 } : null;
}

async function owns(studioId: string, conversationId: string): Promise<boolean> {
  if (!UUID.test(conversationId)) return false;
  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

async function list(studioId: string): Promise<ConversationSummary[]> {
  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("id, title, last_message_at")
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false })
    .limit(CONVERSATIONS);
  return (data ?? []).map((c) => ({ id: c.id as string, title: (c.title as string | null) ?? null, lastAt: c.last_message_at as string }));
}

async function messagesOf(studioId: string, conversationId: string): Promise<ChatMessage[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("whatsapp_messages")
    .select("id, direction, channel, type, body, created_at, payload")
    .eq("studio_id", studioId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PER_CONVERSATION);
  const rows = (data ?? []).reverse();

  // Montage videos: fresh signed links on every load, so they never expire in the chat.
  const renderIds = rows.flatMap((r) => {
    const id = (r.payload as { render_id?: string } | null)?.render_id;
    return id ? [id] : [];
  });
  const videos = new Map<string, string>();
  if (renderIds.length) {
    const { data: renders } = await db.from("renders").select("id, storage_path").eq("studio_id", studioId).in("id", renderIds);
    for (const r of renders ?? []) {
      const path = r.storage_path as string | null;
      if (!path?.startsWith(`${studioId}/`)) continue;
      const signed = await db.storage.from("media").createSignedUrl(path, 6 * 3600);
      if (signed.data) videos.set(r.id as string, signed.data.signedUrl);
    }
  }

  return rows.map((r) => {
    const renderId = (r.payload as { render_id?: string } | null)?.render_id;
    const videoUrl = renderId ? (videos.get(renderId) ?? null) : null;
    const body = (r.body as string | null)
      ?.replace(/\n*Voir la vidéo : \S+/u, "")
      .replace(/^\[Vidéo envoyée[^\]]*\]\n?/u, "")
      .trim();
    return {
      id: r.id as string,
      from: r.direction === "inbound" ? "me" : "fauve",
      channel: r.channel === "web" ? "web" : "whatsapp",
      type: r.type as string,
      body: body || null,
      at: r.created_at as string,
      videoUrl,
    };
  });
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

export type SendResult =
  | { ok: true; conversationId: string; messages: ChatMessage[]; conversations: ConversationSummary[] }
  | { ok: false; error: string; conversationId: string | null };

/** Sends a message to Fauve: in `conversationId`, or in a new conversation when null. */
export async function sendToFauve(text: string, conversationId: string | null): Promise<SendResult> {
  const ctx = await current();
  if (!ctx) return { ok: false, error: "Ton numéro n’est relié à aucun studio.", conversationId };
  const body = text.trim().slice(0, 4000);
  if (!body) return { ok: false, error: "Message vide.", conversationId };

  const db = supabaseAdmin();
  let id = conversationId;
  if (id) {
    if (!(await owns(ctx.studioId, id))) return { ok: false, error: "Cette conversation n’existe plus.", conversationId: null };
  } else {
    const created = await db.from("conversations").insert({ studio_id: ctx.studioId, started_by: "web" }).select("id").single();
    if (created.error) return { ok: false, error: "Ton message n’est pas parti. Réessaie.", conversationId: null };
    id = created.data.id as string;
  }

  const inserted = await db.from("whatsapp_messages").insert({
    studio_id: ctx.studioId,
    conversation_id: id,
    channel: "web",
    direction: "inbound",
    phone_e164: ctx.phone,
    type: "text",
    body,
  });
  if (inserted.error) return { ok: false, error: "Ton message n’est pas parti. Réessaie.", conversationId: id };

  try {
    const result = await replyInConversation({ studioId: ctx.studioId, memberId: ctx.memberId, conversationId: id });
    if (result.reply) {
      await db.from("whatsapp_messages").insert({
        studio_id: ctx.studioId,
        conversation_id: id,
        channel: "web",
        direction: "outbound",
        type: "text",
        body: result.reply,
      });
    }
    // E.g. a montage: queued now, the video shows up in the chat when it is ready.
    for (const job of result.afterReply) await job().catch((e) => console.error("chat: after-reply job failed", e));
  } catch (error) {
    console.error("chat: agent failed", error);
    return { ok: false, error: "Fauve n’a pas pu répondre. Réessaie dans un instant.", conversationId: id };
  }
  const [messages, conversations] = await Promise.all([messagesOf(ctx.studioId, id), list(ctx.studioId)]);
  return { ok: true, conversationId: id, messages, conversations };
}
