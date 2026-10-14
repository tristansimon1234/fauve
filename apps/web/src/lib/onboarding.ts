import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Once her first publication exists, getting started moves on to its last step: Instagram, to publish it. */
export async function completeFirstPost(studioId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("studios").update({ onboarding_step: "connect" }).eq("id", studioId).eq("onboarding_step", "first_post");
  if (error) console.warn("onboarding: first post not recorded", error.message);
}

/**
 * Her very first Reel: no other publication of the studio has a montage yet.
 * (Getting started is already done once the post exists, so the step cannot tell.)
 */
export async function isFirstReel(studioId: string, postId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .neq("id", postId)
    .not("edit_plan_id", "is", null);
  return !error && count === 0;
}
