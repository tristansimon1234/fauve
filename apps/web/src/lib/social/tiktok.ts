import "server-only";
import { env } from "@/lib/env";
import { socialConnect } from "./connect";

// TikTok API v2 (Login Kit + Content Posting API). Each studio connects its own
// account (OAuth); the access token lasts a day and is renewed with the refresh
// token (a year). Videos are uploaded from our storage (FILE_UPLOAD: no domain to
// verify), either to her TikTok drafts (inbox: she adds a sound and posts it in
// the app) or, once TikTok has audited the app, straight to her account.

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";

/** Profile, follower count and her videos (to measure them), then uploading. */
const BASE_SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list", "video.upload"];

export class TikTokError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

/** Whether the app has its TikTok keys (otherwise TikTok is not offered). */
export const tiktokEnabled = () => socialConnect() && Boolean(env("TIKTOK_CLIENT_KEY") && env("TIKTOK_CLIENT_SECRET"));

/** Posts go straight to her account (audited app) rather than to her drafts. */
export const tiktokDirectPost = () => env("TIKTOK_DIRECT_POST");

export const tiktokScopes = () => (tiktokDirectPost() ? [...BASE_SCOPES, "video.publish"] : BASE_SCOPES);

export function tiktokRedirectUri(): string {
  return `${env("APP_URL")}/api/tiktok/callback`;
}

export function tiktokAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", env("TIKTOK_CLIENT_KEY")!);
  url.searchParams.set("scope", tiktokScopes().join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", tiktokRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
};

export type TikTokTokens = {
  accessToken: string;
  expiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
  openId: string;
  scopes: string[];
};

async function token(params: Record<string, string>): Promise<TikTokTokens> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({ client_key: env("TIKTOK_CLIENT_KEY")!, client_secret: env("TIKTOK_CLIENT_SECRET")!, ...params }),
  });
  const body = (await res.json().catch(() => null)) as (Partial<TokenResponse> & { error?: string; error_description?: string }) | null;
  if (!res.ok || !body?.access_token) {
    throw new TikTokError(`TikTok OAuth: ${body?.error_description ?? body?.error ?? `HTTP ${res.status}`}`, res.status, body);
  }
  return {
    accessToken: body.access_token,
    expiresAt: new Date(Date.now() + (body.expires_in ?? 86_400) * 1000),
    refreshToken: body.refresh_token!,
    refreshExpiresAt: new Date(Date.now() + (body.refresh_expires_in ?? 31_536_000) * 1000),
    openId: body.open_id!,
    scopes: (body.scope ?? "").split(",").filter(Boolean),
  };
}

/** Authorization code → tokens. */
export const exchangeTikTokCode = (code: string) =>
  token({ code: decodeURIComponent(code), grant_type: "authorization_code", redirect_uri: tiktokRedirectUri() });

/** A new access token (and often a new refresh token). */
export const refreshTikTokToken = (refreshToken: string) => token({ grant_type: "refresh_token", refresh_token: refreshToken });

/** Calls the API; TikTok answers `{ data, error: { code: "ok" | … } }`. */
async function call<T>(path: string, accessToken: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!res.ok || (body?.error?.code && body.error.code !== "ok")) {
    throw new TikTokError(`TikTok API: ${body?.error?.message || body?.error?.code || `HTTP ${res.status}`}`, res.status, body);
  }
  return (body?.data ?? {}) as T;
}

export type TikTokUser = {
  open_id: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
  bio_description?: string;
};

/** Her profile and, with user.info.stats, her counters. */
export async function tiktokUser(accessToken: string): Promise<TikTokUser> {
  const fields = "open_id,display_name,username,avatar_url,bio_description,follower_count,following_count,likes_count,video_count";
  const data = await call<{ user: TikTokUser }>(`/user/info/?fields=${fields}`, accessToken, { method: "GET" });
  return data.user;
}

export type CreatorInfo = {
  creator_username?: string;
  creator_nickname?: string;
  creator_avatar_url?: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec?: number;
};

/** What she may choose for a direct post (TikTok asks to read it before each one). */
export const creatorInfo = (accessToken: string) => call<CreatorInfo>("/post/publish/creator_info/query/", accessToken, { body: {} });

export type DirectPostInfo = {
  title: string;
  privacy_level: string;
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  video_cover_timestamp_ms?: number;
};

const CHUNK = 10 * 1024 * 1024;
const SINGLE_MAX = 64 * 1024 * 1024;

/** TikTok's chunks: one piece up to 64 MB, else 10 MB pieces, the last one taking the rest (floor). */
export function chunksFor(size: number): { chunkSize: number; count: number } {
  if (size <= SINGLE_MAX) return { chunkSize: size, count: 1 };
  return { chunkSize: CHUNK, count: Math.floor(size / CHUNK) };
}

/**
 * Uploads a video: to her drafts (`post` null) or as a direct post. Returns the
 * publish id whose status TikTok then reports (publishStatus).
 */
export async function uploadTikTokVideo(accessToken: string, video: Buffer, post: DirectPostInfo | null): Promise<string> {
  const { chunkSize, count } = chunksFor(video.length);
  const source_info = { source: "FILE_UPLOAD", video_size: video.length, chunk_size: chunkSize, total_chunk_count: count };
  const init = post
    ? await call<{ publish_id: string; upload_url: string }>("/post/publish/video/init/", accessToken, { body: { post_info: post, source_info } })
    : await call<{ publish_id: string; upload_url: string }>("/post/publish/inbox/video/init/", accessToken, { body: { source_info } });
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = i === count - 1 ? video.length : start + chunkSize;
    const res = await fetch(init.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(end - start),
        "Content-Range": `bytes ${start}-${end - 1}/${video.length}`,
      },
      body: new Uint8Array(video.subarray(start, end)),
    });
    if (res.status !== 201 && res.status !== 206 && !res.ok) {
      throw new TikTokError(`TikTok n'a pas accepté la vidéo (HTTP ${res.status})`, res.status, await res.text().catch(() => null));
    }
  }
  return init.publish_id;
}

export type PublishStatus = {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED" | string;
  fail_reason?: string;
  /** Spelled this way by TikTok. Only when the post is public. */
  publicaly_available_post_id?: (number | string)[];
};

export const publishStatus = (accessToken: string, publishId: string) =>
  call<PublishStatus>("/post/publish/status/fetch/", accessToken, { body: { publish_id: publishId } });

export type TikTokVideo = {
  id: string;
  title?: string;
  video_description?: string;
  create_time?: number;
  /** A signed link TikTok renews: shown, never kept. */
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

const VIDEO_FIELDS = "id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count";

/** Her latest videos, newest first. */
export async function recentTikToks(accessToken: string, max = 20): Promise<TikTokVideo[]> {
  const data = await call<{ videos?: TikTokVideo[] }>(`/video/list/?fields=${VIDEO_FIELDS}`, accessToken, { body: { max_count: Math.min(max, 20) } });
  return data.videos ?? [];
}

/** Counters of given videos (20 at most per call). */
export async function tiktokVideos(accessToken: string, ids: string[]): Promise<TikTokVideo[]> {
  if (!ids.length) return [];
  const data = await call<{ videos?: TikTokVideo[] }>(`/video/query/?fields=${VIDEO_FIELDS}`, accessToken, { body: { filters: { video_ids: ids.slice(0, 20) } } });
  return data.videos ?? [];
}
