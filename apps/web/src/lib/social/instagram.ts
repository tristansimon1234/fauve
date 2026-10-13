import "server-only";
import { env } from "@/lib/env";

// Instagram API with Instagram Login: each studio connects its own professional
// account (OAuth), Fauve keeps a long-lived token (60 days, refreshed) and
// publishes Reels through a media container then media_publish.

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
];

/** Fauve's own account also reads and answers the DMs managers send it. */
export const FAUVE_ACCOUNT_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"];

export class InstagramError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

const graphUrl = (path: string) => `https://graph.instagram.com/${env("INSTAGRAM_GRAPH_VERSION")}/${path}`;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { error?: { message?: string }; error_message?: string } | null)?.error?.message
      ?? (body as { error_message?: string } | null)?.error_message
      ?? `HTTP ${res.status}`;
    throw new InstagramError(`Instagram API: ${message}`, res.status, body);
  }
  return body as T;
}

export function redirectUri(): string {
  return `${env("APP_URL")}/api/instagram/callback`;
}

export function authorizeUrl(state: string, scopes: string[] = INSTAGRAM_SCOPES): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", env("INSTAGRAM_APP_ID"));
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("state", state);
  // Always show the account picker, so a manager can switch accounts.
  url.searchParams.set("force_reauth", "true");
  return url.toString();
}

/** Authorization code → long-lived token (about 60 days) and the account's identity. */
export async function connectWithCode(code: string) {
  const short = await call<{ access_token: string; user_id: string | number; permissions?: string[] } | { data: { access_token: string; user_id: string | number; permissions?: string[] }[] }>(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: env("INSTAGRAM_APP_ID"),
        client_secret: env("INSTAGRAM_APP_SECRET"),
        grant_type: "authorization_code",
        redirect_uri: redirectUri(),
        code: code.replace(/#_$/, ""),
      }),
    },
  );
  const first = "data" in short ? short.data[0]! : short;

  const long = await call<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: env("INSTAGRAM_APP_SECRET"),
      access_token: first.access_token,
    })}`,
  );
  const me = await call<{ user_id?: string; id: string; username: string; account_type?: string }>(
    graphUrl(`me?fields=user_id,username,account_type&access_token=${encodeURIComponent(long.access_token)}`),
  );
  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + long.expires_in * 1000),
    userId: String(me.user_id ?? first.user_id),
    username: me.username,
    accountType: me.account_type ?? null,
    scopes: first.permissions ?? INSTAGRAM_SCOPES,
  };
}

/** Extends a long-lived token by another 60 days (valid tokens older than 24 h only). */
export async function refreshToken(accessToken: string) {
  const res = await call<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken })}`,
  );
  return { accessToken: res.access_token, expiresAt: new Date(Date.now() + res.expires_in * 1000) };
}

