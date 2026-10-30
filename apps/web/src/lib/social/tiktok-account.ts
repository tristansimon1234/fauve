import "server-only";
import {
  captionForTikTok,
  captionMatch,
  isInSessionWindow,
  postCoverSchema,
  readTikTokExternal,
  readTikTokSettings,
  TIKTOK_PENDING,
  type PostKind,
  type TikTokExternal,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { socialConnect } from "./connect";
import {
  creatorInfo,
  publishStatus,
  recentTikToks,
  refreshTikTokToken,
  TikTokError,
  tiktokDirectPost,
  tiktokVideos,
  uploadTikTokVideo,
  type TikTokTokens,
} from "./tiktok";

// A studio's TikTok account: linking it, keeping its token alive (a day, renewed
// with the refresh token), sending a post's video, following its status, and
// measuring what is online.

const RENEW_BEFORE_MS = 10 * 60_000;
const FOLLOW_FOR_MS = 7 * 24 * 3600_000;

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

/** Links a TikTok account to a studio. null when linked; else the error code shown on /connect. */
export async function linkTikTokAccount(
  state: { studioId: string; memberId: string },
  tokens: TikTokTokens,
  user: { username?: string; display_name?: string },
): Promise<string | null> {
  const db = supabaseAdmin();
  const memberRow = await db.from("members").select("studio_id, phone_e164").eq("id", state.memberId).eq("studio_id", state.studioId).maybeSingle();
  if (!memberRow.data) return "lien-expire";
  const phone = memberRow.data.phone_e164 as string | null;
  const handle = user.username ?? user.display_name ?? null;
  const social = await db
    .from("social_accounts")
    .upsert(
      {
        studio_id: state.studioId,
        platform: "tiktok",
        handle,
        provider: "tiktok",
        provider_ref: tokens.openId,
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "studio_id,platform" },
    )
    .select("id")
    .single();
  if (social.error) {
    console.error("tiktok social_accounts upsert failed", social.error.message);
    return "tiktok";
  }
  const creds = await db.from("social_credentials").upsert({
    social_account_id: social.data.id,
    access_token: tokens.accessToken,
    expires_at: tokens.expiresAt.toISOString(),
    refresh_token: tokens.refreshToken,
    refresh_expires_at: tokens.refreshExpiresAt.toISOString(),
    scopes: tokens.scopes,
    updated_at: new Date().toISOString(),
  });
  if (creds.error) {
    console.error("tiktok social_credentials upsert failed", creds.error.message);
    return "tiktok";
  }
  if (phone) {
    const text = tiktokDirectPost()
      ? `C’est bon, ton TikTok${handle ? ` @${handle}` : ""} est connecté ✅ Tes Reels validés partiront aussi sur TikTok.`
      : `C’est bon, ton TikTok${handle ? ` @${handle}` : ""} est connecté ✅ À l’heure prévue, j’enverrai tes Reels dans tes brouillons TikTok : tu n’auras qu’à ajouter un son et publier.`;
    const id = await sendText(phone.slice(1), text).catch(() => undefined);
    if (id) {
      await db.from("whatsapp_messages").insert({ studio_id: state.studioId, wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body: text });
    }
  }
  return null;
}

/** The studio's TikTok account with a valid access token, or null when not connected. */
export async function tiktokAccount(studioId: string): Promise<{ id: string; handle: string | null; openId: string; accessToken: string } | null> {
  // Put aside (connect.ts): nothing is sent to TikTok nor read from its API.
  if (!socialConnect()) return null;
  const db = supabaseAdmin();
  const account = await db.from("social_accounts").select("id, handle, provider_ref, status").eq("studio_id", studioId).eq("platform", "tiktok").maybeSingle();
  if (!account.data || account.data.status !== "connected" || !account.data.provider_ref) return null;
  const creds = await db.from("social_credentials").select("access_token, expires_at, refresh_token").eq("social_account_id", account.data.id).maybeSingle();
  if (!creds.data) return null;
  let accessToken = creds.data.access_token as string;
  const expiresAt = creds.data.expires_at ? new Date(creds.data.expires_at as string).getTime() : 0;
  if (expiresAt - Date.now() < RENEW_BEFORE_MS) {
    accessToken = await renew(account.data.id as string, creds.data.refresh_token as string | null);
  }
  return { id: account.data.id as string, handle: account.data.handle as string | null, openId: account.data.provider_ref as string, accessToken };
}

/** Renews an account's token; a refused refresh token marks the account expired (she reconnects). */
async function renew(accountId: string, refreshToken: string | null): Promise<string> {
  const db = supabaseAdmin();
  if (!refreshToken) {
    await db.from("social_accounts").update({ status: "expired" }).eq("id", accountId);
    throw new Error("La connexion TikTok a expiré : reconnecte ton compte dans Réglages");
  }
  try {
    const next = await refreshTikTokToken(refreshToken);
    await db
      .from("social_credentials")
      .update({
        access_token: next.accessToken,
        expires_at: next.expiresAt.toISOString(),
        refresh_token: next.refreshToken,
        refresh_expires_at: next.refreshExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("social_account_id", accountId);
    return next.accessToken;
  } catch (error) {
    console.error("tiktok token refresh failed", accountId, error instanceof TikTokError ? error.body : error);
    await db.from("social_accounts").update({ status: "expired" }).eq("id", accountId);
    throw new Error("La connexion TikTok a expiré : reconnecte ton compte dans Réglages");
  }
}

/** Renews the TikTok tokens not used for 5 days, so the refresh token never lapses. */
export async function refreshIdleTikTokTokens(): Promise<number> {
  const db = supabaseAdmin();
  const idle = new Date(Date.now() - 5 * 24 * 3600_000).toISOString();
  const { data } = await db
    .from("social_credentials")
    .select("social_account_id, refresh_token, social_accounts!inner(platform, status)")
    .eq("social_accounts.platform", "tiktok")
    .eq("social_accounts.status", "connected")
    .lt("updated_at", idle)
    .limit(20);
  let renewed = 0;
  for (const row of data ?? []) {
    await renew(row.social_account_id as string, row.refresh_token as string | null).then(
      () => renewed++,
      () => undefined,
    );
  }
  return renewed;
}

/** Whether a post can go to TikTok: a video (a Reel's montage, or a post made of a video). */
export function tiktokCanTake(kind: PostKind): boolean {
  return kind === "reel" || kind === "post" || kind === "story";
}

/** The video of a post, as bytes from our storage. */
async function postVideo(post: { studio_id: string; kind: PostKind; render_id: string | null; media_ids: string[] | null }): Promise<Buffer> {
  const db = supabaseAdmin();
  let path: string | null = null;
  if (post.render_id) {
    const render = check(await db.from("renders").select("storage_path, status").eq("id", post.render_id).single()).data!;
    if (render.status === "done") path = render.storage_path as string | null;
  } else if (post.kind !== "reel" && post.media_ids?.length) {
    const first = await db.from("media_assets").select("storage_path, kind, mime_type").eq("studio_id", post.studio_id).eq("id", post.media_ids[0]!).maybeSingle();
    const isVideo = first.data && (first.data.kind === "video" || String(first.data.mime_type ?? "").startsWith("video/"));
    if (isVideo) path = first.data!.storage_path as string;
  }
  if (!path) throw new Error(post.kind === "reel" ? "la vidéo montée n'est pas prête" : "TikTok ne prend que des vidéos (pas de photos ni de carrousels pour l'instant)");
  const file = await db.storage.from("media").download(path);
  if (file.error) throw new Error(`vidéo introuvable (${file.error.message})`);
  return Buffer.from(await file.data.arrayBuffer());
}

/**
 * Sends a post's video to TikTok: straight to her account when the app is
 * audited and she chose who sees it, else to her TikTok drafts.
 */
export async function sendToTikTok(post: {
  id: string;
  studio_id: string;
  kind: PostKind;
  caption: string | null;
  hashtags: string[] | null;
  render_id: string | null;
  media_ids: string[] | null;
  cover: unknown;
  tiktok: unknown;
}): Promise<TikTokExternal> {
  const account = await tiktokAccount(post.studio_id);
  if (!account) throw new Error("TikTok n'est pas connecté");
  const video = await postVideo(post);
  const settings = readTikTokSettings(post.tiktok);
  let direct = null;
  if (tiktokDirectPost() && settings.privacy_level) {
    // TikTok asks to read the creator's options right before each post.
    const info = await creatorInfo(account.accessToken);
    if (!info.privacy_level_options.includes(settings.privacy_level)) throw new Error("ce choix de visibilité n'est plus proposé par TikTok : choisis-en un autre");
    const cover = postCoverSchema.nullable().catch(null).parse(post.cover);
    direct = {
      title: captionForTikTok(post.caption, post.hashtags),
      privacy_level: settings.privacy_level,
      disable_comment: info.comment_disabled || !settings.allow_comment,
      disable_duet: info.duet_disabled || !settings.allow_duet,
      disable_stitch: info.stitch_disabled || !settings.allow_stitch,
      ...(cover && "at" in cover ? { video_cover_timestamp_ms: Math.round(cover.at * 1000) } : {}),
    };
  }
  const publishId = await uploadTikTokVideo(account.accessToken, video, direct);
  return { publish_id: publishId, mode: direct ? "direct" : "draft", status: "PROCESSING_UPLOAD", sent_at: new Date().toISOString() };
}

async function tellOwner(studioId: string, text: string) {
  const db = supabaseAdmin();
  const owner = await db.from("members").select("phone_e164").eq("studio_id", studioId).eq("role", "owner").limit(1).maybeSingle();
  const phone = owner.data?.phone_e164 as string | undefined;
  if (!phone) return;
  const last = await db.from("whatsapp_messages").select("created_at").eq("phone_e164", phone).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!isInSessionWindow(last.data ? new Date(last.data.created_at as string) : null)) return;
  const id = await sendText(phone.slice(1), text).catch(() => undefined);
  if (id) await db.from("whatsapp_messages").insert({ studio_id: studioId, wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body: text });
}

/**
 * Follows the videos sent to TikTok: processing, in her drafts, online (with
 * its id, to measure it) or refused. A TikTok-only post becomes published once
 * it is online, failed when refused.
 */
export async function trackTikTok(): Promise<number> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - FOLLOW_FOR_MS).toISOString();
  const { data: posts } = await db
    .from("posts")
    .select("id, studio_id, title, status, platforms, external_ids")
    .in("external_ids->tiktok->>status", TIKTOK_PENDING)
    .gte("external_ids->tiktok->>sent_at", since)
    .limit(20);
  let changed = 0;
  for (const post of posts ?? []) {
    const current = readTikTokExternal(post.external_ids);
    if (!current) continue;
    try {
      const account = await tiktokAccount(post.studio_id as string);
      if (!account) continue;
      const state = await publishStatus(account.accessToken, current.publish_id);
      if (state.status === current.status && !state.publicaly_available_post_id?.length) continue;
      const postId = state.publicaly_available_post_id?.[0];
      const next: TikTokExternal = {
        ...current,
        status: state.status,
        ...(postId ? { post_id: String(postId), published_at: current.published_at ?? new Date().toISOString() } : {}),
        ...(state.status === "FAILED" ? { error: state.fail_reason ?? null } : {}),
      };
      const onlyTikTok = !(post.platforms as string[]).includes("instagram");
      const update: Record<string, unknown> = { external_ids: { ...(post.external_ids as object), tiktok: next } };
      if (state.status === "FAILED") {
        if (onlyTikTok) Object.assign(update, { status: "failed", publish_error: `TikTok : ${state.fail_reason ?? "vidéo refusée"}` });
        await tellOwner(post.studio_id as string, `TikTok a refusé la vidéo de « ${post.title} »${state.fail_reason ? ` (${state.fail_reason})` : ""}. Dis-moi si je réessaie.`);
      } else if (state.status === "PUBLISH_COMPLETE" && onlyTikTok && post.status === "scheduled") {
        update.status = "published";
      }
      check(await db.from("posts").update(update).eq("id", post.id));
      changed++;
    } catch (error) {
      console.error("tiktok status failed", post.id, error instanceof TikTokError ? error.body : error);
    }
  }
  return changed;
}

