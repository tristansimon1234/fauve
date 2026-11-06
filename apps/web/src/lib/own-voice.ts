import "server-only";
import {
  clipAnalysisSchema,
  ownTrackFilter,
  ownTrackTranscript,
  ownVoiceKey,
  ownVoicePlay,
  videoVoice,
  voiceTranscriptSchema,
  VOICE_MAX_SECONDS,
  type EditPlan,
  type SkillTalk,
  type VoiceTranscript,
} from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { ownTrackRow, videoVoicePath, videoVoiceRow } from "@/lib/own-voice-files";
import { cutVoiceInSandbox, sandboxCostEur, videoVoiceInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureSpeech } from "@/lib/video/speech";
import { ensureTranscript } from "@/lib/voice";

// Her own voice leading a model (packages/agent/src/own-voice.ts; docs/voix.md, « Sa voix mène le modèle »): her recording
// played whole on the Reel, as it is when nothing inside her words is cut, else on its own track cut once in the
// workshop (her « euh », false starts and long pauses out), kept under her studio's folder; and her voice taken from one of
// her videos where she speaks (« Sa voix tirée d'une de ses vidéos »), its sound taken once in the workshop and kept as an
// audio of hers, then exactly her voice note.

/**
 * Her recording as the Reel plays it, when her voice leads its model: whole from `at` (one piece), else its track (her
 * pieces one after the other, cut in the workshop from her cleaned copy when she has one, heard from the Reel's first
 * image), the track of the version a correction corrects kept when it plays the same (the same key). The cut's seconds
 * logged (kind voice, vercel_sandbox). Throws when the workshop fails: her voice is then laid over the model as any voice.
 */
