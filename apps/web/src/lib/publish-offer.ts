import "server-only";
import { publishOfferAnswer, publishWhen } from "@fauve/agent";
import { z } from "zod";
import { createLoginLink } from "@/lib/auth/login-link";
import { scheduleValidated } from "@/lib/posts";
import { instagramAccount } from "@/lib/social/publish";
import { answerStealOffer } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";

// « Je le publie vendredi à 18 h ? » under a delivered montage (lib/render/deliver.ts),
// and the draft_ready template's own buttons: her tap is answered at once, with no
// Simone turn. « Oui, publie-le » validates and schedules it; « Je regarde d'abord »
// points to its page. Any other answer goes to Simone as usual.

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

/** A tap on the buttons under Simone's last message, answered at once: a Reel to publish, or a style to follow (lib/steal.ts). */
export async function answerOffer(
  studioId: string,
  text: string | null | undefined,
  lastOutbound: { payload: unknown } | null,
  channel: { waId?: string },
): Promise<OfferReply | null> {
  return (await answerStealOffer(studioId, text, lastOutbound)) ?? answerPublishOffer(studioId, text, lastOutbound, channel);
}

async function answerPublishOffer(
  studioId: string,
  text: string | null | undefined,
  lastOutbound: { payload: unknown } | null,
  channel: { waId?: string },
): Promise<OfferReply | null> {
  const answer = publishOfferAnswer(text);
  const postId = answer ? offeredPost(lastOutbound?.payload) : null;
  if (!answer || !postId) return null;
  const db = supabaseAdmin();
  const [{ data: post }, { data: studio }] = await Promise.all([
    db.from("posts").select("id, status, scheduled_at, platforms").eq("id", postId).eq("studio_id", studioId).maybeSingle(),
    db.from("studios").select("timezone").eq("id", studioId).maybeSingle(),
  ]);
  if (!post) return null;
  const card = { posts: [postId], open_post: postId };
  const page = `/v/${postId}`;
  const platforms = (post.platforms as string[] | null) ?? ["instagram"];

  if (answer === "look") {
    const line = "Prends ton temps ! Sur sa page, tu peux changer le texte, la musique ou le jour, puis le publier d’un bouton.";
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
  const scheduled = status === "scheduled" ? "already" : await scheduleValidated(studioId, postId);
  const timezone = (studio?.timezone as string | undefined) ?? "Europe/Paris";
  const { data: now } = await db.from("posts").select("scheduled_at").eq("id", postId).maybeSingle();
  const at = (now?.scheduled_at as string | null) ?? null;
  const when = at ? publishWhen(at, timezone).short : null;
  let line: string;
  if (scheduled === "now") line = `C’est parti ✅ Je le publie ${where(platforms)} maintenant.`;
  else if (scheduled && when) line = `${scheduled === "already" ? "Il est déjà programmé" : "C’est programmé ✅"} : il part ${when} ${where(platforms)}. Tu peux encore le changer d’ici là sur sa page.`;
  else if (!(await instagramAccount(studioId))) line = "C’est validé ✅ Connecte ton Instagram dans Réglages pour que je le publie.";
  else line = "C’est validé ✅ Je le publie dès que la vidéo est prête.";
  return { reply: line, body: line, payload: card };
}
