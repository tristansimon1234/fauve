import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { muxAudioInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// One-off for the landing: the demo Reels with the music ElevenLabs composed for
// them (music-tests/*.mp3), saved next to the silent ones as reel-*-music.mp4.
// Called with CRON_SECRET (from the database, through pg_net).
export const maxDuration = 300;

const REELS = ["pilates", "coiffure", "trattoria"] as const;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin();
  const done: Record<string, string> = {};
  for (const name of REELS) {
    try {
      const [video, music] = await Promise.all([db.storage.from("landing").download(`reel-${name}.mp4`), db.storage.from("landing").download(`music-tests/${name}-1.mp3`)]);
      if (!video.data || !music.data) throw new Error("missing file");
      const mp4 = await muxAudioInSandbox(`landing-${name}`, Buffer.from(await video.data.arrayBuffer()), new Uint8Array(await music.data.arrayBuffer()));
      const { error } = await db.storage.from("landing").upload(`reel-${name}-music.mp4`, mp4, { contentType: "video/mp4", upsert: true });
      done[name] = error ? error.message : `ok ${mp4.length}`;
    } catch (error) {
      done[name] = error instanceof Error ? error.message : String(error);
    }
  }
  return Response.json(done);
}
