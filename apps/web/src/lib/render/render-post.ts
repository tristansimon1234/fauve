import "server-only";
import { randomUUID } from "node:crypto";
import {
  brandProfileSchema,
  buildAss,
  buildReelProps,
  clipAnalysisSchema,
  motionTemplateSchema,
  type ClipAnalysis,
  buildFfmpegArgs,
  canTransition,
  editPlanSchema,
  postStatusSchema,
  renderDuration,
  type PostStatus,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderInSandbox, renderReelInSandbox } from "./sandbox";

const extensionByMime: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

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
function towardsDraft(status: PostStatus): PostStatus[] {
  if (canTransition(status, "draft")) return ["draft"];
  if (canTransition(status, "media_received") && canTransition("media_received", "draft")) return ["media_received", "draft"];
  return [];
}

/** Renders the latest edit plan of a post to MP4, stores it and links it to the post. */
export async function renderPost(studioId: string, postId: string): Promise<RenderResult> {
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
  const planRow = check(
    await (post.edit_plan_id ? planQuery.eq("id", post.edit_plan_id) : planQuery.order("version", { ascending: false }))
      .limit(1)
      .single(),
  ).data!;
  const plan = editPlanSchema.parse(planRow.plan);

  const clipIds = [...new Set(plan.segments.map((s) => s.clip_id))];
  const assets = check(
    await db.from("media_assets").select("id, storage_path, mime_type").eq("studio_id", studioId).in("id", clipIds),
  ).data!;
  const clipFiles: Record<string, string> = {};
  const clips: Record<string, string> = {};
  const clipUrls: Record<string, string> = {};
  for (const [i, id] of clipIds.entries()) {
    const asset = assets.find((a) => a.id === id);
    if (!asset) throw new Error(`Clip ${id} introuvable dans la médiathèque du studio`);
    const signed = check(await db.storage.from("media").createSignedUrl(asset.storage_path, 3600)).data!;
    const file = `clip${i}.${extensionByMime[asset.mime_type ?? ""] ?? "mp4"}`;
    clipFiles[id] = file;
    clips[file] = signed.signedUrl;
    clipUrls[id] = signed.signedUrl;
  }

  const [brand, studio, analyses] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
    db.from("studios").select("name").eq("id", studioId).single(),
    db.from("clip_analyses").select("media_id, analysis").in("media_id", clipIds).order("created_at", { ascending: false }),
  ]);
  const style = brandProfileSchema
    .pick({ colors: true, logo_url: true })
    .catch({})
    .parse(brand.data?.[0]?.profile ?? {});
  const accent = style.colors?.[0];
  const words: Record<string, ClipAnalysis["words"]> = {};
  for (const row of analyses.data ?? []) {
    const parsed = clipAnalysisSchema.safeParse(row.analysis);
    if (parsed.success && !(row.media_id in words)) words[row.media_id as string] = parsed.data.words;
  }
  const motion = motionTemplateSchema.safeParse(plan.template);

  const renderId = randomUUID();
  check(await db.from("renders").insert({ id: renderId, studio_id: studioId, edit_plan_id: planRow.id, status: "rendering" }));

  const started = Date.now();
  try {
    const ffmpegRender = () =>
      renderInSandbox({ id: renderId, clips, ass: buildAss(plan, accent), ffmpegArgs: buildFfmpegArgs(plan, { clipFiles }) });
    let engine: "remotion" | "ffmpeg" = "ffmpeg";
    let mp4: Buffer;
    let durationMs = Math.round(renderDuration(plan) * 1000);
    if (motion.success) {
      // Motion templates (Remotion); the ffmpeg engine is the safety net.
      const props = buildReelProps(plan, {
        template: motion.data,
        clipUrls,
        words,
        brand: { name: (studio.data?.name as string | null) ?? "", accent, logoUrl: style.logo_url ?? null },
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
    check(await db.from("posts").update({ render_id: renderId, status }).eq("id", postId));

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