/**
 * Videos she posted from her TikTok drafts: TikTok does not always say so, so
 * her latest videos are read and the one with the closest caption, posted after
 * the draft was sent, is linked to the post (then measured).
 */
export async function matchTikTokDrafts(): Promise<number> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - FOLLOW_FOR_MS).toISOString();
  const { data: waiting } = await db
    .from("posts")
    .select("id, studio_id, title, caption, external_ids")
    .eq("external_ids->tiktok->>mode", "draft")
    .is("external_ids->tiktok->>post_id", null)
    .neq("external_ids->tiktok->>status", "FAILED")
    .gte("external_ids->tiktok->>sent_at", since)
    .limit(30);
  if (!waiting?.length) return 0;
  let matched = 0;
  for (const [studioId, posts] of Map.groupBy(waiting, (p) => p.studio_id as string)) {
    try {
      const account = await tiktokAccount(studioId);
      if (!account) continue;
      const videos = await recentTikToks(account.accessToken, 20);
      const { data: linked } = await db.from("posts").select("external_ids").eq("studio_id", studioId).not("external_ids->tiktok->>post_id", "is", null);
      const taken = new Set((linked ?? []).map((p) => readTikTokExternal(p.external_ids)?.post_id));
      for (const post of posts) {
        const current = readTikTokExternal(post.external_ids)!;
        const after = new Date(current.sent_at).getTime() / 1000 - 3600;
        const best = videos
          .filter((v) => !taken.has(String(v.id)) && (v.create_time ?? 0) >= after)
          .map((v) => ({ v, score: captionMatch(post.caption as string | null, v.video_description ?? v.title ?? null) }))
          .sort((x, y) => y.score - x.score || (x.v.create_time ?? 0) - (y.v.create_time ?? 0))[0];
        // Several drafts waiting: only a caption that matches decides.
        if (!best || (posts.length > 1 && best.score < 0.5)) continue;
        taken.add(String(best.v.id));
        const next: TikTokExternal = {
          ...current,
          status: "PUBLISH_COMPLETE",
          post_id: String(best.v.id),
          share_url: best.v.share_url ?? null,
          published_at: best.v.create_time ? new Date(best.v.create_time * 1000).toISOString() : new Date().toISOString(),
        };
        check(await db.from("posts").update({ external_ids: { ...(post.external_ids as object), tiktok: next } }).eq("id", post.id));
        matched++;
      }
    } catch (error) {
      console.error("tiktok draft match failed", studioId, error instanceof TikTokError ? error.body : error);
    }
  }
  return matched;
}

