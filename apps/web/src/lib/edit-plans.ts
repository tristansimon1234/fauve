import "server-only";
import type { EditPlan } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Saves a new version of a post's montage under the next number. Two versions can
 * land at once (a montage being made while she changes the music or a text by
 * hand): the number is taken again and the insert retried.
 */
export async function insertPlanVersion(studioId: string, postId: string, plan: EditPlan): Promise<{ id: string; version: number }> {
  const db = supabaseAdmin();
  for (let attempt = 0; ; attempt++) {
    const { data: last } = await db.from("edit_plans").select("version").eq("post_id", postId).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = ((last?.version as number | undefined) ?? 0) + 1;
    const { data, error } = await db.from("edit_plans").insert({ studio_id: studioId, post_id: postId, version, plan }).select("id").single();
    if (!error) return { id: data.id as string, version };
    // 23505: another version took this number meanwhile.
    if (error.code !== "23505" || attempt >= 4) throw new Error(error.message);
  }
}
