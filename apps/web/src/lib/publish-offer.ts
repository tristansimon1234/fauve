import "server-only";
import { publishOfferAnswer } from "@fauve/agent";
import { z } from "zod";
import { createLoginLink } from "@/lib/auth/login-link";
import { scheduleValidated } from "@/lib/posts";
import { supabaseAdmin } from "@/lib/supabase/admin";

// « Je le publie maintenant ? » under a delivered montage (lib/render/deliver.ts) or a
// reminder at the moment Simone suggested (lib/reminders.ts), and the draft_ready template's
// own buttons: her tap is answered at once, with no Simone turn. « Oui, publie-le » validates
// it and publishes it now; « Je regarde d'abord » points to its page. Any other answer goes
// to Simone as usual.

export type OfferReply = {
  /** Sent (on WhatsApp it may carry a one-time link)… */
  reply: string;
  /** …and stored without the link (Simone's history must not reuse it). */
  body: string;
  payload: Record<string, unknown>;
};

const offerSchema = z.object({ publish_offer: z.uuid() });

/** The post the last message offered to publish, if it did. */
export function offeredPost(payload: unknown): string | null {
  const parsed = offerSchema.safeParse(payload);
  return parsed.success ? parsed.data.publish_offer : null;
}

const where = (platforms: string[]) => (platforms.includes("tiktok") ? "sur Instagram et TikTok" : "sur Instagram");

export async function answerPublishOffer(
  studioId: string,
  text: string | null | undefined,
  lastOutbound: { payload: unknown } | null,
  channel: { waId?: string },
): Promise<OfferReply | null> {
  const answer = publishOfferAnswer(text);
  const postId = answer ? offeredPost(lastOutbound?.payload) : null;
  if (!answer || !postId) return null;
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("id, status, platforms").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return null;
  const card = { posts: [postId], open_post: postId };
  const page = `/v/${postId}`;
  const platforms = (post.platforms as string[] | null) ?? ["instagram"];

  if (answer === "look") {
    const line = "Prends ton temps ! Sur sa page, tu peux changer le texte ou la musique, puis le publier d’un bouton.";
    const link = channel.waId ? await createLoginLink(`+${channel.waId}`, page, "open_post") : null;
    return { reply: link ? `${line}\n\nIl est ici : ${link}` : line, body: line, payload: card };
  }

  const status = post.status as string;
  if (status === "published" || status === "measured") return { reply: "Il est déjà en ligne 🎉", body: "Il est déjà en ligne 🎉", payload: card };
  // A new version on its way (a correction): Simone answers, it is not the one she watched.
  if (status !== "draft" && status !== "validated" && status !== "scheduled") return null;
  if (status === "draft") {
    const { data: moved } = await db.from("posts").update({ status: "validated" }).eq("id", postId).eq("studio_id", studioId).eq("status", "draft").select("id");
    if (!moved?.length) return null;
  }
  // Nothing waits for a set time any more: « Oui » publishes it now (lib/posts.ts).
  const result = status === "scheduled" ? null : await scheduleValidated(studioId, postId);
  let line: string;
  if (status === "scheduled") line = `Il part déjà ${where(platforms)}, je te dis quand il est en ligne.`;
  else if (result && "when" in result) line = `C’est parti ✅ Je le publie ${where(platforms)} maintenant.`;
  else if (result && "blocked" in result && result.blocked === "instagram") line = "C’est validé ✅ Connecte ton Instagram dans Réglages pour que je le publie.";
  else if (result && "blocked" in result && result.blocked === "tiktok") line = "C’est validé ✅ Reconnecte TikTok dans Réglages (ou retire-le de « Où publier ») pour que je le publie.";
  else line = "C’est validé ✅ Je le publie dès que la vidéo est prête.";
  return { reply: line, body: line, payload: card };
}
