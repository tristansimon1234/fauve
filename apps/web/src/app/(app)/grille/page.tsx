import type { Metadata } from "next";
import { Suspense } from "react";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { profile, recentMedia, type InstagramProfile } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";
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
      .select("id, title, kind, status, scheduled_at, render_id")
      .eq("studio_id", studioId)
      .in("status", [...UPCOMING])
      .neq("kind", "story")
      .order("scheduled_at", { ascending: false, nullsFirst: true })
      .limit(12),
    account ? recentMedia(account.userId, account.accessToken, GRID_POSTS, { images: true }).catch(() => []) : Promise.resolve([]),
    account ? profile(account.userId, account.accessToken).catch((): InstagramProfile => ({})) : Promise.resolve(null),
  ]);

  // Fauve's montages: the rendered video, its first frame stands in for the cover.
  const renderIds = (upcoming.data ?? []).flatMap((p) => (p.render_id ? [p.render_id as string] : []));
  const { data: renders } = renderIds.length ? await db.from("renders").select("id, storage_path").in("id", renderIds) : { data: [] };
  const paths = new Map((renders ?? []).map((r) => [r.id as string, r.storage_path as string | null]));
  const signed = await signMediaUrls(db, studioId, [...paths.values()].filter((p): p is string => Boolean(p)));

  const tiles: Tile[] = [
    ...(upcoming.data ?? []).map((p): Tile => {
      const path = p.render_id ? paths.get(p.render_id as string) : null;
      return {
        kind: "upcoming",
        id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        at: (p.scheduled_at as string | null) ?? null,
        videoUrl: path ? (signed.get(path) ?? null) : null,
        format: p.kind as string,
      };
    }),
    ...feed.map((media): Tile => ({ kind: "instagram", media })),
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
