import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { instagramAccount, publishIfDue } from "@/lib/social/publish";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Shared by the publication page and the calendar's grouped actions.

const whenFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** validated → scheduled when possible; returns when it goes out, or null. */
export async function scheduleValidated(studioId: string, postId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const post = await db.from("posts").select("render_id, scheduled_at").eq("id", postId).eq("studio_id", studioId).single();
  if (!post.data?.render_id || !(await instagramAccount(studioId))) return null;
  const planned = post.data.scheduled_at ? new Date(post.data.scheduled_at as string) : null;
  const at = planned && planned.getTime() > Date.now() + 60_000 ? planned : new Date();
  const { data } = await db
    .from("posts")
    .update({ status: "scheduled", scheduled_at: at.toISOString(), publish_started_at: null, publish_error: null })
    .eq("id", postId)
    .eq("status", "validated")
    .select("id");
  if (!data?.length) return null;
  revalidatePath(`/publications/${postId}`);
  if (at === planned) return whenFormat.format(at);
  after(() => publishIfDue(postId).then(() => revalidatePath(`/publications/${postId}`)));
  return "now";
}

