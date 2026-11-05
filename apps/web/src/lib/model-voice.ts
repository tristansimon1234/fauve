import "server-only";
import {
  editPlanSchema,
  isBaked,
  modelVoiceChoice,
  readingVoice,
  readOwnVoice,
  readPostVoice,
  readVoiceSetting,
  saidKey,
  saidVoiceName,
  sayWords,
  skillSaysOn,
  usdToEur,
  type CopiedVoice,
  type EditPlan,
  type MontageSkill,
  type ReelContract,
  type SaidCue,
} from "@fauve/agent";
import { skillFor } from "@fauve/agent/skills";
import { costMeta } from "@/lib/cost-scope";
import { insertPlanVersion } from "@/lib/edit-plans";
import { env } from "@/lib/env";
import { readPostMusic } from "@/lib/render/music";
import { sandboxCostEur, sayWordsInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A model whose words are what its voice says (« Celui-là, celui-là… »; docs/voix.md, « La voix dit les mots du modèle »):
// the voice chosen for her Reel, its words read once by ElevenLabs (the same reading as Edith's voice-overs, `speak`),
// cut out of that reading and laid at their moments on one track in the workshop (packages/agent/src/model-voice.ts),
// kept as an audio of hers (source ai, its words on the Reel's clock) and set as the plan's voice, subtitles off. Made
// when her Reel is designed (designSkill), kept by a correction that says the same, made again at the render when her
// words were changed by hand or another voice was asked (« le user peut changer de voix »). Never fails a montage.

/** Her business's voice settings and her own voice (a clone), from her latest brand profile. */
async function voiceSettings(studioId: string) {
  const { data } = await supabaseAdmin().from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle();
  const profile = (data?.profile ?? {}) as { voice?: unknown; own_voice?: unknown };
  return { setting: readVoiceSetting(profile.voice), own: readOwnVoice(profile.own_voice) };
}

/**
 * The voice that says a model's words on her Reel (modelVoiceChoice): this Reel's choice, her business's, her own voice,
 * the gender she asked; none under a voice of hers laid over it (`laid`), on a Reel that keeps the sound of the Reel it
 * copies, or one copied from a Reel without a voice (`copied`). Null: no voice.
 */
export async function modelVoiceFor(params: {
  studioId: string;
  postId: string;
  skill: Pick<MontageSkill, "saysWords">;
  contract?: ReelContract;
  laid?: boolean;
  copied?: CopiedVoice;
}): Promise<string | null> {
  if (!params.skill.saysWords || params.laid || !env("ELEVENLABS_API_KEY")) return null;
  const db = supabaseAdmin();
  const [post, { setting, own }] = await Promise.all([
    db.from("posts").select("kind, voice_over, music").eq("id", params.postId).eq("studio_id", params.studioId).maybeSingle(),
    voiceSettings(params.studioId),
  ]);
  if (post.data?.kind !== "reel") return null;
  return modelVoiceChoice({
    says: params.skill.saysWords,
    post: readPostVoice(post.data.voice_over),
    studio: setting,
    own,
    gender: params.contract?.voice_gender,
    keptSound: readPostMusic(post.data.music).mode === "model",
    ...(params.copied ? { copied: params.copied } : {}),
  });
}

/**
 * The voice saying a model's words on her plan: its words and their moments read on the plan (skillSaysOn); the track of
 * the version it corrects kept when it says the same with the same voice (a correction keeps the voice and its words but
 * what her request changes), else made now. Null when there is nothing to say (no word, its cut no longer its model's).
 */
export async function sayModelWords(params: {
  studioId: string;
  postId: string;
  skill: MontageSkill;
  plan: EditPlan;
  voiceId: string;
  previous?: EditPlan | null;
}): Promise<Pick<EditPlan, "voice" | "says_words"> | null> {
  const cues = skillSaysOn(params.skill, params.plan);
  if (!cues?.length) return null;
  const key = saidKey(params.voiceId, cues);
  const before = params.previous;
  if (before?.voice && before.says_words?.key === key && before.says_words.voice_id === params.voiceId) {
    return { voice: { media_id: before.voice.media_id, at: 0 }, says_words: before.says_words };
  }
  const made = await makeSaidTrack({ studioId: params.studioId, postId: params.postId, cues, voiceId: params.voiceId, duration: params.plan.duration, key });
  return { voice: { media_id: made.mediaId, at: 0 }, says_words: { voice_id: params.voiceId, key } };
}

/**
 * At the render: the voice of a model that says its words, made again when it no longer says what its plan shows (her
 * words changed by hand in « Modifier »), or when it has no track yet (another voice asked), with the voice its plan names
 * while it is hers to use (readingVoice: a voice of the gallery or her own clone, else Edith's default). Null when it is
 * up to date, or when the plan no longer follows its model's timeline (another version, its cut changed): kept as it is.
 */
export async function refreshModelWords(studioId: string, postId: string, plan: EditPlan): Promise<Pick<EditPlan, "voice" | "says_words"> | null> {
  if (!plan.says_words || isBaked(plan)) return null;
  const skill = skillFor(plan.skill?.key);
  const cues = skill ? skillSaysOn(skill, plan) : null;
  if (!cues?.length) return null;
  const { own } = await voiceSettings(studioId);
  const voiceId = readingVoice(plan.says_words.voice_id, own);
  const key = saidKey(voiceId, cues);
  if (plan.voice && plan.says_words.key === key) return null;
  if (!env("ELEVENLABS_API_KEY")) return null;
  const made = await makeSaidTrack({ studioId, postId, cues, voiceId, duration: plan.duration, key });
  console.log("said words: made again for the render", postId, plan.says_words.key ?? "(no track)", "→", key);
  return { voice: { media_id: made.mediaId, at: 0 }, says_words: { voice_id: voiceId, key } };
}

/**
 * Another voice for a Reel whose model says its words, or its voice back after « Sans voix » (Tristan: « le user peut
 * changer de voix »): a new version of its plan naming that voice (this Reel's choice, else her business's, else Edith's
 * default), its track made at the render; her choice kept on the post for its next corrections. Free, the video made
 * again. Null when it is not such a Reel (her own voice note on it, a Reel of the chain, another model): the usual way.
 */
export async function revoiceModelWords(studioId: string, postId: string, voiceId?: string): Promise<{ voiceId: string; name: string | null } | null> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("kind, edit_plan_id, voice_media_id, voice_over").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (post?.kind !== "reel" || !post.edit_plan_id) return null;
  // Her own voice note on it speaks instead (the usual way takes it off first).
  if (post.voice_media_id) {
    const { data: note } = await db.from("media_assets").select("source").eq("id", post.voice_media_id as string).maybeSingle();
    if (note && note.source !== "ai") return null;
  }
  const { data: row } = await db.from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).maybeSingle();
  const plan = editPlanSchema.safeParse(row?.plan);
  if (!plan.success || isBaked(plan.data)) return null;
  const skill = skillFor(plan.data.skill?.key);
  if (!skill?.saysWords || !skillSaysOn(skill, plan.data)?.length) return null;
  // A voice laid over it that is not its words (Edith's voice from her words to say): the usual way.
  if (plan.data.voice && !plan.data.says_words) return null;
  const { setting, own } = await voiceSettings(studioId);
  const chosen = readingVoice(voiceId ?? readPostVoice(post.voice_over)?.voice_id ?? setting.voice_id, own);
  // Its track made at the render, with that voice.
  const next: EditPlan = { ...plan.data, subtitles: false, says_words: { voice_id: chosen } };
  delete next.voice;
  const saved = await insertPlanVersion(studioId, postId, next);
  await db
    .from("posts")
    .update({ edit_plan_id: saved.id, voice_over: { mode: "on", voice_id: chosen } })
    .eq("id", postId)
    .eq("studio_id", studioId);
  return { voiceId: chosen, name: saidVoiceName(chosen, own?.id) };
}

