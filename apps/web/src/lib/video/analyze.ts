import "server-only";
import { FileState, GoogleGenAI } from "@google/genai";
import { accessMessage, bankWorthy, CLIP_ANALYSIS_PROMPT, clipAnalysisRequestSchema, clipAnalysisSchema, type ClipAnalysis } from "@fauve/agent";
import { readAnswer } from "@fauve/agent/answer";
import { z } from "zod";
import { env } from "@/lib/env";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { toGeminiSchema } from "@/lib/gemini-schema";
import { studioAccess } from "@/lib/billing/access";
import { sortClip } from "@/lib/clip-sort";
import { stabilizeIfShaky } from "@/lib/video/stabilize";
import { polishSpeech } from "@/lib/video/speech";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Clip analysis with Gemini: the clip goes from Storage to the Gemini Files API,
// comes back as a validated ClipAnalysis, and is stored in clip_analyses.
// One analysis per clip: a claim on media_assets.analysis_status stops two
// webhook invocations from analysing the same clip in parallel.

const FPS = 3; // short studio clips: more frames give sharper shot boundaries
const PROCESSING_TIMEOUT_MS = 120_000;
// Gemini, then a shaky video steadied (up to two 150 s passes) and its speech read before the analysis is stored.
const STALE_CLAIM_MS = 8 * 60_000;

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

// Gemini rejects some schemas with a bare "invalid argument": ask for the full
// analysis (the look of every shot, the clip's correction, word timings with no
// size bound on the list) first, then without words, then the plain analysis.
const wordsSchema = z.array(z.object({ w: z.string(), start: z.number(), end: z.number() }));
const RESPONSE_SCHEMAS = [
  toGeminiSchema(z.toJSONSchema(clipAnalysisRequestSchema.extend({ words: wordsSchema.optional() }))),
  toGeminiSchema(z.toJSONSchema(clipAnalysisRequestSchema.omit({ words: true }))),
  toGeminiSchema(z.toJSONSchema(clipAnalysisSchema.omit({ words: true, correction: true, speech: true }))),
];

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
    const generate = (responseJsonSchema: unknown) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ fileData: { fileUri: file.uri, mimeType }, videoMetadata: { fps: FPS } }, { text: CLIP_ANALYSIS_PROMPT }],
          },
        ],
        config: { responseMimeType: "application/json", responseJsonSchema },
      });
    let response: Awaited<ReturnType<typeof generate>> | undefined;
    for (const [i, schema] of RESPONSE_SCHEMAS.entries()) {
      try {
        response = await generate(schema);
        break;
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 400 || i === RESPONSE_SCHEMAS.length - 1) throw error;
        console.warn("gemini rejected the analysis schema, retrying with a simpler one", i, error instanceof Error ? error.message : error);
      }
    }
    if (!response) throw new Error("Gemini gave no response");
    await logGeminiCost({ studioId: asset.studio_id, kind: "video_analysis", model, usage: response.usageMetadata as GeminiUsage });

    const raw = JSON.parse(response.text ?? "") as { words?: unknown };
    // Words are a bonus for subtitles: keep only a clean, bounded list.
    const words = wordsSchema.safeParse(raw.words);
    const read = readAnswer(clipAnalysisSchema, { ...raw, words: words.success ? words.data.slice(0, 400) : undefined });
    // Steadied before the analysis is stored: whoever waits for it (a montage) tracks and cuts the steady file.
    await stabilizeIfShaky(asset, read);
    // Someone speaks: its sound cleaned when noisy, its words timed exactly, its « euh » and pauses measured.
    const analysis = await polishSpeech(asset, read);
    const insert = await db
      .from("clip_analyses")
      .insert({ studio_id: asset.studio_id, media_id: asset.id, analysis, model });
    if (insert.error) throw new Error(insert.error.message);
    await db
      .from("media_assets")
      .update({ analysis_status: "done", duration: analysis.duration, bank: bankWorthy(analysis) })
      .eq("id", asset.id);
    // Sent without a word about what it is for: put it on the publication it fits.
    await sortClip(asset.studio_id, asset.id, analysis).catch((error) => console.warn("clip sort failed", asset.id, error));
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
): Promise<StoredAnalysis | { media_id: string; status: "pending" | "failed" | "not_a_video" | "locked"; error?: string }> {
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
  // Watching a video costs: not without a subscription (past her first publication) or credits.
  const already = await existing(mediaId);
  if (already) return already;
  const access = await studioAccess(studioId);
  if (!access.analyze) return { media_id: mediaId, status: "locked", error: accessMessage(access.reason) };

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
