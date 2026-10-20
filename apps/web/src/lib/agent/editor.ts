import "server-only";
import { insertPlanVersion } from "@/lib/edit-plans";
import {
  editorClip,
  signatureLines,
  followedForEditor,
  followedLook,
  signatureOf,
  editorOutputSchemaLegacy,
  finishPlan,
  type EditorOutput,
  type EditorOutputLegacy,
  type MediaFacts,
  type ReelFormat,
  carryRetouch,
  carryTextStyle,
  clearOfVoice,
  compositionShots,
  textBands,
  holdAfterVoice,
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
  PHOTO_MAX_SECONDS,
  readMemory,
  resolveReelBrand,
  type EditPlan,
  openingCandidates,
  planHook,
  planTimeline,
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
  type ReelProps,
  type TracksByClip,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { ensureCutouts, photoOffers } from "@/lib/render/cutout";
import { videoFramesInSandbox } from "@/lib/render/sandbox";
import { ensureTracks, loadTracks } from "@/lib/render/tracks";
import { usableFonts } from "@/lib/fonts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { ensureTranscript } from "@/lib/voice";
import { photoRegions } from "@/lib/video/regions";
import { latestReport } from "@/lib/performance";
import { judgeHooks } from "./hook-judge";
import { designMotionScenes, type SceneRequest } from "./motion-designer";
import { ensureInspirationRead } from "@/lib/inspirations";
import { MODEL_SOURCE, postStyle, SENT_TO_COPY, STEAL_WAIT_MS } from "@/lib/steal";
import { isFirstReel } from "@/lib/onboarding";
import { LAYER_ROLE, markTemplatesUsed, OVERLAY_ROLE, PHOTO_ROLE, recentlyShownTemplates, saveTemplates, templateCode, templatesForEditor } from "./motion-templates";
import { anthropic, logClaudeCost } from "./run";

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
 * under it, its middle, its end), with its code and what the review found (`seen`).
 */
