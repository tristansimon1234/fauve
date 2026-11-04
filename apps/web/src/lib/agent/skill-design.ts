import "server-only";
import {
  BRIEF_MAX,
  CHAT_MODEL,
  compositionShots,
  compositionTexts,
  contractLines,
  fewFiles,
  finishPlan,
  followedFilter,
  followedLook,
  houseModel,
  isClipSegment,
  memoryLines,
  motionTemplateSchema,
  planLook,
  planTimeline,
  readSkillFill,
  resolveReelBrand,
  shotScore,
  SKILL_FILL_PROMPT,
  skillFillInput,
  skillFillSchema,
  skillPlan,
  skillShotCount,
  type BrandProfile,
  type ClipAnalysis,
  type EditPlan,
  type FollowedStyle,
  type MediaFacts,
  type MontageSkill,
  type ReelContract,
  type SkillFile,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { skillFor } from "@fauve/agent/skills";
import { insertPlanVersion } from "@/lib/edit-plans";
import { usableFonts } from "@/lib/fonts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { noteGap } from "@/lib/toolkit";
import { designMotionScenes, type SceneRequest } from "./motion-designer";
import { anthropic, logClaudeCost } from "./run";

// A Reel made on a montage skill (packages/agent/src/skills.ts): one of Edith's models coded once for the whole Reel,
// like an Edits or CapCut template. One small call (Sonnet) says whether her request is served by it, casts her files
// on its shots and writes its words; the plan is code; its composition is played as it is, only checked (never written
// again by the motion designer). Anything else (a voice, another layout, more than its slots), the editor, whose motion
// designer starts from the skill's code.

export type SkillDesign = { plan: EditPlan; editPlanId: string; version: number; rationale: string };

/** The skill a Reel can be made on before anything is asked: one of Edith's models with a skill, without a voice nor a layout of hers. */
export function skillCandidate(followed: FollowedStyle | undefined, contract: ReelContract | undefined, voice: boolean): MontageSkill | undefined {
  const skill = skillFor(followed?.house);
  if (!skill || voice || contract?.layout || contract?.voice_text || contract?.voice_text_rest) return undefined;
  return skill;
}

/** Her files as a skill casts them: a video's length, what it shows and its moments worth showing (best first); a photo's reading. */
export function skillFiles(mediaIds: string[], clips: { media_id: string; analysis: ClipAnalysis }[], photos: MediaFacts["photos"]): SkillFile[] {
  return mediaIds.flatMap((id): SkillFile[] => {
    const photo = photos[id];
    if (photo) return [{ id, photo: true, seconds: 0, shows: (photo.detection.notes ?? "").slice(0, 200) }];
    const clip = clips.find((c) => c.media_id === id);
    if (!clip) return [];
    const a = clip.analysis;
    const shots = [...a.shots].filter((s) => !s.quality.blurry && !s.quality.dark).sort((x, y) => shotScore(y, a) - shotScore(x, a));
    return [
      {
        id,
        photo: false,
        seconds: a.duration,
        shows: a.summary.slice(0, 200),
        moments: [...a.best_moments.map((m) => ({ start: m.start, end: m.end, what: m.why.slice(0, 120) })), ...shots.map((s) => ({ start: s.start, end: s.end, what: s.description.slice(0, 120) }))],
      },
    ];
  });
}

/**
 * Her Reel on the skill, or null when her request needs more than the skill does (the editor then makes it from the
 * skill's code), when its words could not be written, or when its composition does not pass the check.
 */
export async function designSkill(params: {
  studioId: string;
  postId: string;
  skill: MontageSkill;
  followed: FollowedStyle;
  /** Her files, in her order. */
  mediaIds: string[];
  clips: { media_id: string; analysis: ClipAnalysis }[];
  photos: MediaFacts["photos"];
  brief?: string;
  contract?: ReelContract;
  /** The version corrected, when it was made on this skill: its words are kept but what her request changes. */
  previous?: EditPlan | null;
  studio: { name?: string | null; business?: string | null; memory?: unknown; booking?: boolean };
  profile: Partial<BrandProfile>;
}): Promise<SkillDesign | null> {
  const { skill } = params;
  const name = houseModel(skill.key)?.name ?? skill.key;
  const files = skillFiles(params.mediaIds, params.clips, params.photos);
  if (!files.length) return null;
  const n = skillShotCount(skill, files);
  // A correction keeps its words but what her request changes: the words of its texts, by slot.
  const current = params.previous?.skill?.key === skill.key ? Object.fromEntries(skill.texts.flatMap((t) => {
    const same = params.previous!.texts.filter((x) => x.style === t.role);
    const k = skill.texts.filter((x) => x.role === t.role).indexOf(t);
    return same[k] ? [[t.slot, same[k]!.text] as const] : [];
  })) : undefined;
  const input = skillFillInput({
    skill,
    name,
    n,
    files,
    business: { name: params.studio.name, activity: params.studio.business, facts: memoryLines(params.studio.memory), booking: params.studio.booking, tone: params.profile.tone },
    request: params.brief?.slice(0, BRIEF_MAX) || "Un Reel fait sur ce modèle, avec ses fichiers.",
    contract: contractLines(params.contract),
    ...(current && Object.keys(current).length ? { current } : {}),
  });
  let answer;
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 6000,
      output_config: { effort: "medium", format: outputFormat(skillFillSchema) },
      system: SKILL_FILL_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(params.studioId, response.usage, "skill_fill", CHAT_MODEL);
    answer = response.parsed_output ? readAnswer(skillFillSchema, response.parsed_output) : null;
  } catch (error) {
    console.warn("skill: its filling failed, the editor makes the Reel", params.postId, error);
    return null;
  }
  if (!answer) return null;
  if (!answer.fits) {
    console.log("skill: her request needs the editor", params.postId, skill.key, answer.missing);
    // What the skill could not do, noted: a gap that comes back becomes a tool (toolkit).
    await noteGap({ studioId: params.studioId, postId: params.postId, source: "skill", label: answer.missing.trim().slice(0, 200) || `une demande hors du modèle « ${name} »`, request: params.brief });
    return null;
  }
  const fill = readSkillFill(skill, files, n, answer);
  if (!fill) return null;

  const plan = skillPlan({ skill, name, files, fill });
  // The model's lettering when she chose it (her charter's when Edith picked it), and its finish (its grade, its grain).
  Object.assign(plan, followedLook(plan, params.followed));
  Object.assign(plan, followedFilter(plan, params.followed));
  if (!planLook(plan) && params.profile.look) plan.look = params.profile.look;
  // Each shot framed on its subject and its light corrected, as any montage.
  const durations = Object.fromEntries(files.map((f) => [f.id, f.photo ? plan.duration : f.seconds]));
  const facts: MediaFacts = { clips: Object.fromEntries(params.clips.map((c) => [c.media_id, c.analysis])), photos: params.photos, tracks: {} };
  Object.assign(plan, finishPlan(plan, facts, durations));

  // Its composition checked as any composition, never written again: a failure leaves the Reel to the editor.
  const checked = await checkSkill(params.studioId, plan, facts, params.profile, params.studio.name ?? "", name, params.brief).catch((error: unknown) => {
    console.warn("skill: its check could not run", params.postId, error);
    return null;
  });
  if (!checked) return null;
  const layer = plan.layers![0]!;
  plan.layers = [{ ...layer, motion: { ...layer.motion, js: checked.js, ...(checked.fonts.length ? { fonts: checked.fonts } : {}) } }];

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  await supabaseAdmin().from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  return {
    plan,
    editPlanId: row.id,
    version: row.version,
    rationale: [`Je l'ai monté sur le modèle « ${name} ».`, answer.why.trim().slice(0, 300)].filter(Boolean).join(" "),
  };
}

