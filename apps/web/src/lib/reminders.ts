import "server-only";
import { missingContent, PUBLISH_OFFER_OPTIONS, REMINDER_GRACE_HOURS, reminderMessage, type PostKind } from "@fauve/agent";
import { studioAccess } from "@/lib/billing/access";
import { messageOwner } from "@/lib/owner-message";
import { supabaseAdmin } from "@/lib/supabase/admin";

// No more publishing on a schedule (Tristan : « la programmation sert à rien », « mais les
// rappels oui ») : a post ready to go keeps the moment Simone suggested (scheduled_at), and at
// that moment she reminds her, once, with « Oui, publie-le » / « Je regarde d'abord » (the same
// offer a delivery makes, answered by lib/publish-offer.ts : « oui » publishes it now). On
// WhatsApp in the 24 h window, else the draft_ready template, and always in the app.

const BATCH = 10;

/** Reminds the posts whose moment has come (called by the publish cron); returns how many. */
export async function remindDue(): Promise<number> {
  const db = supabaseAdmin();
  const now = Date.now();
  // Due in the last hours, and not reminded since its moment (a moment moved after a reminder is a new one).
  const { data: candidates } = await db
    .from("posts")
    .select("id, studio_id, kind, title, platforms, render_id, media_ids, scheduled_at, reminded_at")
    .in("status", ["draft", "validated"])
    .lte("scheduled_at", new Date(now).toISOString())
    .gt("scheduled_at", new Date(now - REMINDER_GRACE_HOURS * 3600_000).toISOString())
    .order("scheduled_at")
    .limit(50);
  const posts = (candidates ?? []).filter((p) => !p.reminded_at || Date.parse(p.reminded_at as string) < Date.parse(p.scheduled_at as string)).slice(0, BATCH);
  let sent = 0;
  for (const post of posts) {
    // Claimed first: two cron runs never remind the same post twice.
    const claim = db.from("posts").update({ reminded_at: new Date().toISOString() }).eq("id", post.id);
    const { data: claimed } = await (post.reminded_at ? claim.eq("reminded_at", post.reminded_at as string) : claim.is("reminded_at", null)).select("id");
    if (!claimed?.length) continue;
    const studioId = post.studio_id as string;
    // Nothing to post yet (its video is not made), or nothing she can publish yet: no reminder.
    if (missingContent(post.kind as PostKind, Boolean(post.render_id), ((post.media_ids as string[] | null) ?? []).length)) continue;
    if (!(await studioAccess(studioId)).unlock) continue;
    const platforms = (post.platforms as string[] | null)?.length ? (post.platforms as string[]) : ["instagram"];
    const kind = post.kind === "carousel" ? "carrousel" : post.kind === "story" ? "story" : post.kind === "post" ? "post" : "Reel";
    const title = ((post.title as string | null) ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "ta publication";
    try {
      await messageOwner(studioId, {
        text: reminderMessage(post.kind as string, (post.title as string | null) ?? "", platforms),
        options: PUBLISH_OFFER_OPTIONS,
        kind: "reminder",
        // Utility, so Meta does not cap it; draft_ready until post_reminder is approved.
        template: { name: "post_reminder", params: [kind, title], fallback: { name: "draft_ready", params: [kind, "aujourd’hui"] } },
        payload: { posts: [post.id], open_post: post.id, publish_offer: post.id },
      });
      sent++;
    } catch (error) {
      console.error("reminder failed", post.id, error);
    }
  }
  return sent;
}
