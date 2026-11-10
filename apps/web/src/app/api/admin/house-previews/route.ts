import { HOUSE_MODELS, IDEA_PREVIEW_DIR, ideaPreviewPath } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The previews of « Regarde nos idées » (docs/modeles.md, « Nos modèles restent internes »): each model's looping
// preview and its poster, never public again (Tristan, 6 November: « je préfère ne pas divulguer nos modèles »), kept in
// the bucket media under house/previews/<key>.mp4 and .jpg (never under a studio's folder: the retention and a studio's
// deletion never touch them) and served to a studio's members by signed links only. Restored from git history by
// scripts/models/upload-previews.sh. POST with CRON_SECRET (Authorization: Bearer …):
// ?key=<model>&ext=mp4|jpg: a signed upload URL (2 h), then PUT the file to it (its Content-Type, x-upsert: true);
// &drop=1 removes that file; ?list=1: the previews kept, and the models without one (never proposed until they have it).

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const storage = supabaseAdmin().storage.from("media");
  if (params.get("list") === "1") {
    const { data, error } = await storage.list(IDEA_PREVIEW_DIR, { limit: 500 });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const names = new Set((data ?? []).map((f) => f.name));
    const kept = HOUSE_MODELS.map((m) => m.key).filter((k) => names.has(`${k}.mp4`) && names.has(`${k}.jpg`));
    return Response.json({ ok: true, kept: kept.length, missing: HOUSE_MODELS.map((m) => m.key).filter((k) => !kept.includes(k)) });
  }
  const key = params.get("key") ?? "";
  if (!HOUSE_MODELS.some((m) => m.key === key)) return Response.json({ error: `modèle inconnu : ${key}` }, { status: 400 });
  const ext = params.get("ext");
  if (ext !== "mp4" && ext !== "jpg") return Response.json({ error: "ext=mp4 ou ext=jpg" }, { status: 400 });
  const path = ideaPreviewPath(key, ext);
  if (params.get("drop") === "1") {
    const { error } = await storage.remove([path]);
    return Response.json(error ? { error: error.message } : { ok: true, removed: path }, { status: error ? 500 : 200 });
  }
  const { data, error } = await storage.createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return Response.json({ error: error?.message ?? "no upload url" }, { status: 500 });
  return Response.json({ ok: true, path, upload: data.signedUrl });
}
