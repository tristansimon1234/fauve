import "server-only";
import { isInSessionWindow, type PostKind } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { InstagramError, mediaInsights, publishMedia, refreshToken, type PublishRequest } from "./instagram";
import { publishItems } from "./media-urls";

// Publishing worker. Posts in "scheduled" whose time has come are claimed (one
// worker per post), sent to Instagram, then moved to "published" or "failed".
// The manager hears about it on WhatsApp when the 24 h window allows it.

const CLAIM_TTL_MS = 10 * 60_000;
const REFRESH_BEFORE_MS = 7 * 24 * 3600_000;

type PublishOutcome = { postId: string; ok: boolean; permalink?: string | null; error?: string };

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

async function claim(postId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ publish_started_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("status", "scheduled")
    .or(`publish_started_at.is.null,publish_started_at.lt.${staleBefore}`)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

async function notify(studioId: string, text: string) {
  const db = supabaseAdmin();
  const owner = await db.from("members").select("phone_e164").eq("studio_id", studioId).eq("role", "owner").limit(1).maybeSingle();
  const phone = owner.data?.phone_e164 as string | undefined;
  if (!phone) return;
  const last = await db
    .from("whatsapp_messages")
    .select("created_at")
    .eq("phone_e164", phone)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!isInSessionWindow(last.data ? new Date(last.data.created_at) : null)) return;
  const id = await sendText(phone.slice(1), text).catch(() => undefined);
  if (id) {
    await db.from("whatsapp_messages").insert({
      studio_id: studioId,
      wa_message_id: id,
      direction: "outbound",
      phone_e164: phone,
      type: "text",
      body: text,
    });
  }
}

/** Instagram account and token of a studio, or null when not connected. */
export async function instagramAccount(studioId: string) {
  const db = supabaseAdmin();
  const account = await db
    .from("social_accounts")
    .select("id, handle, provider_ref, status")
    .eq("studio_id", studioId)
    .eq("platform", "instagram")
    .maybeSingle();
  if (!account.data || account.data.status !== "connected" || !account.data.provider_ref) return null;
  const creds = await db
    .from("social_credentials")
    .select("access_token, expires_at")
    .eq("social_account_id", account.data.id)
    .maybeSingle();
  if (!creds.data) return null;
  return {
    id: account.data.id as string,
    handle: account.data.handle as string | null,
    userId: account.data.provider_ref as string,
    accessToken: creds.data.access_token as string,
  };
}

const kindNames: Record<PostKind, string> = { reel: "Ton Reel", post: "Ton post", carousel: "Ton carrousel", story: "Ta story" };

/** The montage video of a post, as a URL Instagram can fetch. */
async function renderUrl(renderId: string | null): Promise<string> {
  if (!renderId) throw new Error("Aucune vidéo montée pour cette publication");
  const db = supabaseAdmin();
  const render = check(await db.from("renders").select("storage_path, status").eq("id", renderId).single()).data!;
  if (render.status !== "done" || !render.storage_path) throw new Error("La vidéo montée n'est pas prête");
  return check(await db.storage.from("media").createSignedUrl(render.storage_path as string, 3600)).data!.signedUrl;
}

/** What to publish for each kind: a Reel is the montage; posts, carousels and stories use the post's media. */
async function publishRequest(studioId: string, kind: PostKind, renderId: string | null, mediaIds: string[], caption: string): Promise<PublishRequest> {
  if (kind === "reel") return { kind: "reel", videoUrl: await renderUrl(renderId), caption };
  if (kind === "story") {
    const [item] = renderId ? [{ type: "video" as const, url: await renderUrl(renderId) }] : await publishItems(studioId, mediaIds.slice(0, 1));
    if (!item) throw new Error("Aucune photo ni vidéo pour cette story");
    return { kind: "story", item };
  }
  const items = await publishItems(studioId, mediaIds);
  if (kind === "carousel") {
    if (items.length < 2) throw new Error("Un carrousel demande au moins 2 photos ou vidéos");
    return { kind: "carousel", items: items.slice(0, 10), caption };
  }
  const [first] = items;
  if (!first) throw new Error("Aucune photo pour ce post");
  // A video in the feed is a Reel on Instagram.
  return first.type === "video" ? { kind: "reel", videoUrl: first.url, caption } : { kind: "image", imageUrl: first.url, caption };
}

/** Publishes one claimed post now. */
async function publishPost(postId: string): Promise<PublishOutcome> {
  const db = supabaseAdmin();
  const post = check(
    await db
      .from("posts")
      .select("id, studio_id, kind, title, caption, hashtags, render_id, media_ids, external_ids")
      .eq("id", postId)
      .single(),
  ).data!;
  const studioId = post.studio_id as string;

  const kind = post.kind as PostKind;
  try {
    const account = await instagramAccount(studioId);
    if (!account) throw new Error("Instagram n'est pas connecté");
    const hashtags = ((post.hashtags as string[] | null) ?? []).map((h) => `#${h}`).join(" ");
    const caption = [post.caption ?? "", hashtags].filter(Boolean).join("\n\n");
    const request = await publishRequest(studioId, kind, post.render_id as string | null, (post.media_ids as string[] | null) ?? [], caption);
    const result = await publishMedia({ userId: account.userId, accessToken: account.accessToken, request });

    check(
      await db
        .from("posts")
        .update({
          status: "published",
          publish_error: null,
          external_ids: {
            ...(post.external_ids as object),
            instagram: { media_id: result.mediaId, permalink: result.permalink, published_at: new Date().toISOString() },
          },
        })
        .eq("id", postId),
    );
    await notify(studioId, `${kindNames[kind]} « ${post.title} » est en ligne sur Instagram ✅${result.permalink ? `\n${result.permalink}` : ""}`);
    return { postId, ok: true, permalink: result.permalink };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("publish failed", postId, error instanceof InstagramError ? error.body : error);
    await db.from("posts").update({ status: "failed", publish_error: message.slice(0, 1000) }).eq("id", postId);
    await notify(studioId, `Je n’ai pas pu publier « ${post.title} » sur Instagram : ${message}. Dis-moi si je réessaie.`);
    return { postId, ok: false, error: message };
  }
}

