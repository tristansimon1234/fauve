import "server-only";
import { randomUUID } from "node:crypto";
import {
  brandProfileSchema,
  buildAss,
  buildReelProps,
  busyTimeline,
  clipAnalysisSchema,
  clipAspect,
  clipsUnderAnimations,
  isClipSegment,
  motionTemplateSchema,
  isComposed,
  planMediaIds,
  PHOTO_MAX_SECONDS,
  scenePhotoIds,
  depthPhotoIds,
  dayIn,
  withoutScenes,
  type ClipAnalysis,
  buildFfmpegArgs,
  canTransition,
  editPlanSchema,
  postStatusSchema,
  renderDuration,
  signatureOf,
  photoDetectionSchema,
  subtitleRowAmong,
  SUBTITLE_ROW,
  textBands,
  type EditPlan,
  type MediaFacts,
  type PostKind,
  type PostStatus,
  type ReelInputs,
  type ReelProps,
  type TracksByClip,
  voiceTranscriptSchema,
} from "@fauve/agent";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { meterWaits } from "@/lib/work-slots";
import { logoTone } from "./logo-tone";
import { withMusic } from "./music";
import { usableFonts } from "@/lib/fonts";
import { makeSceneSprite } from "./scene-sprite";
import { ensureCutouts, sceneCutoutInputs, stickerInputs } from "./cutout";
import { ensureCleanCopies } from "@/lib/video/speech";
import { loadTracks } from "./tracks";
import { postStyle } from "@/lib/steal";
import { renderInSandbox, renderReelInSandbox, sandboxCostEur, smokeTestScenes, type SceneChecks } from "./sandbox";
import { costMeta } from "@/lib/cost-scope";

const extensionByMime: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type RenderResult = {
  renderId: string;
  postId: string;
  title: string;
  caption: string | null;
  hashtags: string[];
  storagePath: string;
  durationMs: number;
  /** Signed link to the MP4, valid 24 h (WhatsApp fetches it, the web app shows it). */
  url: string;
};

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

/** Moves the post forward to "draft" (to validate) when the state machine allows it. */
export function towardsDraft(status: PostStatus): PostStatus[] {
  if (canTransition(status, "draft")) return ["draft"];
  if (canTransition(status, "media_received") && canTransition("media_received", "draft")) return ["media_received", "draft"];
  return [];
}

/**
 * What a montage needs besides its plan: signed clip links (1 h), word timings
 * for subtitles, the brand (accent, logo, fonts, name) and each clip's length.
 * Shared by the render and the live editor. With its post, a Reel's look also
 * takes the style of the Reel it copies (« Steal », `reelSignature`).
 */
