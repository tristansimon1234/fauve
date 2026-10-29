import "server-only";
import { randomUUID } from "node:crypto";
import { hasSpeech, SPEECH_MAX_SECONDS, splitFillers, voiceTranscriptSchema, type ClipAnalysis, type ClipSpeech } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { cleanSpeechInSandbox, sandboxCostEur, type CleanedSpeech } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcribeSpeech } from "@/lib/voice";

// Someone speaking in her video (speech.ts in @fauve/agent): its sound cleaned once, when it was
// noisy, into a copy beside the video (the video keeps its sound as recorded: a Reel can take either,
// finish.sound), its words timed exactly by Scribe with its hesitations apart, and its pauses measured;
// the engine then cuts the « euh » and the long silences out of every Reel. Never fails an analysis:
// without it, the words stay Gemini's.

/** Where the copy of a video (mp4) or of a voice note (m4a) with its sound cleaned is kept, beside it. */
export const cleanedPath = (studioId: string, mediaId: string, ext: "mp4" | "m4a") => `${studioId}/clean/${mediaId}.${ext}`;

/** Both possible cleaned copies of a media: they go with it (retention, deletion). */
export const cleanedPaths = (studioId: string, mediaId: string) => [cleanedPath(studioId, mediaId, "mp4"), cleanedPath(studioId, mediaId, "m4a")];

/** Its sound cleaned in the sandbox, the cleaned copy kept beside it (when the denoiser ran), the work logged. */
async function cleanCopy(
  asset: { id: string; studio_id: string },
  kind: "video" | "audio",
  force: boolean,
): Promise<{ cleaned: CleanedSpeech; path: string | null } | null> {
  const db = supabaseAdmin();
  // The file as it is now (a shaky video was just steadied: its steady copy is the one cleaned).
  const { data: row } = await db.from("media_assets").select("storage_path").eq("id", asset.id).eq("studio_id", asset.studio_id).single();
  if (!row?.storage_path) return null;
  const signed = await db.storage.from("media").createSignedUrl(row.storage_path as string, 3600);
  if (!signed.data?.signedUrl) throw new Error(signed.error?.message ?? "no signed url");
  const cleaned = await cleanSpeechInSandbox(`speech-${randomUUID()}`, signed.data.signedUrl, kind, { force });
  if (!cleaned) return null;
  let path: string | null = null;
  if (cleaned.media) {
    path = cleanedPath(asset.studio_id, asset.id, kind === "video" ? "mp4" : "m4a");
    const uploaded = await db.storage.from("media").upload(path, cleaned.media, { contentType: kind === "video" ? "video/mp4" : "audio/mp4", upsert: true });
    if (uploaded.error) throw new Error(uploaded.error.message);
  }
  await db.from("cost_events").insert({
    studio_id: asset.studio_id,
    kind: "speech_clean",
    provider: "vercel_sandbox",
    units: Math.round(cleaned.seconds),
    cost_eur: sandboxCostEur(cleaned.seconds),
    meta: costMeta({ media_id: asset.id, floor: cleaned.floor, denoised: Boolean(path), forced: force, ...(kind === "audio" ? { voice_note: true } : {}) }),
  });
  return { cleaned, path };
}

/**
 * The analysis with her speech read precisely (`speech`, and Scribe's words without the hesitations);
 * unchanged when nobody speaks, when it is too long, or when the reading fails. `force`: the sound
 * cleaned even when it is not noisy (she asked for it).
 */
export async function polishSpeech(asset: { id: string; studio_id: string }, analysis: ClipAnalysis, options: { force?: boolean } = {}): Promise<ClipAnalysis> {
  if (analysis.speech || !hasSpeech(analysis) || analysis.duration > SPEECH_MAX_SECONDS) return analysis;
  try {
    const copy = await cleanCopy(asset, "video", Boolean(options.force));
    if (!copy) return analysis;
    // Its words timed exactly, hesitations included, then set apart: the subtitles never show « euh ».
    const scribed = await transcribeSpeech(asset.studio_id, asset.id, copy.cleaned.wav);
    const { words, fillers } = splitFillers(scribed?.words ?? analysis.words ?? []);
    const speech: ClipSpeech = {
      source: scribed ? "scribe" : "gemini",
      cleaned: Boolean(copy.path),
      floor: copy.cleaned.floor,
      fillers: fillers.slice(0, 200),
      pauses: copy.cleaned.pauses,
      ...(copy.path ? { path: copy.path } : {}),
    };
    return { ...analysis, words: words.slice(0, 400), speech };
  } catch (error) {
    console.warn("speech not polished, the video keeps its sound", asset.id, error instanceof Error ? error.message.slice(0, 300) : error);
    return analysis;
  }
}

