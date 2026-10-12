import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText, sendVideo } from "@/lib/whatsapp/client";
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

/** Renders the post and sends the video to the manager (WhatsApp) or into the web test chat. */
export async function renderAndDeliver(target: DeliveryTarget): Promise<void> {
  try {
    const r = await renderPost(target.studioId, target.postId);
    const seconds = Math.round(r.durationMs / 100) / 10;
    const hashtags = r.hashtags.map((h) => `#${h}`).join(" ");
    const caption = [
      `Ton montage « ${r.title} » (${seconds} s).${target.rationale ? ` ${target.rationale}` : ""}`,
      r.caption ? `Légende :\n${r.caption}${hashtags ? `\n${hashtags}` : ""}` : null,
      "Réponds « ok » pour le valider, ou dis-moi ce que tu veux changer.",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (target.waId) {
      const id = await sendVideo(target.waId, r.url, caption);
      await store(target, {
        wa_message_id: id,
        type: "video",
        body: `[Vidéo envoyée : montage de « ${r.title} », ${seconds} s]\n${caption}`,
        payload: { render_id: r.renderId },
      });
    } else {
      await store(target, { type: "text", body: `${caption}\n\nVoir la vidéo : ${r.url}`, payload: { render_id: r.renderId } });
    }
  } catch (error) {
    console.error("render failed", target.postId, error);
    await notifyFailure(target, "Le montage n’a pas abouti cette fois, je regarde ce qui coince. Tu veux que je réessaie ?", error);
  }
}
