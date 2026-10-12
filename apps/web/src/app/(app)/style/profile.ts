import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextProfile, type StoredProfile } from "./style-profile";

/**
 * Inserts the next version of the studio's brand profile, built from the latest
 * one. Never updates in place. Service role: callers must have checked that the
 * user is a member of `studioId`.
 */
export async function insertProfileVersion(
  studioId: string,
  change: (current: StoredProfile) => Record<string, unknown>,
): Promise<{ version: number; profile: StoredProfile }> {
  const db = supabaseAdmin();
  // Two saves at once would want the same version: the unique key rejects one, retry it.
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await db
      .from("brand_profiles")
      .select("version, profile, examples")
      .eq("studio_id", studioId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw new Error(`brand_profiles: ${latest.error.message}`);

    const profile = nextProfile(latest.data?.profile, change);
    const version = ((latest.data?.version as number | undefined) ?? 0) + 1;
    const { error } = await db.from("brand_profiles").insert({
      studio_id: studioId,
      version,
      profile,
      examples: latest.data?.examples ?? [],
    });
    if (!error) return { version, profile };
    if (error.code !== "23505") throw new Error(`brand_profiles insert: ${error.message}`);
  }
  throw new Error("brand_profiles: version conflict");
}
