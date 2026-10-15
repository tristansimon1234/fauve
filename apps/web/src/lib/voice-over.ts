import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  CLAUDE_MODEL,
  clipAnalysisSchema,
  fromTtsAlignment,
  readMemory,
  spokenWords,
  stripAudioTags,
  usdToEur,
  VOICE_MAX_SECONDS,
  VOICE_OVER_PROMPT,
  VOICE_OVER_WORDS,
  voiceOverScriptSchema,
  type VoiceOverScript,
  type VoiceTranscript,
} from "@fauve/agent";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Simone's voice over a Reel: the script she writes from what the images show,
// read by an ElevenLabs voice with the timing of every word, kept as an audio
// media of the studio (source ai, with its transcript) and put on the post
// (voice_media_id). The next montage is cut on it exactly like on the manager's
// own voice note: phrases for the cuts, word by word subtitles, music under it.

/** What the script is written from: the business, the idea, the tone and what the images show, in order. */
async function scriptInput(studioId: string, postId: string) {
  const db = supabaseAdmin();
  const [post, studio, brand] = await Promise.all([
    db.from("posts").select("title, kind, agent_note, media_ids").eq("id", postId).eq("studio_id", studioId).single(),
    db.from("studios").select("name, business_type, booking_url, memory").eq("id", studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (post.error) throw new Error("Publication introuvable");
  const ids = (post.data.media_ids as string[] | null) ?? [];
  const [media, analyses] = await Promise.all([
    ids.length ? db.from("media_assets").select("id, kind, regions").eq("studio_id", studioId).in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from("clip_analyses").select("media_id, analysis").in("media_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const read = new Map((analyses.data ?? []).map((a) => [a.media_id as string, clipAnalysisSchema.safeParse(a.analysis)]));
  const kinds = new Map((media.data ?? []).map((m) => [m.id as string, m]));
  const images = ids.flatMap((id): ({ photo: string } | { video: string; plans: string[] })[] => {
    const asset = kinds.get(id);
    if (!asset) return [];
    if (asset.kind === "image") {
      const notes = (asset.regions as { detection?: { notes?: string } } | null)?.detection?.notes;
      return notes ? [{ photo: notes }] : [];
    }
    const a = read.get(id);
    return a?.success ? [{ video: a.data.summary, plans: a.data.shots.slice(0, 6).map((s) => s.description) }] : [];
  });
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.profile ?? {});
  return {
    commerce: {
      nom: studio.data?.name ?? undefined,
      activite: studio.data?.business_type ?? undefined,
      ce_qu_on_sait: readMemory(studio.data?.memory).map((f) => f.fact),
      reservation_en_ligne: Boolean(studio.data?.booking_url),
      ton: profile.tone,
    },
    publication: { idee: post.data.title, angle: post.data.agent_note ?? undefined },
    images,
  };
}

/** Simone writes what the voice says (a creator talking over the images, not an ad). */
export async function writeVoiceScript(studioId: string, postId: string, wish?: string): Promise<VoiceOverScript> {
  const input = { ...(await scriptInput(studioId, postId)), ...(wish ? { demande: wish } : {}) };
  for (let attempt = 0; ; attempt++) {
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "medium", format: betaZodOutputFormat(voiceOverScriptSchema) },
      system: VOICE_OVER_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(studioId, response.usage, "voice_script");
    const script = response.parsed_output;
    if (!script) throw new Error("La voix off n'a pas pu être écrite");
    const words = spokenWords(script.script);
    // Too long, it would not fit in a Reel; too short, it says nothing: once more.
    if ((words >= VOICE_OVER_WORDS.min - 8 && words <= VOICE_OVER_WORDS.max + 8) || attempt >= 1) return script;
    input.publication = { ...input.publication, angle: `${input.publication.angle ?? ""} La version précédente faisait ${words} mots : vise ${VOICE_OVER_WORDS.min} à ${VOICE_OVER_WORDS.max}.`.trim() };
  }
}

/** The models tried in turn: the one configured, then older ones whose word timings are documented. */
const fallbackModels = () => [...new Set([env("ELEVENLABS_TTS_MODEL"), "eleven_v3", "eleven_multilingual_v2"])];

/** ElevenLabs reads the script: the audio and the time of every word. */
export async function speak(text: string, voiceId = env("ELEVENLABS_VOICE_ID")): Promise<{ mp3: Buffer; transcript: VoiceTranscript; model: string; voiceId: string }> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  let failure = "";
  for (const model of fallbackModels()) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      // Multilingual v2 finds the language itself (it refuses language_code) and would read the acting tags aloud.
      body: JSON.stringify(model === "eleven_multilingual_v2" ? { text: stripAudioTags(text), model_id: model } : { text, model_id: model, language_code: "fr" }),
    });
    if (res.ok) {
      const body = (await res.json()) as { audio_base64?: string; alignment?: unknown; normalized_alignment?: unknown };
      if (!body.audio_base64 || !(body.alignment ?? body.normalized_alignment)) {
        failure = `${model}: no audio or no timings`;
        continue;
      }
      return { mp3: Buffer.from(body.audio_base64, "base64"), transcript: fromTtsAlignment(body.alignment ?? body.normalized_alignment, text), model, voiceId };
    }
    failure = `${model} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    // Only a model this endpoint refuses is worth another try; a bad key or a busy service is not.
    if (res.status !== 400 && res.status !== 422) break;
    console.warn("text to speech: model refused, trying the next one", failure);
  }
  throw new Error(`ElevenLabs text to speech ${failure}`);
}

/**
 * Simone's voice on a Reel: the script, the voice, kept as an audio media with its
 * words, set on the post. The next montage of the post is cut on it.
 */
export async function makeVoiceOver(params: { studioId: string; postId: string; wish?: string; voiceId?: string }): Promise<{ mediaId: string; script: string; seconds: number }> {
  const db = supabaseAdmin();
  const script = await writeVoiceScript(params.studioId, params.postId, params.wish);
  const started = Date.now();
  const voice = await speak(script.script, params.voiceId);
  if (voice.transcript.duration > VOICE_MAX_SECONDS) throw new Error(`Voix trop longue (${voice.transcript.duration} s)`);
  const path = `${params.studioId}/voice/${params.postId}-${Date.now()}.mp3`;
  const upload = await db.storage.from("media").upload(path, voice.mp3, { contentType: "audio/mpeg", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({
      studio_id: params.studioId,
      storage_path: path,
      kind: "audio",
      source: "ai",
      mime_type: "audio/mpeg",
      size_bytes: voice.mp3.length,
      duration: voice.transcript.duration,
      transcript: voice.transcript,
      ai: { mode: "voice", voice_id: voice.voiceId, model: voice.model },
      consent_ok: true,
    })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  await Promise.all([
    db.from("posts").update({ voice_media_id: asset.data.id }).eq("id", params.postId).eq("studio_id", params.studioId),
    // Billed by the character, in dollars.
    db.from("cost_events").insert({
      studio_id: params.studioId,
      kind: "voice",
      provider: "elevenlabs",
      units: script.script.length,
      cost_eur: usdToEur((script.script.length / 1000) * env("ELEVENLABS_TTS_USD_PER_KCHAR"), env("USD_TO_EUR")),
      meta: { post_id: params.postId, model: voice.model, voice_id: voice.voiceId, seconds: voice.transcript.duration, ms: Date.now() - started },
    }),
  ]);
  return { mediaId: asset.data.id as string, script: script.script, seconds: voice.transcript.duration };
}
