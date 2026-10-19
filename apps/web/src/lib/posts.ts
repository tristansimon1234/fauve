import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { missingContent, type PostKind } from "@fauve/agent";
import { instagramAccount, publishIfDue } from "@/lib/social/publish";
import { tiktokAccount } from "@/lib/social/tiktok-account";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Shared by the publication page and the calendar's grouped actions.

const whenFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

type Blocked = "montage" | "photos" | "instagram" | "tiktok";

/**
 * Why a validated post cannot be scheduled yet (null: it can), with the same checks as Simone's
 * schedule_post. A carousel or a photo post needs its photos, not a montage: requiring a render
 * left every validated carousel at « validated », never published.
 */
async function blocked(studioId: string, post: { kind: string; render_id: string | null; media_ids: string[] | null; platforms: string[] | null }): Promise<Blocked | null> {
  const missing = missingContent(post.kind as PostKind, Boolean(post.render_id), post.media_ids?.length ?? 0);
  if (missing) return missing === "montage" ? "montage" : "photos";
  const platforms = post.platforms?.length ? post.platforms : ["instagram"];
  if (platforms.includes("instagram") && !(await instagramAccount(studioId))) return "instagram";
  if (platforms.includes("tiktok") && !(await tiktokAccount(studioId).catch(() => null))) return "tiktok";
  return null;
}

/** What she reads when her validated post cannot go out yet: the real reason and what to do. */
export const NOT_SCHEDULED: Record<Blocked, string> = {
  montage: "C’est validé. Simone le publie dès que la vidéo est prête.",
  photos: "C’est validé. Il lui manque ses photos : ajoute-les pour que Simone le publie.",
  instagram: "C’est validé. Connecte Instagram (Réglages) pour que Simone le publie.",
  tiktok: "C’est validé. Reconnecte TikTok (Réglages), ou retire-le de « Où publier », pour que Simone le publie.",
};

/** validated → scheduled when possible; returns when it goes out, or why it cannot yet. */
export async function scheduleValidated(studioId: string, postId: string): Promise<{ when: string } | { blocked: Blocked } | null> {
  const db = supabaseAdmin();
  const post = await db.from("posts").select("kind, render_id, media_ids, platforms, scheduled_at").eq("id", postId).eq("studio_id", studioId).single();
  if (!post.data) return null;
  const why = await blocked(studioId, post.data as { kind: string; render_id: string | null; media_ids: string[] | null; platforms: string[] | null });
  if (why) return { blocked: why };
  const planned = post.data.scheduled_at ? new Date(post.data.scheduled_at as string) : null;
  const at = planned && planned.getTime() > Date.now() + 60_000 ? planned : new Date();
  const { data } = await db
    .from("posts")
    .update({ status: "scheduled", scheduled_at: at.toISOString(), publish_started_at: null, publish_error: null, handoff_at: null, handoff_via: null })
    .eq("id", postId)
    .eq("status", "validated")
    .select("id");
  if (!data?.length) return null;
  revalidatePath(`/publications/${postId}`);
  if (at === planned) return { when: whenFormat.format(at) };
  after(() => publishIfDue(postId).then(() => revalidatePath(`/publications/${postId}`)));
  return { when: "now" };
}

