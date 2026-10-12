import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  CLAUDE_MODEL,
  EDITOR_SYSTEM_PROMPT,
  editorOutputSchema,
  editPlanSchema,
  normalizeEditPlan,
  type EditPlan,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { anthropic, logClaudeCost } from "./run";

export type DesignedEdit = { editPlanId: string; version: number; plan: EditPlan; rationale: string };

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
}): Promise<DesignedEdit> {
  const db = supabaseAdmin();
  const [post, studio, brand, previous] = await Promise.all([
    db.from("posts").select("id, title, kind, caption, platforms").eq("id", params.postId).eq("studio_id", params.studioId).single(),
    db.from("studios").select("name, booking_url").eq("id", params.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1),
    db.from("edit_plans").select("plan, version").eq("post_id", params.postId).order("version", { ascending: false }).limit(1),
  ]);
  if (post.error) throw new Error("Publication introuvable");

  const previousPlan = editPlanSchema.safeParse(previous.data?.[0]?.plan);
  const mediaIds = params.mediaIds?.length
    ? params.mediaIds
    : previousPlan.success
      ? [...new Set(previousPlan.data.segments.map((s) => s.clip_id))]
      : [];
  if (!mediaIds.length) throw new Error("Aucune vidéo à monter : indique les media_id des clips");

  const analyses = await Promise.all(mediaIds.map((id) => ensureClipAnalysis(params.studioId, id)));
  const clips = analyses.flatMap((a) => ("analysis" in a ? [{ media_id: a.media_id, analysis: a.analysis }] : []));
  if (!clips.length) throw new Error("Les vidéos ne sont pas encore analysées, réessaie dans une minute");

  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.[0]?.profile ?? {});
  const input = {
    studio: { name: studio.data?.name, booking: Boolean(studio.data?.booking_url) },
    brand: { tone: profile.tone, visual_notes: profile.visual_notes, colors: profile.colors, dos: profile.dos, donts: profile.donts },
    post: post.data,
    clips: clips.map((c) => ({ media_id: c.media_id, ...c.analysis, words: c.analysis.words?.length ? c.analysis.words : undefined })),
    previous_plan: params.brief && previousPlan.success ? previousPlan.data : undefined,
    request: params.brief ?? "Premier montage de cette publication.",
  };

  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: betaZodOutputFormat(editorOutputSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: EDITOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  await logClaudeCost(params.studioId, response.usage, "editor");
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Le montage n'a pas pu être préparé (${response.stop_reason})`);
  }

  const durations = Object.fromEntries(clips.map((c) => [c.media_id, c.analysis.duration]));
  const plan = normalizeEditPlan(response.parsed_output.plan, durations);

  const version = ((previous.data?.[0]?.version as number | undefined) ?? 0) + 1;
  const row = await db
    .from("edit_plans")
    .insert({ studio_id: params.studioId, post_id: params.postId, version, plan })
    .select("id")
    .single();
  if (row.error) throw new Error(row.error.message);
  await db.from("posts").update({ edit_plan_id: row.data.id }).eq("id", params.postId);
  return { editPlanId: row.data.id as string, version, plan, rationale: response.parsed_output.rationale };
}
