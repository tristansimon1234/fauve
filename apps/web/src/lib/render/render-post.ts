import "server-only";
import { randomUUID } from "node:crypto";
import {
  brandProfileSchema,
  buildAss,
  buildReelProps,
  clipAnalysisSchema,
  clipAspect,
  clipsUnderAnimations,
  isClipSegment,
  motionTemplateSchema,
  planMediaIds,
  PHOTO_MAX_SECONDS,
  scenePhotoIds,
  withoutScenes,
  type ClipAnalysis,
  buildFfmpegArgs,
  canTransition,
  editPlanSchema,
  followedOf,
  postStatusSchema,
  renderDuration,
  signatureOf,
  sceneShifts,
  withShifts,
  type EditPlan,
  type PostKind,
  type PostStatus,
  type ReelInputs,
  voiceTranscriptSchema,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logoTone } from "./logo-tone";
import { withMusic } from "./music";
import { usableFonts } from "@/lib/fonts";
import { makeSceneSprite } from "./scene-sprite";
import { ensureCutouts, sceneCutoutInputs, stickerInputs } from "./cutout";
import { loadTracks } from "./tracks";
import { renderInSandbox, renderReelInSandbox, sandboxCostEur, smokeTestScenes, type SceneChecks } from "./sandbox";

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
 * Shared by the render and the live editor.
 */
export async function loadMontageInputs(
  studioId: string,
  plan: Pick<EditPlan, "segments"> & { voice?: EditPlan["voice"]; template?: EditPlan["template"]; layers?: EditPlan["layers"] },
) {
  const db = supabaseAdmin();
  const clipIds = planMediaIds(plan);
  const assets = clipIds.length
    ? check(await db.from("media_assets").select("id, storage_path, mime_type, duration, kind, regions").eq("studio_id", studioId).in("id", clipIds)).data!
    : [];
  const clipFiles: Record<string, string> = {};
  const clips: Record<string, string> = {};
  const clipUrls: Record<string, string> = {};
  const clipDurations: Record<string, number | null> = {};
  for (const [i, id] of clipIds.entries()) {
    const asset = assets.find((a) => a.id === id);
    if (!asset) throw new Error(`Clip ${id} introuvable dans la médiathèque du studio`);
    const signed = check(await db.storage.from("media").createSignedUrl(asset.storage_path, 3600)).data!;
    const file = `clip${i}.${extensionByMime[asset.mime_type ?? ""] ?? "mp4"}`;
    clipFiles[id] = file;
    clips[file] = signed.signedUrl;
    clipUrls[id] = signed.signedUrl;
    clipDurations[id] = asset.kind === "image" ? PHOTO_MAX_SECONDS : asset.duration === null ? null : Number(asset.duration);
  }
  // Photos play still in a Reel, with a slow zoom.
  const photoIds = assets.filter((a) => a.kind === "image").map((a) => a.id as string);

  const [brand, studio, analyses] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
    db.from("studios").select("name").eq("id", studioId).single(),
    clipIds.length
      ? db.from("clip_analyses").select("media_id, analysis").in("media_id", clipIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { media_id: string; analysis: unknown }[] }),
  ]);
  const style = brandProfileSchema
    .pick({ colors: true, logo_url: true, logo_path: true, fonts: true, custom_fonts: true, font_twins: true, signature: true })
    .catch({})
    .parse(brand.data?.[0]?.profile ?? {});
  // A Reel she likes whose style her Reels follow (« Steal »): its look goes over her charter.
  const followed = followedOf(brand.data?.[0]?.profile);
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
  const voice = plan.voice ? await voiceInput(studioId, plan.voice.media_id) : undefined;
  // A collage lays the subject of a photo as a sticker when its cut-out is clean; in any Reel, an
  // animation composes with the photos it names, and their clean cut-outs.
  const withPhotos = scenePhotoIds(plan);
  const cutouts = template === "collage" && plan.template === "collage" ? await stickerInputs(studioId, photoIds).catch(() => ({})) : undefined;
  // The animations' cut-outs: a clean edge is enough, even cut by the photo's frame (the animation brings the subject in from there).
  const sceneCutouts = withPhotos.length ? await sceneCutoutInputs(studioId, withPhotos).catch(() => ({})) : undefined;
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
  for (const row of analyses.data ?? []) {
    const parsed = clipAnalysisSchema.safeParse(row.analysis);
    if (!parsed.success || row.media_id in words) continue;
    words[row.media_id as string] = parsed.data.words;
    aspects[row.media_id as string] = clipAspect(parsed.data);
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
    // her Reels, the style she follows over it).
    signature: style.signature,
    reelSignature: signatureOf({ signature: style.signature, followed }),
    followed,
    studioName: (studio.data?.name as string | null) ?? "",
    voice,
    cutouts,
    sceneCutouts,
    photoAspects,
    tracks,
  };
}

