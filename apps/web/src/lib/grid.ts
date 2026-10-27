import "server-only";
import { brandProfileSchema } from "@fauve/agent";
import { coverSrc } from "@/lib/cover-src";
import { postCovers, type CoverPost } from "@/lib/covers";
import { mediaViews, profile, recentMedia, type InstagramProfile } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";
import { recentTikToks, tiktokEnabled, tiktokUser, type TikTokUser } from "@/lib/social/tiktok";
import { tiktokAccount } from "@/lib/social/tiktok-account";
import { signMediaUrls, type Db } from "@/lib/studio";
import type { ProfileIdentity, Tile } from "@/app/(app)/grille/grid-view";

// The studio's Instagram grid as followers see it, with Fauve's coming posts
// placed where they will land (top of the grid), to plan the feed at a glance.

const GRID_POSTS = 24;
const UPCOMING = ["draft", "validated", "scheduled"] as const;

export async function loadGrid(db: Db, studioId: string) {
  const account = await instagramAccount(studioId);
  const [upcoming, feed, info] = await Promise.all([
    db
      .from("posts")
      .select("id, title, kind, status, scheduled_at, render_id, media_ids, slides, slides_render, cover, share_to_feed")
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
        inGrid: p.share_to_feed !== false,
      };
    }),
    ...feed.map((media, i): Tile => ({ kind: "instagram", media, views: views[i] })),
  ];

  return { connected: Boolean(account), handle: info?.username ?? account?.handle ?? null, info, tiles };
}

/**
 * Her TikTok profile as followers see it: videos only (TikTok has no carousels
 * here), 3:4 tiles with their views, Edith's coming videos first, then those
 * waiting in her TikTok drafts. null when TikTok is not offered.
 */
export async function loadTikTokGrid(db: Db, studioId: string) {
  if (!tiktokEnabled()) return null;
  const account = await tiktokAccount(studioId).catch(() => null);
  const [upcoming, drafts, user, videos] = await Promise.all([
    db
      .from("posts")
      .select("id, title, kind, status, scheduled_at, render_id, media_ids, slides, slides_render, cover, share_to_feed")
      .eq("studio_id", studioId)
      .in("status", [...UPCOMING])
      .eq("kind", "reel")
      .contains("platforms", ["tiktok"])
      .order("scheduled_at", { ascending: false, nullsFirst: true })
      .limit(12),
    db
      .from("posts")
      .select("id, title, kind, status, scheduled_at, render_id, media_ids, slides, slides_render, cover, share_to_feed")
      .eq("studio_id", studioId)
      .eq("external_ids->tiktok->>mode", "draft")
      .is("external_ids->tiktok->>post_id", null)
      .neq("external_ids->tiktok->>status", "FAILED")
      .order("scheduled_at", { ascending: false })
      .limit(6),
    account ? tiktokUser(account.accessToken).catch((): TikTokUser | null => null) : Promise.resolve(null),
    account ? recentTikToks(account.accessToken, 20).catch(() => []) : Promise.resolve([]),
  ]);
  const posts = [...(upcoming.data ?? []), ...(drafts.data ?? [])];
  if (!account && !posts.length) return { connected: false, handle: null, user: null, tiles: [] as Tile[] };
  const covers = await postCovers(db, studioId, posts.map((p) => ({ ...(p as CoverPost), id: p.id as string })));
  const tile = (p: (typeof posts)[number], status: string): Tile => {
    const cover = covers.get(p.id as string);
    return {
      kind: "upcoming",
      id: p.id as string,
      title: p.title as string,
      status,
      at: (p.scheduled_at as string | null) ?? null,
      videoUrl: cover?.video ? coverSrc(cover) : null,
      imageUrl: cover && !cover.video ? cover.url : null,
      format: "reel",
    };
  };
  const tiles: Tile[] = [
    ...(upcoming.data ?? []).map((p) => tile(p, p.status as string)),
    ...(drafts.data ?? []).map((p) => tile(p, "tiktok_draft")),
    ...videos.map((video): Tile => ({ kind: "tiktok", video })),
  ];
  return { connected: Boolean(account), handle: user?.username ?? account?.handle ?? null, user, tiles };
}

/**
 * Who the profile is before Instagram or TikTok answers (or when neither is linked):
 * her business's name, its activity, its site and its logo, as her profile shows them.
 */
export async function profileIdentity(db: Db, studioId: string): Promise<ProfileIdentity> {
  const [studio, brand] = await Promise.all([
    db.from("studios").select("name, business_type, website_url").eq("id", studioId).maybeSingle(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
  ]);
  const style = brandProfileSchema.pick({ logo_url: true, logo_path: true }).catch({}).parse(brand.data?.[0]?.profile ?? {});
  const signed = style.logo_path ? await signMediaUrls(db, studioId, [style.logo_path]) : new Map<string, string>();
  return {
    name: (studio.data?.name as string | null) ?? null,
    category: (studio.data?.business_type as string | null) ?? null,
    website: /^https?:\/\//.test(studio.data?.website_url ?? "") ? (studio.data?.website_url as string) : null,
    logo: (style.logo_path && signed.get(style.logo_path)) || style.logo_url || null,
  };
}
