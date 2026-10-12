import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type CurrentMember = { id: string; studio_id: string; phone_e164: string | null; first_name: string | null };

/** The signed-in manager and her studio, or null when there is no session. */
export async function currentMember(): Promise<CurrentMember | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const member = await supabaseAdmin()
    .from("members")
    .select("id, studio_id, phone_e164, first_name")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return member.data ?? null;
}
