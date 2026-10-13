import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  CLAUDE_MODEL,
  EDITOR_SYSTEM_PROMPT,
  editorOutputSchema,
  editPlanSchema,
  fromEditorPlan,
  isClipSegment,
  isMotionSegment,
  motionTemplateSchema,
  normalizeEditPlan,
  resolveReelBrand,
  type EditPlan,
} from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { designMotionScenes } from "./motion-designer";
import { markTemplatesUsed, saveTemplates, templateCode, templatesForEditor } from "./motion-templates";
import { anthropic, logClaudeCost } from "./run";

export type DesignedEdit = {
  editPlanId: string;
  version: number;
  plan: EditPlan;
  rationale: string;
  /** Scenes written by the motion designer for this plan (the costly part), and scenes reused from the library. */
  newScenes: number;
  reusedScenes: number;
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
}): Promise<DesignedEdit> {
  const db = supabaseAdmin();
  const [post, studio, brand, previous, library] = await Promise.all([
    db.from("posts").select("id, title, kind, caption, platforms").eq("id", params.postId).eq("studio_id", params.studioId).single(),
    db.from("studios").select("name, booking_url").eq("id", params.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1),
    db.from("edit_plans").select("plan, version").eq("post_id", params.postId).order("version", { ascending: false }).limit(1),
    templatesForEditor(params.studioId),
  ]);
  if (post.error) throw new Error("Publication introuvable");

  const previousPlan = editPlanSchema.safeParse(previous.data?.[0]?.plan);
  const mediaIds = params.mediaIds?.length
    ? params.mediaIds
    : previousPlan.success
      ? [...new Set(previousPlan.data.segments.filter(isClipSegment).map((s) => s.clip_id))]
      : [];
  // No clips is fine: the editor then builds a Reel entirely in motion design.
  const analyses = await Promise.all(mediaIds.map((id) => ensureClipAnalysis(params.studioId, id)));
  const clips = analyses.flatMap((a) => ("analysis" in a ? [{ media_id: a.media_id, analysis: a.analysis }] : []));
  if (mediaIds.length && !clips.length) throw new Error("Les vidéos ne sont pas encore analysées, réessaie dans une minute");

  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.[0]?.profile ?? {});
  const input = {
    studio: { name: studio.data?.name, booking: Boolean(studio.data?.booking_url) },
    brand: {
      tone: profile.tone,
      art_direction: profile.art_direction,
      moodboard: profile.moodboard?.reading,
      default_template: profile.default_template,
      visual_notes: profile.visual_notes,
      colors: profile.colors,
      fonts: profile.fonts,
      dos: profile.dos,
      donts: profile.donts,
    },
    post: post.data,
    clips: clips.map((c) => ({ media_id: c.media_id, ...c.analysis, words: c.analysis.words?.length ? c.analysis.words : undefined })),
    // Scenes already made: reusing one costs nothing.
    templates: library,
    // Motion code stays out of the editor's context: it only needs the briefs.
    previous_plan:
      params.brief && previousPlan.success
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
          }
        : undefined,
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
  const plan = normalizeEditPlan(fromEditorPlan(response.parsed_output.plan), durations);

  // Library scenes: their saved code, with the new texts. An unknown id becomes a new scene.
  const reused = await templateCode(
    params.studioId,
    plan.segments.filter(isMotionSegment).flatMap((s) => (s.motion.template_id ? [s.motion.template_id] : [])),
  );
  plan.segments = plan.segments.map((s) => {
    if (!isMotionSegment(s) || !s.motion.template_id) return s;
    const template = reused.get(s.motion.template_id);
    if (template) return { ...s, motion: { ...s.motion, code: template.code, js: template.js } };
    return { ...s, motion: { ...s.motion, template_id: undefined, texts: undefined } };
  });

  // Free scenes: reuse the code of unchanged briefs, have the motion designer write the others.
  const reusable = new Map(
    (previousPlan.success ? previousPlan.data.segments : [])
      .filter(isMotionSegment)
      .filter((s) => s.motion.js)
      .map((s) => [s.motion.brief, s.motion] as const),
  );
  const requests = plan.segments.flatMap((s, i) =>
    isMotionSegment(s) && !s.motion.js && !reusable.has(s.motion.brief)
      ? [{ id: `s${i}`, brief: s.motion.brief, durationInFrames: Math.round(s.duration * 30) }]
      : [],
  );
  const designed = await designMotionScenes(
    params.studioId,
    requests,
    [profile.art_direction, profile.moodboard?.reading && `Lecture du moodboard de la gérante : ${profile.moodboard.reading}`]
      .filter(Boolean)
      .join("\n\n") || undefined,
    resolveReelBrand(plan, motionTemplateSchema.catch("doux").parse(plan.template), {
      name: (studio.data?.name as string | null) ?? "",
      accent: profile.colors?.[0],
      // The real (signed) URL is set at render time; the designer only needs to know a logo exists.
      logoUrl: profile.logo_path ? "https://logo.fauve/studio" : profile.logo_url,
      fonts: profile.fonts,
    }),
  );
  plan.segments = plan.segments.map((s, i) => {
    if (!isMotionSegment(s) || s.motion.js) return s;
    const kept = reusable.get(s.motion.brief);
    if (kept) return { ...s, motion: { ...s.motion, code: kept.code, js: kept.js } };
    const result = designed.find((d) => d.id === `s${i}`);
    if (result?.error) console.warn("motion scene falls back to its fixed scene", s.motion.brief.slice(0, 80), result.error);
    return { ...s, motion: { ...s.motion, code: result?.code ?? undefined, js: result?.js ?? undefined } };
  });

  // Every new scene that works joins the studio's library, so the next Reels can reuse it.
  const fresh = designed.filter((d) => d.js && d.code);
  const savedIds = await saveTemplates(
    params.studioId,
    fresh.map((d) => {
      const request = requests.find((r) => r.id === d.id)!;
      return { name: d.name ?? "", description: request.brief, slots: d.slots ?? [], code: d.code!, js: d.js!, durationSeconds: request.durationInFrames / 30 };
    }),
  );
  plan.segments = plan.segments.map((s, i) => {
    const index = fresh.findIndex((d) => d.id === `s${i}`);
    const id = index >= 0 ? savedIds[index] : null;
    return id && isMotionSegment(s) ? { ...s, motion: { ...s.motion, template_id: id } } : s;
  });
  await markTemplatesUsed([...reused.keys()]).catch((e: unknown) => console.warn("motion_templates: usage count failed", e));

  const version = ((previous.data?.[0]?.version as number | undefined) ?? 0) + 1;
  const row = await db
    .from("edit_plans")
    .insert({ studio_id: params.studioId, post_id: params.postId, version, plan })
    .select("id")
    .single();
  if (row.error) throw new Error(row.error.message);
  await db.from("posts").update({ edit_plan_id: row.data.id }).eq("id", params.postId);
  return {
    editPlanId: row.data.id as string,
    version,
    plan,
    rationale: response.parsed_output.rationale,
    newScenes: requests.length,
    reusedScenes: reused.size,
  };
}
