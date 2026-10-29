import "server-only";
import { readInstagramPosts, readInstagramProfile, usdToEur, type InstagramPost, type InstagramProfile } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tregCall } from "@/lib/treg";

// Her Instagram profile, given instead of a site at her getting started: read through Treg (the
// sandbox's browser meets Instagram's login wall), its profile and its latest posts at once,
// about a tenth of a cent each (Treg's catalog, October 2026: crawl4ai.instagram.user.profile and
// .user.posts, $0.0009 a success, their inputs and columns documented there).

const PROFILE = "crawl4ai.instagram.user.profile";
const POSTS = "crawl4ai.instagram.user.posts";
/** Photos read for her style, as many as a site gives. */
const POSTS_READ = 12;

/** Her profile and latest posts; null without Treg's key, `profile` null when Instagram has no such public profile. */
export async function fetchInstagramProfile(studioId: string, handle: string): Promise<{ profile: InstagramProfile | null; posts: InstagramPost[] } | null> {
  const [profile, posts] = await Promise.all([
    tregCall(PROFILE, { username: handle }, 0.01).catch(() => null),
    tregCall(POSTS, { username: handle, limit: POSTS_READ }, 0.01).catch(() => null),
  ]);
  if (!profile && !posts) return null;
  const costUsd = (profile?.costUsd ?? 0) + (posts?.costUsd ?? 0);
  const read = { profile: readInstagramProfile(profile?.answer, handle), posts: readInstagramPosts(posts?.answer, POSTS_READ) };
  if (costUsd > 0) {
    await supabaseAdmin()
      .from("cost_events")
      .insert({ studio_id: studioId, kind: "instagram_profile", provider: "treg", units: 1, cost_eur: usdToEur(costUsd, env("USD_TO_EUR")), meta: costMeta({ handle, found: Boolean(read.profile), posts: read.posts.length, cost_usd: costUsd }) })
      .then(undefined, (e: unknown) => console.warn("instagram profile cost not logged", e));
  }
  if (!read.profile) console.warn("instagram profile: nothing read", handle, JSON.stringify(profile?.answer ?? null).slice(0, 300));
  return read;
}
