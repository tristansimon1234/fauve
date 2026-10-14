import "server-only";
import { coverSrc } from "@/lib/cover-src";
import { postCovers, type CoverPost } from "@/lib/covers";
import { mediaViews, profile, recentMedia, type InstagramProfile } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";
import type { Db } from "@/lib/studio";
import type { Tile } from "@/app/(app)/grille/grid-view";

// The studio's Instagram grid as followers see it, with Fauve's coming posts
// placed where they will land (top of the grid), to plan the feed at a glance.

const GRID_POSTS = 24;
const UPCOMING = ["draft", "validated", "scheduled"] as const;

export async function loadGrid(db: Db, studioId: string) {
  const account = await instagramAccount(studioId);
  const [upcoming, feed, info] = await Promise.all([
    db
      .from("posts")
      .select("id, title, kind, status, scheduled_at, render_id, media_ids, slides, slides_render, cover")
      .eq("studio_id", studioId)
      .in("status", [...UPCOMING])
      .neq("kind", "story")
      .order("scheduled_at", { ascending: false, nullsFirst: true })
      .limit(12),
    account ? recentMedia(account.userId, account.accessToken, GRID_POSTS, { images: true }).catch(() => []) : Promise.resolve([]),
    account ? profile(account.userId, account.accessToken).catch((): InstagramProfile => ({})) : Promise.resolve(null),
  ]);
  // Views per media, as Instagram shows them on Reels (one insights call each, in parallel).
  const views = account ? await Promise.all(feed.map((m) => mediaViews(m.id, account.accessToken))) : [];

  // Each coming post's cover: its montage, or its first photo (with its text once rendered).
  const covers = await postCovers(
    db,
    studioId,
    (upcoming.data ?? []).map((p) => ({ ...(p as CoverPost), id: p.id as string })),
  );

  const tiles: Tile[] = [
    ...(upcoming.data ?? []).map((p): Tile => {
      const cover = covers.get(p.id as string);
      return {
        kind: "upcoming",
        id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        at: (p.scheduled_at as string | null) ?? null,
        videoUrl: cover?.video ? coverSrc(cover) : null,
        imageUrl: cover && !cover.video ? cover.url : null,
        format: p.kind as string,
      };
    }),
    ...feed.map((media, i): Tile => ({ kind: "instagram", media, views: views[i] })),
  ];

  return { connected: Boolean(account), handle: info?.username ?? account?.handle ?? null, info, tiles };
}
