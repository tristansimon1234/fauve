import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HOUSE_MEASURES, HOUSE_MODELS, HOUSE_PASSAGES, houseOriginalPath, houseSheetPath, houseSheets, MODEL_SHEETS, sheetSpan } from "@fauve/agent";
import { env } from "@/lib/env";
import { houseSheetsInSandbox, sandboxCostEur } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The sheets of Edith's models' originals (packages/agent/src/house-sheets.ts), made from house/originals/<key>.mp4
// with the recipe of a Reel she sends, kept in house/sheets/<key>/: POST with CRON_SECRET (Authorization: Bearer …),
// from the database by net.http_post. A body { "originals": { "<key>": "lab/models/<uuid>.mp4" } } first copies the
// bench's copy of an original (modelVideo) to its place. ?key=<key> makes one model's sheets, otherwise every model's
// whose original is kept.

export const maxDuration = 800;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const bodySchema = z.object({ originals: z.record(z.string(), z.string().regex(/^lab\/models\/[0-9a-f-]{36}\.mp4$/)).optional() });

type Made = { key: string; sheets: number; named: number; seconds: number } | { key: string; error: string };

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const only = new URL(request.url).searchParams.get("key");
  if (only && !HOUSE_MODELS.some((m) => m.key === only)) return Response.json({ error: `modèle inconnu : ${only}` }, { status: 400 });
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });
  const db = supabaseAdmin();
  const adopted: Record<string, string> = {};
  for (const [key, from] of Object.entries(body.data.originals ?? {})) {
    if (!HOUSE_MODELS.some((m) => m.key === key)) {
      adopted[key] = "modèle inconnu";
      continue;
    }
    const to = houseOriginalPath(key);
    await db.storage.from("media").remove([to]);
    const { error } = await db.storage.from("media").copy(from, to);
    adopted[key] = error ? error.message : "ok";
  }
  const keys = only ? [only] : HOUSE_MODELS.map((m) => m.key);
  const made: Made[] = [];
  let seconds = 0;
  // Two at a time: a few seconds of ffmpeg each in the render workshop.
  for (let i = 0; i < keys.length; i += 2) {
    made.push(...(await Promise.all(keys.slice(i, i + 2).map(async (key) => {
      try {
        const signed = await db.storage.from("media").createSignedUrl(houseOriginalPath(key), 600);
        if (!signed.data?.signedUrl) return { key, error: "original absent" };
        const passage = HOUSE_PASSAGES[key];
        const crop = passage?.crop ? `${passage.crop.width}:${passage.crop.height}:${passage.crop.x}:${passage.crop.y}` : undefined;
        const out = await houseSheetsInSandbox(`house-${key}-${randomUUID()}`, signed.data.signedUrl, { span: sheetSpan(HOUSE_MEASURES[key]?.duration ?? 0), ...(passage ? { to: passage.to } : {}), ...(crop ? { crop } : {}) });
        seconds += out.seconds;
        const kept = await Promise.all(out.sheets.map((jpeg, index) => db.storage.from("media").upload(houseSheetPath(key, index), jpeg, { contentType: "image/jpeg", upsert: true })));
        const failed = kept.find((k) => k.error);
        if (failed?.error) return { key, error: failed.error.message };
        // Sheets of an earlier, longer cut: removed.
        const stale = Array.from({ length: MODEL_SHEETS }, (_, index) => index).filter((index) => index >= out.sheets.length).map((index) => houseSheetPath(key, index));
        if (stale.length) await db.storage.from("media").remove(stale);
        return { key, sheets: out.sheets.length, named: houseSheets(key).length, seconds: Math.round(out.seconds) };
      } catch (error) {
        return { key, error: error instanceof Error ? error.message.slice(0, 300) : String(error) };
      }
    }))));
  }
  if (seconds > 0) {
    await db.from("cost_events").insert({ studio_id: null, kind: "steal", provider: "vercel_sandbox", units: Math.round(seconds), cost_eur: sandboxCostEur(seconds), meta: { purpose: "house_sheets", models: made.length } });
  }
  return Response.json({ adopted, made });
}
