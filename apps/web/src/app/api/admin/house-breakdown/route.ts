import { HOUSE_MODELS } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { breakdownOriginal, houseBreakdownPath } from "@/lib/video/breakdown";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The breakdown of one of Edith's originals by Gemini, watching its video with its sound (lib/video/breakdown.ts), before
// its model is written: POST with CRON_SECRET (from the database, call_app), ?key=<model>; &read=1 gives the kept one
// without a new call. A few cents a model, counted on the team's studio (cost_events, purpose house_breakdown).

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const key = params.get("key") ?? "";
  if (!HOUSE_MODELS.some((m) => m.key === key)) return Response.json({ error: `modèle inconnu : ${key}` }, { status: 400 });
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
