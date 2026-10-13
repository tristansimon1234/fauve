import { postStatusSchema, type PostKind } from "@fauve/agent";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { loadEditorData } from "@/lib/montage-editor-data";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { ActionView } from "./action-view";

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
    .select("id, title, kind, status, caption, hashtags, scheduled_at, edit_plan_id, render_id, media_ids")
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
  // Without a live montage (photos, older montages): the rendered video or the first photo.
  let videoUrl: string | null = null;
  let photoUrl: string | null = null;
  if (!editor) {
    const path = (render.data?.storage_path as string | null) ?? null;
    if (path) videoUrl = (await signMediaUrls(db, studioId, [path])).get(path) ?? null;
    const first = (post.media_ids as string[] | null)?.[0];
    if (!videoUrl && first) {
      const { data: asset } = await db.from("media_assets").select("storage_path").eq("id", first).eq("studio_id", studioId).maybeSingle();
      const p = asset?.storage_path as string | undefined;
      if (p) photoUrl = (await signMediaUrls(db, studioId, [p])).get(p) ?? null;
    }
  }

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
      photoUrl={photoUrl}
      changeHref={whatsappLink(`Pour « ${post.title as string} » : `)}
      backHref={whatsappLink("")}
    />
  );
}