export async function loadMontageInputs(
  studioId: string,
  plan: Pick<EditPlan, "segments"> & { voice?: EditPlan["voice"]; template?: EditPlan["template"]; layers?: EditPlan["layers"]; finish?: EditPlan["finish"] },
  options: { postId?: string } = {},
) {
  const db = supabaseAdmin();
  const clipIds = planMediaIds(plan);
  const [assetRows, analyses] = await Promise.all([
    clipIds.length
      ? db.from("media_assets").select("id, storage_path, original_path, stabilized, mime_type, duration, kind, regions").eq("studio_id", studioId).in("id", clipIds)
      : Promise.resolve({ data: [], error: null }),
    clipIds.length
      ? db.from("clip_analyses").select("media_id, analysis").in("media_id", clipIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { media_id: string; analysis: unknown }[] }),
  ]);
  const assets = check(assetRows).data ?? [];
  // Which file of each video plays (her finishing touches, finish): its copy with the sound cleaned
  // (unless she wants it as recorded), and its shaky original when she does not want it steadied.
  const cleaned = new Map<string, string>();
  for (const row of analyses.data ?? []) {
    const path = clipAnalysisSchema.safeParse(row.analysis).data?.speech?.path;
    if (path && !cleaned.has(row.media_id as string)) cleaned.set(row.media_id as string, path);
  }
  const fileOf = (asset: (typeof assets)[number]): string => {
    if (plan.finish?.steady === "off" && asset.stabilized && asset.original_path) return asset.original_path as string;
    const copy = cleaned.get(asset.id as string);
    return copy && plan.finish?.sound !== "original" && copy.startsWith(`${studioId}/`) ? copy : (asset.storage_path as string);
  };
  const clipFiles: Record<string, string> = {};
  const clips: Record<string, string> = {};
  const clipUrls: Record<string, string> = {};
  const clipDurations: Record<string, number | null> = {};
  for (const [i, id] of clipIds.entries()) {
    const asset = assets.find((a) => a.id === id);
    if (!asset) throw new Error(`Clip ${id} introuvable dans la médiathèque du studio`);
    const signed = check(await db.storage.from("media").createSignedUrl(fileOf(asset), 3600)).data!;
    const file = `clip${i}.${extensionByMime[asset.mime_type ?? ""] ?? "mp4"}`;
    clipFiles[id] = file;
    clips[file] = signed.signedUrl;
    clipUrls[id] = signed.signedUrl;
    clipDurations[id] = asset.kind === "image" ? PHOTO_MAX_SECONDS : asset.duration === null ? null : Number(asset.duration);
  }
  // Photos play still in a Reel, with a slow zoom.
  const photoIds = assets.filter((a) => a.kind === "image").map((a) => a.id as string);

  const [brand, studio] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
    db.from("studios").select("name").eq("id", studioId).single(),
  ]);
  const style = brandProfileSchema
    .pick({ colors: true, logo_url: true, logo_path: true, fonts: true, custom_fonts: true, font_twins: true, signature: true })
    .catch({})
    .parse(brand.data?.[0]?.profile ?? {});
  // The Reel this one copies (« Steal »): its look goes over her charter, for this Reel only.
  const followed = options.postId ? await postStyle(studioId, options.postId).catch(() => undefined) : undefined;
  const accent = style.colors?.[0];
  // An uploaded logo (private bucket) wins over one found on the website.
  const logoUrl = style.logo_path?.startsWith(`${studioId}/`)
    ? ((await db.storage.from("media").createSignedUrl(style.logo_path, 3600)).data?.signedUrl ?? style.logo_url ?? null)
    : (style.logo_url ?? null);
  const logoOnDark = !logoUrl
    ? undefined
    : await logoTone(style.logo_path?.startsWith(`${studioId}/`) ? { path: style.logo_path } : { url: style.logo_url! });
  // The studio's own fonts: signed for the render (and the live preview) like the logo.
  const ownFonts = (style.custom_fonts ?? []).filter((f) => f.path.startsWith(`${studioId}/`));
  const signedFonts = ownFonts.length ? ((await db.storage.from("media").createSignedUrls(ownFonts.map((f) => f.path), 7200)).data ?? []) : [];
  const customFonts = ownFonts.flatMap((f, i) => (signedFonts[i]?.signedUrl ? [{ family: f.family, url: signedFonts[i]!.signedUrl }] : []));
  // Her fonts as the render can load them: a site's font Google does not serve gets its twin (or the ambiance's).
  const template = motionTemplateSchema.catch("doux").parse(plan.template);
  const { fonts } = await usableFonts(style.fonts, ownFonts.map((f) => f.family), template, style.font_twins);
  // Her voice note over the Reel: signed for the render and the preview, with her words.
  const voice = plan.voice ? await voiceInput(studioId, plan.voice.media_id, plan.finish?.sound !== "original") : undefined;
  // A collage lays the subject of a photo as a sticker when its cut-out is clean; in any Reel, an
  // animation composes with the photos it names, and their clean cut-outs.
  const withPhotos = scenePhotoIds(plan);
  const cutouts = (template === "collage" && plan.template === "collage") || isComposed(plan) ? await stickerInputs(studioId, photoIds).catch(() => ({})) : undefined;
  // The animations' cut-outs: a clean edge is enough, even cut by the photo's frame (the animation brings the subject in from there).
  const sceneCutouts = withPhotos.length ? await sceneCutoutInputs(studioId, withPhotos).catch(() => ({})) : undefined;
  // A moving photo whose subject cuts out cleanly plays in relief (the same clean cut-out).
  const moving = depthPhotoIds(plan);
  const depth = moving.length ? await sceneCutoutInputs(studioId, moving).catch(() => ({})) : undefined;
  // Each photo's shape, from its reading.
  const photoAspects = Object.fromEntries(
    assets.flatMap((a) => {
      const read = (a.kind === "image" ? a.regions : null) as { width?: number; height?: number } | null;
      return read?.width && read.height ? [[a.id as string, read.width / read.height]] : [];
    }),
  );
  // What moves in the footage under its animations (hands, faces, bodies, read once per clip): their code follows it.
  const tracks = await loadTracks(studioId, clipsUnderAnimations(plan)).catch(() => ({}));
  const words: Record<string, ClipAnalysis["words"]> = {};
  // Each clip's shape, to frame its subject in the vertical crop (phones film 16:9 or 9:16).
  const aspects: Record<string, number> = {};
  // What was read in her clips and photos (where faces and lettering are), for the place of a voice's subtitles.
  const facts: MediaFacts = { clips: {}, photos: {} };
  for (const row of analyses.data ?? []) {
    const parsed = clipAnalysisSchema.safeParse(row.analysis);
    if (!parsed.success || row.media_id in words) continue;
    words[row.media_id as string] = parsed.data.words;
    aspects[row.media_id as string] = clipAspect(parsed.data);
    facts.clips[row.media_id as string] = parsed.data;
  }
  for (const a of assets) {
    const read = photoReadSchema.safeParse(a.kind === "image" ? a.regions : null);
    if (read.success) facts.photos[a.id as string] = read.data;
  }
  return {
    clipIds,
    photoIds,
    clipFiles,
    clips,
    clipUrls,
    clipDurations,
    words,
    aspects,
    accent,
    logoUrl,
    logoOnDark,
    fonts,
    colors: style.colors,
    customFonts,
    // Her art direction as settings: the render's theme follows it (her photos, her own charter;
    // a Reel that copies another, that one's style over it).
    signature: style.signature,
    reelSignature: signatureOf({ signature: style.signature, followed }),
    followed,
    studioName: (studio.data?.name as string | null) ?? "",
    voice,
    cutouts,
    sceneCutouts,
    depth,
    photoAspects,
    tracks,
    facts,
  };
}

