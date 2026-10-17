import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { cutoutPath } from "@/lib/render/cutout";
import { tracksPath } from "@/lib/render/tracks";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Media retention, called every hour by pg_cron with CRON_SECRET: the photos and
// videos no publication needs any more (24 h after the last one using them went
// online, 7 days when none uses them; see expired_media) are deleted, files then
// rows. Final renders are kept.
export const maxDuration = 120;

const BATCH = 100;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("expired_media", { max_rows: 500 });
  if (error) {
    console.error("retention: listing failed", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  const expired = (data ?? []) as { id: string; studio_id: string; storage_path: string }[];
  let deleted = 0;
  for (let i = 0; i < expired.length; i += BATCH) {
    const batch = expired.slice(i, i + BATCH);
    // Files first: a row is only removed once its file is gone (a failed batch is retried next hour).
    // A photo's cut-out (collages) and what was tracked in a video go with it; a path with nothing there is simply skipped.
    const removed = await db.storage
      .from("media")
      .remove(batch.flatMap((m) => [m.storage_path, cutoutPath(m.studio_id, m.id, "webp"), cutoutPath(m.studio_id, m.id, "png"), tracksPath(m.studio_id, m.id)]));
    if (removed.error) {
      console.error("retention: files not removed", removed.error.message);
      continue;
    }
    const rows = await db.from("media_assets").delete().in("id", batch.map((m) => m.id));
    if (rows.error) console.error("retention: rows not removed", rows.error.message);
    else deleted += batch.length;
  }
  if (deleted) console.info(`retention: ${deleted} media deleted`);
  return Response.json({ ok: true, deleted });
}

export const GET = handle;
export const POST = handle;
