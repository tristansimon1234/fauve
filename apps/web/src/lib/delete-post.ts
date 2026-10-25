import "server-only";
import { readPostMusic } from "@/lib/render/music";
import type { SlidesRender } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Deleting a publication (« Supprimer » in the app, or the admin route): its row, with its plans,
// renders and quotes (cascade), and the files only it had: its videos and their scene strips, its
// rendered carousel images, its music piece. Her photos and videos stay in her library, where
// retention takes them once nothing uses them.

export type RemovePostResult = { ok: true; files: number } | { ok: false; reason: "not_found" | "publishing" | "failed" };

export async function removePost(studioId: string, postId: string): Promise<RemovePostResult> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("id, status, publish_started_at, slides_render, music").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return { ok: false, reason: "not_found" };
  if (post.status === "scheduled" && post.publish_started_at) return { ok: false, reason: "publishing" };

  // The renders go with their plans (cascade); their files must be removed by hand.
  const { data: plans } = await db.from("edit_plans").select("id").eq("post_id", postId);
  const planIds = (plans ?? []).map((p) => p.id as string);
  const { data: renders } = planIds.length ? await db.from("renders").select("storage_path, scenes_path").in("edit_plan_id", planIds) : { data: [] };
  // Its rendered carousel images, its music piece and its scene strips too: they stayed in storage after the post was gone.
  const slides = ((post.slides_render as SlidesRender | null)?.paths ?? []) as (string | null)[];
  const music = readPostMusic(post.music).track?.path ?? null;
  const files = [...(renders ?? []).flatMap((r) => [r.storage_path as string | null, r.scenes_path as string | null]), ...slides, music].filter((p): p is string =>
    Boolean(p?.startsWith(`${studioId}/`)),
  );

  const { error } = await db.from("posts").delete().eq("id", postId).eq("studio_id", studioId);
  if (error) {
    console.warn("removePost failed", error.message);
    return { ok: false, reason: "failed" };
  }
  if (files.length) await db.storage.from("media").remove(files).catch(() => {});
  return { ok: true, files: files.length };
}
