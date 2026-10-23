import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { renderSlides, slidesToPublish } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The rendered versions of any publication, with a link valid an hour, to watch what a
// real studio received (the lab's step=result only knows lab studios): its Reel's videos,
// and its photos as they would be published (a carousel's slides, the cover first):
// POST ?post=<uuid> with CRON_SECRET (Authorization: Bearer …), from the database by net.http_post.
// &render=slides makes its photos again when they are not its plan's (a render lost or failed).

export const maxDuration = 300;

type SlidesPost = { studio_id: string; slides: unknown; slides_render: unknown; media_ids: string[] | null };

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const post = z.uuid().safeParse(params.get("post"));
  if (!post.success) return Response.json({ error: "post=<uuid> attendu" }, { status: 400 });
  const db = supabaseAdmin();
  const readPost = async () => (await db.from("posts").select("studio_id, slides, slides_render, media_ids").eq("id", post.data).maybeSingle()).data as SlidesPost | null;
  const [plansRead, first] = await Promise.all([db.from("edit_plans").select("id, version").eq("post_id", post.data), readPost()]);
  let row = first;
  if (row && params.get("render") === "slides" && slidesToPublish(row).state === "failed") {
    await renderSlides(row.studio_id, post.data);
    row = await readPost();
  }
  const plans = plansRead.data ?? [];
  const version = new Map(plans.map((p) => [p.id as string, p.version as number]));
  const renders = plans.length
    ? ((await db.from("renders").select("id, edit_plan_id, status, storage_path, created_at").in("edit_plan_id", [...version.keys()]).order("created_at", { ascending: false })).data ?? [])
    : [];
  const published = row ? slidesToPublish(row) : null;
  const slides = published ? (published.designed ?? Object.values(published.rendered)) : [];
  const paths = [...renders.flatMap((r) => (r.storage_path ? [r.storage_path as string] : [])), ...slides];
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 3600)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return Response.json({
    renders: renders.map((r) => ({
      id: r.id,
      version: version.get(r.edit_plan_id as string),
      status: r.status,
      created_at: r.created_at,
      url: r.storage_path ? (url.get(r.storage_path as string) ?? null) : null,
    })),
    slides: { state: published?.state ?? null, urls: slides.map((p) => url.get(p) ?? null) },
  });
}
