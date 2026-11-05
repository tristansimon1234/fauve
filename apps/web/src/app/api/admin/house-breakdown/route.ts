import { HOUSE_MODELS, houseOriginalPath } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { breakdownOriginal, houseBreakdownPath } from "@/lib/video/breakdown";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** A new model's key (lower case, its words joined by hyphens), and the bench's copy of an original. */
const NEW_KEY = /^[a-z][a-z0-9-]{1,30}$/;
const LAB_COPY = /^lab\/models\/[0-9a-f-]{36}\.mp4$/;

// The breakdown of one of Edith's originals by Gemini, watching its video with its sound (lib/video/breakdown.ts), before
// its model is written: POST with CRON_SECRET (from the database, call_app), ?key=<model>; &read=1 gives the kept one
// without a new call. A few cents a model, counted on the team's studio (cost_events, purpose house_breakdown). A new
// model of Tristan's, before its entry is in the catalogue: ?key=<its key to come>&from=lab/models/<uuid>.mp4 (the
// bench's copy of its original, step=model of the lab) keeps that copy as its original, then reads it; never for a key
// of the catalogue (its original stays the one its model was written on).

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const key = params.get("key") ?? "";
  const from = params.get("from");
  const known = HOUSE_MODELS.some((m) => m.key === key);
  // A new model's key: a slug, its original given once (from), its breakdown read back after (read=1).
  const fresh = !known && NEW_KEY.test(key) && (from ? LAB_COPY.test(from) : params.get("read") === "1");
  if (!known && !fresh) return Response.json({ error: `modèle inconnu : ${key}` }, { status: 400 });
  if (known && from) return Response.json({ error: "from= seulement pour un nouveau modèle" }, { status: 400 });
  if (from) {
    const storage = supabaseAdmin().storage.from("media");
    await storage.remove([houseOriginalPath(key)]);
    const { error } = await storage.copy(from, houseOriginalPath(key));
    if (error) return Response.json({ error: `original : ${error.message}` }, { status: 500 });
  }
  if (params.get("read") === "1") {
    const { data, error } = await supabaseAdmin().storage.from("media").download(houseBreakdownPath(key));
    if (error || !data) return Response.json({ error: "pas encore décortiqué" }, { status: 404 });
    return new Response(await data.text(), { headers: { "content-type": "application/json" } });
  }
  try {
    return Response.json(await breakdownOriginal(key));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
