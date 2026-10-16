import "server-only";
import { fromScribe, transcriptionCostUsd, usdToEur, voiceTranscriptSchema, type VoiceTranscript } from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her voice notes (WhatsApp or the app), transcribed once by ElevenLabs Scribe:
// the text for Simone (she understands vocal messages) and every word with its
// timing for a Reel over her voice (cuts on her phrases, subtitles). Kept in
// media_assets.transcript; a few tenths of a cent per note.

/** Notes longer than this are not transcribed (a voice note, not a podcast). */
const MAX_BYTES = 25 * 1024 * 1024;

/** The transcript of a voice note, made once; null without the service, or when it fails. */
export async function ensureTranscript(studioId: string, mediaId: string): Promise<VoiceTranscript | null> {
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("id, kind, storage_path, mime_type, size_bytes, transcript").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!asset || asset.kind !== "audio") return null;
  const kept = voiceTranscriptSchema.safeParse(asset.transcript);
  if (kept.success) return kept.data;
  const key = env("ELEVENLABS_API_KEY");
  if (!key || ((asset.size_bytes as number | null) ?? 0) > MAX_BYTES) return null;

  try {
    const file = await db.storage.from("media").download(asset.storage_path as string);
    if (file.error || !file.data) throw new Error(file.error?.message ?? "download failed");
    const form = new FormData();
    form.append("model_id", env("ELEVENLABS_STT_MODEL"));
    // Named like its file (« ….ogg »): the format is told by its extension too.
    const name = (asset.storage_path as string).split("/").pop() || "note.ogg";
    form.append("file", new Blob([await file.data.arrayBuffer()], { type: (asset.mime_type as string | null) ?? "audio/ogg" }), name);
    form.append("timestamps_granularity", "word");
    form.append("tag_audio_events", "false");
    const started = Date.now();
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: form });
    if (!res.ok) throw new Error(`ElevenLabs speech to text ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const transcript = fromScribe(await res.json());
    await Promise.all([
      db.from("media_assets").update({ transcript, duration: transcript.duration || null }).eq("id", mediaId),
      // Billed by the hour of audio.
      db.from("cost_events").insert({
        studio_id: studioId,
        kind: "transcription",
        provider: "elevenlabs",
        units: transcript.duration,
        cost_eur: usdToEur(transcriptionCostUsd(transcript.duration), env("USD_TO_EUR")),
        meta: { media_id: mediaId, model: env("ELEVENLABS_STT_MODEL"), purpose: "transcription", ms: Date.now() - started },
      }),
    ]);
    return transcript;
  } catch (error) {
    console.error("voice note transcription failed", mediaId, error);
    return null;
  }
}
