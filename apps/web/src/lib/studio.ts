import "server-only";
import { platformSchema, postKindSchema, postStatusSchema } from "@fauve/agent";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

// Data access for the signed-in web app. Every read goes through the user's own
// Supabase client, so RLS (is_studio_member) scopes it to their studio; queries
// still filter on studio_id explicitly for clarity and index use.

export type Db = Awaited<ReturnType<typeof supabaseServer>>;

const studioSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  timezone: z.string().min(1).catch("Europe/Paris"),
  plan: z.string(),
  onboarding_step: z.string(),
  website_url: z.string().nullable(),
  booking_url: z.string().nullable(),
});

const memberSchema = z.object({
  id: z.uuid(),
  first_name: z.string().nullable(),
  phone_e164: z.string(),
  role: z.enum(["owner", "staff"]),
  studio: studioSchema,
});

export type Studio = z.infer<typeof studioSchema>;
export type Member = z.infer<typeof memberSchema>;
export type StudioContext = { db: Db; member: Member | null };

type LoadedContext = StudioContext & { signedIn: boolean };

const loadContext = cache(async (): Promise<LoadedContext> => {
  // Per-request data: render at request time (the auth client reads the clock).
  await connection();
  const db = await supabaseServer();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { db, member: null, signedIn: false };

  const { data: row, error } = await db
    .from("members")
    .select(
      "id, first_name, phone_e164, role, created_at, studio:studios(id, name, timezone, plan, onboarding_step, website_url, booking_url)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`members: ${error.message}`);
  return { db, member: row ? memberSchema.parse(row) : null, signedIn: true };
});

/**
 * The signed-in user's member row and studio, once per request.
 * Redirects to the login page without a session; `member` is null when the
 * phone number is not attached to any studio yet.
 */
export async function getStudioContext(): Promise<StudioContext> {
  const { db, member, signedIn } = await loadContext();
  if (!signedIn) redirect("/connexion");
  return { db, member };
}

/** Same, for public pages: no redirect, `member` is null when signed out. */
export async function getOptionalStudioContext(): Promise<StudioContext> {
  const { db, member } = await loadContext();
  return { db, member };
}

// ---------------------------------------------------------------------------
// Row schemas shared by the screens
// ---------------------------------------------------------------------------

export const postRowSchema = z.object({
  id: z.uuid(),
  kind: postKindSchema,
  title: z.string(),
  status: postStatusSchema,
  scheduled_at: z.string().nullable(),
  platforms: z.array(platformSchema),
});
export type PostRow = z.infer<typeof postRowSchema>;
export const POST_COLUMNS = "id, kind, title, status, scheduled_at, platforms";

export const shotRowSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  hint: z.string().nullable(),
  due_date: z.string().nullable(),
  done: z.boolean(),
});
export type ShotRow = z.infer<typeof shotRowSchema>;
export const SHOT_COLUMNS = "id, label, hint, due_date, done";

export const contentPlanSchema = z.object({
  posts_per_week: z.number().int(),
  stories_per_week: z.number().int(),
  platforms: z.array(platformSchema),
});
export type ContentPlan = z.infer<typeof contentPlanSchema>;

export async function getContentPlan(db: Db, studioId: string): Promise<ContentPlan | null> {
  const { data, error } = await db
    .from("content_plans")
    .select("posts_per_week, stories_per_week, platforms")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw new Error(`content_plans: ${error.message}`);
  return data ? contentPlanSchema.parse(data) : null;
}

export const socialAccountSchema = z.object({
  platform: platformSchema,
  handle: z.string().nullable(),
  status: z.enum(["pending", "connected", "expired", "disconnected"]),
});
export type SocialAccount = z.infer<typeof socialAccountSchema>;

export async function getSocialAccounts(db: Db, studioId: string): Promise<SocialAccount[]> {
  return rows(
    socialAccountSchema,
    await db.from("social_accounts").select("platform, handle, status").eq("studio_id", studioId).order("platform"),
    "social_accounts",
  );
}

/** Throws on a Supabase error, parses the rows otherwise. */
export function rows<T>(
  schema: z.ZodType<T>,
  result: { data: unknown[] | null; error: { message: string } | null },
  label: string,
): T[] {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return z.array(schema).parse(result.data ?? []);
}

// ---------------------------------------------------------------------------
// Media: signed URLs from the private "media" bucket
// ---------------------------------------------------------------------------

const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Signs storage paths with the user's client: the storage RLS policy only lets
 * members read objects under their own `<studio_id>/` folder. Paths outside it
 * are skipped rather than sent to Storage.
 */
export async function signMediaUrls(db: Db, studioId: string, paths: string[]): Promise<Map<string, string>> {
  const own = [...new Set(paths.filter((p) => p.startsWith(`${studioId}/`)))];
  const urls = new Map<string, string>();
  if (!own.length) return urls;
  const { data, error } = await db.storage.from("media").createSignedUrls(own, SIGNED_URL_SECONDS);
  if (error) {
    console.warn("media: signing failed", error.message);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
