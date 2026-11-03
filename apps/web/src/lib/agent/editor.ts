import "server-only";
import { insertPlanVersion } from "@/lib/edit-plans";
import { designLook } from "./look-designer";
import {
  contractLines,
  type ReelContract,
  editorClip,
  signatureLines,
  followedForEditor,
  textDrawingWords,
  followedLook,
  followedFilter,
  editorLook,
  lookChoice,
  planLook,
  signatureOf,
  editorOutputSchemaLegacy,
  finishPlan,
  captionStyle,
  AROUND_WORDS,
  CUT_OUT_WORDS,
  type EditorOutput,
  type EditorOutputLegacy,
  type MediaFacts,
  type ReelFormat,
  carryRetouch,
  carryTextStyle,
  compositionShots,
  compositionTexts,
  isComposed,
  holdAfterVoice,
  keepComposition,
  keepWrittenAnimations,
  replacedAnimations,
  brandProfileSchema,
  CLAUDE_MODEL,
  EDITOR_SYSTEM_PROMPT,
  editorOutputSchema,
  editPlanSchema,
  fromEditorPlan,
  isClipSegment,
  isMotionSegment,
  MAX_FREE_SCENES,
  motionTemplateSchema,
  normalizeEditPlan,
  spreadRepeats,
  alikeClip,
  stillClip,
  PHOTO_MAX_SECONDS,
  memoryLines,
  resolveReelBrand,
  type EditPlan,
  openingCandidates,
  planHook,
  lookMoments,
  planTimeline,
  askedSounds,
  textsOnShots,
  voiceAt,
  voiceForEditor,
  buildReelProps,
  clipAspect,
  layerTrack,
  movesForDesigner,
  planMediaIds,
  sceneTrack,
  shotTrack,
  earlierLooks,
  gestureMoments,
  handMoves,
  SUBTITLE_ROW,
  speechFacts,
  asAsked,
  undoSpeechCuts,
  type ReelProps,
  type TracksByClip,
  honestLength,
  lengthNote,
  missesLength,
  AMBIANCE_MAX_SECONDS,
  dressedFloorNote,
  houseModel,
  FONT_PAIRS,
  SPOKEN_WRITTEN,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { HOUSE_EXAMPLES } from "@fauve/agent/house-examples";
import { ensureCutouts, photoOffers } from "@/lib/render/cutout";
import { ensureSubjects } from "@/lib/render/subjects";
import { logoNamed } from "@/lib/render/logo-tone";
import { videoFramesInSandbox } from "@/lib/render/sandbox";
import { ensureTracks, loadTracks } from "@/lib/render/tracks";
import { usableFonts } from "@/lib/fonts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { ensureTranscript } from "@/lib/voice";
import { ensureCleanVoice, ensureSpeech } from "@/lib/video/speech";
import { photoRegions } from "@/lib/video/regions";
import { latestReport } from "@/lib/performance";
import { judgeHooks } from "./hook-judge";
import { copyCandidate, designCopy } from "./copy-design";
import { recordToolUses } from "@/lib/tool-maker";
import { designMotionScenes, type SceneRequest, type SceneResult } from "./motion-designer";
import { reelStills, showReel } from "./reel-canvas";
import { ensureInspirationRead } from "@/lib/inspirations";
import { MODEL_SOURCE, postStyle, SENT_TO_COPY, STEAL_WAIT_MS, modelSheets } from "@/lib/steal";
import { readySounds } from "@/lib/render/sfx";
import { isFirstReel } from "@/lib/onboarding";
import { LAYER_ROLE, markTemplatesUsed, OVERLAY_ROLE, PHOTO_ROLE, recentlyShownTemplates, saveTemplates, templateCode, templatesForEditor } from "./motion-templates";
import { timeLeft } from "@/lib/step-clock";
import { anthropic, CACHE_AN_HOUR, logClaudeCost } from "./run";

/** The brief of the animation that draws a copied Reel's texts as its model does (constant: a correction keeps its code). */
const WORDS_BRIEF =
  "Draw the Reel's texts (reel_texts) exactly as the Reel she copies draws its texts (model_frames): where they sit on the image, their size, font and weight, how each one appears and leaves (typed word by word, slammed, faded), at its pace. Her shots play under you; draw nothing else.";

/** The hooks of the studio's latest other Reels: the next one takes another form and other words. */
async function recentHooks(studioId: string, postId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("posts")
    .select("edit_plan_id")
    .eq("studio_id", studioId)
    .eq("kind", "reel")
    .neq("id", postId)
    .not("edit_plan_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);
  const ids = (posts ?? []).map((p) => p.edit_plan_id as string);
  if (!ids.length) return [];
  const { data: plans } = await db.from("edit_plans").select("plan").in("id", ids);
  return (plans ?? []).flatMap((row) => {
    const plan = editPlanSchema.safeParse(row.plan);
    return plan.success ? plan.data.texts.filter((t) => t.style === "hook").map((t) => t.text) : [];
  });
}

/** The most of her photos the animations of one Reel compose with (each is cut out first, 10 to 30 s). */
const MAX_OFFERED_PHOTOS = 8;

/**
 * A correction's animations to rewrite look at their earlier version first: the frames of the
 * version corrected, rendered on her images where that animation played (its start, the gestures
 * under it, its middle, its end), with its code (`seen`); what is asked is their request.
 */
async function lookAtEarlierRender(
  studioId: string,
  postId: string,
  planId: string,
  previous: EditPlan,
  plan: EditPlan,
  requests: SceneRequest[],
  actions: Record<string, { start: number; end: number; what: string }[]>,
): Promise<void> {
  const looks = earlierLooks(previous, plan, requests.map((r) => r.id), gestureMoments(previous, actions));
  if (!looks.size) return;
  const db = supabaseAdmin();
  const { data: render } = await db
    .from("renders")
    .select("storage_path")
    .eq("edit_plan_id", planId)
    .eq("studio_id", studioId)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!render?.storage_path) return;
  const signed = await db.storage.from("media").createSignedUrl(render.storage_path as string, 900);
  if (!signed.data) return;
  const times = [...new Set([...looks.values()].flatMap((l) => l.times.map((x) => x.t)))];
  const frames = await videoFramesInSandbox(`rework-${postId.slice(0, 8)}-${Date.now()}`, signed.data.signedUrl, times);
  for (const request of requests) {
    const look = looks.get(request.id);
    const shown = look?.times.flatMap((x) => {
      const frame = frames.find((f) => f.t === x.t);
      return frame ? [{ label: x.label, jpeg: frame.jpeg }] : [];
    });
    if (look && shown?.length) request.seen = { code: look.code, frames: shown };
  }
}

export type DesignedEdit = {
  editPlanId: string;
  version: number;
  plan: EditPlan;
  rationale: string;
  /** Scenes written by the motion designer for this plan (the costly part), and scenes reused from the library. */
  newScenes: number;
  reusedScenes: number;
};

/** A failed composition is tried once more only with this much left in the design step (its limit is 800 s): a call, its check, the rest of the step. */
const COMPOSE_RETRY_NEEDS_MS = 420_000;
/** What the director's look at its Reel needs of the step: its images (a minute or two), a call and its check. */
const LOOK_NEEDS_MS = 420_000;
/** How long the look's images may take, her cut-outs computed first (a title behind her is judged behind her). */
const LOOK_IMAGES_MS = 150_000;

/**
 * The director's look at the composition it has just written (the whole Reel): the Reel drawn at its first image, each
 * text, each shot and its end, shown to the motion designer with its code (`look`), which answers it fixed or the same.
 * A new version that passes its check replaces the first one, here and in what the library keeps (`result`).
 */
async function lookAtOwnReel(
  studioId: string,
  postId: string,
  plan: EditPlan,
  request: SceneRequest | undefined,
  result: SceneResult | undefined,
  write: (requests: SceneRequest[]) => Promise<SceneResult[]>,
): Promise<boolean> {
  const index = (plan.layers ?? []).findIndex((l) => l.compose && l.motion.js);
  const layer = index >= 0 ? plan.layers![index]! : undefined;
  if (!layer?.motion.code || !request || !result?.js) return false;
  if (timeLeft() < LOOK_NEEDS_MS) {
    console.log("look: no time left in the step, the Reel goes as written", postId, Math.round(timeLeft() / 1000));
    return false;
  }
  const started = Date.now();
  const timeline = planTimeline(plan).segments;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frames = await Promise.race([
    reelStills(studioId, postId, plan, lookMoments(plan, timeline)),
    new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("look: images too slow")), LOOK_IMAGES_MS))),
  ]).finally(() => clearTimeout(timer));
  if (!frames.length) return false;
  const again = (await write([{ ...request, canvas: undefined, seen: { code: layer.motion.code, frames }, look: true }]))[0];
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!again?.js || !again.code || again.code.trim() === layer.motion.code.trim()) {
    console.log("look: the director kept its Reel as written", postId, `${seconds} s`, again?.error ?? "");
    return false;
  }
  plan.layers![index] = {
    ...layer,
    motion: {
      ...layer.motion,
      code: again.code,
      js: again.js,
      ...(again.photos?.length ? { photos: again.photos } : {}),
      ...(again.fonts?.length ? { fonts: again.fonts } : {}),
      ...(again.sounds?.length ? { sounds: again.sounds } : {}),
      ...(again.subtitleY !== undefined ? { subtitle_y: again.subtitleY } : {}),
      ...(again.spokenShare !== undefined ? { writes_spoken: again.spokenShare >= SPOKEN_WRITTEN } : {}),
    },
  };
  // The library keeps the version that went out.
  Object.assign(result, { code: again.code, js: again.js, ...(again.name ? { name: again.name } : {}), ...(again.slots ? { slots: again.slots } : {}), ...(again.fonts ? { fonts: again.fonts } : {}) });
  console.log("look: the director fixed its Reel", postId, `${seconds} s`, again.notes ?? "");
  return true;
}

