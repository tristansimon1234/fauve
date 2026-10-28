import "server-only";
import { DEFAULT_VOICE_ID, readOwnVoice, readVoiceSetting, usdToEur, type OwnVoice } from "@fauve/agent";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { costMeta } from "@/lib/cost-scope";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { levelSpeech, speak } from "@/lib/voice-over";

// Her own voice on her Reels (Style › Voix off › « Ta voix »): a minute or so she records
// or sends, cloned by ElevenLabs (instant voice cloning, POST /v1/voices/add), with her
// consent. The recordings are deleted once the clone exists; what stays is the voice in
// the ElevenLabs account, its id in her brand profile (own_voice) and a sample to hear it.
// Deleting it (or the studio) deletes the voice from ElevenLabs too.

/** What her clone reads to be heard in Style: words for any business. */
const SAMPLE = "Tu vois ce geste ? Je le refais chaque jour, et je ne m'en lasse pas. Ici, tout est fait sur place, avec soin. Passe me voir cette semaine, je t'attends.";

/** Her clone, read from the latest brand profile; null when she has none. */
export async function ownVoiceOf(studioId: string): Promise<OwnVoice | null> {
  const { data } = await supabaseAdmin()
    .from("brand_profiles")
    .select("profile")
    .eq("studio_id", studioId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return readOwnVoice((data?.profile as { own_voice?: unknown } | null)?.own_voice);
}

const extensionOf = (path: string) => path.split(".").pop()?.toLowerCase() ?? "webm";
const MIME: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav", aac: "audio/aac", flac: "audio/flac" };

/**
 * Clones her voice from the recordings the browser uploaded to `{studio}/voice-clone/`
 * (checked by the caller), makes its sample, keeps it in her brand profile, then deletes
 * the recordings. A clone she had before is replaced (and deleted from ElevenLabs).
 */
export async function cloneOwnVoice(studioId: string, name: string, paths: string[]): Promise<OwnVoice> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const db = supabaseAdmin();
  const form = new FormData();
  form.append("name", `${name} · ${studioId.slice(0, 8)}`);
  form.append("description", "Sa propre voix, clonée avec son accord pour ses Reels (Edith).");
  form.append("remove_background_noise", "true");
  form.append("labels", JSON.stringify({ language: "fr", studio: studioId }));
  for (const path of paths) {
    const file = await db.storage.from("media").download(path);
    if (file.error || !file.data) throw new Error(`download ${path}: ${file.error?.message}`);
    const ext = extensionOf(path);
    form.append("files", new Blob([await file.data.arrayBuffer()], { type: MIME[ext] ?? "audio/webm" }), `voix-${form.getAll("files").length + 1}.${ext}`);
  }
  const started = Date.now();
  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key }, body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`ElevenLabs voices/add ${res.status}: ${text.slice(0, 300)}`);
  const voiceId = (JSON.parse(text) as { voice_id?: string }).voice_id;
  if (!voiceId) throw new Error("ElevenLabs voices/add: no voice_id");

  // Her clone heard in Style: a few sentences, at the level of a voice in a Reel.
  let samplePath: string | undefined;
  try {
    const read = await speak(SAMPLE, voiceId);
    const leveled = await levelSpeech(`own-voice-${studioId}`, read.mp3);
    samplePath = `${studioId}/voice-clone/sample-${Date.now()}.mp3`;
    const up = await db.storage.from("media").upload(samplePath, leveled.mp3, { contentType: "audio/mpeg", upsert: true });
    if (up.error) samplePath = undefined;
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "voice",
      provider: "elevenlabs",
      units: SAMPLE.length,
      cost_eur: usdToEur((SAMPLE.length / 1000) * env("ELEVENLABS_TTS_USD_PER_KCHAR"), env("USD_TO_EUR")),
      meta: costMeta({ purpose: "own_voice_sample", voice_id: voiceId, ms: Date.now() - started }),
    });
  } catch (error) {
    console.warn("own voice sample failed", studioId, error);
  }

  const own: OwnVoice = { id: voiceId, name, ...(samplePath ? { sample_path: samplePath } : {}), made_at: new Date().toISOString() };
  const before = await ownVoiceOf(studioId);
  // She cloned it to hear it: it becomes the voice of her Reels (another one is chosen in Style).
  await insertProfileVersion(studioId, (current) => ({ ...current, own_voice: own, voice: { ...readVoiceSetting(current.voice), voice_id: voiceId } }));
  // Her recordings served their purpose; a former clone and its sample go.
  await db.storage.from("media").remove([...paths, ...(before?.sample_path ? [before.sample_path] : [])]);
  if (before) await deleteFromElevenLabs(before.id);
  return own;
}

async function deleteFromElevenLabs(voiceId: string): Promise<void> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) return;
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE", headers: { "xi-api-key": key } }).catch(() => null);
  if (res && !res.ok && res.status !== 404) console.warn("own voice not deleted from ElevenLabs", voiceId, res.status, (await res.text().catch(() => "")).slice(0, 200));
}

/**
 * Forgets her voice: deleted from ElevenLabs, its sample deleted, gone from her brand profile;
 * a setting that used it goes back to the default voice. With `keepProfile` (a studio being
 * deleted), only ElevenLabs and the files.
 */
export async function forgetOwnVoice(studioId: string, opts: { keepProfile?: boolean } = {}): Promise<boolean> {
  const own = await ownVoiceOf(studioId);
  if (!own) return false;
  await deleteFromElevenLabs(own.id);
  if (own.sample_path) await supabaseAdmin().storage.from("media").remove([own.sample_path]);
  if (!opts.keepProfile) {
    await insertProfileVersion(studioId, (current) => {
      const next: Record<string, unknown> = { ...current };
      delete next.own_voice;
      const voice = readVoiceSetting(current.voice);
      if (voice.voice_id === own.id) next.voice = { ...voice, voice_id: DEFAULT_VOICE_ID };
      return next;
    });
  }
  return true;
}
