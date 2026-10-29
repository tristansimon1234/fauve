import { versionKey } from "@/lib/version-key";
import { postCoverSchema, postStatusSchema, type PostKind } from "@fauve/agent";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { loadEditorData } from "@/lib/montage-editor-data";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { loadTextLooks } from "@/lib/text-looks";
import { instagramAccount } from "@/lib/social/publish";
import { recentMedia } from "@/lib/social/instagram";
import { ActionView, type ActionMedia } from "./action-view";
import { Paywall } from "@/components/paywall";
import { studioAccess } from "@/lib/billing/access";
import { PhoneMaking, PhoneReview } from "@/components/review/phone-review";
import { PhoneCarousel } from "@/components/review/phone-carousel";
import { loadCarouselReview } from "@/lib/carousel-review";
import { montageStatus } from "@/lib/montage-status";
import { loadReview } from "@/lib/review";

export const metadata: Metadata = { title: "Ta publication" };

// « Voir et valider »: the page Fauve's WhatsApp links open. The video, the
// caption, and three things to do: validate, edit a text, ask for a change.

export default function ActionPage({ params }: PageProps<"/v/[id]">) {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-white/60">Chargement…</div>}>
      <Action params={params} />
    </Suspense>
  );
}

async function Action({ params }: { params: PageProps<"/v/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, member } = await getStudioContext();
  if (!member) redirect(`/connexion?next=/v/${id}`);
  const studioId = member.studio.id;
  // Her first publication, before she subscribes: blurred, behind « Débloquer ».
  if (!(await studioAccess(studioId)).unlock) return <Paywall db={db} studioId={studioId} postId={id} next={`/v/${id}`} />;

  const { data: post } = await db
    .from("posts")
    .select("id, title, kind, status, caption, hashtags, scheduled_at, edit_plan_id, render_id, media_ids, slides, slides_render, agent_note, cover, share_to_feed, platforms, publish_by_hand, music, voice_media_id, tiktok, external_ids")
    .eq("id", id)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!post) notFound();

  // A Reel with its montage.
  if (post.kind === "reel") {
    const review = await loadReview(
      db,
      studioId,
      {
        id: post.id as string,
        title: post.title as string,
        status: post.status as string,
        scheduled_at: (post.scheduled_at as string | null) ?? null,
        platforms: (post.platforms as string[] | null) ?? [],
        caption: (post.caption as string | null) ?? null,
        hashtags: (post.hashtags as string[] | null) ?? [],
        edit_plan_id: (post.edit_plan_id as string | null) ?? null,
        render_id: (post.render_id as string | null) ?? null,
        publish_by_hand: post.publish_by_hand === true,
        music: post.music,
        voice_media_id: (post.voice_media_id as string | null) ?? null,
        tiktok: post.tiktok,
        external_ids: post.external_ids,
      },
      member.studio.timezone,
    );
    // Made for her phone: the Reel full screen and what she does from WhatsApp, not the app's page.
    if (review) return <PhoneReview key={`${review.version}-${review.renderId ?? ""}-${review.status}`} data={review} />;
    // No version yet: its montage at work, where it is (the old page said nothing of it).
    const running = (await montageStatus(studioId, id)).find((m) => m.step !== "livré" && !m.late);
    if (running) return <PhoneMaking title={post.title as string} step={running.step} minutes={running.minutes} />;
  }

  // A carousel or a photo post: its slides large, as the feed shows them, and the same buttons as a Reel.
  if (post.kind === "carousel" || post.kind === "post") {
    const data = await loadCarouselReview(
      db,
      studioId,
      {
        id: post.id as string,
        title: post.title as string,
        kind: post.kind,
        status: post.status as string,
        caption: (post.caption as string | null) ?? null,
        hashtags: (post.hashtags as string[] | null) ?? [],
        scheduled_at: (post.scheduled_at as string | null) ?? null,
        platforms: (post.platforms as string[] | null) ?? [],
        media_ids: (post.media_ids as string[] | null) ?? [],
        slides: post.slides,
        slides_render: post.slides_render,
      },
      member.studio.timezone,
    );
    return <PhoneCarousel data={data} looks={data.plan && !data.locked ? await loadTextLooks(studioId).catch(() => []) : []} />;
  }

  const planId =
    (post.edit_plan_id as string | null) ??
    ((await db.from("edit_plans").select("id").eq("post_id", id).order("version", { ascending: false }).limit(1).maybeSingle()).data?.id as
      | string
      | undefined) ??
    null;
  const status = postStatusSchema.parse(post.status);
  const locked = status === "published" || status === "measured";
  const [editor, render] = await Promise.all([
    planId && !locked ? loadEditorData(studioId, planId).catch(() => null) : Promise.resolve(null),
    post.render_id ? db.from("renders").select("storage_path").eq("id", post.render_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // The montage video (also the grid cover), and the post's own photos and videos, in order.
  const path = (render.data?.storage_path as string | null) ?? null;
  const ids = (post.media_ids as string[] | null) ?? [];
  const [assets, account] = await Promise.all([
    ids.length
      ? db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", ids)
      : Promise.resolve({ data: [] as { id: string; storage_path: string; kind: string; mime_type: string | null }[] }),
    post.kind === "story" ? Promise.resolve(null) : instagramAccount(studioId),
  ]);
  const signed = await signMediaUrls(db, studioId, [...(path ? [path] : []), ...(assets.data ?? []).map((a) => a.storage_path as string)]);
  const videoUrl = path ? (signed.get(path) ?? null) : null;
  const byId = new Map((assets.data ?? []).map((a) => [a.id as string, a]));
  const media: ActionMedia[] = ids.flatMap((mid) => {
    const a = byId.get(mid);
    const url = a ? signed.get(a.storage_path as string) : undefined;
    return a && url ? [{ url, video: a.kind === "video" || String(a.mime_type ?? "").startsWith("video/") }] : [];
  });
  // The grid as followers will see it: this post first, then the latest ones on Instagram.
  const feed = account ? await recentMedia(account.userId, account.accessToken, 8, { images: true }).catch(() => []) : [];
  const grid = feed.flatMap((m) => {
    const src = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
    return src ? [{ url: src, reel: m.media_product_type === "REELS", carousel: m.media_type === "CAROUSEL_ALBUM" }] : [];
  });

  return (
    <ActionView
      key={versionKey(post.caption, status, editor?.plan ?? null)}
      post={{
        id: post.id as string,
        title: post.title as string,
        kind: post.kind as PostKind,
        status,
        caption: (post.caption as string | null) ?? "",
        hashtags: (post.hashtags as string[] | null) ?? [],
        when: post.scheduled_at ? formatDateTime(post.scheduled_at as string, member.studio.timezone) : null,
      }}
      editor={editor}
      videoUrl={videoUrl}
      media={media}
      grid={post.kind === "story" ? null : grid}
      looks={locked ? [] : await loadTextLooks(studioId).catch(() => [])}
      note={(post.agent_note as string | null) ?? null}
      cover={postCoverSchema.nullable().catch(null).parse(post.cover ?? null)}
      shareToFeed={post.share_to_feed !== false}
      changeHref={whatsappLink(`Pour « ${post.title as string} » : `)}
      backHref={whatsappLink("")}
    />
  );
}