/** Updates the latest analysis of a clip (its speech read since). */
async function keepAnalysis(studioId: string, mediaId: string, analysis: ClipAnalysis): Promise<void> {
  const db = supabaseAdmin();
  const { data: latest } = await db.from("clip_analyses").select("id").eq("media_id", mediaId).eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (latest?.id) await db.from("clip_analyses").update({ analysis }).eq("id", latest.id);
}

/**
 * Her videos analysed before speech was read (or whose reading failed): read now, and their latest
 * analysis updated. The others come back as they are.
 */
export async function ensureSpeech(studioId: string, clips: { media_id: string; analysis: ClipAnalysis }[]): Promise<{ media_id: string; analysis: ClipAnalysis }[]> {
  return Promise.all(
    clips.map(async (clip) => {
      if (clip.analysis.speech || !hasSpeech(clip.analysis) || clip.analysis.duration > SPEECH_MAX_SECONDS) return clip;
      const analysis = await polishSpeech({ id: clip.media_id, studio_id: studioId }, clip.analysis);
      if (!analysis.speech) return clip;
      await keepAnalysis(studioId, clip.media_id, analysis);
      return { media_id: clip.media_id, analysis };
    }),
  );
}

/**
 * She wants the sound cleaned (finish.sound « clean »): every video of the Reel where someone speaks gets
 * its cleaned copy, even one that was not noisy, and her voice note too. Never fails a render.
 */
export async function ensureCleanCopies(studioId: string, mediaIds: string[], voiceId?: string | null): Promise<void> {
  const db = supabaseAdmin();
  const { data: rows } = mediaIds.length
    ? await db.from("clip_analyses").select("media_id, analysis").in("media_id", mediaIds).eq("studio_id", studioId).order("created_at", { ascending: false })
    : { data: [] as { media_id: string; analysis: unknown }[] };
  const seen = new Set<string>();
  await Promise.all([
    ...(rows ?? []).map(async (row) => {
      if (seen.has(row.media_id as string)) return;
      seen.add(row.media_id as string);
      const analysis = row.analysis as ClipAnalysis;
      if (!hasSpeech(analysis) || analysis.duration > SPEECH_MAX_SECONDS || analysis.speech?.path) return;
      try {
        // Read already: only its cleaned copy is made; never read: read now, cleaned.
        if (!analysis.speech) {
          const polished = await polishSpeech({ id: row.media_id as string, studio_id: studioId }, analysis, { force: true });
          if (polished.speech) await keepAnalysis(studioId, row.media_id as string, polished);
          return;
        }
        const copy = await cleanCopy({ id: row.media_id as string, studio_id: studioId }, "video", true);
        if (copy?.path) await keepAnalysis(studioId, row.media_id as string, { ...analysis, speech: { ...analysis.speech, cleaned: true, path: copy.path } });
      } catch (error) {
        console.warn("sound not cleaned on demand", row.media_id, error instanceof Error ? error.message.slice(0, 300) : error);
      }
    }),
    ...(voiceId ? [ensureCleanVoice(studioId, voiceId, { force: true })] : []),
  ]);
}

/**
 * Her own voice note over a Reel, cleaned once like a video's speech (a voice note recorded in a
 * noisy shop) into a copy beside it, kept with its transcript (`clean`); the note stays as recorded,
 * its words keep their timing. Edith's voices are clean. `force`: cleaned even when it was not noisy.
 */
export async function ensureCleanVoice(studioId: string, mediaId: string, options: { force?: boolean } = {}): Promise<void> {
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("kind, source, transcript").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!asset || asset.kind !== "audio" || asset.source === "ai") return;
  const transcript = voiceTranscriptSchema.safeParse(asset.transcript);
  // Read first (its words): the copy is noted on its transcript.
  if (!transcript.success) return;
  const done = transcript.data.clean;
  if (done && (done.path || !options.force)) return;
  try {
    const copy = await cleanCopy({ id: mediaId, studio_id: studioId }, "audio", Boolean(options.force));
    if (!copy) return;
    await db
      .from("media_assets")
      .update({ transcript: { ...transcript.data, clean: { path: copy.path, floor: copy.cleaned.floor } } })
      .eq("id", mediaId)
      .eq("studio_id", studioId);
  } catch (error) {
    console.warn("voice note not cleaned, it stays as recorded", mediaId, error instanceof Error ? error.message.slice(0, 300) : error);
  }
}
