import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let admin: SupabaseClient | undefined;

/** Service-role client: bypasses RLS. Webhook and jobs only, never in a user request path. */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