/** Claims and publishes one post if it is due (used right after a validation "now"). */
export async function publishIfDue(postId: string): Promise<PublishOutcome | null> {
  if (!(await claim(postId))) return null;
  return publishPost(postId);
}

/** Keeps long-lived tokens alive: refresh those expiring within a week. */
async function refreshExpiringTokens(): Promise<number> {
  const db = supabaseAdmin();
  const soon = new Date(Date.now() + REFRESH_BEFORE_MS).toISOString();
  const { data } = await db.from("social_credentials").select("social_account_id, access_token").lt("expires_at", soon).limit(20);
  let refreshed = 0;
  for (const row of data ?? []) {
    try {
      const next = await refreshToken(row.access_token as string);
      await db
        .from("social_credentials")
        .update({ access_token: next.accessToken, expires_at: next.expiresAt.toISOString(), updated_at: new Date().toISOString() })
        .eq("social_account_id", row.social_account_id);
      refreshed++;
    } catch (error) {
      console.error("token refresh failed", row.social_account_id, error instanceof InstagramError ? error.body : error);
      await db.from("social_accounts").update({ status: "expired" }).eq("id", row.social_account_id);
    }
  }
  // Fauve's own account (Instagram DMs), refreshed the same way.
  const { data: fauve } = await db.from("platform_accounts").select("key, access_token").lt("expires_at", soon);
  for (const row of fauve ?? []) {
    try {
      const next = await refreshToken(row.access_token as string);
      await db
        .from("platform_accounts")
        .update({ access_token: next.accessToken, expires_at: next.expiresAt.toISOString(), updated_at: new Date().toISOString() })
        .eq("key", row.key);
      refreshed++;
    } catch (error) {
      console.error("Fauve account token refresh failed", error instanceof InstagramError ? error.body : error);
    }
  }
  return refreshed;
}

const MEASURE_EVERY_MS = 6 * 3600_000;
const MEASURE_FOR_MS = 30 * 24 * 3600_000;

/**
 * Captures Instagram insights for Fauve's published posts: every 6 h during the
 * first 30 days. A post becomes "measured" once a capture is at least 48 h old.
 */
async function captureMetrics(): Promise<number> {
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("posts")
    .select("id, studio_id, status, external_ids")
    .in("status", ["published", "measured"])
    .not("external_ids->instagram->>media_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(50);
  let captured = 0;
  for (const post of posts ?? []) {
    if (captured >= 10) break;
    const ig = (post.external_ids as { instagram?: { media_id?: string; published_at?: string } }).instagram;
    const publishedAt = ig?.published_at ? new Date(ig.published_at).getTime() : 0;
    if (!ig?.media_id || Date.now() - publishedAt > MEASURE_FOR_MS) continue;
    const last = await db
      .from("metrics")
      .select("captured_at")
      .eq("post_id", post.id)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.data && Date.now() - new Date(last.data.captured_at as string).getTime() < MEASURE_EVERY_MS) continue;
    const account = await instagramAccount(post.studio_id as string);
    if (!account) continue;
    try {
      const m = await mediaInsights(ig.media_id, account.accessToken);
      await db.from("metrics").insert({
        studio_id: post.studio_id,
        post_id: post.id,
        platform: "instagram",
        views: m.views ?? null,
        reach: m.reach ?? null,
        likes: m.likes ?? null,
        saves: m.saved ?? null,
        shares: m.shares ?? null,
        comments: m.comments ?? null,
        profile_visits: m.profile_visits ?? null,
      });
      if (post.status === "published" && Date.now() - publishedAt > 48 * 3600_000) {
        await db.from("posts").update({ status: "measured" }).eq("id", post.id);
      }
      captured++;
    } catch (error) {
      console.error("insights capture failed", post.id, error instanceof InstagramError ? error.body : error);
    }
  }
  return captured;
}

/** Cron entry point: publish what is due, measure, refresh tokens. */
export async function runPublishWorker() {
  const db = supabaseAdmin();
  const due = check(
    await db
      .from("posts")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(5),
  ).data!;
  const published: PublishOutcome[] = [];
  for (const { id } of due) {
    const outcome = await publishIfDue(id as string);
    if (outcome) published.push(outcome);
  }
  const measured = await captureMetrics();
  const refreshed = await refreshExpiringTokens();
  return { due: due.length, published, measured, refreshed };
}
