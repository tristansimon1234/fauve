import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Her first publication is the last step of getting started: once one exists, she is all set. */
export async function completeFirstPost(studioId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("studios").update({ onboarding_step: "done" }).eq("id", studioId).eq("onboarding_step", "first_post");
  if (error) console.warn("onboarding: first post not recorded", error.message);
}
