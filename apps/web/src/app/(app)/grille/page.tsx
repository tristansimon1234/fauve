import type { Metadata } from "next";
import { Suspense } from "react";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { mediaViews, profile, recentMedia, type InstagramProfile } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";
import { slidesToPublish } from "@/lib/render/slides";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { GridView, type Tile } from "./grid-view";

export const metadata: Metadata = { title: "Grille" };

// The studio's Instagram grid as followers see it, with Fauve's coming posts
// placed where they will land (top of the grid), to plan the feed at a glance.

const GRID_POSTS = 24;
const UPCOMING = ["draft", "validated", "scheduled"] as const;

export default function GridPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <Suspense fallback={<PageLoading title="Grille" />}>
        <Grid />
      </Suspense>
    </main>
  );
}

async function Grid() {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;

  const account = await instagramAccount(studioId);
  const [upcoming, feed, info] = await Promise.all([
    db
      .from("posts")
      .select("id, title, kind, status, scheduled_at, render_id, media_ids, slides, slides_render")
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

  // Fauve's montages: the rendered video, its first frame stands in for the cover.
  const renderIds = (upcoming.data ?? []).flatMap((p) => (p.render_id ? [p.render_id as string] : []));
  const { data: renders } = renderIds.length ? await db.from("renders").select("id, storage_path").in("id", renderIds) : { data: [] };
  const paths = new Map((renders ?? []).map((r) => [r.id as string, r.storage_path as string | null]));
  // Photo posts and carousels: the first photo, with its text when it is rendered.
  const firstIds = (upcoming.data ?? []).flatMap((p) => ((p.media_ids as string[] | null)?.[0] ? [(p.media_ids as string[])[0]!] : []));
  const { data: firstAssets } = firstIds.length
    ? await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", firstIds)
    : { data: [] };
  const assets = new Map((firstAssets ?? []).map((a) => [a.id as string, a]));
  const covers = new Map<string, { path: string; video: boolean }>();
  for (const p of upcoming.data ?? []) {
    const slide = slidesToPublish(p as { slides: unknown; slides_render: unknown; media_ids: string[] | null });
    const first = (p.media_ids as string[] | null)?.[0];
    const asset = first ? assets.get(first) : undefined;
    const rendered = first ? slide.rendered[first] : undefined;
    if (rendered) covers.set(p.id as string, { path: rendered, video: false });
    else if (asset) {
      covers.set(p.id as string, {
        path: asset.storage_path as string,
        video: asset.kind === "video" || String(asset.mime_type ?? "").startsWith("video/"),
      });
    }
  }
  const signed = await signMediaUrls(db, studioId, [
    ...[...paths.values()].filter((p): p is string => Boolean(p)),
    ...[...covers.values()].map((c) => c.path),
  ]);

  const tiles: Tile[] = [
    ...(upcoming.data ?? []).map((p): Tile => {
      const path = p.render_id ? paths.get(p.render_id as string) : null;
      const cover = covers.get(p.id as string);
      return {
        kind: "upcoming",
        id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        at: (p.scheduled_at as string | null) ?? null,
        videoUrl: path ? (signed.get(path) ?? null) : cover?.video ? (signed.get(cover.path) ?? null) : null,
        imageUrl: !path && cover && !cover.video ? (signed.get(cover.path) ?? null) : null,
        format: p.kind as string,
      };
    }),
    ...feed.map((media, i): Tile => ({ kind: "instagram", media, views: views[i] })),
  ];

  return (
    <GridView
      connected={Boolean(account)}
      handle={info?.username ?? account?.handle ?? null}
      info={info}
      tiles={tiles}
      timezone={tz}
    />
  );
}
