import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { slidesToPublish } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The rendered versions of any publication, with a link valid an hour, to watch what a
// real studio received (the lab's step=result only knows lab studios): its Reel's videos,
// and its photos as they would be published (a carousel's slides, the cover first):
// POST ?post=<uuid> with CRON_SECRET (Authorization: Bearer …), from the database by net.http_post.

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const post = z.uuid().safeParse(new URL(request.url).searchParams.get("post"));
  if (!post.success) return Response.json({ error: "post=<uuid> attendu" }, { status: 400 });
  const db = supabaseAdmin();
  const [plansRead, postRead] = await Promise.all([
    db.from("edit_plans").select("id, version").eq("post_id", post.data),
    db.from("posts").select("slides, slides_render, media_ids").eq("id", post.data).maybeSingle(),
  ]);
  const plans = plansRead.data ?? [];
  const version = new Map(plans.map((p) => [p.id as string, p.version as number]));
  const renders = plans.length
    ? ((await db.from("renders").select("id, edit_plan_id, status, storage_path, created_at").in("edit_plan_id", [...version.keys()]).order("created_at", { ascending: false })).data ?? [])
    : [];
  const published = postRead.data ? slidesToPublish(postRead.data as { slides: unknown; slides_render: unknown; media_ids: string[] | null }) : null;
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
