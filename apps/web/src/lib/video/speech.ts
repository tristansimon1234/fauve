import "server-only";
import { randomUUID } from "node:crypto";
import { hasSpeech, SPEECH_MAX_SECONDS, splitFillers, type ClipAnalysis } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { cleanSpeechInSandbox, sandboxCostEur } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcribeSpeech } from "@/lib/voice";

// Someone speaking in her video (speech.ts in @fauve/agent): its sound cleaned once, when it was
// noisy (the cleaned copy takes the place of the file, like a steadied one), its words timed exactly
// by Scribe with its hesitations apart, and its pauses measured; the engine then cuts the « euh » and
// the long silences out of every Reel. Never fails an analysis: without it, the words stay Gemini's.

/** Where a video's (or a voice note's) copy with its sound cleaned is kept, when it is not already a copy. */
const cleanedPath = (studioId: string, mediaId: string, ext: "mp4" | "m4a") => `${studioId}/clean/${mediaId}.${ext}`;

/**
 * The analysis with her speech read precisely (`speech`, and Scribe's words without the hesitations);
 * unchanged when nobody speaks, when it is too long, or when the reading fails.
 */
export async function polishSpeech(asset: { id: string; studio_id: string }, analysis: ClipAnalysis): Promise<ClipAnalysis> {
  if (analysis.speech || !hasSpeech(analysis) || analysis.duration > SPEECH_MAX_SECONDS) return analysis;
  const db = supabaseAdmin();
  try {
    // The file as it is now (a shaky video was just steadied: its copy is cleaned).
    const { data: row } = await db.from("media_assets").select("storage_path, original_path").eq("id", asset.id).eq("studio_id", asset.studio_id).single();
    if (!row?.storage_path) return analysis;
    const signed = await db.storage.from("media").createSignedUrl(row.storage_path as string, 3600);
    if (!signed.data?.signedUrl) throw new Error(signed.error?.message ?? "no signed url");
    const cleaned = await cleanSpeechInSandbox(`speech-${randomUUID()}`, signed.data.signedUrl, "video");
    if (!cleaned) return analysis;
    if (cleaned.media) {
      // A copy already (steadied) is replaced in place; the original stays in original_path either way.
      const path = row.original_path ? (row.storage_path as string) : cleanedPath(asset.studio_id, asset.id, "mp4");
      const uploaded = await db.storage.from("media").upload(path, cleaned.media, { contentType: "video/mp4", upsert: true });
      if (uploaded.error) throw new Error(uploaded.error.message);
      const swapped = await db
        .from("media_assets")
        .update({ storage_path: path, original_path: (row.original_path as string | null) ?? (row.storage_path as string), mime_type: "video/mp4" })
        .eq("id", asset.id)
        .eq("studio_id", asset.studio_id);
      if (swapped.error) throw new Error(swapped.error.message);
    }
    await db.from("cost_events").insert({
      studio_id: asset.studio_id,
      kind: "speech_clean",
      provider: "vercel_sandbox",
      units: Math.round(cleaned.seconds),
      cost_eur: sandboxCostEur(cleaned.seconds),
      meta: costMeta({ media_id: asset.id, floor: cleaned.floor, denoised: Boolean(cleaned.media) }),
    });
    // Its words timed exactly, hesitations included, then set apart: the subtitles never show « euh ».
    const scribed = await transcribeSpeech(asset.studio_id, asset.id, cleaned.wav);
    const { words, fillers } = splitFillers(scribed?.words ?? analysis.words ?? []);
    return {
      ...analysis,
      words: words.slice(0, 400),
      speech: {
        source: scribed ? "scribe" : "gemini",
        cleaned: Boolean(cleaned.media),
        floor: cleaned.floor,
        fillers: fillers.slice(0, 200),
        pauses: cleaned.pauses,
      },
    };
  } catch (error) {
    console.warn("speech not polished, the video keeps its sound", asset.id, error instanceof Error ? error.message.slice(0, 300) : error);
    return analysis;
  }
}

/**
 * Her videos analysed before speech was read (or whose reading failed): read now, and their latest
 * analysis updated. The others come back as they are.
 */
export async function ensureSpeech(studioId: string, clips: { media_id: string; analysis: ClipAnalysis }[]): Promise<{ media_id: string; analysis: ClipAnalysis }[]> {
  const db = supabaseAdmin();
  return Promise.all(
    clips.map(async (clip) => {
      if (clip.analysis.speech || !hasSpeech(clip.analysis) || clip.analysis.duration > SPEECH_MAX_SECONDS) return clip;
      const analysis = await polishSpeech({ id: clip.media_id, studio_id: studioId }, clip.analysis);
      if (!analysis.speech) return clip;
      const { data: latest } = await db.from("clip_analyses").select("id").eq("media_id", clip.media_id).eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latest?.id) await db.from("clip_analyses").update({ analysis }).eq("id", latest.id);
      return { media_id: clip.media_id, analysis };
    }),
  );
}

/**
 * Her own voice note over a Reel, cleaned once like a video's speech (a voice note recorded in a
 * noisy shop): the cleaned copy takes its place, its words keep their timing. Edith's voices are clean.
 */
export async function ensureCleanVoice(studioId: string, mediaId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("kind, source, storage_path, original_path").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!asset || asset.kind !== "audio" || asset.source === "ai" || asset.original_path || !asset.storage_path) return;
  try {
    const signed = await db.storage.from("media").createSignedUrl(asset.storage_path as string, 3600);
    if (!signed.data?.signedUrl) return;
    const cleaned = await cleanSpeechInSandbox(`voice-${randomUUID()}`, signed.data.signedUrl, "audio");
    if (!cleaned?.media) return;
    const path = cleanedPath(studioId, mediaId, "m4a");
    const uploaded = await db.storage.from("media").upload(path, cleaned.media, { contentType: "audio/mp4", upsert: true });
    if (uploaded.error) throw new Error(uploaded.error.message);
    await db.from("media_assets").update({ storage_path: path, original_path: asset.storage_path, mime_type: "audio/mp4" }).eq("id", mediaId).eq("studio_id", studioId);
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "speech_clean",
      provider: "vercel_sandbox",
      units: Math.round(cleaned.seconds),
      cost_eur: sandboxCostEur(cleaned.seconds),
      meta: costMeta({ media_id: mediaId, floor: cleaned.floor, voice_note: true }),
    });
  } catch (error) {
    console.warn("voice note not cleaned, it stays as recorded", mediaId, error instanceof Error ? error.message.slice(0, 300) : error);
  }
}
