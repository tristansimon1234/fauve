import "server-only";
import { studioAccess } from "@/lib/billing/access";
import { captionForInstagram, DEFAULT_COVER_SECONDS, isInSessionWindow, postCoverSchema, type PostKind, type TikTokExternal } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { InstagramError, mediaInsights, publishMedia, refreshToken, type PublishRequest } from "./instagram";
import { slidesToPublish } from "@/lib/render/slides";
import { designedItems, publishItems } from "./media-urls";
import { handOff, matchHandPublished } from "./hand-off";
import { TikTokError } from "./tiktok";
import { captureTikTokMetrics, matchTikTokDrafts, refreshIdleTikTokTokens, sendToTikTok, tiktokCanTake, trackTikTok } from "./tiktok-account";

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

/**
 * Whether the video to publish is the latest montage. A manager can change the
 * montage and validate before the new video is rendered (about a minute): the
 * post then waits for it instead of going out with the old video.
 */
async function montageState(postId: string): Promise<"ready" | "rendering" | "failed"> {
  const db = supabaseAdmin();
  const post = check(await db.from("posts").select("kind, edit_plan_id, render_id, slides, slides_render, media_ids").eq("id", postId).single()).data!;
  // Photos with text over them: the images of the current texts.
  if (post.kind === "carousel" || post.kind === "post") {
    const slides = slidesToPublish(post as { slides: unknown; slides_render: unknown; media_ids: string[] | null }).state;
    if (slides !== "ready") return slides;
  }
  if (!post.edit_plan_id) return "ready";
  if (post.render_id) {
    const current = await db.from("renders").select("edit_plan_id").eq("id", post.render_id).maybeSingle();
    if (current.data?.edit_plan_id === post.edit_plan_id) return "ready";
  }
  const latest = await db
    .from("renders")
    .select("status, created_at")
    .eq("edit_plan_id", post.edit_plan_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const recent = (iso: string) => Date.now() - new Date(iso).getTime() < 15 * 60_000;
  if (!latest.data) {
    // The render starts right after the plan is saved.
    const plan = await db.from("edit_plans").select("created_at").eq("id", post.edit_plan_id).maybeSingle();
    return plan.data && Date.now() - new Date(plan.data.created_at as string).getTime() < 2 * 60_000 ? "rendering" : "ready";
  }
  if (latest.data.status === "failed") return "failed";
  return latest.data.status === "rendering" && recent(latest.data.created_at as string) ? "rendering" : "ready";
}

async function claim(postId: string): Promise<boolean> {
  // A newer montage still rendering: the next run (every 5 min) publishes it.
  if ((await montageState(postId)) === "rendering") return false;
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

/** A Reel's cover for Instagram: the photo chosen (as a JPEG link), or the frame chosen, else the default frame. */
async function reelCover(studioId: string, chosen: unknown): Promise<{ at: number } | { url: string }> {
  const cover = postCoverSchema.nullable().catch(null).parse(chosen);
  if (cover && "media_id" in cover) {
    const [item] = await publishItems(studioId, [cover.media_id]).catch(() => []);
    if (item?.type === "image") return { url: item.url };
  }
  return { at: cover && "at" in cover ? cover.at : DEFAULT_COVER_SECONDS };
}

/** A story's picture or video: its montage if it has one, else its first photo or video. */
export async function storyItem(studioId: string, renderId: string | null, mediaIds: string[]): Promise<{ type: "image" | "video"; url: string }> {
  const [item] = renderId ? [{ type: "video" as const, url: await renderUrl(renderId) }] : await publishItems(studioId, mediaIds.slice(0, 1));
  if (!item) throw new Error("Aucune photo ni vidéo pour cette story");
  return item;
}

/** What to publish for each kind: a Reel is the montage; posts, carousels and stories use the post's media. */
async function publishRequest(
  studioId: string,
  kind: PostKind,
  renderId: string | null,
  mediaIds: string[],
  caption: string,
  rendered: Record<string, string> = {},
  chosenCover: unknown = null,
  shareToFeed = true,
  designed?: string[],
): Promise<PublishRequest> {
  if (kind === "reel") return { kind: "reel", videoUrl: await renderUrl(renderId), caption, cover: await reelCover(studioId, chosenCover), shareToFeed };
  if (kind === "story") return { kind: "story", item: await storyItem(studioId, renderId, mediaIds) };
  // A designed carousel goes out as its slides, not as its photos.
  const items = designed?.length ? await designedItems(studioId, designed) : await publishItems(studioId, mediaIds, rendered);
  if (kind === "carousel") {
    if (items.length < 2) throw new Error("Un carrousel demande au moins 2 photos ou vidéos");
    return { kind: "carousel", items: items.slice(0, 10), caption };
  }
  const [first] = items;
  if (!first) throw new Error("Aucune photo pour ce post");
  // A video in the feed is a Reel on Instagram.
  return first.type === "video" ? { kind: "reel", videoUrl: first.url, caption } : { kind: "image", imageUrl: first.url, caption };
}

const POST_COLUMNS = "id, studio_id, kind, title, caption, hashtags, render_id, media_ids, external_ids, slides, slides_render, cover, share_to_feed, platforms, tiktok";
type PostRow = {
  id: string;
  studio_id: string;
  kind: PostKind;
  title: string;
  caption: string | null;
  hashtags: string[] | null;
  render_id: string | null;
  media_ids: string[] | null;
  external_ids: Record<string, unknown> | null;
  slides: unknown;
  slides_render: unknown;
  cover: unknown;
  share_to_feed: boolean | null;
  platforms: string[];
  tiktok: unknown;
};

/** The TikTok part of a post: sent (drafts or direct), or why not. */
async function tiktokPart(post: PostRow): Promise<{ external?: TikTokExternal; error?: string }> {
  try {
    if (!tiktokCanTake(post.kind)) throw new Error("TikTok ne prend que des vidéos (pas de carrousels pour l'instant)");
    return { external: await sendToTikTok(post) };
  } catch (error) {
    console.error("tiktok send failed", post.id, error instanceof TikTokError ? error.body : error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const tiktokNote = (t: TikTokExternal) =>
  t.mode === "draft" ? "dans tes brouillons TikTok (ouvre TikTok, ajoute un son, colle la légende et publie)" : "envoyé sur TikTok";

/** Publishes one claimed post now, on each of its platforms. */
async function publishPost(postId: string): Promise<PublishOutcome> {
  const db = supabaseAdmin();
  const post = check(await db.from("posts").select(POST_COLUMNS).eq("id", postId).single()).data as unknown as PostRow;
  const studioId = post.studio_id;
  const kind = post.kind;
  const toInstagram = post.platforms.includes("instagram") || !post.platforms.length;
  const toTikTok = post.platforms.includes("tiktok");
  const externalIds: Record<string, unknown> = { ...(post.external_ids ?? {}) };
  const errors: string[] = [];
  const lines: string[] = [];
  let permalink: string | null = null;

  if ((await montageState(postId)) === "failed") errors.push("la dernière version du montage ou du texte sur les photos n'a pas pu être rendue");
  else {
    if (toInstagram) {
      try {
        const account = await instagramAccount(studioId);
        if (!account) throw new Error("Instagram n'est pas connecté");
        const { rendered, designed } = slidesToPublish(post as { slides: unknown; slides_render: unknown; media_ids: string[] | null });
        // Cleaned, 5 hashtags at most (Instagram's cap).
        const caption = captionForInstagram(post.caption, post.hashtags);
        const request = await publishRequest(studioId, kind, post.render_id, post.media_ids ?? [], caption, rendered, post.cover, post.share_to_feed !== false, designed);
        const result = await publishMedia({ userId: account.userId, accessToken: account.accessToken, request });
        externalIds.instagram = { media_id: result.mediaId, permalink: result.permalink, published_at: new Date().toISOString() };
        permalink = result.permalink;
        lines.push("en ligne sur Instagram ✅");
      } catch (error) {
        console.error("publish failed", postId, error instanceof InstagramError ? error.body : error);
        errors.push(`Instagram : ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (toTikTok) {
      const tiktok = await tiktokPart(post);
      if (tiktok.external) {
        externalIds.tiktok = tiktok.external;
        lines.push(tiktokNote(tiktok.external));
      } else errors.push(`TikTok : ${tiktok.error}`);
    }
  }

  const sent = lines.length > 0;
  const message = errors.join(" ; ");
  await db
    .from("posts")
    .update({ status: sent ? "published" : "failed", publish_error: message ? message.slice(0, 1000) : null, external_ids: externalIds })
    .eq("id", postId);
  if (sent) {
    await notify(studioId, `${kindNames[kind]} « ${post.title} » : ${lines.join(", et ")}.${message ? `\nPar contre, ${message}.` : ""}${permalink ? `\n${permalink}` : ""}`);
  }
  else await notify(studioId, `Je n’ai pas pu publier « ${post.title} » : ${message}. Dis-moi si je réessaie.`);
  return sent ? { postId, ok: true, permalink } : { postId, ok: false, error: message };
}

/** « Je publie moi-même » on Instagram: TikTok, if chosen, still gets the video at the post's time. */
async function handOffWithTikTok(postId: string): Promise<PublishOutcome> {
  const db = supabaseAdmin();
  const post = check(await db.from("posts").select(POST_COLUMNS).eq("id", postId).single()).data as unknown as PostRow;
  if (post.platforms.includes("tiktok")) {
    const tiktok = await tiktokPart(post);
    await db
      .from("posts")
      .update({ external_ids: { ...(post.external_ids ?? {}), ...(tiktok.external ? { tiktok: tiktok.external } : {}) }, ...(tiktok.error ? { publish_error: `TikTok : ${tiktok.error}` } : {}) })
      .eq("id", postId);
    if (tiktok.external?.mode === "draft") await notify(post.studio_id, `Pour TikTok, « ${post.title} » est ${tiktokNote(tiktok.external)}.`);
  }
  const outcome = await handOff(postId);
  return { postId, ok: outcome.ok };
}

/** Claims and publishes one post if it is due (used right after a validation "now"); « je publie moi-même » hands it over instead. */
export async function publishIfDue(postId: string): Promise<PublishOutcome | null> {
  // Nothing goes out without a subscription: it waits, scheduled, until she subscribes.
  const { data: owner } = await supabaseAdmin().from("posts").select("studio_id").eq("id", postId).single();
  if (owner && !(await studioAccess(owner.studio_id as string)).unlock) return null;
  if (!(await claim(postId))) return null;
  const { data } = await supabaseAdmin().from("posts").select("publish_by_hand, handoff_at, platforms").eq("id", postId).single();
  if (data?.publish_by_hand && data.platforms?.includes("instagram")) return data.handoff_at ? null : handOffWithTikTok(postId);
  return publishPost(postId);
}

/** Keeps long-lived tokens alive: refresh those expiring within a week. */
async function refreshExpiringTokens(): Promise<number> {
  const db = supabaseAdmin();
  const soon = new Date(Date.now() + REFRESH_BEFORE_MS).toISOString();
  // Instagram only: a TikTok token lasts a day and is renewed with its refresh token (tiktok-account.ts).
  const { data } = await db
    .from("social_credentials")
    .select("social_account_id, access_token, social_accounts!inner(platform)")
    .eq("social_accounts.platform", "instagram")
    .lt("expires_at", soon)
    .limit(20);
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
      console.error("Simone account token refresh failed", error instanceof InstagramError ? error.body : error);
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

/** Cron entry point: publish what she said to publish, remind what is due, measure, refresh tokens. */
export async function runPublishWorker() {
  const db = supabaseAdmin();
  const due = check(
    await db
      .from("posts")
      .select("id")
      .eq("status", "scheduled")
      // Handed over already: waiting for her to publish it (matchHandPublished).
      .is("handoff_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(5),
  ).data!;
  const published: PublishOutcome[] = [];
  for (const { id } of due) {
    const outcome = await publishIfDue(id as string);
    if (outcome) published.push(outcome);
  }
  // The moment Simone suggested has come: she reminds her (nothing goes out on its own any more).
  const { remindDue } = await import("@/lib/reminders");
  const reminded = await remindDue().catch((error) => {
    console.error("reminders failed", error);
    return 0;
  });
  const handPublished = await matchHandPublished().catch((error) => {
    console.error("hand-off match failed", error);
    return 0;
  });
  const tiktok =
    (await trackTikTok().catch((error) => {
      console.error("tiktok tracking failed", error);
      return 0;
    })) + (await matchTikTokDrafts().catch(() => 0));
  const measured = (await captureMetrics()) + (await captureTikTokMetrics().catch(() => 0));
  const refreshed = (await refreshExpiringTokens()) + (await refreshIdleTikTokTokens().catch(() => 0));
  // The account day by day (Résultats): a few studios per run.
  const { captureAccountStats } = await import("./account-stats");
  const account = await captureAccountStats().catch((error) => {
    console.error("account stats failed", error);
    return 0;
  });
  return { due: due.length, published, reminded, handPublished, tiktok, measured, refreshed, account };
}
