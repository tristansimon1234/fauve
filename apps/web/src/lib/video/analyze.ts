import "server-only";
import { FileState, GoogleGenAI } from "@google/genai";
import { CLIP_ANALYSIS_PROMPT, clipAnalysisSchema, usdToEur, type ClipAnalysis } from "@fauve/agent";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Clip analysis with Gemini: the clip goes from Storage to the Gemini Files API,
// comes back as a validated ClipAnalysis, and is stored in clip_analyses.
// One analysis per clip: a claim on media_assets.analysis_status stops two
// webhook invocations from analysing the same clip in parallel.

const FPS = 3; // short studio clips: more frames give sharper shot boundaries
const PROCESSING_TIMEOUT_MS = 120_000;
const STALE_CLAIM_MS = 4 * 60_000;

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

/** Gemini accepts a subset of JSON Schema: drop the keywords it does not need. */
function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$schema" && key !== "additionalProperties")
      .map(([key, v]) => [key, toGeminiSchema(v)]),
  );
}
const responseJsonSchema = toGeminiSchema(z.toJSONSchema(clipAnalysisSchema));

export type StoredAnalysis = { media_id: string; analysis: ClipAnalysis };

async function existing(mediaId: string): Promise<StoredAnalysis | null> {
  const { data } = await supabaseAdmin()
    .from("clip_analyses")
    .select("media_id, analysis")
    .eq("media_id", mediaId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const parsed = clipAnalysisSchema.safeParse(row.analysis);
  return parsed.success ? { media_id: row.media_id as string, analysis: parsed.data } : null;
}

async function claim(mediaId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("media_assets")
    .update({ analysis_status: "running", analysis_started_at: new Date().toISOString() })
    .eq("id", mediaId)
    .or(`analysis_status.is.null,analysis_status.eq.failed,analysis_started_at.lt.${staleBefore}`)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length > 0;
}

async function logCost(studioId: string, model: string, usage: Record<string, number | undefined> | undefined) {
  const input = (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0);
  const output = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const inPrice = env("GEMINI_INPUT_USD_PER_MTOK");
  const outPrice = env("GEMINI_OUTPUT_USD_PER_MTOK");
  const usd = inPrice !== undefined && outPrice !== undefined ? (input * inPrice + output * outPrice) / 1e6 : null;
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({
      studio_id: studioId,
      kind: "video_analysis",
      provider: "google",
      units: input + output,
      cost_eur: usd === null ? 0 : usdToEur(usd, env("USD_TO_EUR")),
      meta: { model, usage, cost_usd: usd, priced: usd !== null },
    });
  if (error) console.error("cost_events insert failed", error.message);
}

async function runAnalysis(asset: { id: string; studio_id: string; storage_path: string; mime_type: string | null }) {
  const db = supabaseAdmin();
  const download = await db.storage.from("media").download(asset.storage_path);
  if (download.error) throw new Error(download.error.message);
  const mimeType = asset.mime_type ?? "video/mp4";

  const ai = gemini();
  let file = await ai.files.upload({ file: download.data, config: { mimeType, displayName: asset.id } });
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  while (file.state === FileState.PROCESSING) {
    if (Date.now() > deadline) throw new Error("Gemini file processing timed out");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== FileState.ACTIVE || !file.uri) throw new Error(`Gemini file ${file.state}: ${file.error?.message ?? ""}`);

  const model = env("GEMINI_MODEL");
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ fileData: { fileUri: file.uri, mimeType }, videoMetadata: { fps: FPS } }, { text: CLIP_ANALYSIS_PROMPT }],
        },
      ],
      config: { responseMimeType: "application/json", responseJsonSchema },
    });
    await logCost(asset.studio_id, model, response.usageMetadata as Record<string, number | undefined> | undefined);

    const analysis = clipAnalysisSchema.parse(JSON.parse(response.text ?? ""));
    const insert = await db
      .from("clip_analyses")
      .insert({ studio_id: asset.studio_id, media_id: asset.id, analysis, model });
    if (insert.error) throw new Error(insert.error.message);
    await db
      .from("media_assets")
      .update({ analysis_status: "done", duration: analysis.duration })
      .eq("id", asset.id);
    return { media_id: asset.id, analysis };
  } finally {
    await ai.files.delete({ name: file.name! }).catch(() => {});
  }
}

/**
 * Returns the clip's analysis, running it if nobody has yet. If another
 * invocation is already on it, waits for its result (up to waitMs).
 */
export async function ensureClipAnalysis(
  studioId: string,
  mediaId: string,
  { waitMs = 150_000 }: { waitMs?: number } = {},
): Promise<StoredAnalysis | { media_id: string; status: "pending" | "failed" | "not_a_video"; error?: string }> {
  const db = supabaseAdmin();
  const asset = await db
    .from("media_assets")
    .select("id, studio_id, storage_path, mime_type, kind")
    .eq("id", mediaId)
    .eq("studio_id", studioId)
    .single();
  if (asset.error) throw new Error(`Media ${mediaId} not found`);
  if (asset.data.kind !== "video" && !asset.data.mime_type?.startsWith("video/")) {
    return { media_id: mediaId, status: "not_a_video" };
  }

  const deadline = Date.now() + waitMs;
  for (;;) {
    const done = await existing(mediaId);
    if (done) return done;
    if (await claim(mediaId)) {
      try {
        return await runAnalysis(asset.data);
      } catch (error) {
        console.error("clip analysis failed", mediaId, error);
        await db.from("media_assets").update({ analysis_status: "failed" }).eq("id", mediaId);
        return { media_id: mediaId, status: "failed", error: error instanceof Error ? error.message : String(error) };
      }
    }
    if (Date.now() > deadline) return { media_id: mediaId, status: "pending" };
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