/** The voice saying a model's words on a version of her Reel, by its name (« Eva », « ta voix »), for its delivery and its page; null: none. */
export async function saidVoiceOf(studioId: string, planId: string): Promise<{ id: string; name: string | null } | null> {
  const { data } = await supabaseAdmin().from("edit_plans").select("plan->says_words").eq("id", planId).eq("studio_id", studioId).maybeSingle();
  const said = (data as { says_words?: { voice_id?: unknown } } | null)?.says_words;
  if (typeof said?.voice_id !== "string") return null;
  const { own } = await voiceSettings(studioId);
  return { id: said.voice_id, name: saidVoiceName(said.voice_id, own?.id) };
}

/**
 * A model's words said (sayWords): read once by ElevenLabs with the voice (`speak`, as Edith's voice-overs), laid in the
 * workshop, kept under her studio's folder as an audio of hers (source ai, its words on the Reel's clock, retained while
 * its Reel needs it: expired_media), each cost logged for this montage (kind voice: the reading, the workshop's seconds).
 */
async function makeSaidTrack(p: { studioId: string; postId: string; cues: SaidCue[]; voiceId: string; duration: number; key: string }): Promise<{ mediaId: string }> {
  // (Loaded when used: lib/voice-over reads the model a voice is laid on, which designs it with this.)
  const { speak } = await import("@/lib/voice-over");
  const db = supabaseAdmin();
  const made = await sayWords(
    {
      speak: (text, voiceId) => speak(text, voiceId),
      lay: (reading, compose) => sayWordsInSandbox(`said-${p.postId.slice(0, 8)}`, Buffer.from(reading), compose),
      cost: async (row) => {
        const { error } = await db.from("cost_events").insert({ studio_id: p.studioId, ...row, meta: costMeta({ post_id: p.postId, ...row.meta }) });
        if (error) console.warn("said words: cost not logged", p.postId, error.message);
      },
      keep: async (track) => {
        const path = `${p.studioId}/voice/${p.postId}-mots-${Date.now()}.mp3`;
        const upload = await db.storage.from("media").upload(path, track.mp3, { contentType: "audio/mpeg", upsert: true });
        if (upload.error) throw new Error(upload.error.message);
        const asset = await db
          .from("media_assets")
          .insert({ studio_id: p.studioId, storage_path: path, kind: "audio", source: "ai", mime_type: "audio/mpeg", size_bytes: track.mp3.length, duration: p.duration, transcript: track.transcript, ai: track.ai, consent_ok: true })
          .select("id")
          .single();
        if (asset.error) throw new Error(asset.error.message);
        return asset.data.id as string;
      },
    },
    {
      cues: p.cues,
      voiceId: p.voiceId,
      duration: p.duration,
      key: p.key,
      // Billed by the character, in dollars, like every voice; the workshop by its seconds.
      prices: { usdPerKchar: env("ELEVENLABS_TTS_USD_PER_KCHAR"), eur: (usd) => usdToEur(usd, env("USD_TO_EUR")), sandboxEur: sandboxCostEur },
    },
  );
  console.log("said words: laid", p.postId, made.laid.map((w) => `« ${w.text} » ${w.at} s${w.speed !== 1 ? ` ×${w.speed}` : ""}${w.cut ? " (shortened)" : ""}`).join(", "));
  return { mediaId: made.mediaId };
}
