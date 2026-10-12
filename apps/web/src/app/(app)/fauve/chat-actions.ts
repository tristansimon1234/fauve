"use server";

import { replyInConversation } from "@/lib/agent/conversation";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The in-app chat: the same Fauve and the same conversation as WhatsApp
// (messages from both channels share one history), from the web app.

export type ChatMessage = {
  id: string;
  from: "me" | "fauve";
  channel: "whatsapp" | "web";
  type: string;
  body: string | null;
  at: string;
  videoUrl: string | null;
};

const HISTORY = 40;

async function studioId(): Promise<{ studioId: string; memberId: string; phone: string } | null> {
  const { member } = await getStudioContext();
  return member ? { studioId: member.studio.id, memberId: member.id, phone: member.phone_e164 } : null;
}

async function load(studio: string): Promise<ChatMessage[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("whatsapp_messages")
    .select("id, direction, channel, type, body, created_at, payload")
    .eq("studio_id", studio)
    .order("created_at", { ascending: false })
    .limit(HISTORY);
  const rows = (data ?? []).reverse();

  // Montage videos: fresh signed links on every load, so they never expire in the chat.
  const renderIds = rows.flatMap((r) => {
    const id = (r.payload as { render_id?: string } | null)?.render_id;
    return id ? [id] : [];
  });
  const videos = new Map<string, string>();
  if (renderIds.length) {
    const { data: renders } = await db.from("renders").select("id, storage_path").eq("studio_id", studio).in("id", renderIds);
    for (const r of renders ?? []) {
      const path = r.storage_path as string | null;
      if (!path?.startsWith(`${studio}/`)) continue;
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

export async function loadChat(): Promise<ChatMessage[]> {
  const ctx = await studioId();
  return ctx ? load(ctx.studioId) : [];
}

export async function sendToFauve(text: string): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  const ctx = await studioId();
  if (!ctx) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const body = text.trim().slice(0, 4000);
  if (!body) return { ok: false, error: "Message vide." };

  const db = supabaseAdmin();
  const inserted = await db.from("whatsapp_messages").insert({
    studio_id: ctx.studioId,
    channel: "web",
    direction: "inbound",
    phone_e164: ctx.phone,
    type: "text",
    body,
  });
  if (inserted.error) return { ok: false, error: "Ton message n’est pas parti. Réessaie." };

  try {
    const result = await replyInConversation({ studioId: ctx.studioId, memberId: ctx.memberId });
    if (result.reply) {
      await db.from("whatsapp_messages").insert({
        studio_id: ctx.studioId,
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
    return { ok: false, error: "Fauve n’a pas pu répondre. Réessaie dans un instant." };
  }
  return { ok: true, messages: await load(ctx.studioId) };
}
