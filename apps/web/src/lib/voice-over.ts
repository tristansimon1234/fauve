import "server-only";
import {
  brandProfileSchema,
  CHAT_MODEL,
  CLAUDE_MODEL,
  contractIsEmpty,
  contractLines,
  clipAnalysisSchema,
  DEFAULT_VOICE_ID,
  editPlanSchema,
  findVoice,
  fromTtsAlignment,
  isBaked,
  openingCandidates,
  OWN_TEXT_PROMPT,
  ownTextKey,
  ownTextSchema,
  SIMONE_VOICES,
  VOICE_SPEED,
  verbatimScript,
  scriptFrom,
  readPostVoice,
  readVoiceSetting,
  sentencePauses,
  voiceLeftToSimone,
  wantsVoiceOver,
  withPauses,
  memoryLines,
  spokenWords,
  stripAudioTags,
  usdToEur,
  VOICE_MAX_SECONDS,
  VOICE_FORMAT_PROMPT,
  VOICE_OVER_PROMPT,
  voiceWordsFor,
  voiceOverDecisionSchema,
  voiceOverScriptSchema,
  type ReelContract,
  type ReelFormat,
  type VoiceOverDecision,
  type VoiceOverDraft,
  type VoiceOverScript,
  type VoiceTranscript,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { judgeHooks } from "@/lib/agent/hook-judge";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { env } from "@/lib/env";
import { levelSpeechInSandbox } from "@/lib/render/sandbox";
import { postStyle, STEAL_WAIT_MS } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";

// Simone's voice over a Reel: the script she writes from what the images show,
// read by an ElevenLabs voice with the timing of every word, kept as an audio
// media of the studio (source ai, with its transcript) and put on the post
// (voice_media_id). The next montage is cut on it exactly like on the manager's
// own voice note: phrases for the cuts, word by word subtitles, music under it.

/** What the script is written from: the business, the idea and her request, the tone and what the images show, in order. */
async function scriptInput(studioId: string, postId: string, mediaIds?: string[], brief?: string) {
  const db = supabaseAdmin();
  const [post, studio, brand, recent] = await Promise.all([
    db.from("posts").select("title, kind, agent_note, media_ids").eq("id", postId).eq("studio_id", studioId).single(),
    db.from("studios").select("name, business_type, booking_url, memory").eq("id", studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    // Its last voices, so a new one never takes the same hook, build or turns of phrase.
    db.from("media_assets").select("transcript").eq("studio_id", studioId).eq("kind", "audio").eq("source", "ai").order("created_at", { ascending: false }).limit(3),
  ]);
  if (post.error) throw new Error("Publication introuvable");
  const recentVoices = (recent.data ?? []).flatMap((r) => {
    const text = (r.transcript as { text?: string } | null)?.text?.trim();
    return text ? [text.slice(0, 400)] : [];
  });
  const ids = mediaIds?.length ? mediaIds : ((post.data.media_ids as string[] | null) ?? []);
  const [media, analyses, copied] = await Promise.all([
    ids.length ? db.from("media_assets").select("id, kind, regions").eq("studio_id", studioId).in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from("clip_analyses").select("media_id, analysis").in("media_id", ids) : Promise.resolve({ data: [] }),
    // The Reel she copies (« Steal »): the form of its hook and its ending guide the voice's first sentence and its end.
    postStyle(studioId, postId).catch(() => undefined),
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
  // The image the Reel opens on (its strongest shot): the first sentence is written for it, the editor opens on it.
  const opening = openingCandidates(
    ids.flatMap((id) => {
      const a = read.get(id);
      return kinds.get(id)?.kind !== "image" && a?.success ? [{ media_id: id, analysis: a.data }] : [];
    }),
    ids.flatMap((id) => (kinds.get(id)?.kind === "image" ? [{ media_id: id, contenu: (kinds.get(id)!.regions as { detection?: { notes?: string } } | null)?.detection?.notes }] : [])),
    1,
  )[0];
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.profile ?? {});
  // What there is to show: the videos' length, a photo about 2 s.
  const footage = ids.reduce((sum, id) => {
    const asset = kinds.get(id);
    if (asset?.kind === "image") return sum + 2;
    const a = read.get(id);
    return sum + (a?.success ? a.data.duration : 0);
  }, 0);
  const length = voiceWordsFor(footage);
  return {
    longueur: { mots_min: length.min, mots_max: length.max },
    commerce: {
      nom: studio.data?.name ?? undefined,
      activite: studio.data?.business_type ?? undefined,
      ce_qu_on_sait: memoryLines(studio.data?.memory),
      reservation_en_ligne: Boolean(studio.data?.booking_url),
      ton: profile.tone,
    },
    // How its voice plays (its signature): « cool et nonchalant, un brin rock ».
    ...(profile.signature?.narrator ? { intonation: profile.signature.narrator.delivery } : {}),
    // Her whole request (the title keeps only its first words): what she imagines, or Simone's brief from the chat.
    publication: { idee: post.data.title, angle: post.data.agent_note ?? undefined, ...(brief ? { demande: brief.slice(0, 1500) } : {}) },
    images,
    ...(opening?.what ? { ouverture: opening.what } : {}),
    ...(copied ? { reel_a_recopier: { accroche: `${copied.look.hook.kind} : ${copied.look.hook.what}`, fin: copied.look.ending } } : {}),
    ...(recentVoices.length ? { voix_recentes: recentVoices } : {}),
  };
}

type ScriptOptions = {
  /** What she wants the voice to say (« parle de la promo »). */
  wish?: string;
  mediaIds?: string[];
  /** Her request for the Reel: what she imagines (Créer), or Simone's brief from the chat. */
  brief?: string;
  whispered?: boolean;
  /** Choose the form first (her setting is « auto »). */
  decide?: boolean;
  /** What she fixed for this Reel: her text, her person, her ending… over every rule. */
  contract?: ReelContract;
};

/**
 * Simone writes what the voice says (a creator talking over the images, not an ad).
 * `decide`: she first chooses the form (her setting is « auto »): a key message with the
 * music comes back with its format and nothing to read.
 */
export async function writeVoiceScript(
  studioId: string,
  postId: string,
  { wish, mediaIds, brief, whispered = false, decide = false, contract }: ScriptOptions = {},
): Promise<VoiceOverScript & Partial<Pick<VoiceOverDecision, "format" | "why">>> {
  const fixed = contractLines(contract);
  const read = await scriptInput(studioId, postId, mediaIds, brief);
  // The length she asked for decides how much the voice says, so that it reaches the end of her Reel.
  if (contract?.duration) {
    const asked = voiceWordsFor(0, contract.duration);
    read.longueur = { mots_min: asked.min, mots_max: asked.max };
  }
  const input = {
    ...read,
    ...(wish ? { consigne_voix: wish } : {}),
    ...(whispered ? { voix: "chuchotée (ASMR)" } : {}),
    ...(fixed.length ? { contrat: fixed } : {}),
  };
  // She wrote the words herself: read as written (or improved for the ear when she asked), never rewritten into another voice.
  if (contract?.voice_text) return ownTextScript(studioId, contract, fixed, input);
  let draft: VoiceOverDraft & Partial<Pick<VoiceOverDecision, "format" | "why">>;
  for (let attempt = 0; ; attempt++) {
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "medium", format: outputFormat(decide ? voiceOverDecisionSchema : voiceOverScriptSchema) },
      system: decide ? `${VOICE_OVER_PROMPT}\n\n${VOICE_FORMAT_PROMPT}` : VOICE_OVER_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(studioId, response.usage, "voice_script");
    const parsed = response.parsed_output as (VoiceOverDraft & Partial<Pick<VoiceOverDecision, "format" | "why">>) | null;
    if (!parsed) throw new Error("La voix off n'a pas pu être écrite");
    if (parsed.format === "message") return { format: "message", why: parsed.why, hook: "", script: "" };
    draft = { ...parsed, hooks: parsed.hooks.map((h) => h.trim()).filter(Boolean) };
    const words = spokenWords(scriptFrom(draft.hooks[0] ?? "", draft.rest).script);
    // Too long, it would not fit in a Reel; too short, it says nothing: once more.
    const { mots_min: min, mots_max: max } = input.longueur;
    if ((words >= min - 6 && words <= max + 4) || attempt >= 1) break;
    input.publication = { ...input.publication, angle: `${input.publication.angle ?? ""} La version précédente faisait ${words} mots : vise ${min} à ${max}.`.trim() };
  }
  // Its first sentence decides whether anyone stays: the strongest of its hooks (and the judge's own), for the image it opens on.
  const next = stripAudioTags(draft.rest).split(/(?<=[.!?…])\s+/)[0];
  // What she fixed (her person, her words, her ending) is kept from the judge, who would weigh other forms against it.
  const chosen =
    draft.hooks.length > 0 && contractIsEmpty(contract)
      ? await judgeHooks(studioId, {
          type: "voix",
          commerce: { nom: input.commerce.nom, activite: input.commerce.activite, ce_qu_on_sait: input.commerce.ce_qu_on_sait, ton: input.commerce.ton },
          demande: input.publication.demande,
          premiere_image: input.ouverture,
          message: draft.message || undefined,
          suite: next || undefined,
          chuchotee: whispered || undefined,
          accroches: draft.hooks,
        })
      : null;
  return { ...scriptFrom(chosen?.text ?? draft.hooks[0] ?? "", draft.rest), format: draft.format, why: draft.why };
}

/** Her own text, prepared for the voice: corrected only (verbatim), or improved for the ear keeping her meaning and her person (polish). */
async function ownTextScript(
  studioId: string,
  contract: ReelContract,
  fixed: string[],
  input: Pick<Awaited<ReturnType<typeof scriptInput>>, "longueur" | "commerce" | "publication">,
): Promise<VoiceOverScript> {
  let script = verbatimScript(contract.voice_text ?? "");
  // She wrote only its start and described the rest: Simone writes the rest, the whole voice as long as her Reel.
  const rest = contract.voice_text_rest?.trim();
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 2000,
      output_config: { effort: rest ? "medium" : "low", format: outputFormat(ownTextSchema) },
      system: OWN_TEXT_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            mode: contract.voice_text_mode,
            texte: contract.voice_text,
            ...(rest ? { suite: rest } : {}),
            // Her whole request, always: the writer reads what she asked, not only the words she quoted.
            demande: input.publication.demande ?? input.publication.idee,
            commerce: input.commerce,
            contrat: fixed,
            ...(rest || contract.voice_text_mode === "polish" ? { longueur: input.longueur } : {}),
          }),
        },
      ],
    });
    await logClaudeCost(studioId, response.usage, "voice_script", CHAT_MODEL);
    const written = response.parsed_output?.script?.trim();
    if (written) script = stripAudioTags(written);
  } catch (error) {
    console.warn("her text read as she wrote it", error);
  }
  return { hook: script.split(/(?<=[.!?…])\s+/)[0] ?? script, script };
}