type ContainerStatus = { status_code?: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED"; status?: string };

/** Creates a media container (any format) and returns its id. */
async function createContainer(userId: string, token: string, fields: Record<string, string>): Promise<string> {
  const container = await call<{ id: string }>(graphUrl(`${userId}/media`), {
    method: "POST",
    body: new URLSearchParams({ ...fields, access_token: token }),
  });
  return container.id;
}

/** Waits until Instagram has fetched and processed a container (videos take a while). */
async function waitUntilReady(containerId: string, token: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await call<ContainerStatus>(
      graphUrl(`${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`),
    );
    if (state.status_code === "FINISHED") return;
    if (state.status_code === "ERROR" || state.status_code === "EXPIRED") {
      throw new InstagramError(`Instagram n'a pas pu traiter le média (${state.status ?? state.status_code})`, 422, state);
    }
    if (Date.now() > deadline) throw new InstagramError("Instagram met trop de temps à traiter le média", 504, state);
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

async function publishContainer(userId: string, token: string, containerId: string): Promise<{ mediaId: string; permalink: string | null }> {
  const published = await call<{ id: string }>(graphUrl(`${userId}/media_publish`), {
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  const media = await call<{ permalink?: string }>(
    graphUrl(`${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`),
  ).catch(() => ({ permalink: undefined }));
  return { mediaId: published.id, permalink: media.permalink ?? null };
}

/** One photo or video of a post, as a public URL (images must be JPEG). */
export type PublishItem = { type: "image" | "video"; url: string };

/**
 * What can be published: a Reel, a photo post, a carousel (2 to 10 photos or
 * videos), a story (one photo or video; Instagram takes no caption on stories).
 */
export type PublishRequest =
  | { kind: "reel"; videoUrl: string; caption: string }
  | { kind: "image"; imageUrl: string; caption: string }
  | { kind: "carousel"; items: PublishItem[]; caption: string }
  | { kind: "story"; item: PublishItem };

/** Publishes on Instagram: containers, wait for processing, publish. Returns the media id and permalink. */
export async function publishMedia(params: {
  userId: string;
  accessToken: string;
  request: PublishRequest;
  timeoutMs?: number;
}): Promise<{ mediaId: string; permalink: string | null }> {
  const { userId, accessToken: token, request } = params;
  const timeout = params.timeoutMs ?? 180_000;
  const caption = (text: string) => text.slice(0, 2200);
  let containerId: string;
  switch (request.kind) {
    case "reel":
      containerId = await createContainer(userId, token, {
        media_type: "REELS",
        video_url: request.videoUrl,
        caption: caption(request.caption),
        share_to_feed: "true",
      });
      break;
    case "image":
      containerId = await createContainer(userId, token, { image_url: request.imageUrl, caption: caption(request.caption) });
      break;
    case "story":
      containerId = await createContainer(userId, token, {
        media_type: "STORIES",
        ...(request.item.type === "video" ? { video_url: request.item.url } : { image_url: request.item.url }),
      });
      break;
    case "carousel": {
      if (request.items.length < 2 || request.items.length > 10) throw new InstagramError("Un carrousel compte de 2 à 10 photos ou vidéos", 400, null);
      const children = [];
      for (const item of request.items) {
        const child = await createContainer(userId, token, {
          is_carousel_item: "true",
          ...(item.type === "video" ? { media_type: "VIDEO", video_url: item.url } : { image_url: item.url }),
        });
        if (item.type === "video") await waitUntilReady(child, token, timeout);
        children.push(child);
      }
      containerId = await createContainer(userId, token, { media_type: "CAROUSEL", children: children.join(","), caption: caption(request.caption) });
      break;
    }
  }
  await waitUntilReady(containerId, token, timeout);
  return publishContainer(userId, token, containerId);
}

/** A Reel from a public video URL (kept for callers that only publish Reels). */
export async function publishReel(params: { userId: string; accessToken: string; videoUrl: string; caption: string; timeoutMs?: number }) {
  return publishMedia({ ...params, request: { kind: "reel", videoUrl: params.videoUrl, caption: params.caption } });
}

// ---------------------------------------------------------------------------
// Reading the account: recent media, comments, insights; replying to comments.
// ---------------------------------------------------------------------------

export type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  /** Image (or video file) and, for videos, the cover image: only when asked for. */
  media_url?: string;
  thumbnail_url?: string;
};

export type InstagramProfile = {
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

export type InstagramComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
  replies?: { data?: { id: string; text?: string; username?: string; timestamp?: string }[] };
};

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

export async function recentMedia(
  userId: string,
  accessToken: string,
  limit = 12,
  { images = false }: { images?: boolean } = {},
): Promise<InstagramMedia[]> {
  const res = await call<{ data: InstagramMedia[] }>(
    graphUrl(
      `${userId}/media?${q({
        fields: `id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count${images ? ",media_url,thumbnail_url" : ""}`,
        limit: String(limit),
        access_token: accessToken,
      })}`,
    ),
  );
  return res.data;
}

/** The account's public profile, for the grid preview. */
export async function profile(userId: string, accessToken: string): Promise<InstagramProfile> {
  return call<InstagramProfile>(
    graphUrl(
      `${userId}?${q({
        fields: "username,name,biography,profile_picture_url,followers_count,follows_count,media_count",
        access_token: accessToken,
      })}`,
    ),
  );
}

export async function mediaComments(mediaId: string, accessToken: string, limit = 50): Promise<InstagramComment[]> {
  const res = await call<{ data: InstagramComment[] }>(
    graphUrl(
      `${mediaId}/comments?${q({
        fields: "id,text,username,timestamp,like_count,replies{id,text,username,timestamp}",
        limit: String(limit),
        access_token: accessToken,
      })}`,
    ),
  );
  return res.data;
}

export type MediaInsights = Partial<Record<"views" | "reach" | "likes" | "comments" | "shares" | "saved" | "total_interactions" | "profile_visits" | "follows", number>>;

// Metric names differ by media type and Meta retires some; ask for the full set
// first and fall back to the core metrics every media type supports.
const FULL_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions", "profile_visits", "follows"];
const CORE_METRICS = ["reach", "likes", "comments", "shares", "saved"];

export async function mediaInsights(mediaId: string, accessToken: string): Promise<MediaInsights> {
  for (const metrics of [FULL_METRICS, ["views", ...CORE_METRICS], CORE_METRICS]) {
    try {
      const res = await call<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
        graphUrl(`${mediaId}/insights?${q({ metric: metrics.join(","), access_token: accessToken })}`),
      );
      return Object.fromEntries(
        res.data.map((m) => [m.name, m.total_value?.value ?? m.values?.[0]?.value ?? 0]),
      ) as MediaInsights;
    } catch (error) {
      if (!(error instanceof InstagramError) || error.status !== 400) throw error;
    }
  }
  return {};
}

/** Public reply under a comment, posted as the studio's account. */
export async function replyToComment(commentId: string, accessToken: string, message: string): Promise<string> {
  const res = await call<{ id: string }>(graphUrl(`${commentId}/replies`), {
    method: "POST",
    body: new URLSearchParams({ message: message.slice(0, 2200), access_token: accessToken }),
  });
  return res.id;
}

// ---------------------------------------------------------------------------
// Direct messages (Fauve's own account)
// ---------------------------------------------------------------------------

/** Subscribes the connected account to its DM webhooks (the app must have the webhook set up in Meta). */
export async function subscribeToMessages(accessToken: string): Promise<void> {
  await call(graphUrl(`me/subscribed_apps?${q({ subscribed_fields: "messages", access_token: accessToken })}`), { method: "POST" });
}

/** Sends a text DM from Fauve's account (only inside the 24 h after the person wrote). */
export async function sendDirectMessage(accessToken: string, recipientId: string, text: string): Promise<string | undefined> {
  const res = await call<{ message_id?: string }>(graphUrl(`me/messages?${q({ access_token: accessToken })}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 1000) } }),
  });
  return res.message_id;
}
