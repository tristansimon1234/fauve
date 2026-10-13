import "server-only";
import { slidesToPublish } from "@/lib/render/slides";
import { signMediaUrls, type Db } from "@/lib/studio";

// What stands for a post in a thumbnail (calendar, grid): its rendered montage,
// else its first photo with its text when rendered, else its first photo or video.

export type CoverPost = { id: string; render_id: string | null; media_ids: string[] | null; slides: unknown; slides_render: unknown };
export type Cover = { url: string; video: boolean };

export const COVER_COLUMNS = "render_id, media_ids, slides, slides_render";

export async function postCovers(db: Db, studioId: string, posts: CoverPost[]): Promise<Map<string, Cover>> {
  const renderIds = posts.flatMap((p) => (p.render_id ? [p.render_id] : []));
  const firstIds = posts.flatMap((p) => (p.media_ids?.[0] ? [p.media_ids[0]] : []));
  const [renders, assets] = await Promise.all([
    renderIds.length ? db.from("renders").select("id, storage_path").in("id", renderIds) : Promise.resolve({ data: [] }),
    firstIds.length
      ? db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", firstIds)
      : Promise.resolve({ data: [] }),
  ]);
  const renderPaths = new Map((renders.data ?? []).map((r) => [r.id as string, r.storage_path as string | null]));
  const byId = new Map((assets.data ?? []).map((a) => [a.id as string, a]));

  const paths = new Map<string, { path: string; video: boolean }>();
  for (const p of posts) {
    const render = p.render_id ? renderPaths.get(p.render_id) : null;
    if (render) {
      paths.set(p.id, { path: render, video: true });
      continue;
    }
    const first = p.media_ids?.[0];
    const rendered = first ? slidesToPublish(p).rendered[first] : undefined;
    const asset = first ? byId.get(first) : undefined;
    if (rendered) paths.set(p.id, { path: rendered, video: false });
    else if (asset) {
      paths.set(p.id, { path: asset.storage_path as string, video: asset.kind === "video" || String(asset.mime_type ?? "").startsWith("video/") });
    }
  }
  const signed = await signMediaUrls(db, studioId, [...paths.values()].map((c) => c.path));
  const covers = new Map<string, Cover>();
  for (const [id, c] of paths) {
    const url = signed.get(c.path);
    if (url) covers.set(id, { url, video: c.video });
  }
  return covers;
}