/** A voice of the gallery that matches what she asked (a man's, a woman's), keeping the chosen one when it does. */
function voiceFor(voiceId: string, gender: ReelContract["voice_gender"] | undefined): string {
  if (!gender || gender === "libre") return voiceId;
  const want = gender === "homme" ? "m" : "f";
  const current = findVoice(voiceId);
  if (current && current.gender === want) return voiceId;
  return SIMONE_VOICES.find((v) => v.gender === want && !v.asmr)?.id ?? voiceId;
}

/** A voice's own settings in the library, kept when only its speed changes (Tristan: « garde le ton d'origine des voix »). */
const voiceSettings = new Map<string, Record<string, unknown> | null>();
async function settingsOf(voiceId: string, key: string): Promise<Record<string, unknown> | null> {
  if (voiceSettings.has(voiceId)) return voiceSettings.get(voiceId)!;
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}/settings`, { headers: { "xi-api-key": key } }).catch(() => null);
  const settings = res?.ok ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
  voiceSettings.set(voiceId, settings);
  return settings;
}

/** The models tried in turn: the one configured, then older ones whose word timings are documented. */
const fallbackModels = () => [...new Set([env("ELEVENLABS_TTS_MODEL"), "eleven_v3", "eleven_multilingual_v2"])];

/** How many times a voice waits for its turn: the plan reads 5 texts at once, the others get 429. */
const BUSY_RETRIES = 5;

/**
 * ElevenLabs reads the script: the audio (as it comes, its loudness varies by voice,
 * see levelSpeech) and the time of every word.
 */
export async function speak(
  text: string,
  voiceId = env("ELEVENLABS_VOICE_ID"),
  speed = 1,
): Promise<{ mp3: Buffer; transcript: VoiceTranscript; model: string; voiceId: string }> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  // A pace she asked for: the voice's own settings, its speed changed (refused by a model, the voice is read at its pace).
  const paced = speed !== 1 ? { ...((await settingsOf(voiceId, key)) ?? {}), speed } : null;
  let failure = "";
  for (const model of fallbackModels()) {
    let res: Response;
    let withPace = Boolean(paced);
    for (let attempt = 0; ; attempt++) {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json" },
        // Multilingual v2 finds the language itself (it refuses language_code) and would read the acting tags aloud.
        // Each voice keeps its own tone (its library settings): Tristan picked them by ear as they are.
        body: JSON.stringify({
          ...(model === "eleven_multilingual_v2" ? { text: stripAudioTags(text), model_id: model } : { text, model_id: model, language_code: "fr" }),
          ...(withPace && paced ? { voice_settings: paced } : {}),
        }),
      });
      if ((res.status === 400 || res.status === 422) && withPace) {
        console.warn("voice pace refused by", model, (await res.text().catch(() => "")).slice(0, 200));
        withPace = false;
        continue;
      }
      if (res.status !== 429 || attempt >= BUSY_RETRIES) break;
      await res.text().catch(() => "");
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1) + Math.random() * 1000));
    }
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
 * A voice at the level of a voice in a Reel (ElevenLabs' voices come out between
 * -19 and -31 LUFS): set once, so the live preview and the mix hear it the same.
 * As it came when the sandbox cannot do it.
 */
export async function levelSpeech(
  id: string,
  mp3: Buffer,
  pauses: { at: number; add: number }[] = [],
): Promise<{ mp3: Buffer; lufs: number | null; paused: boolean; pauses: { at: number; add: number }[] }> {
  try {
    return await levelSpeechInSandbox(id, mp3, pauses);
  } catch (error) {
    console.warn("voice level unchanged", id, error);
    return { mp3, lufs: null, paused: false, pauses: [] };
  }
}

/**
 * Before a montage: Simone's voice over the Reel when it should have one
 * (wantsVoiceOver: the Reel's own choice, else the studio's; « auto » when nobody
 * speaks in the shots and there is enough to show). Made before the editor, which
 * then cuts on it like on her own voice note. A failure leaves the Reel without a
 * voice rather than without a montage. Returns the voice's name when one was made.
 */
export async function voiceOverIfWanted(params: {
  studioId: string;
  postId: string;
  mediaIds?: string[];
  correction?: boolean;
  /** Her request for the Reel, read by the voice too. */
  brief?: string;
  /** What she fixed: her own text asks for a voice reading it, at her pace, with the voice she asked. */
  contract?: ReelContract;
}): Promise<{ mediaId: string; voice: string } | { format: Extract<ReelFormat, "message">; why: string } | { spokenKept: true } | null> {
  if (!env("ELEVENLABS_API_KEY")) return null;
  const db = supabaseAdmin();
  const [post, brand] = await Promise.all([
    db.from("posts").select("kind, voice_media_id, voice_over, media_ids").eq("id", params.postId).eq("studio_id", params.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (post.error || post.data.kind !== "reel") return null;
  const choice = readPostVoice(post.data.voice_over);
  const setting = readVoiceSetting((brand.data?.profile as { voice?: unknown } | null)?.voice);
  const ids = params.mediaIds?.length ? params.mediaIds : ((post.data.media_ids as string[] | null) ?? []);
  const { data: media } = ids.length
    ? await db.from("media_assets").select("id, kind, duration").eq("studio_id", params.studioId).in("id", ids)
    : { data: [] as { id: string; kind: string; duration: number | null }[] };
  const videos = (media ?? []).filter((m) => m.kind === "video");
  const { data: analyses } = videos.length
    ? await db.from("clip_analyses").select("media_id, analysis").in("media_id", videos.map((v) => v.id as string))
    : { data: [] as { media_id: string; analysis: unknown }[] };
  const read = (analyses ?? []).map((a) => clipAnalysisSchema.safeParse(a.analysis)).flatMap((a) => (a.success ? [a.data] : []));
  // Someone speaking in a shot carries the Reel with their own words.
  const speechInClips = read.some((a) => (a.words?.length ?? 0) >= 6);
  const footageSeconds = videos.reduce((sum, v) => sum + (Number(v.duration) || 0), 0) || read.reduce((sum, a) => sum + a.duration, 0);
  // The voice on the Reel now: hers (a voice note she sent) or one Simone made.
  const current = post.data.voice_media_id
    ? (await db.from("media_assets").select("source, ai").eq("id", post.data.voice_media_id as string).maybeSingle()).data
    : null;
  const choices = {
    post: choice,
    studio: setting.use,
    onReel: post.data.voice_media_id ? (current?.source === "ai" ? ("simone" as const) : ("hers" as const)) : null,
    correction: Boolean(params.correction),
  };
  // Left to Simone, the Reel she copies decides (told by a voice, or not): its reading is waited for, as the editor does.
  const copied = voiceLeftToSimone(choices) ? await postStyle(params.studioId, params.postId, { waitMs: STEAL_WAIT_MS }).catch(() => undefined) : undefined;
  // Her own text for the voice asks for it (a correction too), unless it is already the one on the Reel, at her pace.
  const ownText = params.contract?.voice_text ? ownTextKey(params.contract) : null;
  const pace = VOICE_SPEED[params.contract?.voice_pace ?? "normale"];
  const ownTextOnReel = ownText && current && (current as { ai?: { own_text?: string; speed?: number } }).ai?.own_text === ownText && ((current as { ai?: { speed?: number } }).ai?.speed ?? 1) === pace;
  if (ownTextOnReel) return null;
  const wanted =
    Boolean(ownText && choice?.mode !== "off") ||
    wantsVoiceOver({
      ...choices,
      speechInClips,
      footageSeconds,
      photos: (media ?? []).filter((m) => m.kind === "image").length,
      copied: copied?.look.voice,
    });
  // She chose a voice (for this Reel, or always) but someone speaks in her videos: their words stay, and the delivery says so.
  if (!wanted && speechInClips && !choices.onReel && !choices.correction && choice?.mode !== "off" && (choice?.mode === "on" || setting.use === "always")) return { spokenKept: true };
  if (!wanted) return null;
  // A voice of the gallery, or one of her own (a clone made with her consent) kept as it is.
  const voiceId = voiceFor(choice?.voice_id ?? setting.voice_id ?? DEFAULT_VOICE_ID, params.contract?.voice_gender);
  try {
    // Her setting leaves it to Simone: told by a voice, or one key message with the music (then nothing is read nor paid);
    // a Reel she copies told by a voice has its form already.
    const auto = choice?.mode !== "on" && !choice?.wish && setting.use === "auto" && !copied && !ownText;
    const written = auto
      ? await writeVoiceScript(params.studioId, params.postId, { mediaIds: ids, brief: params.brief, whispered: Boolean(findVoice(voiceId)?.asmr), decide: true, contract: params.contract })
      : undefined;
    if (written?.format === "message") return { format: "message", why: (written.why ?? "").slice(0, 300) };
    const made = await makeVoiceOver({ studioId: params.studioId, postId: params.postId, wish: choice?.wish, voiceId, mediaIds: ids, brief: params.brief, script: written, contract: params.contract });
    // Her wish and the remake were for this voice: used once.
    if (choice?.wish || choice?.remake) await db.from("posts").update({ voice_over: { mode: choice.mode, ...(choice.voice_id ? { voice_id: choice.voice_id } : {}) } }).eq("id", params.postId);
    return { mediaId: made.mediaId, voice: findVoice(voiceId)?.name ?? "ta voix" };
  } catch (error) {
    console.error("voice over failed, the montage goes on without it", params.postId, error);
    return null;
  }
}

/**
 * A Reel without a voice (hers or Simone's): the choice is kept on the post and,
 * when it is already montaged, its plan gets a new version without the voice (the
 * cut stays; the music is made again for a Reel without voice). True when the
 * video must be made again; "agent" when the voice is in a video the effects agent
 * drew (only a correction of the effect takes it out).
 */
export async function removeVoice(studioId: string, postId: string): Promise<boolean | "agent"> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("edit_plan_id").eq("id", postId).eq("studio_id", studioId).single();
  const off = await db.from("posts").update({ voice_over: { mode: "off" }, voice_media_id: null }).eq("id", postId).eq("studio_id", studioId);
  if (off.error) throw new Error(off.error.message);
  if (!post?.edit_plan_id) return false;
  const [current, latest] = await Promise.all([
    db.from("edit_plans").select("plan").eq("id", post.edit_plan_id as string).single(),
    db.from("edit_plans").select("version").eq("post_id", postId).order("version", { ascending: false }).limit(1).single(),
  ]);
  const plan = editPlanSchema.safeParse(current.data?.plan);
  if (!plan.success || !plan.data.voice) return false;
  if (isBaked(plan.data)) return "agent";
  // The same plan, its voice left out (undefined is dropped when stored).
  const row = await db
    .from("edit_plans")
    .insert({ studio_id: studioId, post_id: postId, version: ((latest.data?.version as number | undefined) ?? 0) + 1, plan: { ...plan.data, voice: undefined } })
    .select("id")
    .single();
  if (row.error) throw new Error(row.error.message);
  await db.from("posts").update({ edit_plan_id: row.data.id }).eq("id", postId);
  return true;
}

/**
 * Simone's voice on a Reel: the script, the voice, kept as an audio media with its
 * words, set on the post. The next montage of the post is cut on it.
 */
export async function makeVoiceOver(params: {
  studioId: string;
  postId: string;
  wish?: string;
  voiceId?: string;
  mediaIds?: string[];
  /** Her request for the Reel. */
  brief?: string;
  /** Already written (when Simone chose the form first). */
  script?: VoiceOverScript;
  /** What she fixed for this Reel (her text, her person, her pace). */
  contract?: ReelContract;
}): Promise<{ mediaId: string; script: string; seconds: number }> {
  const db = supabaseAdmin();
  const script =
    params.script ??
    (await writeVoiceScript(params.studioId, params.postId, {
      wish: params.wish,
      mediaIds: params.mediaIds,
      brief: params.brief,
      whispered: Boolean(findVoice(params.voiceId)?.asmr),
      contract: params.contract,
    }));
  const started = Date.now();
  const speed = VOICE_SPEED[params.contract?.voice_pace ?? "normale"];
  const voice = await speak(script.script, params.voiceId, speed);
  if (voice.transcript.duration > VOICE_MAX_SECONDS) throw new Error(`Voix trop longue (${voice.transcript.duration} s)`);
  // A breath between two sentences read in one go, while it still fits a Reel.
  const breaths = sentencePauses(voice.transcript.words);
  const pauses = voice.transcript.duration + breaths.reduce((sum, p) => sum + p.add, 0) <= VOICE_MAX_SECONDS ? breaths : [];
  const leveled = await levelSpeech(`voice-${params.postId}`, voice.mp3, pauses);
  // The breaths where they were really opened (moved to the voice's silence, or left out).
  const transcript = leveled.paused ? withPauses(voice.transcript, leveled.pauses) : voice.transcript;
  const path = `${params.studioId}/voice/${params.postId}-${Date.now()}.mp3`;
  const upload = await db.storage.from("media").upload(path, leveled.mp3, { contentType: "audio/mpeg", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({
      studio_id: params.studioId,
      storage_path: path,
      kind: "audio",
      source: "ai",
      mime_type: "audio/mpeg",
      size_bytes: leveled.mp3.length,
      duration: transcript.duration,
      transcript,
      ai: {
        mode: "voice",
        voice_id: voice.voiceId,
        model: voice.model,
        lufs: leveled.lufs,
        // Her own text and pace, so that the next correction keeps this voice when they have not changed.
        ...(params.contract?.voice_text ? { own_text: ownTextKey(params.contract) } : {}),
        ...(speed !== 1 ? { speed } : {}),
      },
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
      meta: costMeta({ post_id: params.postId, model: voice.model, voice_id: voice.voiceId, seconds: transcript.duration, ms: Date.now() - started }),
    }),
  ]);
  return { mediaId: asset.data.id as string, script: script.script, seconds: transcript.duration };
}
