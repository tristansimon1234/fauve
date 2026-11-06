import type { VoiceTranscript } from "@fauve/agent";

// Her own voice's files (own-voice.ts in @fauve/agent; docs/voix.md, « Sa voix mène le modèle » and « Sa voix tirée
// d'une de ses vidéos »): where they are kept and what they are, as their media_assets rows. Pure (no server import), so
// that node --test reads it. Both under her studio's folder ({studio}/voice/: deleting a studio removes them), both hers
// (never source ai: her own voice, never one of Edith's), kept while a publication needs them (expired_media keeps the
// voice a post or its plan names, docs/medias.md).

/** Her voice taken from one of her videos where she speaks: one file per video, found again by its path (taken once). */
export const videoVoicePath = (studioId: string, videoId: string) => `${studioId}/voice/video-${videoId}.m4a`;

/** Her voice cut for a model it leads (her « euh » and long pauses out): one file per cut, its key in its name. */
export const ownTrackPath = (studioId: string, postId: string, key: string) => `${studioId}/voice/${postId}-ta-voix-${key}.mp3`;

/** A media_assets row of her voice, as inserted. */
export type VoiceAssetRow = {
  studio_id: string;
  storage_path: string;
  kind: "audio";
  source: string;
  mime_type: string;
  size_bytes: number;
  duration: number;
  transcript: VoiceTranscript | null;
  ai?: Record<string, unknown>;
  consent_ok: true;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Her voice taken from one of her videos: an audio of hers with the video's own source (WhatsApp, the app: she sent it),
 * the length of the part where she speaks, its words when Scribe had read them in the video already (that video marked
 * in them: never shown under her voice), else none (Scribe reads it at its first use, as a voice note).
 */
export function videoVoiceRow(p: { studioId: string; videoId: string; source: string; bytes: number; span: { from: number; to: number }; transcript: VoiceTranscript | null }): VoiceAssetRow {
  return {
    studio_id: p.studioId,
    storage_path: videoVoicePath(p.studioId, p.videoId),
    kind: "audio",
    // Hers, as she sent the video (never Edith's): a montage then lays it as her own voice note; kept as her files are.
    source: p.source === "whatsapp" ? "whatsapp" : "web_upload",
    mime_type: "audio/mp4",
    size_bytes: p.bytes,
    duration: round(Math.max(0, p.span.to - p.span.from)),
    transcript: p.transcript ? { ...p.transcript, video: { media_id: p.videoId, from: round(p.span.from) } } : null,
    consent_ok: true,
  };
}

/**
 * Her voice's track for a model it leads: made by the engine from her recording (source render: never in her library nor
 * Edith's list of her files), its words on the Reel's clock, what it was cut from and its key (plan.voice_leads).
 */
export function ownTrackRow(p: { studioId: string; postId: string; key: string; from: string; bytes: number; duration: number; transcript: VoiceTranscript }): VoiceAssetRow {
  return {
    studio_id: p.studioId,
    storage_path: ownTrackPath(p.studioId, p.postId, p.key),
    kind: "audio",
    source: "render",
    mime_type: "audio/mpeg",
    size_bytes: p.bytes,
    duration: round(p.duration),
    transcript: p.transcript,
    ai: { mode: "own_voice", from: p.from, key: p.key },
    consent_ok: true,
  };
}