export async function ownVoiceOnReel(p: {
  studioId: string;
  postId: string;
  /** Her recording: her voice note, or her voice taken from one of her videos. */
  source: string;
  talk: SkillTalk;
  lead: number;
  duration: number;
  previous?: Pick<EditPlan, "voice" | "voice_leads"> | null;
}): Promise<{ voice: { media_id: string; at: number }; key: string }> {
  const key = ownVoiceKey(p.source, p.talk, p.lead);
  const play = ownVoicePlay(p.talk, p.lead);
  if (!play.track) return { voice: { media_id: p.source, at: play.at }, key };
  if (p.previous?.voice && p.previous.voice_leads?.key === key) return { voice: { media_id: p.previous.voice.media_id, at: 0 }, key };
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("storage_path, transcript").eq("id", p.source).eq("studio_id", p.studioId).maybeSingle();
  if (!asset) throw new Error("her recording is gone");
  // Her cleaned copy when she has one (a noisy shop), as the render would play her note.
  const clean = voiceTranscriptSchema.safeParse(asset.transcript).data?.clean?.path;
  const path = clean?.startsWith(`${p.studioId}/`) ? clean : (asset.storage_path as string);
  const signed = await db.storage.from("media").createSignedUrl(path, 3600);
  if (!signed.data?.signedUrl) throw new Error(signed.error?.message ?? "no signed url for her recording");
  const made = await cutVoiceInSandbox(`own-${p.postId.slice(0, 8)}`, signed.data.signedUrl, ownTrackFilter(p.talk.pieces, { lead: p.lead, duration: p.duration }));
  await db.from("cost_events").insert({
    studio_id: p.studioId,
    kind: "voice",
    provider: "vercel_sandbox",
    units: Math.round(made.seconds),
    cost_eur: sandboxCostEur(made.seconds),
    meta: costMeta({ post_id: p.postId, purpose: "own_voice", pieces: p.talk.pieces.length }),
  });
  const row = ownTrackRow({ studioId: p.studioId, postId: p.postId, key, from: p.source, bytes: made.mp3.length, duration: p.duration, transcript: ownTrackTranscript(p.talk, p.lead) });
  const upload = await db.storage.from("media").upload(row.storage_path, made.mp3, { contentType: "audio/mpeg", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const inserted = await db.from("media_assets").insert(row).select("id").single();
  if (inserted.error) throw new Error(inserted.error.message);
  console.log("own voice: her track cut", p.postId, `${p.talk.pieces.length} pieces`, `${p.talk.duration} s`, key);
  return { voice: { media_id: inserted.data.id as string, at: 0 }, key };
}

/**
 * Her voice taken from one of her videos where she speaks (« prends ma voix de la vidéo où je parle »): its speech read
 * first if it was not (Scribe, the workshop), its sound from just before her first word to just after her last taken once
 * in the workshop (from its cleaned copy when it has one) and kept as an audio of hers under her studio's folder, her words
 * on it (Scribe's, read in the video, or read now), that video marked (never shown under her voice). The same video asked
 * again gives the same audio. Throws with what to tell her when nobody speaks in it or it is too long for a Reel.
 */
export async function voiceFromVideo(studioId: string, videoId: string): Promise<{ mediaId: string; transcript: VoiceTranscript }> {
  const db = supabaseAdmin();
  const { data: video } = await db.from("media_assets").select("id, kind, source, storage_path").eq("id", videoId).eq("studio_id", studioId).maybeSingle();
  if (video?.kind !== "video") throw new Error("Ce media_id n'est pas une vidéo de ce studio.");
  const path = videoVoicePath(studioId, videoId);
  // Taken once: the same video gives the same voice.
  const { data: kept } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("storage_path", path).limit(1).maybeSingle();
  if (kept?.id) {
    const transcript = await ensureTranscript(studioId, kept.id as string);
    if (transcript?.words.length) return { mediaId: kept.id as string, transcript };
  }
  const { data: row } = await db.from("clip_analyses").select("analysis").eq("media_id", videoId).eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const read = clipAnalysisSchema.safeParse(row?.analysis);
  if (!read.success) throw new Error("Cette vidéo n'est pas encore regardée : réessaie dans une minute.");
  // Her speech read precisely (her words timed by Scribe, her « euh », its cleaned copy), as for any Reel.
  const [polished] = await ensureSpeech(studioId, [{ media_id: videoId, analysis: read.data }]);
  const analysis = polished?.analysis ?? read.data;
  const span = videoVoice(analysis, videoId);
  if (!span) throw new Error("Personne ne parle dans cette vidéo : il n'y a pas de voix à prendre.");
  if (span.to - span.from > VOICE_MAX_SECONDS) throw new Error(`On parle ${Math.round(span.to - span.from)} s dans cette vidéo : ${VOICE_MAX_SECONDS} s au plus pour une voix de Reel. Demande-lui un passage plus court, ou un vocal.`);
  const source = analysis.speech?.path?.startsWith(`${studioId}/`) ? analysis.speech.path : (video.storage_path as string);
  const signed = await db.storage.from("media").createSignedUrl(source, 3600);
  if (!signed.data?.signedUrl) throw new Error(signed.error?.message ?? "no signed url for her video");
  const made = await videoVoiceInSandbox(`voice-${videoId.slice(0, 8)}`, signed.data.signedUrl, span);
  await db.from("cost_events").insert({
    studio_id: studioId,
    kind: "voice",
    provider: "vercel_sandbox",
    units: Math.round(made.seconds),
    cost_eur: sandboxCostEur(made.seconds),
    meta: costMeta({ media_id: videoId, purpose: "video_voice", seconds: Math.round((span.to - span.from) * 10) / 10 }),
  });
  // Taken from its cleaned copy: clean already, never cleaned again.
  const transcript = span.transcript && analysis.speech?.path ? { ...span.transcript, clean: { path: null, floor: analysis.speech.floor, ...(analysis.speech.isolated ? { isolated: true } : {}) } } : span.transcript;
  const asset = videoVoiceRow({ studioId, videoId, source: video.source as string, bytes: made.m4a.length, span, transcript });
  const upload = await db.storage.from("media").upload(asset.storage_path, made.m4a, { contentType: "audio/mp4", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const inserted = await db.from("media_assets").insert(asset).select("id").single();
  if (inserted.error) throw new Error(inserted.error.message);
  const id = inserted.data.id as string;
  // Its words not read in the video (an old reading): read now by Scribe, as a voice note, that video marked in them.
  const words = asset.transcript ?? (await ensureTranscript(studioId, id));
  if (!words?.words.length) throw new Error("Je n'arrive pas à lire la voix de cette vidéo : demande-lui un vocal.");
  if (!asset.transcript) await db.from("media_assets").update({ transcript: { ...words, video: { media_id: videoId, from: span.from } } }).eq("id", id).eq("studio_id", studioId);
  console.log("own voice: taken from her video", videoId, "→", id, `${span.from}–${span.to} s`);
  return { mediaId: id, transcript: { ...words, video: { media_id: videoId, from: span.from } } };
}