/** A voice note as the composition plays it: its signed link and its words; undefined if it is gone or not read. */
async function voiceInput(studioId: string, mediaId: string): Promise<ReelInputs["voice"]> {
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("storage_path, transcript").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  const transcript = voiceTranscriptSchema.safeParse(asset?.transcript);
  if (!asset || !transcript.success) return undefined;
  const signed = await db.storage.from("media").createSignedUrl(asset.storage_path as string, 7200);
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
  // Photos have their subject cut out once (an open model in its own sandbox): a collage's, laid as stickers,
  // and those an animation composes with (the design step has usually made them already).
  const toCut = plan.template === "collage" ? planMediaIds(plan) : scenePhotoIds(plan);
  if (toCut.length) await ensureCutouts(studioId, toCut);
  const { clipFiles, clips, clipUrls, photoIds, words, aspects, accent, logoUrl, logoOnDark, studioName, fonts, colors, customFonts, reelSignature: signature, voice, cutouts, sceneCutouts, photoAspects, tracks } =
    await loadMontageInputs(studioId, plan);
  const motion = motionTemplateSchema.safeParse(plan.template);

  const renderId = randomUUID();
  check(await db.from("renders").insert({ id: renderId, studio_id: studioId, edit_plan_id: planRow.id, status: "rendering" }));

  const started = Date.now();
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
    let engine: "remotion" | "ffmpeg" = "ffmpeg";
    let mp4: Buffer;
    let durationMs = Math.round(renderDuration(withoutScenes(plan)) * 1000);
    if (motion.success) {
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
        photoAspects,
        ...(Object.keys(tracks).length ? { tracks } : {}),
      });
      // Library scenes play with new texts, older plans predate the layout check: every
      // scene is checked before the render, and one whose text leaves the frame plays its
      // fixed scene (an animation over several shots, which has none, is left out). If the
      // check is unavailable, the scenes stay.
      // A scene that follows what moves is checked where it goes: with the footage's tracks and the Reel's camera moves.
      const look = { template: props.template, ...(props.tempo ? { tempo: props.tempo } : {}), ...(props.brand.signature ? { signature: props.brand.signature } : {}) };
      const checks = await smokeTestScenes(
        [
          ...props.segments.flatMap((s, i) =>
            s.type === "motion"
              ? [{ id: `m${i}`, js: s.js, durationInFrames: s.durationInFrames, texts: s.texts, ...(s.photos ? { photos: s.photos } : {}), ...(s.track ? { track: s.track, look } : {}) }]
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
          })),
        ],
        props.brand,
      ).catch((e: unknown): SceneChecks => {
        console.warn("motion scenes: check unavailable", e);
        return { errors: {}, bands: {}, faces: {} };
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
      // An animation over her footage never covers a face or a sign under it: where its texts sit
      // was just measured, the whole scene moves to the free rows when they fall on them. The move
      // is kept on the plan, so the live preview shows it where the video has it.
      const shifts = sceneShifts(plan, checks.bands);
      if (shifts.size) {
        props.segments = props.segments.map((s, i) => {
          if (s.type !== "motion" || !shifts.has(i)) return s;
          // Measured now: this move replaces the one kept on the plan (none when the texts are clear).
          return { ...s, shift: (s.under && shifts.get(i)) || undefined };
        });
        // Kept on the plan as it is stored (not its parsed copy), so nothing else of it changes.
        const kept = withShifts(planRow.plan as EditPlan, shifts);
        if (kept) {
          const saved = await db.from("edit_plans").update({ plan: kept }).eq("id", planRow.id);
          if (saved.error) console.warn("motion scenes: shift not kept on the plan", planRow.id, saved.error.message);
        }
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
    // Simone's music, composed for this cut (or the one kept for it), on the video.
    const voiced = await withMusic({ studioId, postId, kind: post.kind as PostKind, plan, mp4, renderId, fresh: options.freshMusic }).catch((error: unknown) => {
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
    // The strip of scenes under the Reel, when the video follows the plan (the ffmpeg engine drops its animations).
    if (engine === "remotion" || plan.segments.every(isClipSegment)) {
      await makeSceneSprite({ studioId, renderId, videoUrl: url, plan }).catch((error: unknown) => console.warn("scenes strip failed", renderId, error));
    }

    const seconds = Math.round((Date.now() - started) / 1000);
    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "render",
      provider: "vercel_sandbox",
      units: seconds,
      cost_eur: sandboxCostEur(seconds),
      meta: { render_id: renderId, engine, template: plan.template, seconds_of_video: durationMs / 1000, bytes: mp4.length },
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