/** A photo's reading as kept on it (its size and what Gemini saw: faces, lettering). */
const photoReadSchema = z.object({ width: z.number(), height: z.number(), detection: photoDetectionSchema });

/**
 * The check of a Reel's animations before it renders (scenes `m<i>`, animations over several shots `l<i>`): one whose text
 * leaves the frame is refused, and what each draws, row by row, is measured. Library scenes play with new texts, older
 * plans predate the layout check: every animation is checked. A scene that follows what moves is checked where it goes,
 * with the footage's tracks and the Reel's camera moves. Unavailable, nothing is refused.
 */
export async function checkReelAnimations(props: ReelProps): Promise<SceneChecks> {
  const look = { template: props.template, ...(props.tempo ? { tempo: props.tempo } : {}), ...(props.brand.signature ? { signature: props.brand.signature } : {}) };
  return smokeTestScenes(
    [
      ...props.segments.flatMap((s, i) =>
        s.type === "motion"
          ? [
              {
                id: `m${i}`,
                js: s.js,
                durationInFrames: s.durationInFrames,
                texts: s.texts,
                ...(s.photos ? { photos: s.photos } : {}),
                ...(s.track ? { track: s.track, look } : {}),
                ...(s.fonts ? { fonts: s.fonts } : {}),
              },
            ]
          : [],
      ),
      ...(props.layers ?? []).map((l, i) => ({
        id: `l${i}`,
        js: l.js,
        durationInFrames: l.durationInFrames,
        texts: l.texts,
        cuts: l.cuts,
        ...(l.photos ? { photos: l.photos } : {}),
        ...(l.shots ? { shots: l.shots } : {}),
        ...(l.track || l.shots?.some((x) => x.track) ? { look, ...(l.track ? { track: l.track } : {}) } : {}),
        ...(l.fonts ? { fonts: l.fonts } : {}),
      })),
    ],
    props.brand,
  ).catch((e: unknown): SceneChecks => {
    console.warn("motion scenes: check unavailable", e);
    return { errors: {}, faces: {}, cover: {} };
  });
}

/**
 * A voice's subtitles show all along it, on one row for the whole Reel: once its animations are drawn (those that pass
 * their check), the row where they, the faces and the Reel's texts leave them room (Tristan: « il faut pas masquer mais
 * bien les placer là où ça ne gêne pas les anim et les visages »). The new row, or undefined when it stays where it is
 * (no voice, or a composition that plays sets its own). The render uses it, and the look before it, so that the
 * animations are looked at with the subtitles where they will be.
 */