const MEASURE_EVERY_MS = 6 * 3600_000;
const MEASURE_FOR_MS = 30 * 24 * 3600_000;

/** Views, likes, comments and shares of the posts online on TikTok: every 6 h for 30 days. */
export async function captureTikTokMetrics(): Promise<number> {
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("posts")
    .select("id, studio_id, external_ids")
    .not("external_ids->tiktok->>post_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(60);
  const due: { id: string; studioId: string; videoId: string }[] = [];
  for (const post of posts ?? []) {
    const t = readTikTokExternal(post.external_ids);
    if (!t?.post_id || Date.now() - new Date(t.published_at ?? t.sent_at).getTime() > MEASURE_FOR_MS) continue;
    const last = await db
      .from("metrics")
      .select("captured_at")
      .eq("post_id", post.id)
      .eq("platform", "tiktok")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.data && Date.now() - new Date(last.data.captured_at as string).getTime() < MEASURE_EVERY_MS) continue;
    due.push({ id: post.id as string, studioId: post.studio_id as string, videoId: t.post_id });
  }
  let captured = 0;
  for (const [studioId, group] of Map.groupBy(due, (d) => d.studioId)) {
    try {
      const account = await tiktokAccount(studioId);
      if (!account) continue;
      const videos = new Map((await tiktokVideos(account.accessToken, group.map((g) => g.videoId))).map((v) => [String(v.id), v]));
      for (const item of group) {
        const v = videos.get(item.videoId);
        if (!v) continue;
        await db.from("metrics").insert({
          studio_id: studioId,
          post_id: item.id,
          platform: "tiktok",
          views: v.view_count ?? null,
          likes: v.like_count ?? null,
          comments: v.comment_count ?? null,
          shares: v.share_count ?? null,
        });
        captured++;
      }
    } catch (error) {
      console.error("tiktok metrics failed", studioId, error instanceof TikTokError ? error.body : error);
    }
  }
  return captured;
}

/** Where a new post goes by default: Instagram, and TikTok too for a Reel once TikTok is connected. */
export async function defaultPlatforms(studioId: string, kind: PostKind): Promise<("instagram" | "tiktok")[]> {
  if (kind !== "reel" || !socialConnect()) return ["instagram"];
  const { data } = await supabaseAdmin().from("social_accounts").select("status").eq("studio_id", studioId).eq("platform", "tiktok").maybeSingle();
  return data?.status === "connected" ? ["instagram", "tiktok"] : ["instagram"];
}
