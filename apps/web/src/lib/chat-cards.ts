import "server-only";
import { replyExtrasSchema, type PostKind, type PostStatus } from "@fauve/agent";
import { signMediaUrls } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Buttons and cards under Fauve's messages in the app (reply_with): read from
// the message payload, filled with the posts' current state and fresh media links.

export type CardPost = {
  id: string;
  title: string;
  kind: PostKind;
  status: PostStatus;
  at: string | null;
  caption: string | null;
  media: { url: string; video: boolean } | null;
};

export type ChatCard = { type: "post"; post: CardPost } | { type: "grid"; posts: CardPost[] };

/** Parsed extras of one message; anything malformed is dropped. */
export function extrasOf(payload: unknown) {
  const parsed = replyExtrasSchema.safeParse(payload ?? {});
  return parsed.success ? parsed.data : {};
}

const GRID_POSTS = 6;
const UPCOMING = ["draft", "validated", "scheduled"];

/** Cards for every message of a page, in one pass (posts, renders, photos). */
export async function resolveCards(studioId: string, payloads: unknown[]): Promise<ChatCard[][]> {
  const extras = payloads.map(extrasOf);
  const wanted = new Set(extras.flatMap((e) => e.posts ?? []));
  const withGrid = extras.some((e) => e.grid);
  if (!wanted.size && !withGrid) return extras.map(() => []);

  const db = supabaseAdmin();
  const columns = "id, title, kind, status, scheduled_at, caption, render_id, media_ids";
  const [byId, upcoming] = await Promise.all([
    wanted.size ? db.from("posts").select(columns).eq("studio_id", studioId).in("id", [...wanted]) : Promise.resolve({ data: [] }),
    withGrid
      ? db
          .from("posts")
          .select(columns)
          .eq("studio_id", studioId)
          .in("status", UPCOMING)
          .neq("kind", "story")
          .order("scheduled_at", { ascending: false, nullsFirst: true })
          .limit(GRID_POSTS)
      : Promise.resolve({ data: [] }),
  ]);
  const rows = [...(byId.data ?? []), ...(upcoming.data ?? [])];

  // A montage shows its render; a photo post its first photo.
  const renderIds = [...new Set(rows.flatMap((p) => (p.render_id ? [p.render_id as string] : [])))];
  const firstMedia = [...new Set(rows.flatMap((p) => (!p.render_id && (p.media_ids as string[] | null)?.[0] ? [(p.media_ids as string[])[0]!] : [])))];
  const [renders, assets] = await Promise.all([
    renderIds.length ? db.from("renders").select("id, storage_path").eq("studio_id", studioId).in("id", renderIds) : Promise.resolve({ data: [] }),
    firstMedia.length
      ? db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", firstMedia)
      : Promise.resolve({ data: [] }),
  ]);
  const renderPath = new Map((renders.data ?? []).map((r) => [r.id as string, r.storage_path as string | null]));
  const asset = new Map((assets.data ?? []).map((a) => [a.id as string, a]));
  const urls = await signMediaUrls(db, studioId, [
    ...[...renderPath.values()].filter((p): p is string => Boolean(p)),
    ...(assets.data ?? []).map((a) => a.storage_path as string),
  ]);

  const toCard = (p: (typeof rows)[number]): CardPost => {
    let media: CardPost["media"] = null;
    const path = p.render_id ? renderPath.get(p.render_id as string) : null;
    if (path && urls.get(path)) media = { url: urls.get(path)!, video: true };
    const first = (p.media_ids as string[] | null)?.[0];
    const a = !media && first ? asset.get(first) : undefined;
    if (a && urls.get(a.storage_path as string)) {
      media = { url: urls.get(a.storage_path as string)!, video: a.kind === "video" || String(a.mime_type ?? "").startsWith("video/") };
    }
    return {
      id: p.id as string,
      title: (p.title as string | null) ?? "Publication",
      kind: p.kind as PostKind,
      status: p.status as PostStatus,
      at: (p.scheduled_at as string | null) ?? null,
      caption: (p.caption as string | null) ?? null,
      media,
    };
  };
  const posts = new Map((byId.data ?? []).map((p) => [p.id as string, toCard(p)]));
  const grid = (upcoming.data ?? []).map(toCard);

  return extras.map((e) => [
    ...(e.posts ?? []).flatMap((id): ChatCard[] => {
      const post = posts.get(id);
      return post ? [{ type: "post", post }] : [];
    }),
    ...(e.grid ? [{ type: "grid" as const, posts: grid }] : []),
  ]);
}