export async function subtitleRowAmongAnimations(
  studioId: string,
  plan: EditPlan,
  props: ReelProps,
  checks: SceneChecks,
  inputs: { clipIds: string[]; tracks: TracksByClip; facts: MediaFacts },
): Promise<number | undefined> {
  if (!props.words.length || props.layers?.some((l, i) => l.compose && !checks.errors[`l${i}`])) return undefined;
  // What each animation that plays draws, row by row, for as long as it plays.
  const drawnFor = (id: string, frames: number) => (!checks.errors[id] && checks.cover[id] ? [{ seconds: frames / props.fps, profile: checks.cover[id]! }] : []);
  const drawnBy = [
    ...props.segments.flatMap((s, i) => (s.type === "motion" ? drawnFor(`m${i}`, s.durationInFrames) : [])),
    ...(props.layers ?? []).flatMap((l, i) => drawnFor(`l${i}`, l.durationInFrames)),
  ];
  const current = props.subtitleY ?? SUBTITLE_ROW.y;
  const missing = inputs.clipIds.filter((id) => !(id in inputs.tracks) && !inputs.facts.photos[id]);
  const everyTrack = { ...inputs.tracks, ...(await loadTracks(studioId, missing).catch(() => ({}))) };
  const row = subtitleRowAmong(current, {
    faces: busyTimeline(plan, { ...inputs.facts, tracks: everyTrack }).flatMap((s) => s.windows),
    animations: drawnBy,
    texts: textBands(plan.texts, Boolean(plan.voice)),
  });
  return row === current ? undefined : row;
}

/** The finished video of a Reel the effects agent made: its one shot. */
async function bakedVideo(studioId: string, plan: EditPlan): Promise<Buffer> {
  const shot = plan.segments.find(isClipSegment);
  if (!shot) throw new Error("Reel de l'atelier d'effets sans vidéo");
  const db = supabaseAdmin();
  const asset = check(await db.from("media_assets").select("storage_path").eq("id", shot.clip_id).eq("studio_id", studioId).single()).data!;
  const { data, error } = await db.storage.from("media").download(asset.storage_path as string);
  if (!data) throw new Error(`Vidéo de l'effet introuvable : ${error?.message ?? asset.storage_path}`);
  return Buffer.from(await data.arrayBuffer());
}

/** A voice note as the composition plays it: its signed link and its words; undefined if it is gone or not read. */
async function voiceInput(studioId: string, mediaId: string, cleaned = true): Promise<ReelInputs["voice"]> {
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("storage_path, transcript").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  const transcript = voiceTranscriptSchema.safeParse(asset?.transcript);
  if (!asset || !transcript.success) return undefined;
  // Her voice note's copy with its sound cleaned, unless she wants it as recorded.
  const copy = cleaned && transcript.data.clean?.path?.startsWith(`${studioId}/`) ? transcript.data.clean.path : null;
  const signed = await db.storage.from("media").createSignedUrl(copy ?? (asset.storage_path as string), 7200);
  return signed.data ? { src: signed.data.signedUrl, words: transcript.data.words } : undefined;
}

/**
 * Renders the post's current edit plan (or the version given, which becomes the
 * current one) to MP4, stores it and links it to the post.
 */
