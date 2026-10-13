import { alignSlides, postStatusSchema, type PostKind } from "@fauve/agent";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { loadEditorData } from "@/lib/montage-editor-data";
import { loadMontageInputs } from "@/lib/render/render-post";
import { postSlides } from "@/lib/render/slides";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { loadTextLooks } from "@/lib/text-looks";
import { instagramAccount } from "@/lib/social/publish";
import { recentMedia } from "@/lib/social/instagram";
import { ActionView, type ActionMedia } from "./action-view";

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

  const { data: post } = await db
    .from("posts")
    .select("id, title, kind, status, caption, hashtags, scheduled_at, edit_plan_id, render_id, media_ids, slides")
    .eq("id", id)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!post) notFound();

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
  // Text over the photos (carousel, photo post): the plan, or an empty one to start from by hand.
  const photos: Record<string, string> = {};
  for (const mid of ids) {
    const a = byId.get(mid);
    const url = a ? signed.get(a.storage_path as string) : undefined;
    if (a && url && a.kind !== "video" && !String(a.mime_type ?? "").startsWith("video/")) photos[mid] = url;
  }
  const slides =
    (post.kind === "carousel" || post.kind === "post") && Object.keys(photos).length
      ? {
          plan: postSlides({ slides: post.slides, media_ids: ids }) ?? alignSlides({ template: "doux", slides: [] }, ids),
          photos,
          brand: await loadMontageInputs(studioId, { segments: [] }).then((i) => ({ name: i.studioName, accent: i.accent, logoUrl: i.logoUrl, fonts: i.fonts })),
        }
      : null;
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
      slides={slides}
      looks={locked ? [] : await loadTextLooks(studioId).catch(() => [])}
      changeHref={whatsappLink(`Pour « ${post.title as string} » : `)}
      backHref={whatsappLink("")}
    />
  );
}
