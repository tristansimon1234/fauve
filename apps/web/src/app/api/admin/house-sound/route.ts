import { HOUSE_MODELS, houseSoundPath } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A model's bench Reel with its original's own sound laid on it (Tristan, 6 November: « je veux me rendre compte sur la
// musique originale », « tu les mets sur l'admin please »): made by hand by the team (ffmpeg, the bench's video and the
// original's audio), shown beside the bench on /admin only, never served to a business (the original's music is
// another account's). POST with CRON_SECRET (from the database, call_app), ?key=<model>: a signed upload URL (2 h) for
// house/sound/<key>.mp4, then PUT the file to it (Content-Type: video/mp4, x-upsert: true). &drop=1 removes it.

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const key = params.get("key") ?? "";
  if (!HOUSE_MODELS.some((m) => m.key === key)) return Response.json({ error: `modèle inconnu : ${key}` }, { status: 400 });
  const storage = supabaseAdmin().storage.from("media");
  if (params.get("drop") === "1") {
    const { error } = await storage.remove([houseSoundPath(key)]);
    return Response.json(error ? { error: error.message } : { ok: true, removed: houseSoundPath(key) }, { status: error ? 500 : 200 });
  }
  const { data, error } = await storage.createSignedUploadUrl(houseSoundPath(key), { upsert: true });
  if (error || !data) return Response.json({ error: error?.message ?? "no upload url" }, { status: 500 });
  return Response.json({ ok: true, path: houseSoundPath(key), upload: data.signedUrl });
}
