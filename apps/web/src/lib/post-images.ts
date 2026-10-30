import "server-only";
import { captionForInstagram } from "@fauve/agent";
import { slidesToPublish } from "@/lib/render/slides";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A carousel or photo post as she publishes it herself (Tristan, « ok », on « Partager » for a
// carousel): its images as they would go out by the API, in order (a composed carousel's
// slides, photos with their texts, otherwise its photos), each with a file name, for her
// phone's share sheet or to download, and her caption to copy.

/** As many as Instagram takes in one post from its app. */
const MAX_ITEMS = 20;
const URL_TTL_SECONDS = 3600;

export type PostImage = { url: string; name: string; video: boolean };
export type PostImages =
  | { state: "ready"; items: PostImage[]; caption: string }
  | { state: "rendering" | "failed" | "none"; items: []; caption: string };

const baseName = (title: string) => title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 50) || "publication";

export async function postImages(studioId: string, postId: string): Promise<PostImages | null> {
  const db = supabaseAdmin();
  const { data: post } = await db
    .from("posts")
    .select("kind, title, caption, hashtags, slides, slides_render, media_ids")
    .eq("id", postId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!post || (post.kind !== "carousel" && post.kind !== "post")) return null;
  const caption = captionForInstagram(post.caption as string | null, (post.hashtags as string[] | null) ?? []);
  const mediaIds = (post.media_ids as string[] | null) ?? [];
  const { state, rendered, designed } = slidesToPublish(post as { slides: unknown; slides_render: unknown; media_ids: string[] | null });
  if (state !== "ready") return { state, items: [], caption };

  // What goes out, in order: the composed slides, or each photo (with its texts when it has some).
  let files: { path: string; video: boolean }[];
  if (designed?.length) {
    files = designed.filter((p) => p.startsWith(`${studioId}/`)).map((path) => ({ path, video: false }));
  } else {
    const { data: assets } = mediaIds.length
      ? await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", mediaIds)
      : { data: [] };
    const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
    files = [];
    for (const id of mediaIds) {
      const slide = rendered[id];
      if (slide?.startsWith(`${studioId}/`)) {
        files.push({ path: slide, video: false });
        continue;
      }
      const asset = byId.get(id);
      if (!asset) continue;
      const mime = asset.mime_type as string | null;
      const video = asset.kind === "video" || Boolean(mime?.startsWith("video/"));
      // A HEIC or PNG becomes the JPEG Instagram takes (made once, kept next to it).
      files.push({ path: video ? (asset.storage_path as string) : await jpegPath(studioId, asset.storage_path as string, mime), video });
    }
  }
  files = files.slice(0, post.kind === "post" ? 1 : MAX_ITEMS);
  if (!files.length) return { state: "none", items: [], caption };

  const base = baseName(post.title as string);
  const items = await Promise.all(
    files.map(async ({ path, video }, i) => {
      const ext = video ? (path.match(/\.(mp4|mov)$/i)?.[1]?.toLowerCase() ?? "mp4") : "jpg";
      const name = files.length > 1 ? `${base} ${i + 1}.${ext}` : `${base}.${ext}`;
      const { data } = await db.storage.from("media").createSignedUrl(path, URL_TTL_SECONDS, { download: name });
      return data ? { url: data.signedUrl, name, video } : null;
    }),
  );
  const kept = items.filter((i): i is PostImage => i !== null);
  return kept.length ? { state: "ready", items: kept, caption } : { state: "none", items: [], caption };
}
