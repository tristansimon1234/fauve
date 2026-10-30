import "server-only";
import { platformSchema, postKindSchema, postStatusSchema } from "@fauve/agent";
import { redirect } from "next/navigation";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { socialConnect } from "@/lib/social/connect";

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
  /** How it was connected: « instagram » (Instagram Login) or « facebook » (Facebook Login, earlier connections). */
  provider: z.string().nullable().catch(null),
});
export type SocialAccount = z.infer<typeof socialAccountSchema>;

export async function getSocialAccounts(db: Db, studioId: string): Promise<SocialAccount[]> {
  // Connecting accounts is put aside (lib/social/connect.ts): none shows, even one connected before.
  if (!socialConnect()) return [];
  return rows(
    socialAccountSchema,
    await db.from("social_accounts").select("platform, handle, status, provider").eq("studio_id", studioId).order("platform"),
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

const SIGNED_URL_SECONDS = 2 * 60 * 60;

/**
 * Signs storage paths of the studio's own `<studio_id>/` folder (paths outside it
 * are skipped; the caller passes the signed-in member's studio). The links are
 * kept for an hour, so a refresh gives back the same URLs: images and videos
 * already on screen do not reload or flicker.
 */
export async function signMediaUrls(_db: Db, studioId: string, paths: string[]): Promise<Map<string, string>> {
  const own = [...new Set(paths.filter((p) => p.startsWith(`${studioId}/`) && !p.includes("..")))].sort();
  if (!own.length) return new Map();
  try {
    return new Map(Object.entries(await signedUrls(own)));
  } catch (error) {
    console.warn("media: signing failed", error instanceof Error ? error.message : error);
    return new Map();
  }
}

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  "use cache";
  // Kept an hour at most: every link served is still valid for an hour.
  cacheLife({ stale: 1800, revalidate: 1800, expire: 3600 });
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUrls(paths, SIGNED_URL_SECONDS);
  // A failure throws, so it is not kept.
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).flatMap((item) => (item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : [])));
}