/** The scene check of a skill's composition on her Reel (its shots as grey cards, its texts and marks): its js, or null when it fails. */
async function checkSkill(
  studioId: string,
  plan: EditPlan,
  facts: MediaFacts,
  profile: Partial<BrandProfile>,
  business: string,
  name: string,
  asked?: string,
): Promise<{ js: string; fonts: string[] } | null> {
  const layer = plan.layers?.find((l) => l.compose);
  if (!layer?.motion.code) return null;
  const timeline = planTimeline(plan);
  const shots = plan.segments.flatMap((s, i) => {
    if (!isClipSegment(s)) return [];
    const at = timeline.segments[i]!;
    const photo = facts.photos[s.clip_id];
    const clip = facts.clips[s.clip_id];
    const aspect = photo ? photo.width / Math.max(1, photo.height) : clip?.orientation === "landscape" ? 16 / 9 : clip?.orientation === "square" ? 1 : 9 / 16;
    return [{ src: "", aspect, segment: i, from: Math.round(at.start * 30), durationInFrames: Math.round(at.length * 30), kind: photo ? ("photo" as const) : ("video" as const) }];
  });
  const template = motionTemplateSchema.catch("libre").parse(plan.template);
  const { fonts } = await usableFonts(profile.fonts, (profile.custom_fonts ?? []).map((f) => f.family), template, profile.font_twins).catch(() => ({ fonts: profile.fonts }));
  const brand = resolveReelBrand(plan, template, { name: business, accent: profile.colors?.[0], colors: profile.colors, logoUrl: profile.logo_path ? "https://logo.fauve/studio" : profile.logo_url, fonts });
  const request: SceneRequest = {
    id: "l0",
    brief: layer.motion.brief,
    ...(asked ? { request: asked } : {}),
    durationInFrames: Math.round((layer.to - layer.from) * 30),
    compose: { plans: compositionShots(plan, facts), shots, ...compositionTexts(plan) },
    draft: { code: layer.motion.code, name, ...(layer.motion.fonts?.length ? { fonts: layer.motion.fonts } : {}) },
    keep: true,
  };
  const [result] = await designMotionScenes(studioId, [request], undefined, brand, [], { look: { template, ...(plan.tempo ? { tempo: plan.tempo } : {}) } });
  if (!result?.js) {
    console.warn("skill: its composition did not pass the check, the editor makes the Reel", name, result?.error);
    return null;
  }
  return { js: result.js, fonts: result.fonts ?? [] };
}

/**
 * At launch: the Reel follows a model coded as a skill she (or Edith in the chat) chose, and she gave fewer files than
 * it wants: Edith asks her first whether she has others. Null when there is nothing to ask.
 */
export async function skillWantsMore(studioId: string, postId: string, mediaIds: string[]): Promise<{ name: string; least: number; files: number } | null> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("inspiration_id, edith_pick, media_ids").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  // Picked by Edith while the Reel is made: she only picks a model her files fill.
  if (!post?.inspiration_id || post.inspiration_id === post.edith_pick) return null;
  const { data: inspiration } = await db.from("inspirations").select("source, external_id").eq("id", post.inspiration_id).maybeSingle();
  const skill = inspiration?.source === "house" ? skillFor(inspiration.external_id as string | null) : undefined;
  if (!skill) return null;
  const files = new Set(mediaIds.length ? mediaIds : ((post.media_ids as string[] | null) ?? [])).size;
  return fewFiles(skill, files) ? { name: houseModel(skill.key)?.name ?? skill.key, least: skill.files[0], files } : null;
}