export async function renderPost(studioId: string, postId: string, options: { editPlanId?: string; freshMusic?: boolean } = {}): Promise<RenderResult> {
  const db = supabaseAdmin();
  const post = check(
    await db
      .from("posts")
      .select("id, title, kind, caption, hashtags, status, edit_plan_id")
      .eq("id", postId)
      .eq("studio_id", studioId)
      .single(),
  ).data!;

  const planQuery = db.from("edit_plans").select("id, version, plan").eq("post_id", postId);
  const planId = options.editPlanId ?? post.edit_plan_id;
  const planRow = check(
    await (planId ? planQuery.eq("id", planId) : planQuery.order("version", { ascending: false }))
      .limit(1)
      .single(),
  ).data!;
  const plan = editPlanSchema.parse(planRow.plan);
  // Photos have their subject cut out once (an open model in its own sandbox): a collage's, laid as stickers, a
  // composed Reel's, and those an animation composes with (the design step has usually made them already).
  const toCut = plan.template === "collage" || isComposed(plan) ? planMediaIds(plan) : [...new Set([...scenePhotoIds(plan), ...depthPhotoIds(plan)])];
  if (toCut.length) await ensureCutouts(studioId, toCut);
  // She wants the sound cleaned, even where it was not noisy: the cleaned copies are made first.
  if (plan.finish?.sound === "clean") await ensureCleanCopies(studioId, planMediaIds(plan), plan.voice?.media_id);
  const { clipIds, clipFiles, clips, clipUrls, photoIds, words, aspects, accent, logoUrl, logoOnDark, studioName, fonts, colors, customFonts, reelSignature: signature, voice, cutouts, sceneCutouts, depth, photoAspects, tracks, facts } =
    await loadMontageInputs(studioId, plan, { postId });
  const motion = motionTemplateSchema.safeParse(plan.template);

  const renderId = randomUUID();
  check(await db.from("renders").insert({ id: renderId, studio_id: studioId, edit_plan_id: planRow.id, status: "rendering" }));

  const started = Date.now();
  const waited = meterWaits();
  try {
    // The ffmpeg engine has no motion-design scenes: it renders the clips only.
    // Blurred zones (faces, plates) only exist in the Remotion composition: never fall back without them.
    const needsBlur = plan.segments.some((s) => isClipSegment(s) && s.blur?.tracks.length);
    const ffmpegRender = () => {
      if (needsBlur) throw new Error("Ce montage floute des zones : le moteur de secours ne sait pas le faire, réessaie dans un instant");
      if (photoIds.length) throw new Error("Ce montage anime des photos : le moteur de secours ne sait pas le faire, réessaie dans un instant");
      if (plan.voice) throw new Error("Ce montage porte ta voix : le moteur de secours ne sait pas la poser, réessaie dans un instant");
      const clipsOnly = withoutScenes(plan);
      if (!clipsOnly.segments.length) throw new Error("Montage sans vidéo : le moteur de motion design est indisponible");
      return renderInSandbox({ id: renderId, clips, ass: buildAss(clipsOnly, accent), ffmpegArgs: buildFfmpegArgs(clipsOnly, { clipFiles }) });
    };
    let engine: "remotion" | "ffmpeg" | "baked" = "ffmpeg";
    let mp4: Buffer;
    let durationMs = Math.round(renderDuration(withoutScenes(plan)) * 1000);
    if (plan.baked) {
      // A Reel the effects agent made: its video plays as it is (its texts and its effect are in the image), the music goes on it.
      mp4 = await bakedVideo(studioId, plan);
      engine = "baked";
      durationMs = Math.round(plan.duration * 1000);
    } else if (motion.success) {
      // Motion templates (Remotion); the ffmpeg engine is the safety net.
      const props = buildReelProps(plan, {
        template: motion.data,
        clipUrls,
        photoIds,
        words,
        aspects,
        brand: { name: studioName, accent, logoUrl, logoOnDark, fonts, colors, customFonts, signature },
        ...(voice ? { voice } : {}),
        ...(cutouts ? { cutouts } : {}),
        ...(sceneCutouts ? { sceneCutouts } : {}),
        ...(depth ? { depth } : {}),
        today: dayIn(),
        photoAspects,
        ...(Object.keys(tracks).length ? { tracks } : {}),
      });
      // Every animation is checked before the render: one whose text leaves the frame plays its fixed scene (an
      // animation over several shots, which has none, is left out). If the check is unavailable, the scenes stay.
      const checks = await checkReelAnimations(props);
      // Where a voice's subtitles go once its animations are drawn, weighed on the animations as checked (below).
      const row = await subtitleRowAmongAnimations(studioId, plan, props, checks, { clipIds, tracks, facts }).catch((error: unknown) => {
        console.warn("subtitles' row not weighed, kept", renderId, error);
        return undefined;
      });
      props.segments = props.segments.map((s, i) => {
        if (s.type !== "motion" || !checks.errors[`m${i}`]) return s;
        console.warn("motion scene falls back to its fixed scene", renderId, checks.errors[`m${i}`]);
        return { type: "scene", scene: s.fallback, startAt: s.startAt, durationInFrames: s.durationInFrames, ...(s.under ? { under: s.under } : {}) };
      });
      // An animation over several shots has no fixed version: one whose text leaves the frame is left out.
      if (props.layers) {
        const layers = props.layers.filter((_, i) => {
          const error = checks.errors[`l${i}`];
          if (error) console.warn("animation over several shots left out", renderId, error);
          return !error;
        });
        props.layers = layers.length ? layers : undefined;
      }
      // Where an animation sits over her footage is its designer's (it looked at it on her images): the engine no longer
      // moves it (a move kept on an older plan stays, motion.shift).
      // A voice's subtitles on the row its animations, faces and texts leave free; kept on the plan, so the preview shows them there too.
      if (row !== undefined) {
        console.log("subtitles placed where the animations leave room", renderId, props.subtitleY ?? SUBTITLE_ROW.y, "→", row);
        props.subtitleY = row;
        const saved = await db.from("edit_plans").update({ plan: { ...(planRow.plan as Record<string, unknown>), subtitle_y: row } }).eq("id", planRow.id);
        if (saved.error) console.warn("subtitles' row not kept on the plan", planRow.id, saved.error.message);
      }
      try {
        mp4 = await renderReelInSandbox({ id: renderId, props });
        engine = "remotion";
        durationMs = Math.round((props.durationInFrames / props.fps) * 1000);
      } catch (error) {
        // A collage's composition that broke the render gives way to the printed collage; photos, blurred
        // zones or her voice: the ffmpeg engine cannot render them, Remotion gets a second try.
        const composed = Boolean(props.layers?.some((l) => l.compose));
        if (composed || needsBlur || photoIds.length || plan.voice) {
          console.error("remotion render failed, trying again", renderId, composed ? "without its composition" : "", error);
          const layers = props.layers?.filter((l) => !l.compose);
          mp4 = await renderReelInSandbox({ id: `${renderId}-again`, props: { ...props, layers: layers?.length ? layers : undefined } });
          engine = "remotion";
          durationMs = Math.round((props.durationInFrames / props.fps) * 1000);
        } else {
          console.error("remotion render failed, falling back to ffmpeg", renderId, error);
          mp4 = await ffmpegRender();
        }
      }
    } else {
      mp4 = await ffmpegRender();
    }
    // Edith's music, composed for this cut (or the one kept for it), on the video; the sound of her videos kept all along
    // with nobody speaking (finish.video_sound « all ») stays under it as an ambience.
    const ambient =
      plan.finish?.video_sound === "all" &&
      !plan.voice &&
      !plan.segments.some((s) => isClipSegment(s) && (words[s.clip_id] ?? []).some((w) => w.start >= s.in && w.end <= s.out));
    const voiced = await withMusic({ studioId, postId, kind: post.kind as PostKind, plan, mp4, renderId, fresh: options.freshMusic, ambient }).catch((error: unknown) => {
      console.warn("music unavailable, silent Reel", renderId, error);
      return { mp4, music: "none" as const };
    });
    mp4 = voiced.mp4;
    const storagePath = `${studioId}/renders/${renderId}.mp4`;
    check(await db.storage.from("media").upload(storagePath, mp4, { contentType: "video/mp4", upsert: true }));
    check(await db.from("renders").update({ status: "done", storage_path: storagePath, duration_ms: durationMs }).eq("id", renderId));

    let status = postStatusSchema.parse(post.status);
    for (const next of towardsDraft(status)) status = next;
    check(await db.from("posts").update({ render_id: renderId, status, ...(options.editPlanId ? { edit_plan_id: planRow.id } : {}) }).eq("id", postId));

    const url = check(await db.storage.from("media").createSignedUrl(storagePath, 24 * 3600)).data!.signedUrl;
    // The strip of scenes under the Reel, when the video follows the plan (the ffmpeg engine drops its animations;
    // the effects agent's video is one shot: no strip).
    if (engine === "remotion" || (engine === "ffmpeg" && plan.segments.every(isClipSegment))) {
      await makeSceneSprite({ studioId, renderId, videoUrl: url, plan }).catch((error: unknown) => console.warn("scenes strip failed", renderId, error));
    }

    // The time it worked: a render that queued for a sandbox is not charged for the wait.
    const seconds = Math.round(Math.max(0, Date.now() - started - waited.ms) / 1000);
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "render",
      provider: "vercel_sandbox",
      units: seconds,
      cost_eur: sandboxCostEur(seconds),
      meta: costMeta({ render_id: renderId, engine, template: plan.template, seconds_of_video: durationMs / 1000, bytes: mp4.length }),
    });

    return {
      renderId,
      postId,
      title: post.title as string,
      caption: post.caption as string | null,
      hashtags: (post.hashtags as string[] | null) ?? [],
      storagePath,
      durationMs,
      url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("renders").update({ status: "failed", error: message.slice(0, 2000) }).eq("id", renderId);
    throw error;
  }
}
