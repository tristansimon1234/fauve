import "server-only";
import { createLoginLink } from "@/lib/auth/login-link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { renderPost } from "./render-post";

export type DeliveryTarget = {
  studioId: string;
  postId: string;
  /** WhatsApp id of the manager; absent for the web test chat. */
  waId?: string;
  /** Inbound message this answers (keeps the conversation history in order). */
  replyTo?: string;
  /** The editor's one-line explanation, shown with the video. */
  rationale?: string;
};

function store(target: DeliveryTarget, fields: { wa_message_id?: string; type: string; body: string; payload?: Record<string, unknown> }) {
  return supabaseAdmin()
    .from("whatsapp_messages")
    .insert({
      studio_id: target.studioId,
      channel: target.waId ? "whatsapp" : "web",
      direction: "outbound",
      phone_e164: target.waId ? `+${target.waId}` : null,
      ...fields,
      payload: { reply_to: target.replyTo, ...fields.payload },
    });
}

/** Tells the manager something went wrong, on the channel she uses. */
export async function notifyFailure(target: DeliveryTarget, text: string, detail: unknown) {
  const id = target.waId ? await sendText(target.waId, text).catch(() => undefined) : undefined;
  await store(target, { wa_message_id: id, type: "text", body: text, payload: { error: String(detail).slice(0, 500) } });
}

/**
 * Renders the post and points the manager to its page, where she watches the
 * video, reads the caption and validates. On WhatsApp: a sign-in link to that
 * page; in the app: the post's card (and the app opens the page).
 * Returns what was delivered, or null if it failed (the manager is told).
 */
export async function renderAndDeliver(target: DeliveryTarget): Promise<{ title: string } | null> {
  try {
    const r = await renderPost(target.studioId, target.postId);
    const seconds = Math.round(r.durationMs / 100) / 10;
    const page = `/publications/${target.postId}`;
    const intro = `Ton montage « ${r.title} » est prêt 🎬 (${seconds} s).${target.rationale ? ` ${target.rationale}` : ""}`;
    const after = "Valide-le sur sa page, ou dis-moi ce que tu veux changer. Je peux aussi te faire une variante (autre style, autre accroche) pour 1 crédit.";
    const payload = { posts: [target.postId], open_post: target.postId };
    if (target.waId) {
      const link = await createLoginLink(`+${target.waId}`, page, "open_post");
      const body = `${intro}\n\nRegarde-le ici : ${link}\n\n${after}`;
      const id = await sendText(target.waId, body);
      // Stored without the one-time link (Fauve's history must not reuse it).
      await store(target, { wa_message_id: id, type: "text", body: `${intro}\n\n${after}`, payload });
    } else {
      await store(target, { type: "text", body: `${intro}\n\n${after}`, payload });
    }
    return { title: r.title };
  } catch (error) {
    console.error("render failed", target.postId, error);
    await notifyFailure(target, "Le montage n’a pas abouti cette fois, je regarde ce qui coince. Tu veux que je réessaie ? Aucun crédit n’a été débité.", error);
    return null;
  }
}
