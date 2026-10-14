import "server-only";
import { randomUUID } from "node:crypto";
import {
  brandProfileSchema,
  buildAss,
  buildReelProps,
  clipAnalysisSchema,
  isClipSegment,
  motionTemplateSchema,
  PHOTO_MAX_SECONDS,
  withoutScenes,
  type ClipAnalysis,
  buildFfmpegArgs,
  canTransition,
  editPlanSchema,
  postStatusSchema,
  renderDuration,
  type EditPlan,
  type PostStatus,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderInSandbox, renderReelInSandbox, smokeTestScenes } from "./sandbox";

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
export async function loadMontageInputs(studioId: string, plan: Pick<EditPlan, "segments">) {
  const db = supabaseAdmin();
  const clipIds = [...new Set(plan.segments.filter(isClipSegment).map((s) => s.clip_id))];
  const assets = clipIds.length
    ? check(await db.from("media_assets").select("id, storage_path, mime_type, duration, kind").eq("studio_id", studioId).in("id", clipIds)).data!
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
    .pick({ colors: true, logo_url: true, logo_path: true, fonts: true, custom_fonts: true })
    .catch({})
    .parse(brand.data?.[0]?.profile ?? {});
  const accent = style.colors?.[0];
  // An uploaded logo (private bucket) wins over one found on the website.
  const logoUrl = style.logo_path?.startsWith(`${studioId}/`)
    ? ((await db.storage.from("media").createSignedUrl(style.logo_path, 3600)).data?.signedUrl ?? style.logo_url ?? null)
    : (style.logo_url ?? null);
  // The studio's own fonts: signed for the render (and the live preview) like the logo.
  const ownFonts = (style.custom_fonts ?? []).filter((f) => f.path.startsWith(`${studioId}/`));
  const signedFonts = ownFonts.length ? ((await db.storage.from("media").createSignedUrls(ownFonts.map((f) => f.path), 7200)).data ?? []) : [];
  const customFonts = ownFonts.flatMap((f, i) => (signedFonts[i]?.signedUrl ? [{ family: f.family, url: signedFonts[i]!.signedUrl }] : []));
  const words: Record<string, ClipAnalysis["words"]> = {};
  for (const row of analyses.data ?? []) {
    const parsed = clipAnalysisSchema.safeParse(row.analysis);
    if (parsed.success && !(row.media_id in words)) words[row.media_id as string] = parsed.data.words;
  }
  return {
    clipIds,
    photoIds,
    clipFiles,
    clips,
    clipUrls,
    clipDurations,
    words,
    accent,
    logoUrl,
    fonts: style.fonts,
    customFonts,
    studioName: (studio.data?.name as string | null) ?? "",
  };
}

/**
 * Renders the post's current edit plan (or the version given, which becomes the
 * current one) to MP4, stores it and links it to the post.
 */
export async function renderPost(studioId: string, postId: string, options: { editPlanId?: string } = {}): Promise<RenderResult> {
  const db = supabaseAdmin();
  const post = check(
    await db
      .from("posts")
      .select("id, title, caption, hashtags, status, edit_plan_id")
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
  const { clipFiles, clips, clipUrls, photoIds, words, accent, logoUrl, studioName, fonts, customFonts } = await loadMontageInputs(studioId, plan);
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
        brand: { name: studioName, accent, logoUrl, fonts, customFonts },
      });
      // Library scenes play with new texts, older plans predate the layout check: every
      // scene is checked before the render, and one whose text leaves the frame plays its
      // fixed scene. If the check is unavailable, the scenes stay.
      const checks = await smokeTestScenes(
        props.segments.flatMap((s, i) => (s.type === "motion" ? [{ id: `m${i}`, js: s.js, durationInFrames: s.durationInFrames, texts: s.texts }] : [])),
        props.brand,
      ).catch((e: unknown): Record<string, string | null> => {
        console.warn("motion scenes: check unavailable", e);
        return {};
      });
      props.segments = props.segments.map((s, i) => {
        if (s.type !== "motion" || !checks[`m${i}`]) return s;
        console.warn("motion scene falls back to its fixed scene", renderId, checks[`m${i}`]);
        return { type: "scene", scene: s.fallback, startAt: s.startAt, durationInFrames: s.durationInFrames };
      });
      try {
        mp4 = await renderReelInSandbox({ id: renderId, props });
        engine = "remotion";
        durationMs = Math.round((props.durationInFrames / props.fps) * 1000);
      } catch (error) {
        console.error("remotion render failed, falling back to ffmpeg", renderId, error);
        mp4 = await ffmpegRender();
      }
    } else {
      mp4 = await ffmpegRender();
    }
    const storagePath = `${studioId}/renders/${renderId}.mp4`;
    check(await db.storage.from("media").upload(storagePath, mp4, { contentType: "video/mp4", upsert: true }));
    check(await db.from("renders").update({ status: "done", storage_path: storagePath, duration_ms: durationMs }).eq("id", renderId));

    let status = postStatusSchema.parse(post.status);
    for (const next of towardsDraft(status)) status = next;
    check(await db.from("posts").update({ render_id: renderId, status, ...(options.editPlanId ? { edit_plan_id: planRow.id } : {}) }).eq("id", postId));

    await db.from("cost_events").insert({
      studio_id: studioId,
      kind: "render",
      provider: "vercel_sandbox",
      units: Math.round((Date.now() - started) / 1000),
      meta: { render_id: renderId, engine, template: plan.template, seconds_of_video: durationMs / 1000, bytes: mp4.length },
    });

    const url = check(await db.storage.from("media").createSignedUrl(storagePath, 24 * 3600)).data!.signedUrl;
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
