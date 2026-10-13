import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PublishItem } from "./instagram";

// Public URLs Instagram can fetch for a post's photos and videos. Instagram only
// takes JPEG images for photo posts, carousels and stories: other formats (PNG,
// HEIC, WebP…) are converted once and kept next to the original.

const URL_TTL_SECONDS = 2 * 3600;
const MAX_EDGE = 1440;

async function sign(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUrl(path, URL_TTL_SECONDS);
  if (error || !data) throw new Error(`Média introuvable (${path})`);
  return data.signedUrl;
}

/** A JPEG copy of an image in storage (the original path if it already is one). */
async function jpegPath(studioId: string, path: string, mimeType: string | null): Promise<string> {
  if (mimeType === "image/jpeg" || /\.jpe?g$/i.test(path)) return path;
  const db = supabaseAdmin();
  const download = await db.storage.from("media").download(path);
  if (download.error) throw new Error(`Image illisible (${path})`);
  const jpeg = await sharp(Buffer.from(await download.data.arrayBuffer()))
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  const target = `${studioId}/publish/${randomUUID()}.jpg`;
  const upload = await db.storage.from("media").upload(target, jpeg, { contentType: "image/jpeg" });
  if (upload.error) throw new Error(`Conversion en JPEG impossible : ${upload.error.message}`);
  return target;
}

/** The post's media, in order, as items Instagram can fetch. */
export async function publishItems(studioId: string, mediaIds: string[]): Promise<PublishItem[]> {
  if (!mediaIds.length) return [];
  const { data, error } = await supabaseAdmin()
    .from("media_assets")
    .select("id, storage_path, kind, mime_type")
    .eq("studio_id", studioId)
    .in("id", mediaIds);
  if (error) throw new Error(error.message);
  const byId = new Map(data.map((m) => [m.id as string, m]));
  const items: PublishItem[] = [];
  for (const id of mediaIds) {
    const asset = byId.get(id);
    if (!asset) throw new Error(`Média ${id} introuvable`);
    const mime = asset.mime_type as string | null;
    const isVideo = asset.kind === "video" || Boolean(mime?.startsWith("video/"));
    const path = isVideo ? (asset.storage_path as string) : await jpegPath(studioId, asset.storage_path as string, mime);
    items.push({ type: isVideo ? "video" : "image", url: await sign(path) });
  }
  return items;
}