async function lookAtEarlierRender(
  studioId: string,
  postId: string,
  planId: string,
  previous: EditPlan,
  plan: EditPlan,
  requests: SceneRequest[],
  review: string,
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
    if (look && shown?.length) request.seen = { code: look.code, review, frames: shown };
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

/** How long the montage waits for what moves in her videos (its faces, its hands) before the editor cuts. */
const TRACKS_WAIT_MS = 180_000;

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
  /** Simone chose the form: « message », one key message with the music, no voice. */
  format?: ReelFormat;
}): Promise<DesignedEdit> {
  const db = supabaseAdmin();
  const [post, studio, brand, previous, recent, report, inspirations, hooks] = await Promise.all([
    db.from("posts").select("id, title, kind, caption, platforms, edit_plan_id, template, inspiration_id, voice_media_id").eq("id", params.postId).eq("studio_id", params.studioId).single(),
    db.from("studios").select("name, business_type, booking_url, memory").eq("id", params.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1),
    db.from("edit_plans").select("plan, version").eq("post_id", params.postId).order("version", { ascending: false }).limit(1),
    recentlyShownTemplates(params.studioId, params.postId),
    latestReport(params.studioId).catch(() => null),
    db.from("inspirations").select("analysis, source, copied:style->look").eq("studio_id", params.studioId).not("analysis", "is", null).order("created_at", { ascending: false }).limit(12),
    recentHooks(params.studioId, params.postId).catch(() => []),
  ]);
  if (post.error) throw new Error("Publication introuvable");
  // The Reel she sent to copy (« Steal »): its style, read after her message, is waited for while the rest is read.
  const copying = post.data.inspiration_id ? postStyle(params.studioId, params.postId, { waitMs: STEAL_WAIT_MS }).catch(() => undefined) : Promise.resolve(undefined);

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
  const [analyses, photoReads] = await Promise.all([
    Promise.all(videoIds.map((id) => ensureClipAnalysis(params.studioId, id))),
    Promise.all(photoIds.map((id) => photoRegions(params.studioId, id).catch(() => null))),
  ]);
  const clips = analyses.flatMap((a) => ("analysis" in a ? [{ media_id: a.media_id, analysis: a.analysis }] : []));
  if (videoIds.length && !clips.length && !photoIds.length) throw new Error("Les vidéos ne sont pas encore analysées, réessaie dans une minute");
  // What moves in her videos (hands, faces, bodies), followed once per clip with someone in it (the cut-out sandbox),
  // started now so it runs while the rest is read: an animation can then start from a gesture, hold on to it or follow it.
  const earlyTracks = clips.length
    ? ensureTracks(params.studioId, clips.map((c) => c.media_id)).catch((e: unknown) => console.warn("tracks: not ready", e))
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
  const chosenInspiration = inspirationId ? await ensureInspirationRead(params.studioId, inspirationId).catch(() => null) : null;
  const chosenTemplate = motionTemplateSchema.safeParse(post.data.template);
  // A collage composes with her photos' cut-outs: for one she chose for this post or asks for now (« en collage »), they are
  // made while the editor works (their own sandbox); one the editor chooses itself has them made after it.
  const askedCollage = (chosenTemplate.success && chosenTemplate.data === "collage") || /\bcollage\b/i.test(params.brief ?? "");
  const earlyCutouts =
    askedCollage && photoIds.length
      ? ensureCutouts(params.studioId, photoIds.slice(0, MAX_OFFERED_PHOTOS)).catch((e: unknown) => console.warn("cut-outs: not ready", e))
      : null;
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.[0]?.profile ?? {});
  // What moves in her videos, followed before the editor cuts: which gestures show their hands in the vertical
  // frame (the editor puts an animation that hangs on a gesture where it can be seen), where the faces really are
  // (the texts keep off them) and what the animations follow. Never more than a few minutes of waiting (a sandbox
  // installing the tracker for the first time): without them, the faces are Gemini's and the animations follow nothing.
  if (earlyTracks) await Promise.race([earlyTracks, new Promise((resolve) => setTimeout(resolve, TRACKS_WAIT_MS))]);
  const tracks: TracksByClip = clips.length ? await loadTracks(params.studioId, clips.map((c) => c.media_id)).catch(() => ({})) : {};
  const input = {
    studio: {
      name: studio.data?.name,
      business: studio.data?.business_type ?? undefined,
      booking: Boolean(studio.data?.booking_url),
      // What Simone knows of the business (its site, what was said): where the words on screen come from.
      facts: readMemory(studio.data?.memory).map((f) => f.fact),
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
      // Reels she likes (added in Style, shared with Simone on Instagram), as read by Gemini; not a Reel she sent
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
      // Text looks the manager keeps (copied from examples): the editor reuses them.
      text_looks: profile.text_looks?.length ? profile.text_looks : undefined,
      dos: profile.dos,
      donts: profile.donts,
    },
    post: {
      ...post.data,
      edit_plan_id: undefined,
      template: undefined,
      inspiration_id: undefined,
      voice_media_id: undefined,
      // The collage form she chose for this Reel (or an older Reel's ambiance); « libre » says nothing.
      chosen_template: chosenTemplate.success && chosenTemplate.data !== "libre" ? chosenTemplate.data : undefined,
      chosen_inspiration: chosenInspiration ?? undefined,
      // Simone chose this form: one key message held on screen, with the music, no voice.
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
    templates: library,
    // The hooks of her latest Reels: this one takes another form and other words.
    recent_hooks: hooks.length ? hooks : undefined,
    // Motion code stays out of the editor's context: it only needs the briefs.
    previous_plan:
      correction && previousPlan.success
        ? {
            ...previousPlan.data,
            segments: previousPlan.data.segments.map((s) =>
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
            layers: previousPlan.data.layers?.map((l) => ({ brief: l.motion.brief, from: l.from, to: l.to, ...(l.compose ? { composition_du_collage: true } : {}) })),
          }
        : undefined,
    request: params.brief ?? "Premier montage de cette publication.",
    // Her very first Reel (getting started): it has to wow her.
    first_reel: !previousPlan.success && (await isFirstReel(params.studioId, params.postId)) ? true : undefined,
    // Credits: past this, the editor must reuse library scenes or use fixed ones.
    max_new_scenes: params.maxNewScenes ?? MAX_FREE_SCENES,
  };

  const ask = async (legacy: boolean) => {
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      output_config: { effort: params.effort ?? "high", format: outputFormat(legacy ? editorOutputSchemaLegacy : editorOutputSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: EDITOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(params.studioId, response.usage, "editor");
    return response as { stop_reason: string | null; parsed_output: EditorOutput | EditorOutputLegacy | null };
  };
  // The answer's schema is compiled into a grammar with limits of its own: if the API ever
  // refuses it, the editor answers in the previous, smaller schema rather than not at all.
  const response = await ask(false).catch((error: unknown) => {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : String(error);
    if (status !== 400 || !/grammar|schema|complex|compil/i.test(message)) throw error;
    console.warn("editor: schema refused, answering in the legacy schema", message);
    return ask(true);
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Le montage n'a pas pu être préparé (${response.stop_reason})`);
  }

  const durations = { ...Object.fromEntries(clips.map((c) => [c.media_id, c.analysis.duration])), ...Object.fromEntries(photoIds.map((id) => [id, PHOTO_MAX_SECONDS])) };
  // Retouch and blur stay on their clips from one version to the next.
  // A correction also keeps the texts' styles and places (the editor names looks, it does not copy them).
  const base = previousPlan.success ? previousPlan.data : null;
  // Its animations whose brief did not change keep their code before the new ones are counted;
  // one rewritten (its shots changed, or the request touched it) takes the place of the one it replaces.
  const drafted = keepWrittenAnimations(fromEditorPlan(response.parsed_output.plan, profile.text_looks ?? []), params.fresh ? null : base);
  const allowed = Math.min(MAX_FREE_SCENES, (params.maxNewScenes ?? MAX_FREE_SCENES) + replacedAnimations(drafted, params.fresh ? null : base));
  const plan = carryRetouch(carryTextStyle(normalizeEditPlan(drafted, durations, allowed), params.fresh ? null : base), base);
  // The Reel she copies takes its own font and colours over her charter's when they make its style (the animations get them too).
  Object.assign(plan, followedLook(plan, followed));

  // The hook's words decide whether anyone stays: a new Reel's written hook is weighed against
  // other forms by the hook judge, who keeps the strongest (an opening animation is its own hook).
  const hook = planHook(plan);
  const opener = plan.segments[0];
  if (hook && !hook.text.items?.length && opener && isClipSegment(opener) && !correction) {
    const clip = clips.find((c) => c.media_id === opener.clip_id);
    const firstImage = clip
      ? (clip.analysis.shots.find((shot) => opener.in >= shot.start && opener.in < shot.end)?.description ?? clip.analysis.summary)
      : photos.find((p) => p.media_id === opener.clip_id)?.contenu;
    const judged = await judgeHooks(params.studioId, {
      type: "texte",
      commerce: { nom: studio.data?.name ?? undefined, activite: studio.data?.business_type ?? undefined, ce_qu_on_sait: input.studio.facts, ton: profile.tone },
      demande: params.brief,
      premiere_image: firstImage,
      voix_premiere_phrase: spoken?.phrases[0]?.text,
      recentes: hooks.length ? hooks : undefined,
      accroches: [hook.text.text],
    });
    if (judged && judged.index > 0) plan.texts[hook.index] = { ...hook.text, text: judged.text, emphasis: judged.emphasis };
  }

  // The finishing touches of a professional editor, from what Gemini read: each clip's
  // light, colour and tilt corrected when it needs it, the vertical crop framed on its
  // subject, a slow move on shots filmed still, her footage under every animation, texts
  // kept off faces and off the lettering in a picture.
  const facts: MediaFacts = {
    clips: Object.fromEntries(clips.map((c) => [c.media_id, c.analysis])),
    photos: Object.fromEntries(photoIds.flatMap((id, i) => (photoReads[i] ? [[id, photoReads[i]!]] : []))),
    tracks,
  };
  Object.assign(plan, finishPlan(plan, facts, durations));

  // Her voice plays with its first word at once, her words as subtitles; without it, the plan has no voice.
  // The Reel she copies wins over these defaults: a voice it speaks without subtitles, several texts it sets over its voice.
  if (voice && voiceId && spoken) {
    plan.voice = { media_id: voiceId, at: voiceStart };
    plan.subtitles = !followed || followed.look.voice === "aucune" || followed.look.text.subtitles;
    // Her voice leads: the Reel holds a moment after its last word, and the other texts keep to
    // its silences (its words are the subtitles; the hook stays over its first phrase).
    Object.assign(plan, holdAfterVoice(plan, spoken.ends_at, durations));
    if (followed?.look.text.amount !== "plusieurs") plan.texts = clearOfVoice(plan.texts, spoken.phrases);
  } else delete plan.voice;

  // The animations of the version corrected: a scene kept by its id keeps the photos it composes with.
  const previousMotions = previousPlan.success
    ? [...previousPlan.data.segments.filter(isMotionSegment).map((s) => s.motion), ...(previousPlan.data.layers ?? []).map((l) => l.motion)]
    : [];
  const photosOfTemplate = new Map(previousMotions.flatMap((m) => (m.template_id && m.photos?.length ? [[m.template_id, m.photos] as const] : [])));

  // Library scenes: their saved code, with the new texts. An unknown id becomes a new scene.
  const reused = await templateCode(
    params.studioId,
    plan.segments.filter(isMotionSegment).flatMap((s) => (s.motion.template_id ? [s.motion.template_id] : [])),
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
  // Her photos an animation may compose with: in a collage, every photo of the Reel; elsewhere, those its brief
  // names (by media_id). Each is cut out first (their own sandbox); one without a clean cut-out comes whole.
  const collage = plan.template === "collage";
  const named = (brief: string) => photoIds.filter((id) => brief.includes(id));
  const wanted = [...new Set(toWrite.flatMap((w) => (collage ? photoIds : named(w.brief))))].slice(0, MAX_OFFERED_PHOTOS);
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
    texts: textBands(plan),
    shots: plan.segments.flatMap((s, i) => {
      if (!isClipSegment(s)) return [];
      const at = timeline.segments[i]!;
      const offer = offers.find((o) => o.id === s.clip_id);
      const track = reel ? shotTrack(plan, reel.segments, i, tracks) : undefined;
      return [
        {
          ...(offer?.photo ?? { src: "", aspect: 9 / 16 }),
          segment: i,
          from: Math.round(at.start * 30),
          durationInFrames: Math.round(at.length * 30),
          kind: facts.photos[s.clip_id] ? ("photo" as const) : ("video" as const),
          ...(track ? { track } : {}),
        },
      ];
    }),
  });
  const requests: SceneRequest[] = toWrite.map((w) => {
    const photos = offersFor(w.brief);
    const layer = w.id.startsWith("l") ? layers[Number(w.id.slice(1))]! : null;
    const found = layer ? null : plan.segments[Number(w.id.slice(1))];
    const segment = found && isMotionSegment(found) ? found : null;
    const durationInFrames = Math.round((layer ? layer.to - layer.from : (segment?.duration ?? 2)) * 30);
    const compose = layer?.compose ? composition() : undefined;
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
          return seen ? [{ plan: k, ...seen }] : [];
        })
      : track.length
        ? movesForDesigner(track, durationInFrames, actions)
        : null;
    return {
      id: w.id,
      brief: w.brief,
      durationInFrames,
      // The faces and lettering of the footage under a scene: the designer composes around them.
      ...(segment?.over?.busy?.length ? { busy: segment.over.busy } : {}),
      ...(layer ? { cuts: cutsUnder(layer.from, layer.to) } : {}),
      ...(compose ? { compose } : {}),
      ...(photos.length ? { photos } : {}),
      ...(track.length ? { track } : {}),
      ...(Array.isArray(moves) ? (moves.length ? { moves: { par_plan: moves } } : {}) : moves ? { moves } : {}),
    };
  });
  // A correction: each animation rewritten first looks at how its earlier version came out on her images.
  if (correction && previousPlan.success && baseId && requests.length) {
    await lookAtEarlierRender(params.studioId, params.postId, baseId, previousPlan.data, plan, requests, params.brief ?? "", {
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
  const designed = await designMotionScenes(
    params.studioId,
    requests,
    [
      profile.art_direction,
      charter && `Sa charte en réglages (ses titres, son mouvement, sa lumière) :\n${charter}`,
      followed &&
        `Le Reel qu'elle t'a envoyé à recopier, pour ses mots : ${followed.look.text.composition}${bare ? " Ses mots y sont nus, sans boîte ni aplat (une ombre légère les fait lire) : fais de même." : ""}`,
      profile.moodboard?.reading && `Lecture du moodboard de la gérante : ${profile.moodboard.reading}`,
    ]
      .filter(Boolean)
      .join("\n\n") || undefined,
    resolveReelBrand(plan, template, {
      name: (studio.data?.name as string | null) ?? "",
      accent: profile.colors?.[0],
      // The real (signed) URL is set at render time; the designer only needs to know a logo exists.
      logoUrl: profile.logo_path ? "https://logo.fauve/studio" : profile.logo_url,
      fonts: usable,
    }),
    kit,
    {
      kept: keptScenes.map((name) => `déjà dans ce Reel : ${name}`),
      done,
      // The Reel's rhythm and look: its test render moves the footage like the video does (what a scene follows stays under it).
      look: {
        template,
        ...(plan.tempo ? { tempo: plan.tempo } : {}),
        ...(signature ? { signature: resolveReelBrand(plan, template, { name: "", signature }).signature } : {}),
      },
    },
  );
  const resultOf = (id: string) => designed.find((d) => d.id === id);
  plan.segments = plan.segments.map((s, i) => {
    if (!isMotionSegment(s) || s.motion.js) return s;
    const kept = reusable.get(s.motion.brief);
    if (kept) return { ...s, motion: { ...s.motion, code: kept.code, js: kept.js, ...(kept.photos ? { photos: kept.photos } : {}), ...(kept.fonts ? { fonts: kept.fonts } : {}) } };
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
      },
    };
  });
  // An animation over several shots has no fixed version: one that could not be written is left out.
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
      };
      return [{ ...l, motion }];
    }
    const result = resultOf(`l${i}`);
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
    };
    return [{ ...l, motion }];
  });
  if (written.length) plan.layers = written;
  else delete plan.layers;

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

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  const version = row.version;
  await db.from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  return {
    editPlanId: row.id,
    version,
    plan,
    rationale: response.parsed_output.rationale,
    // A collage's composition is the ambiance itself, never a paid animation.
    newScenes: requests.filter((r) => !r.compose).length,
    reusedScenes: reused.size,
  };
}