/** How long the montage waits for what moves in her videos (its faces, its hands) before the editor cuts. */
const TRACKS_WAIT_MS = 180_000;
/** …and for the speech of a video analysed before it was read (its sound cleaned, its words timed). */
const SPEECH_WAIT_MS = 90_000;

/** A correction that would have made her Reel worse: not kept, its words are what she is told. */
export class MissedCorrection extends Error {}
const MISSED_LAYOUT =
  "Je n'ai pas réussi à faire la mise en page que tu demandes : ta version d'avant reste en place, et rien n'est débité. Tu veux que je réessaie, ou que je le fasse autrement ?";
const missedLength = (after: number, before: number) => {
  const s = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
  return `Cette retouche donnait un Reel de ${s(after)} s au lieu de ${s(before)} s : je ne l'ai pas gardée. Ta version d'avant reste en place, et rien n'est débité. Dis-moi ce que je change, ou quels fichiers ajouter.`;
};

/**
 * Fauve's editor: watches the analyses, picks a motion template and writes the
 * edit plan (new version) for a post. With a previous plan and a brief, it
 * applies a correction instead of starting over.
 */
export async function designEdit(params: {
  studioId: string;
  postId: string;
  mediaIds?: string[];
  brief?: string;
  /** New animated scenes allowed by the quote (default: the usual cap). */
  maxNewScenes?: number;
  /** The editor's reasoning effort (level of care of the montage). */
  effort?: "medium" | "high";
  /** The version to correct (default: the post's current one, the one the manager has). */
  fromPlanId?: string;
  /** A new take, not a correction: the brief is the request, the previous plan is not shown. */
  fresh?: boolean;
  /** Edith chose the form: « message », one key message with the music, no voice. */
  format?: ReelFormat;
  /** What she fixed for this Reel: over every default of the editor. */
  contract?: ReelContract;
  /** How many times the director looks at its new composition before it goes out (its level of care; 1 by default). */
  looks?: number;
}): Promise<DesignedEdit> {
  const db = supabaseAdmin();
  const [post, studio, brand, previous, recent, report, inspirations, hooks, readyForEditor] = await Promise.all([
    db.from("posts").select("id, title, kind, caption, platforms, edit_plan_id, template, inspiration_id, voice_media_id").eq("id", params.postId).eq("studio_id", params.studioId).single(),
    db.from("studios").select("name, business_type, booking_url, memory").eq("id", params.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1),
    db.from("edit_plans").select("plan, version").eq("post_id", params.postId).order("version", { ascending: false }).limit(1),
    recentlyShownTemplates(params.studioId, params.postId),
    latestReport(params.studioId).catch(() => null),
    db.from("inspirations").select("analysis, source, copied:style->look").eq("studio_id", params.studioId).not("analysis", "is", null).order("created_at", { ascending: false }).limit(12),
    recentHooks(params.studioId, params.postId).catch(() => []),
    readySounds().catch(() => []),
  ]);
  if (post.error) throw new Error("Publication introuvable");
  // The Reel she sent to copy (« Steal »): its style, read after her message, is waited for while the rest is read.
  // A new montage follows the latest reading of the Reel it copies; a correction, the one its Reel was made with.
  const copying = post.data.inspiration_id
    ? postStyle(params.studioId, params.postId, { waitMs: STEAL_WAIT_MS, latest: Boolean(params.fresh) }).catch(() => undefined)
    : Promise.resolve(undefined);

  // The version to correct: the one asked for, else the post's current one (a reviewed
  // montage keeps the version the critic chose, often not the highest number), else the latest.
  const baseId = params.fromPlanId ?? (post.data.edit_plan_id as string | null);
  const from = baseId ? await db.from("edit_plans").select("plan").eq("id", baseId).eq("post_id", params.postId).maybeSingle() : { data: null };
  const previousPlan = editPlanSchema.safeParse(from.data?.plan ?? previous.data?.[0]?.plan);
  // Reels in a row never share a scene: the latest Reels' scenes are held back, except this Reel's own (a correction keeps them).
  const own = new Set(previousPlan.success ? previousPlan.data.segments.filter(isMotionSegment).flatMap((s) => (s.motion.template_id ? [s.motion.template_id] : [])) : []);
  const library = await templatesForEditor(params.studioId, new Set([...recent].filter((id) => !own.has(id))));
  const mediaIds = params.mediaIds?.length
    ? params.mediaIds
    : previousPlan.success
      ? [...new Set(previousPlan.data.segments.filter(isClipSegment).map((s) => s.clip_id))]
      : [];
  // Photos play still with a slow zoom; videos are cut from their analysis. No media at all
  // is fine too: the editor then builds a Reel entirely in motion design.
  const kinds = mediaIds.length
    ? new Map(((await db.from("media_assets").select("id, kind").eq("studio_id", params.studioId).in("id", mediaIds)).data ?? []).map((m) => [m.id as string, m.kind as string]))
    : new Map<string, string>();
  const photoIds = mediaIds.filter((id) => kinds.get(id) === "image");
  const videoIds = mediaIds.filter((id) => kinds.get(id) !== "image");
  // A video still being read is waited for 4 min: its reading may include its enlargement on the card (a 480p one,
  // up to 2 min of it) and its steadying; without its reading, the montage would leave it out.
  const [analyses, photoReads] = await Promise.all([
    Promise.all(videoIds.map((id) => ensureClipAnalysis(params.studioId, id, { waitMs: 240_000 }))),
    Promise.all(photoIds.map((id) => photoRegions(params.studioId, id).catch(() => null))),
  ]);
  let clips = analyses.flatMap((a) => ("analysis" in a ? [{ media_id: a.media_id, analysis: a.analysis }] : []));
  if (videoIds.length && !clips.length && !photoIds.length) throw new Error("Les vidéos ne sont pas encore analysées, réessaie dans une minute");
  // What moves in her videos (hands, faces, bodies), followed once per clip with someone in it (the cut-out sandbox),
  // started now so it runs while the rest is read: an animation can then start from a gesture, hold on to it or follow it.
  const earlyTracks = clips.length
    ? ensureTracks(params.studioId, clips.map((c) => c.media_id)).catch((e: unknown) => console.warn("tracks: not ready", e))
    : null;
  // Someone speaking in a video analysed before its speech was read: read now (its sound cleaned, its « euh » timed).
  const earlySpeech = clips.length
    ? ensureSpeech(params.studioId, clips).catch((e: unknown) => {
        console.warn("speech: not read", e);
        return null;
      })
    : null;
  const photos = photoIds.map((id, i) => {
    const read = photoReads[i];
    return {
      media_id: id,
      ...(read ? { format: read.width > read.height * 1.1 ? "paysage" : read.height > read.width * 1.1 ? "portrait" : "carré", contenu: read.detection.notes } : {}),
    };
  });

  // Her voice note over the Reel: read once (her words with their timings), the editor cuts on her phrases.
  // Its first word is heard at once: the silence a voice note opens on is cut.
  const voiceId = post.data.voice_media_id as string | null;
  const voice = voiceId ? await ensureTranscript(params.studioId, voiceId) : null;
  // Her own voice note recorded in a noisy place: a cleaned copy beside it, its words keep their timing.
  if (voiceId && voice) await ensureCleanVoice(params.studioId, voiceId);
  const voiceStart = voice ? voiceAt(voice) : 0;
  const spoken = voice ? voiceForEditor(voice, voiceStart) : null;
  // The strongest moments to open on, best first (a voice over was written for the first one).
  const openings = openingCandidates(clips, photos);
  // A correction keeps what was asked; a new Reel (or a new take) has its hook weighed.
  const correction = Boolean(params.brief && !params.fresh && previousPlan.success);

  // The inspiration she picked for this post (read now if it was just added in the app), or the Reel
  // she sent to copy: its form and pace, its look over her charter, for this Reel only.
  const inspirationId = post.data.inspiration_id as string | null;
  const followed = await copying;
  // A Reel she copies has its animations written for it, in the copied Reel's look (a black ending stays black): no scene
  // of the library but this Reel's own (a reused closing card from an earlier try had painted the copied black ending violet).
  const copiedOnly = Boolean(followed && !followed.own);
  const offered = copiedOnly ? library.filter((t) => own.has(t.id)) : library;
  const chosenInspiration = inspirationId ? await ensureInspirationRead(params.studioId, inspirationId).catch(() => null) : null;
  const chosenTemplate = motionTemplateSchema.safeParse(post.data.template);
  // A collage composes with her photos' cut-outs: for one she chose for this post or asks for now (« en collage »), they are
  // made while the editor works (their own sandbox); one the editor chooses itself has them made after it.
  const askedCollage = (chosenTemplate.success && chosenTemplate.data === "collage") || /\bcollage\b/i.test(params.brief ?? "");
  // A word around something of her photos or behind it (a glass, her): their cut-outs too, so each animation knows which ones it can draw behind.
  const askedAround = AROUND_WORDS.test(params.brief ?? "") || CUT_OUT_WORDS.test(params.brief ?? "");
  const earlyCutouts =
    (askedCollage || askedAround) && photoIds.length
      ? ensureCutouts(params.studioId, photoIds.slice(0, MAX_OFFERED_PHOTOS)).catch((e: unknown) => console.warn("cut-outs: not ready", e))
      : null;
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.[0]?.profile ?? {});
  // A simple Reel she copies is remade by code (copy.ts: the model's own cuts, her photos' subjects laid over, its title, its
  // ending): no editor nor motion designer, one small call writes its words. Its correction too; anything it cannot do, the editor.
  const previousCopy = previousPlan.success && previousPlan.data.copy ? previousPlan.data : null;
  if ((!correction || previousCopy) && copyCandidate(followed, params.contract, Boolean(voice))) {
    const copied = await designCopy({
      studioId: params.studioId,
      postId: params.postId,
      followed,
      mediaIds,
      clips,
      photos: Object.fromEntries(photoIds.flatMap((id, i) => (photoReads[i] ? [[id, photoReads[i]!] as const] : []))),
      brief: params.brief,
      contract: params.contract,
      previous: correction ? previousCopy : null,
      studio: { name: studio.data?.name, business: studio.data?.business_type, memory: studio.data?.memory, booking: Boolean(studio.data?.booking_url), tone: profile.tone, fonts: profile.fonts },
    });
    if (copied) return { editPlanId: copied.editPlanId, version: copied.version, plan: copied.plan, rationale: copied.rationale, newScenes: 0, reusedScenes: 0 };
  }
  // What moves in her videos, followed before the editor cuts: which gestures show their hands in the vertical
  // frame (the editor puts an animation that hangs on a gesture where it can be seen), where the faces really are
  // (the texts keep off them) and what the animations follow. Never more than a few minutes of waiting (a sandbox
  // installing the tracker for the first time): without them, the faces are Gemini's and the animations follow nothing.
  if (earlyTracks) await Promise.race([earlyTracks, new Promise((resolve) => setTimeout(resolve, TRACKS_WAIT_MS))]);
  // Her speech read (the hesitations and pauses the engine cuts): a minute and a half at most, else cut as it is.
  if (earlySpeech) {
    const read = await Promise.race([earlySpeech, new Promise<null>((resolve) => setTimeout(() => resolve(null), SPEECH_WAIT_MS))]);
    if (read) clips = read;
  }
  const tracks: TracksByClip = clips.length ? await loadTracks(params.studioId, clips.map((c) => c.media_id)).catch(() => ({})) : {};
  // The version to correct as the editor wrote it: its ramps and its cuts of the « euh » undone (the engine makes them again).
  const asWritten = previousPlan.success ? undoSpeechCuts({ ...previousPlan.data, segments: previousPlan.data.segments.map(asAsked) }) : null;
  const input = {
    studio: {
      name: studio.data?.name,
      business: studio.data?.business_type ?? undefined,
      booking: Boolean(studio.data?.booking_url),
      // What Edith knows of the business (its site, what was said): where the words on screen come from.
      facts: memoryLines(studio.data?.memory),
    },
    brand: {
      tone: profile.tone,
      art_direction: profile.art_direction,
      // The same direction as settings: the render already applies them (titles, key words, boxes, light).
      signature: signatureLines(signatureOf({ signature: profile.signature, followed })),
      reel_a_recopier: followed ? followedForEditor(followed) : undefined,
      moodboard: profile.moodboard?.reading,
      // What worked on this studio's Instagram (weekly analysis): follow it when it applies.
      lessons: report?.lessons.map((l) => l.lesson),
      // Reels she likes (added in Style, shared with Edith on Instagram), as read by Gemini; not a Reel she sent
      // to copy (« Steal »): that one is the model of one Reel only; nor one of hers kept as a model, for the Reels made like it.
      inspirations: (inspirations.data ?? [])
        .filter((i) => !(i.copied && SENT_TO_COPY.includes(i.source as string)) && i.source !== MODEL_SOURCE)
        .map((i) => i.analysis as string)
        .filter((a) => a !== chosenInspiration)
        .slice(0, 6),
      visual_notes: profile.visual_notes,
      colors: profile.colors,
      fonts: profile.fonts,
      // Her own uploaded fonts: usable by name in fonts and looks.
      own_fonts: profile.custom_fonts?.map((f) => f.family),
      // Pairings that work, for the fonts it brings when this Reel takes a liberty with her charter (never instead of it).
      font_pairs: { note: "si ce Reel prend d'autres polices que sa charte, une de ces paires (titres + textes)", paires: FONT_PAIRS.map((p) => `${p.display.family} + ${p.body.family} : ${p.fits}`) },
      // Text looks the manager keeps (copied from examples): the editor reuses them.
      text_looks: profile.text_looks?.length ? profile.text_looks : undefined,
      dos: profile.dos,
      donts: profile.donts,
    },
    // What she fixed herself for this Reel (her text, the layout, the length, the ending…): followed to the letter.
    ...(contractLines(params.contract).length ? { contrat: contractLines(params.contract) } : {}),
    post: {
      ...post.data,
      edit_plan_id: undefined,
      template: undefined,
      inspiration_id: undefined,
      voice_media_id: undefined,
      // The collage form she chose for this Reel (or an older Reel's ambiance); « libre » says nothing.
      chosen_template: chosenTemplate.success && chosenTemplate.data !== "libre" ? chosenTemplate.data : undefined,
      chosen_inspiration: chosenInspiration ?? undefined,
      // Edith chose this form: one key message held on screen, with the music, no voice.
      format: params.format === "message" ? "message clé" : undefined,
    },
    // Every shot as an editor weighs it (size, camera, beauty, energy, hook, where the subject is).
    clips: clips.map((c) => editorClip(c.media_id, c.analysis, tracks[c.media_id])),
    // Her voice over the Reel: her phrases on the Reel's clock (the voice is placed for you).
    voice: spoken ?? undefined,
    // Where the Reel opens best: the strongest shots for its first image.
    openings: openings.length ? openings.map((o) => ({ clip_id: o.media_id, in: o.start, out: o.end, what: o.what })) : undefined,
    // Her photos: each one a still shot with a slow zoom (clip_id = media_id, in 0, out = how long it shows).
    photos: photos.length ? photos : undefined,
    // Scenes already made: reusing one costs nothing.
    templates: offered,
    // The hooks of her latest Reels: this one takes another form and other words.
    recent_hooks: hooks.length ? hooks : undefined,
    // Motion code stays out of the editor's context: it only needs the briefs.
    previous_plan:
      correction && asWritten
        ? {
            ...asWritten,
            // Its look by its name (« look » of the answer: the same name keeps it as it is).
            look: planLook(asWritten)?.preset ?? planLook(asWritten)?.name,
            effect: undefined,
            segments: asWritten.segments.map((s) =>
              isMotionSegment(s)
                ? {
                    motion: {
                      brief: s.motion.brief,
                      fallback: s.motion.fallback,
                      template_id: s.motion.template_id,
                      template_texts: Object.entries(s.motion.texts ?? {}).map(([slot, text]) => ({ slot, text })),
                    },
                    duration: s.duration,
                  }
                : s,
            ),
            // Its animations over several shots, by their brief and span (a collage's composition named as such).
            layers: asWritten.layers?.map((l) => ({ brief: l.motion.brief, from: l.from, to: l.to, ...(l.compose ? { composition_du_reel: true } : {}) })),
          }
        : undefined,
    request: params.brief ?? "Premier montage de cette publication.",
    // Her very first Reel (getting started): it has to wow her.
    first_reel: !previousPlan.success && (await isFirstReel(params.studioId, params.postId)) ? true : undefined,
    // Credits: past this, the editor must reuse library scenes or use fixed ones.
    max_new_scenes: params.maxNewScenes ?? MAX_FREE_SCENES,
  };

  // `again`: its earlier answer and what the engine measured on it (a length it missed).
  const ask = async (legacy: boolean, again?: { answer: EditorOutput | EditorOutputLegacy; note: string }) => {
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      output_config: { effort: params.effort ?? "high", format: outputFormat(legacy ? editorOutputSchemaLegacy : editorOutputSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: EDITOR_SYSTEM_PROMPT, cache_control: CACHE_AN_HOUR }],
      messages: [
        { role: "user", content: JSON.stringify(input) },
        ...(again ? [{ role: "assistant" as const, content: JSON.stringify(again.answer) }, { role: "user" as const, content: again.note }] : []),
      ],
    });
    await logClaudeCost(params.studioId, response.usage, "editor");
    return response as { stop_reason: string | null; parsed_output: EditorOutput | EditorOutputLegacy | null };
  };
  // The answer's schema is compiled into a grammar with limits of its own: if the API ever
  // refuses it, the editor answers in the previous, smaller schema rather than not at all.
  let legacy = false;
  const response = await ask(false).catch((error: unknown) => {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 400 || !/grammar|schema|complex|compil/i.test(message)) throw error;
    console.warn("editor: schema refused, answering in the legacy schema", message);
    legacy = true;
    return ask(true);
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Le montage n'a pas pu être préparé (${response.stop_reason})`);
  }
  let output = response.parsed_output;

  const durations = { ...Object.fromEntries(clips.map((c) => [c.media_id, c.analysis.duration])), ...Object.fromEntries(photoIds.map((id) => [id, PHOTO_MAX_SECONDS])) };
  // Where someone speaks: the hesitations and long pauses the engine cuts out.
  const speech = speechFacts(clips);
  // Retouch and blur stay on their clips from one version to the next.
  // A correction also keeps the texts' styles and places (the editor names looks, it does not copy them).
  const base = previousPlan.success ? previousPlan.data : null;
  // Clips whose passages all look alike, shown twice at most: their later passages go to the files she sent that show the least.
  const alike = new Set(clips.filter((c) => alikeClip(c.analysis)).map((c) => c.media_id));
  const still = new Set(clips.filter((c) => alikeClip(c.analysis) && stillClip(c.analysis)).map((c) => c.media_id));
  const files = [...clips.map((c) => ({ id: c.media_id, seconds: c.analysis.duration, photo: false })), ...photoIds.map((id) => ({ id, seconds: PHOTO_MAX_SECONDS, photo: true }))];
  // Her finishing touches (the sound, the « euh » cut or not, the ramps, the relief, the steadying): her defaults
  // for all her Reels, then this Reel's own, carried from version to version (never written by the editor).
  const finish = { ...profile.finish, ...base?.finish };
  // Its animations whose brief did not change keep their code before the new ones are counted;
  // one rewritten (its shots changed, or the request touched it) takes the place of the one it replaces.
  // What is said written like a creator, her choice for all her Reels or this one: written whenever someone speaks.
  const writeSpoken = captionStyle({ finish }) && (Boolean(spoken) || clips.some((c) => c.analysis.words?.length));
  const toPlan = (answer: EditorOutput | EditorOutputLegacy) => {
    // A model Edith picked as this Reel's form is always composed: its director draws the whole Reel, then looks at it.
    const read = fromEditorPlan(followed?.dressed && !correction ? ({ ...answer.plan, form: "composition" } as typeof answer.plan) : answer.plan, profile.text_looks ?? []);
    const written = writeSpoken ? { ...read, subtitles: true } : read;
    const withWritten = keepWrittenAnimations(Object.keys(finish).length ? { ...written, finish } : written, params.fresh ? null : base);
    // A correction that redraws nothing keeps the composition's code as it is: never written again for a voice or a subtitle.
    const drafted = correction && !params.fresh && params.contract?.redraw === false ? keepComposition(withWritten, base) : withWritten;
    const allowed = Math.min(MAX_FREE_SCENES, (params.maxNewScenes ?? MAX_FREE_SCENES) + replacedAnimations(drafted, params.fresh ? null : base));
    // A clip whose passages look alike shows twice at most, whatever its passages.
    const capped = spreadRepeats(drafted, alike, files, still);
    return carryRetouch(carryTextStyle(normalizeEditPlan(capped, durations, allowed, speech), params.fresh ? null : base), base);
  };
  let plan = toPlan(output);
  // Her videos whole and horizontal on black (her contract): the engine draws it on every version.
  // A correction keeps it (its request is about something else).
  const letterbox = params.contract?.frame === "letterbox" || (correction && base?.frame === "letterbox");
  // The sounds she asked for on what appears (her contract), placed on each version's texts or cuts; a correction
  // keeps those of the version it corrects.
  const asking = params.contract?.asked_sounds?.length
    ? params.contract.asked_sounds
    : correction
      ? [...new Map((base?.sounds ?? []).filter((c) => c.asked).map((c) => [c.sound, { on: "texts" as const, sound: c.sound }])).values()]
      : [];
  const framed = (p: EditPlan): EditPlan => {
    // A text per shot: each one with its shot (its click with it).
    const next: EditPlan = { ...textsOnShots(p) };
    if (letterbox) next.frame = "letterbox";
    else delete next.frame;
    const sounds = asking.length ? askedSounds(next, planTimeline(next).segments, asking) : [];
    if (sounds.length) next.sounds = sounds;
    else delete next.sounds;
    // A copied Reel's texts drawn as the model draws them, by an animation over the whole montage (the engine's rows
    // put a title typed word by word on the image as a static line above it). Never over a composition, which draws
    // its own, nor for a model without text.
    const layers = (next.layers ?? []).filter((l) => !l.words);
    const copiesText = followed && followed.look.text.amount !== "aucun" && next.texts.length && !next.copy && !layers.some((l) => l.compose) && layers.length < 3;
    if (copiesText) next.layers = [...layers, { motion: { brief: WORDS_BRIEF }, from: 0, to: next.duration, words: true }];
    else if (layers.length) next.layers = layers;
    else delete next.layers;
    return next;
  };
  plan = framed(plan);
  // The length she asked for is measured on the plan, never taken from the editor's words: missed, it
  // reads the measure and answers once more, and the closer of its two plans is kept.
  const asked = params.contract?.duration;
  if (asked && missesLength(plan.duration, asked)) {
    const again = await ask(legacy, { answer: output, note: lengthNote(plan.duration, asked) }).catch((error: unknown) => {
      console.warn("editor: length retry failed", error);
      return null;
    });
    if (again?.parsed_output) {
      const retried = toPlan(again.parsed_output);
      if (Math.abs(retried.duration - asked) < Math.abs(plan.duration - asked)) {
        output = again.parsed_output;
        plan = framed(retried);
      }
    }
  }
  // A model Edith picked holds her floor (dressedFloorNote): a plan without one word, or too long for an ambiance,
  // reads what was measured and answers once more; the retry is kept when it holds (or holds better).
  const floorContext = { voice: Boolean(voice), speech: clips.some((c) => Boolean(c.analysis.words?.length)), request: params.brief, duration: params.contract?.duration };
  const floor = followed?.dressed && !correction ? dressedFloorNote(plan, floorContext) : null;
  if (floor) {
    const again = await ask(legacy, { answer: output, note: floor }).catch((error: unknown) => {
      console.warn("editor: floor retry failed", error);
      return null;
    });
    if (again?.parsed_output) {
      const retried = framed(toPlan(again.parsed_output));
      const fails = (p: typeof plan) => (p.texts.length ? 0 : 2) + (p.duration > AMBIANCE_MAX_SECONDS + 0.5 ? 1 : 0);
      if (!dressedFloorNote(retried, floorContext) || fails(retried) < fails(plan)) {
        output = again.parsed_output;
        plan = retried;
      }
      console.log("editor: floor retry", params.postId, `${plan.duration} s, ${plan.texts.length} texts`);
    }
  }
  // A correction keeps this Reel's own colours when the editor wrote none: only what she asked changes.
  if (!plan.colors && base?.colors && !params.fresh) plan.colors = base.colors;
  // And how what is said is written, when the editor didn't write another style.
  if (!plan.captions && base?.captions && !params.fresh) plan.captions = base.captions;
  // The Reel she copies takes its own font over her charter's when it makes its style (the animations get it too); its colours were offered to the editor.
  Object.assign(plan, followedLook(plan, followed));
  // Its look: a preset is already on the plan; one in her words is designed now (named again in a correction, it is
  // kept as it was). A correction keeps its look unless the editor changed it (« none » takes it off); a new Reel
  // takes the look of the Reel she copies, else her default for all her Reels, when she asked for one.
  const baseLook = base && !params.fresh ? planLook(base) : null;
  const askedLook = editorLook(output.plan);
  let lookNote = "";
  if (askedLook && "design" in askedLook) {
    const named = lookChoice(baseLook?.name);
    if (baseLook && named && "design" in named && named.design.toLowerCase() === askedLook.design.toLowerCase()) plan.look = baseLook;
    else {
      const designed = await designLook(params.studioId, askedLook.design);
      if (designed) {
        plan.look = designed.look;
        lookNote = designed.note;
      } else if (baseLook) plan.look = baseLook;
    }
  } else if (!askedLook && correction && baseLook) plan.look = baseLook;
  if (!correction || params.fresh) {
    Object.assign(plan, followedFilter(plan, followed));
    if (!planLook(plan) && profile.look) plan.look = profile.look;
  }

  // The hook's words decide whether anyone stays: a new Reel's written hook is weighed against
  // other forms by the hook judge, who keeps the strongest (an opening animation is its own hook).
  const hook = planHook(plan);
  const opener = plan.segments[0];
  // Never on a Reel she copies: its hook is the model's form, made with her words (« plus de règles en cas de recopiage »).
  const faithfulCopy = Boolean(followed && !followed.dressed);
  if (hook && !hook.text.items?.length && opener && isClipSegment(opener) && !correction && !params.contract?.screen_text && !faithfulCopy) {
    const clip = clips.find((c) => c.media_id === opener.clip_id);
    const firstImage = clip
      ? (clip.analysis.shots.find((shot) => opener.in >= shot.start && opener.in < shot.end)?.description ?? clip.analysis.summary)
      : photos.find((p) => p.media_id === opener.clip_id)?.contenu;
    const judged = await judgeHooks(params.studioId, {
      type: "texte",
      commerce: { nom: studio.data?.name ?? undefined, activite: studio.data?.business_type ?? undefined, ce_qu_on_sait: input.studio.facts, ton: profile.tone },
      demande: params.brief,
      ...(contractLines(params.contract).length ? { contrat: contractLines(params.contract) } : {}),
      premiere_image: firstImage,
      voix_premiere_phrase: spoken?.phrases[0]?.text,
      recentes: hooks.length ? hooks : undefined,
      accroches: [hook.text.text],
    });
    if (judged && judged.index > 0) plan.texts[hook.index] = { ...hook.text, text: judged.text, emphasis: judged.emphasis };
  }

  // The end card writes her name under her logo unless the logo already writes it (read once from its
  // letters): a mascot or a symbol says nothing, and Edith's end card had shown its mascot without a name.
  const ownLogo = profile.logo_path?.startsWith(`${params.studioId}/`) ? profile.logo_path : undefined;
  if (plan.end_card && (ownLogo || profile.logo_url)) {
    const named = await logoNamed(params.studioId, (studio.data?.name as string | null) ?? "", ownLogo ? { path: ownLogo } : { url: profile.logo_url! });
    if (named !== undefined) plan.end_card = { ...plan.end_card, logo_named: named };
  }

  // Her voice plays with its first word at once, her words as subtitles; without it, the plan has no voice.
  // The Reel she copies wins over these defaults: a voice it speaks without subtitles. Her voice leads: the Reel
  // holds a moment after its last word. The texts the editor kept stay (its prompt keeps them few): the engine no
  // longer takes them away, and places them off the subtitles' row.
  if (voice && voiceId && spoken) {
    plan.voice = { media_id: voiceId, at: voiceStart };
    plan.subtitles = !followed || followed.look.voice === "aucune" || followed.look.text.subtitles;
    Object.assign(plan, holdAfterVoice(plan, spoken.ends_at, durations));
  } else delete plan.voice;

  // The finishing touches of a professional editor, from what Gemini read: each clip's
  // light, colour and tilt corrected when it needs it, the vertical crop framed on its
  // subject, a slow move on shots filmed still, her footage under every animation, texts
  // kept off faces, off the lettering in a picture and off the subtitles.
  const facts: MediaFacts = {
    clips: Object.fromEntries(clips.map((c) => [c.media_id, c.analysis])),
    photos: Object.fromEntries(photoIds.flatMap((id, i) => (photoReads[i] ? [[id, photoReads[i]!]] : []))),
    tracks,
  };
  Object.assign(plan, finishPlan(plan, facts, durations));

  // The animations of the version corrected: a scene kept by its id keeps the photos it composes with.
  const previousMotions = previousPlan.success
    ? [...previousPlan.data.segments.filter(isMotionSegment).map((s) => s.motion), ...(previousPlan.data.layers ?? []).map((l) => l.motion)]
    : [];
  const photosOfTemplate = new Map(previousMotions.flatMap((m) => (m.template_id && m.photos?.length ? [[m.template_id, m.photos] as const] : [])));

  // Library scenes: their saved code, with the new texts. An unknown id becomes a new scene.
  const reused = await templateCode(
    params.studioId,
    plan.segments.filter(isMotionSegment).flatMap((s) => (s.motion.template_id && (!copiedOnly || own.has(s.motion.template_id)) ? [s.motion.template_id] : [])),
  );
  plan.segments = plan.segments.map((s) => {
    if (!isMotionSegment(s) || !s.motion.template_id) return s;
    const template = reused.get(s.motion.template_id);
    const photos = photosOfTemplate.get(s.motion.template_id);
    if (template) {
      return { ...s, motion: { ...s.motion, code: template.code, js: template.js, ...(photos ? { photos } : {}), ...(template.fonts.length ? { fonts: template.fonts } : {}) } };
    }
    return { ...s, motion: { ...s.motion, template_id: undefined, texts: undefined } };
  });
  // Free scenes and animations over several shots: reuse the code of unchanged briefs, have the motion designer write the others.
  const reusable = new Map(previousMotions.filter((m) => m.js).map((m) => [m.brief, m] as const));
  const layers = plan.layers ?? [];
  const toWrite = [
    ...plan.segments.flatMap((s, i) => (isMotionSegment(s) && !s.motion.js && !reusable.has(s.motion.brief) ? [{ id: `s${i}`, brief: s.motion.brief }] : [])),
    ...layers.flatMap((l, i) => (!l.motion.js && !reusable.has(l.motion.brief) ? [{ id: `l${i}`, brief: l.motion.brief }] : [])),
  ];
  // Her photos an animation may compose with: in a collage or another composition, every photo of the Reel; elsewhere,
  // those its brief names (by media_id). Each is cut out first (their own sandbox); one without a clean cut-out comes whole.
  const collage = plan.template === "collage" || isComposed(plan);
  const named = (brief: string) => photoIds.filter((id) => brief.includes(id));
  // At most MAX_OFFERED_PHOTOS: the ones a brief names first, then a correction's new photos, then (for a composition)
  // the others in the Reel's order. In the Reel's order alone, Promo Edith 2's five new photos came last, were left
  // out, and the détourages she asked for of them were never drawn.
  const earlierFiles = correction && previousPlan.success ? new Set(planMediaIds(previousPlan.data)) : null;
  // A word asked around or behind something of her photos: every photo under the animations is cut out and shown to them with it (cut_out).
  const around = askedAround || toWrite.some((w) => AROUND_WORDS.test(w.brief) || CUT_OUT_WORDS.test(w.brief));
  const wanted = [
    ...new Set([...toWrite.flatMap((w) => named(w.brief)), ...(earlierFiles ? photoIds.filter((id) => !earlierFiles.has(id)) : []), ...(collage || around ? photoIds : [])]),
  ].slice(0, MAX_OFFERED_PHOTOS);
  await earlyCutouts;
  if (wanted.length) await ensureCutouts(params.studioId, wanted);
  const offers = wanted.length ? await photoOffers(params.studioId, wanted).catch(() => []) : [];
  const offersFor = (brief: string) => (collage ? offers : offers.filter((o) => brief.includes(o.id)));
  // What moves under each animation: the tracks of the clips it plays over, placed as the Reel draws them (the
  // Reel's own segments, built without links), and the gestures Gemini saw in them.
  let reel: ReelProps | null = null;
  if (toWrite.length && Object.keys(tracks).length) {
    try {
      reel = buildReelProps(plan, {
        template: motionTemplateSchema.catch("libre").parse(plan.template),
        clipUrls: Object.fromEntries(planMediaIds(plan).map((id) => [id, "about:blank"])),
        photoIds,
        aspects: Object.fromEntries(clips.map((c) => [c.media_id, clipAspect(c.analysis)])),
        brand: { name: "" },
      });
    } catch (error) {
      console.warn("tracks: the Reel's timing could not be built", error);
    }
  }
  const actions = Object.fromEntries(clips.map((c) => [c.media_id, c.analysis.actions]));
  // The cuts under an animation over several shots, in frames from its start.
  const timeline = planTimeline(plan);
  const starts = timeline.segments.slice(1).map((t) => t.start);
  const cutsUnder = (from: number, to: number) => starts.filter((t) => t > from && t < to).map((t) => Math.round((t - from) * 30));
  // A collage's composition lays the shots itself: what each one shows and when, where the texts go over it,
  // and for its test render, each shot's span and shape (a photo with its cut-out).
  const composition = (): NonNullable<SceneRequest["compose"]> => ({
    plans: compositionShots(plan, facts, Object.fromEntries(offers.map((o) => [o.id, o.shows])), new Set(offers.filter((o) => o.photo.cutout).map((o) => o.id))),
    ...compositionTexts(plan),
    shots: plan.segments.flatMap((s, i) => {
      if (!isClipSegment(s)) return [];
      const at = timeline.segments[i]!;
      const offer = offers.find((o) => o.id === s.clip_id);
      const track = reel ? shotTrack(plan, reel.segments, i, tracks) : undefined;
      // A photo with its framing and its subject's box, as the Reel places them: SubjectBox finds it in the test render too.
      const subject = facts.photos[s.clip_id] ? offer?.photo.subject : undefined;
      return [
        {
          ...(offer?.photo ?? { src: "", aspect: 9 / 16 }),
          segment: i,
          from: Math.round(at.start * 30),
          durationInFrames: Math.round(at.length * 30),
          kind: facts.photos[s.clip_id] ? ("photo" as const) : ("video" as const),
          ...(track ? { track } : {}),
          ...(facts.photos[s.clip_id] && s.photo ? { edit: s.photo } : {}),
          ...(subject ? { subjectBoxes: [[subject.x, subject.y, subject.w, subject.h]] } : {}),
        },
      ];
    }),
  });
  // An animation over the montage: the shots under it, numbered as in the plan (its Subject, SubjectOutline, Depth name
  // them), when each plays (frames from its start) and what it shows, for the tools that cut out what is in them.
  const underLayer = (layer: { from: number; to: number }): SceneRequest["under"] => {
    const start = Math.round(layer.from * 30);
    const end = Math.round(layer.to * 30);
    const c = composition();
    const plans = c.plans.filter((p) => p.to > start && p.from < end).map((p) => ({ ...p, from: p.from - start, to: p.to - start }));
    return plans.length ? { plans, shots: c.shots.map((s) => ({ ...s, from: s.from - start })) } : undefined;
  };
  // Her voice's subtitles show all along it (an animation over several shots meets the subtitles of who speaks in them):
  // an animation's words keep off their row.
  const subtitles = plan.subtitles ? { y: plan.subtitle_y ?? SUBTITLE_ROW.y, h: SUBTITLE_ROW.h } : null;
  const requestFor = (w: { id: string; brief: string }): SceneRequest => {
    const photos = offersFor(w.brief);
    const layer = w.id.startsWith("l") ? layers[Number(w.id.slice(1))]! : null;
    const found = layer ? null : plan.segments[Number(w.id.slice(1))];
    const segment = found && isMotionSegment(found) ? found : null;
    const durationInFrames = Math.round((layer ? layer.to - layer.from : (segment?.duration ?? 2)) * 30);
    const compose = layer?.compose ? composition() : undefined;
    const under = layer && !compose ? underLayer(layer) : undefined;
    // The animation that draws a copied Reel's texts: they are its to draw, at their moments.
    const words = layer?.words ? compositionTexts(plan).texts : undefined;
    // What moves under it: the footage of its passage (a scene), the shots under it (an animation over the montage),
    // or, in a composition, each shot it lays (its code places them in the box it gives the shot).
    const track = !reel || compose
      ? []
      : layer
        ? layerTrack(plan, reel.segments, Math.round(layer.from * 30), durationInFrames, tracks)
        : sceneTrack(plan, reel.segments, Number(w.id.slice(1)), tracks);
    const moves = compose
      ? compose.shots.flatMap((shot, k) => {
          const seen = shot.track ? movesForDesigner([{ at: shot.from, length: shot.durationInFrames, ...shot.track }], durationInFrames, actions, { positions: false }) : null;
          return seen ? [{ shot: k, ...seen }] : [];
        })
      : track.length
        ? movesForDesigner(track, durationInFrames, actions)
        : null;
    return {
      id: w.id,
      brief: w.brief,
      ...(params.brief ? { request: params.brief } : {}),
      durationInFrames,
      // The faces and lettering of the footage under a scene: the designer composes around them.
      ...(segment?.over?.busy?.length ? { busy: segment.over.busy } : {}),
      ...(layer ? { cuts: cutsUnder(layer.from, layer.to) } : {}),
      ...(compose ? { compose } : {}),
      ...(under ? { under } : {}),
      ...(words ? { words } : {}),
      ...(photos.length ? { photos } : {}),
      ...(track.length ? { track } : {}),
      ...(Array.isArray(moves) ? (moves.length ? { moves: { by_shot: moves } } : {}) : moves ? { moves } : {}),
      ...(subtitles && !compose && (plan.voice || layer) ? { subtitles } : {}),
    };
  };
  const requests = toWrite.map(requestFor);
  // The sound effects already made: an animation reuses a name when one fits (a new one costs about a cent).
  if (readyForEditor.length) for (const request of requests) request.readySounds = readyForEditor;
  // The Reel she copies, seen by each animation that remakes part of it: the sheets of its frames at the same point
  // of the Reel (all of them for an animation over the whole Reel), never a sentence alone.
  if (post.data.inspiration_id && requests.length) {
    const sheets = await modelSheets(params.studioId, post.data.inspiration_id as string).catch(() => []);
    if (sheets.length) {
      const modelLength = sheets.at(-1)!.to || 1;
      const spans = planTimeline(plan).segments;
      const modelOf = followed?.dressed ? "dressed" : followed?.house ? "house" : "copy";
      const label = (s: { from: number; to: number }) => `${modelOf === "copy" ? "Le Reel qu'elle recopie" : "L'original du modèle"}, de ${s.from.toFixed(1).replace(".", ",")} s à ${s.to.toFixed(1).replace(".", ",")} s :`;
      for (const request of requests) {
        const layer = request.id.startsWith("l") ? layers[Number(request.id.slice(1))] : null;
        const at = layer ? { start: layer.from, end: layer.to } : spans[Number(request.id.slice(1))] ? { start: spans[Number(request.id.slice(1))]!.start, end: spans[Number(request.id.slice(1))]!.start + spans[Number(request.id.slice(1))]!.length } : null;
        if (!at) continue;
        const whole = at.end - at.start >= plan.duration * 0.7;
        const from = (at.start / plan.duration) * modelLength - 0.5;
        const to = (at.end / plan.duration) * modelLength + 0.5;
        const chosen = whole ? sheets.filter((_, i) => sheets.length <= 8 || i % Math.ceil(sheets.length / 8) === 0).slice(0, 8) : sheets.filter((s) => s.to > from && s.from < to).slice(0, 3);
        if (chosen.length) {
          request.model = chosen.map((s) => ({ label: label(s), jpeg: s.jpeg }));
          request.modelOf = modelOf;
        }
      }
    }
  }
  // One of Edith's models: its reference composition, timed on the model, a worked example for each animation that
  // remakes it (the composition over the whole Reel first of all), never pasted as it is.
  const house = houseModel(followed?.house);
  const example = house?.example ? HOUSE_EXAMPLES[house.example] : undefined;
  if (house && example) for (const request of requests) request.example = { name: house.name, ...example };
  // A correction: each animation rewritten first looks at how its earlier version came out on her images.
  if (correction && previousPlan.success && baseId && requests.length) {
    await lookAtEarlierRender(params.studioId, params.postId, baseId, previousPlan.data, plan, requests, {
      ...Object.fromEntries(clips.map((c) => [c.media_id, c.analysis.actions ?? []])),
      ...Object.fromEntries(
        Object.entries(tracks).map(([id, file]) => [
          id,
          [...(clips.find((c) => c.media_id === id)?.analysis.actions ?? []), ...handMoves({ fps: file.fps, from: file.from, frames: file.frames, aspect: file.w / file.h })],
        ]),
      ),
    }).catch((error: unknown) => console.warn("motion: the earlier render could not be looked at", error));
  }
  // Its motion kit: the business's latest scenes, whose language the new ones keep (a family from one Reel to the next);
  // their names, and those of the Reel's kept animations, say which ideas are already taken.
  const latest = requests.length
    ? ((
        await supabaseAdmin()
          .from("motion_templates")
          .select("id, name, code")
          .eq("studio_id", params.studioId)
          .eq("kind", "scene")
          .in("role", [OVERLAY_ROLE, PHOTO_ROLE, LAYER_ROLE])
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(6)
      ).data ?? [])
    : [];
  const kit = latest.slice(0, 2).flatMap((t) => (t.code ? [{ name: (t.name as string | null) ?? "", code: (t.code as string).slice(0, 6000) }] : []));
  const keptScenes = plan.segments.flatMap((s) =>
    isMotionSegment(s) && (s.motion.js || reusable.has(s.motion.brief))
      ? [latest.find((t) => t.id === s.motion.template_id)?.name ?? s.motion.brief]
      : [],
  );
  const done = latest.filter((t) => t.name && !plan.segments.some((s) => isMotionSegment(s) && s.motion.template_id === t.id)).map((t) => t.name as string);
  const template = motionTemplateSchema.catch("doux").parse(plan.template);
  // Its fonts as the render loads them (a site's font Google does not serve gets its twin).
  const { fonts: usable } = await usableFonts(profile.fonts, (profile.custom_fonts ?? []).map((f) => f.family), template, profile.font_twins).catch(() => ({ fonts: profile.fonts }));
  // Her charter, under the style of the Reel this one copies: the animations move as that Reel does,
  // and set its words as it does (bare words there keep no box of her charter).
  const signature = signatureOf({ signature: profile.signature, followed });
  const bare = followed?.look.text.band === "none";
  const charter = signatureLines(signature)
    ?.split("\n")
    .filter((line) => !(bare && line.startsWith("Phrases sur la vidéo")))
    .join("\n");
  const direction =
    [
      profile.art_direction,
      charter && `Sa charte en réglages (ses titres, son mouvement, sa lumière) :\n${charter}`,
      followed &&
        [
          `Le Reel qu'elle t'a envoyé à recopier, pour ses mots : ${followed.look.text.composition}`,
          bare ? "Ses mots y sont nus, sans boîte ni aplat : fais de même." : "",
          // How its letters are drawn: a fine pen stays fine, never a heavier and cheaper version of it.
          textDrawingWords(followed.look.text) ? `Le dessin de ses mots, à garder : ${textDrawingWords(followed.look.text)}. Jamais une version plus grasse ou plus cheap.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      profile.moodboard?.reading && `Lecture du moodboard de la gérante : ${profile.moodboard.reading}`,
    ]
      .filter(Boolean)
      .join("\n\n") || undefined;
  const sceneBrand = resolveReelBrand(plan, template, {
      name: (studio.data?.name as string | null) ?? "",
      accent: profile.colors?.[0],
      // Her charter's other colours: the animations' palette (secondary, light, dark).
      colors: profile.colors,
      // The real (signed) URL is set at render time; the designer only needs to know a logo exists.
      logoUrl: profile.logo_path ? "https://logo.fauve/studio" : profile.logo_url,
      fonts: usable,
    });
  const sceneContext = {
      kept: keptScenes.map((name) => `already in this Reel: ${name}`),
      done,
      // The Reel's rhythm and look: its test render moves the footage like the video does (what a scene follows stays under it).
      look: {
        template,
        ...(plan.tempo ? { tempo: plan.tempo } : {}),
        ...(signature ? { signature: resolveReelBrand(plan, template, { name: "", signature }).signature } : {}),
      },
    };
  // Its first drafts see the Reel as it will come out without them (her shots, her texts, her subtitles), never blind:
  // with the animations a correction keeps (their brief unchanged), the ones being written drawn as nothing.
  const withKept = <M extends { brief: string; js?: string }>(motion: M): M => {
    const kept = motion.js ? undefined : reusable.get(motion.brief);
    return kept?.js ? { ...motion, code: kept.code, js: kept.js, ...(kept.photos ? { photos: kept.photos } : {}), ...(kept.fonts ? { fonts: kept.fonts } : {}) } : motion;
  };
  const shown: EditPlan = {
    ...plan,
    segments: plan.segments.map((s) => (isMotionSegment(s) ? { ...s, motion: withKept(s.motion) } : s)),
    ...(plan.layers ? { layers: plan.layers.map((l) => ({ ...l, motion: withKept(l.motion) })) } : {}),
  };
  // Her cut out at every image, when the composition will want it (her background replaced, a word behind her): made
  // in the cut-out sandbox while the animations are written, instead of after them, so a whole Reel on another ground
  // has the time it needs (the render step finishes what is left).
  const cutOutAsked =
    (plan.layers ?? []).some((l) => l.compose && CUT_OUT_WORDS.test(l.motion.brief)) ||
    CUT_OUT_WORDS.test(params.brief ?? "") ||
    // A model of Edith's whose reference composition draws her cut out (a title behind her): the director looks at it with her cut-out.
    Boolean(example && /\bSubject\b/.test(example.code));
  const earlySubjects = cutOutAsked
    ? ensureSubjects(params.studioId, params.postId, plan, { anticipate: true }).catch((e: unknown) => console.warn("subjects: not ready", e))
    : null;
  const designed = await designMotionScenes(params.studioId, requests, direction, sceneBrand, kit, {
    ...sceneContext,
    show: (written) => showReel(params.studioId, params.postId, shown, written),
  });
  // The composition is the Reel itself (a split screen, a frame…): when its code failed, a whole new try before
  // the plain montage takes its place (Tristan's split screen fell back to full-frame shots, twice, silently).
  const composeId = requests.find((r) => r.compose)?.id;
  let compositionMissed = Boolean(composeId && !designed.find((d) => d.id === composeId)?.js);
  // Only while the step has time for it (800 s for the whole design): a step cut short would deliver nothing at all.
  if (composeId && !designed.find((d) => d.id === composeId)?.js && timeLeft() > COMPOSE_RETRY_NEEDS_MS) {
    console.warn("composition failed, one more try", params.postId, designed.find((d) => d.id === composeId)?.error);
    const again = (await designMotionScenes(params.studioId, requests.filter((r) => r.id === composeId), direction, sceneBrand, kit, sceneContext).catch(() => []))[0];
    if (again?.js) {
      designed.splice(designed.findIndex((d) => d.id === composeId), 1, again);
      compositionMissed = false;
    }
  }
  // Her cut-outs, started with the animations, kept before the step ends (the render finishes what is left).
  await earlySubjects;
  const resultOf = (id: string) => designed.find((d) => d.id === id);
  plan.segments = plan.segments.map((s, i) => {
    if (!isMotionSegment(s) || s.motion.js) return s;
    const kept = reusable.get(s.motion.brief);
    if (kept)
      return {
        ...s,
        motion: { ...s.motion, code: kept.code, js: kept.js, ...(kept.photos ? { photos: kept.photos } : {}), ...(kept.fonts ? { fonts: kept.fonts } : {}), ...(kept.sounds ? { sounds: kept.sounds } : {}) },
      };
    const result = resultOf(`s${i}`);
    if (result?.error) console.warn("motion scene falls back to its fixed scene", s.motion.brief.slice(0, 80), result.error);
    return {
      ...s,
      motion: {
        ...s.motion,
        code: result?.code ?? undefined,
        js: result?.js ?? undefined,
        ...(result?.js && result.photos?.length ? { photos: result.photos } : {}),
        ...(result?.js && result.fonts?.length ? { fonts: result.fonts } : {}),
        ...(result?.js && result.sounds?.length ? { sounds: result.sounds } : {}),
      },
    };
  });
  // An animation over several shots has no fixed version: one that could not be written is left out.
  const earlierComposition = correction && previousPlan.success ? previousPlan.data.layers?.find((l) => l.compose && l.motion.js) : undefined;
  let compositionKept = false;
  const written = layers.flatMap((l, i) => {
    if (l.motion.js) return [l];
    const kept = reusable.get(l.motion.brief);
    if (kept?.js) {
      const motion = {
        ...l.motion,
        code: kept.code,
        js: kept.js,
        ...(kept.photos ? { photos: kept.photos } : {}),
        ...(kept.fonts ? { fonts: kept.fonts } : {}),
        ...(kept.template_id ? { template_id: kept.template_id } : {}),
        ...(kept.sounds ? { sounds: kept.sounds } : {}),
        // A composition kept as it was draws what it drew (its texts, or only its shots), and keeps its subtitles' row.
        ...(kept.draws_texts ? { draws_texts: true } : {}),
        ...(kept.subtitle_y !== undefined ? { subtitle_y: kept.subtitle_y } : {}),
        ...(kept.writes_spoken !== undefined ? { writes_spoken: kept.writes_spoken } : {}),
      };
      return [{ ...l, motion }];
    }
    const result = resultOf(`l${i}`);
    // A correction whose composition could not be written again keeps the one her Reel had (it lays out the new
    // shots and draws the new texts it is given): Tristan asked for bigger subtitles and lost his whole split screen.
    const earlier = l.compose && !result?.js ? earlierComposition : undefined;
    if (earlier) {
      console.warn("composition not rewritten, the earlier one kept", params.postId, result?.error);
      compositionKept = true;
      return [{ ...l, motion: { ...earlier.motion, brief: l.motion.brief } }];
    }
    if (!result?.js) {
      console.warn("animation over several shots left out", l.motion.brief.slice(0, 80), result?.error);
      return [];
    }
    const motion = {
      ...l.motion,
      code: result.code ?? undefined,
      js: result.js,
      ...(result.photos?.length ? { photos: result.photos } : {}),
      ...(result.fonts?.length ? { fonts: result.fonts } : {}),
      ...(result.sounds?.length ? { sounds: result.sounds } : {}),
      // A collage's composition written now draws the whole picture: its ground, the Reel's texts and its end;
      // it knows where its faces are, so it sets the row of a voice's subtitles (they had landed on Tristan's eyes).
      ...(l.compose ? { draws_texts: true, draws_end: Boolean(plan.end_card) } : {}),
      ...(l.compose && result.subtitleY !== undefined ? { subtitle_y: result.subtitleY } : {}),
      // Its code reads what is said: whether the check saw it written (else the engine's subtitles stay).
      ...(result.spokenShare !== undefined ? { writes_spoken: result.spokenShare >= SPOKEN_WRITTEN } : {}),
    };
    return [{ ...l, motion }];
  });
  if (written.length) plan.layers = written;
  else delete plan.layers;

  // The director looks at its own Reel before it goes out (Tristan: « fait un rendu rapide, regarde les images, corrige
  // une ou deux fois, puis livre »): a composition written now, drawn as it will come out (her cut-outs computed first,
  // as the render does), seen by the one who wrote it, which fixes what is off or keeps it. Only while the step has the
  // time for its images and a call; a look that fails keeps the composition as written.
  for (let look = 0; composeId && !correction && look < (params.looks ?? 1); look++) {
    const fixed = await lookAtOwnReel(params.studioId, params.postId, plan, requests.find((r) => r.id === composeId), designed.find((d) => d.id === composeId), (requests) =>
      designMotionScenes(params.studioId, requests, direction, sceneBrand, kit, sceneContext),
    ).catch((error: unknown) => {
      console.warn("look: the director could not look at its Reel, kept as written", params.postId, error);
      return false;
    });
    // Kept as it was: another look would see the same Reel.
    if (!fixed) break;
  }

  // Every new scene that works joins the studio's library: an animation over her footage can be reused by the
  // next Reels; one made with her photos or over several shots belongs to its Reel (kept for its kit and its name).
  const fresh = designed.filter((d) => d.js && d.code);
  const savedIds = await saveTemplates(
    params.studioId,
    fresh.map((d) => {
      const request = requests.find((r) => r.id === d.id)!;
      const role = d.id.startsWith("l") ? LAYER_ROLE : d.photos?.length ? PHOTO_ROLE : OVERLAY_ROLE;
      return { name: d.name ?? "", description: request.brief, slots: d.slots ?? [], code: d.code!, js: d.js!, fonts: d.fonts ?? [], durationSeconds: request.durationInFrames / 30, role };
    }),
  );
  const savedId = (id: string) => {
    const index = fresh.findIndex((d) => d.id === id);
    return index >= 0 ? savedIds[index] : null;
  };
  plan.segments = plan.segments.map((s, i) => {
    const id = savedId(`s${i}`);
    return id && isMotionSegment(s) ? { ...s, motion: { ...s.motion, template_id: id } } : s;
  });
  if (plan.layers) {
    // A layer's index in its request is the one before the failed ones were left out: matched by brief.
    plan.layers = plan.layers.map((l) => {
      const i = layers.findIndex((x) => x.motion.brief === l.motion.brief);
      const id = i >= 0 ? savedId(`l${i}`) : null;
      return id ? { ...l, motion: { ...l.motion, template_id: id } } : l;
    });
  }
  await markTemplatesUsed([...reused.keys()]).catch((e: unknown) => console.warn("motion_templates: usage count failed", e));

  // A correction that came out worse than the Reel she has never replaces it: the layout she asked for not made, or a
  // Reel half as long without her asking (Promo Edith 2, 13 s with its handwritten title, came back as 3 s of five
  // photos and was delivered over it). Her version stays, nothing is charged (the job reopens its quote), she is told.
  if (correction && previousPlan.success && baseId && !compositionKept) {
    const before = previousPlan.data.duration;
    const shrunk = !params.contract?.duration && plan.duration < before * 0.5;
    if (compositionMissed || shrunk) {
      const { count } = await db.from("renders").select("id", { count: "exact", head: true }).eq("edit_plan_id", baseId).eq("status", "done");
      if (count) throw new MissedCorrection(compositionMissed ? MISSED_LAYOUT : missedLength(plan.duration, before));
    }
  }

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  const version = row.version;
  await db.from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  // A tool of the shared library reused here: its use is noted, settled in two days (lib/tool-maker.ts).
  await recordToolUses(params.studioId, params.postId, row.id, [...reused.keys()]);

  return {
    editPlanId: row.id,
    version,
    plan,
    // Said as it is when the composition she asked for could not be made: never a split screen announced over full-frame shots.
    // The editor's own words describe the composition it asked for: never sent over a Reel that does not have it.
    rationale: compositionKept
      ? "Je n'ai pas réussi à refaire l'animation du haut avec tes changements : je garde celle de la version d'avant, avec tes nouveaux textes et ta nouvelle voix. Dis-moi « refais l'animation » et je la reprends."
      : compositionMissed
        ? "Je n'ai pas réussi à composer la mise en page demandée : cette version passe tes plans en plein cadre. Dis-moi « réessaie la mise en page » et je la refais."
        : [honestLength(output.rationale, plan.duration, params.contract?.duration), lookNote].filter(Boolean).join(" "),
    // A collage's composition is the ambiance itself, and the one that draws a copied Reel's texts is the copy itself:
    // never a paid animation, never counted in her new animations.
    newScenes: requests.filter((r) => !r.compose && !r.words).length,
    reusedScenes: reused.size,
  };
}
