import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { removePost } from "@/lib/delete-post";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Deletes a publication like « Supprimer » in the app (its renders, carousel images and music
// with it): POST ?post=<uuid> with CRON_SECRET (Authorization: Bearer …). Irreversible.

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const post = z.uuid().safeParse(new URL(request.url).searchParams.get("post"));
  if (!post.success) return Response.json({ error: "post=<uuid> attendu" }, { status: 400 });
  const { data } = await supabaseAdmin().from("posts").select("studio_id, title").eq("id", post.data).maybeSingle();
  if (!data) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const result = await removePost(data.studio_id as string, post.data);
  return Response.json({ title: data.title, ...result }, { status: result.ok ? 200 : 409 });
}
