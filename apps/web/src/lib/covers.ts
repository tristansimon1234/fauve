import "server-only";
import { DEFAULT_COVER_SECONDS, postCoverSchema } from "@fauve/agent";
import { slidesToPublish } from "@/lib/render/slides";
import type { Cover } from "@/lib/cover-src";
import { signMediaUrls, type Db } from "@/lib/studio";

// What stands for a post in a thumbnail (calendar, grid): a Reel's chosen cover
// (a photo, or a frame of its montage), else its rendered montage at the default
// frame, else its first photo with its text when rendered, else its first photo or video.

export type CoverPost = { id: string; render_id: string | null; media_ids: string[] | null; slides: unknown; slides_render: unknown; cover?: unknown };
export type { Cover } from "@/lib/cover-src";

export const COVER_COLUMNS = "render_id, media_ids, slides, slides_render, cover";

export async function postCovers(db: Db, studioId: string, posts: CoverPost[]): Promise<Map<string, Cover>> {
  const chosen = new Map(posts.map((p) => [p.id, postCoverSchema.nullable().catch(null).parse(p.cover ?? null)]));
  const renderIds = posts.flatMap((p) => (p.render_id ? [p.render_id] : []));
  const assetIds = [
    ...new Set(
      posts.flatMap((p) => {
        const c = chosen.get(p.id);
        return [...(c && "media_id" in c ? [c.media_id] : []), ...(p.media_ids?.[0] ? [p.media_ids[0]] : [])];
      }),
    ),
  ];
  const [renders, assets] = await Promise.all([
    renderIds.length ? db.from("renders").select("id, storage_path").in("id", renderIds) : Promise.resolve({ data: [] }),
    assetIds.length
      ? db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", assetIds)
      : Promise.resolve({ data: [] }),
  ]);
  const renderPaths = new Map((renders.data ?? []).map((r) => [r.id as string, r.storage_path as string | null]));
  const byId = new Map((assets.data ?? []).map((a) => [a.id as string, a]));
  const isVideo = (a: { kind?: unknown; mime_type?: unknown }) => a.kind === "video" || String(a.mime_type ?? "").startsWith("video/");

  const paths = new Map<string, { path: string; video: boolean; at?: number }>();
  for (const p of posts) {
    const cover = chosen.get(p.id);
    const photo = cover && "media_id" in cover ? byId.get(cover.media_id) : undefined;
    if (photo && !isVideo(photo)) {
      paths.set(p.id, { path: photo.storage_path as string, video: false });
      continue;
    }
    const render = p.render_id ? renderPaths.get(p.render_id) : null;
    if (render) {
      paths.set(p.id, { path: render, video: true, at: cover && "at" in cover ? cover.at : DEFAULT_COVER_SECONDS });
      continue;
    }
    const first = p.media_ids?.[0];
    const slides = slidesToPublish(p);
    // A designed carousel's cover is its first slide.
    const rendered = slides.designed?.[0] ?? (first ? slides.rendered[first] : undefined);
    const asset = first ? byId.get(first) : undefined;
    if (rendered) paths.set(p.id, { path: rendered, video: false });
    else if (asset) paths.set(p.id, { path: asset.storage_path as string, video: isVideo(asset) });
  }
  const signed = await signMediaUrls(db, studioId, [...paths.values()].map((c) => c.path));
  const covers = new Map<string, Cover>();
  for (const [id, c] of paths) {
    const url = signed.get(c.path);
    if (url) covers.set(id, { url, video: c.video, ...(c.at !== undefined ? { at: c.at } : {}) });
  }
  return covers;
}
