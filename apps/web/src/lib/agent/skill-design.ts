import "server-only";
import {
  BRIEF_MAX,
  CHAT_MODEL,
  compositionShots,
  compositionTexts,
  contractLines,
  dressSkillPlan,
  fewFiles,
  finishPlan,
  houseModel,
  isClipSegment,
  memoryLines,
  motionTemplateSchema,
  planTimeline,
  readSkillFill,
  resolveReelBrand,
  shotScore,
  SKILL_FILL_PROMPT,
  skillFillInput,
  skillFillSchema,
  skillPlan,
  skillShotCount,
  skillFit,
  skillFitAt,
  skillLengths,
  skillWordsOf,
  mergeSkillSettings,
  leadPlan,
  soundLead,
  soundTempo,
  hasSpeech,
  saidCurrent,
  skillTalk,
  type BrandProfile,
  type ClipAnalysis,
  type EditPlan,
  type FollowedStyle,
  type MediaFacts,
  type MontageSkill,
  type ReelContract,
  type SkillFacts,
  type SkillFile,
  type SkillFillAnswer,
  type SkillTalk,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { MONTAGE_SKILLS, skillFor } from "@fauve/agent/skills";
import { insertPlanVersion } from "@/lib/edit-plans";
import { usableFonts } from "@/lib/fonts";
import { studioPlace } from "@/lib/geo";
import { skillGate } from "@/lib/skill-reviews";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { noteGap } from "@/lib/toolkit";
import { syncTakes } from "@/lib/video/takes";
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

/** Her files as a skill casts them: a video's length, what it shows and its moments worth showing (best first); a photo's reading; each one's shape. */
export function skillFiles(mediaIds: string[], clips: { media_id: string; analysis: ClipAnalysis }[], photos: MediaFacts["photos"]): SkillFile[] {
  return mediaIds.flatMap((id): SkillFile[] => {
    const photo = photos[id];
    // Its shape (width / height): a slot laid in a box of another shape (a tall half) keeps only its middle.
    if (photo) return [{ id, photo: true, seconds: 0, shows: (photo.detection.notes ?? "").slice(0, 200), aspect: photo.width / Math.max(1, photo.height) }];
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
        aspect: a.orientation === "landscape" ? 16 / 9 : a.orientation === "square" ? 1 : 9 / 16,
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
  /** The sound she follows (its tempo and first beat): the skill plays at its tempo, its cuts on its beats. */
  sound?: { bpm: number; offset: number };
}): Promise<SkillDesign | null> {
  const { skill } = params;
  const name = houseModel(skill.key)?.name ?? skill.key;
  const files = skillFiles(params.mediaIds, params.clips, params.photos);
  if (!files.length) return null;
  // Timed on her voice: her talking video cut as a creator cuts it, her other angles of the same take synced on their sound.
  const talk = skill.voice ? await talkOf(params.studioId, params.clips) : undefined;
  if (skill.voice && !talk) {
    console.log("skill: a model on her voice and no video where she speaks (or her words not read), the editor makes the Reel", params.postId, skill.key);
    return null;
  }
  // What the engine writes itself in its slots: her place's coordinates (her address geocoded once, kept on the studio).
  const known = skill.texts.some((t) => t.fact === "coordinates") ? await placeFacts(params.studioId) : undefined;
  // As many shots as her files give, or, for a length she asked for, the count (then the tempo) that comes closest to it;
  // following a sound, its tempo (its own, halved or doubled, nearest the model's), the count closest to her length at it.
  // On her voice, her talk's pieces and her length (its music under her voice, at its own tempo).
  const soundBpm = params.sound && !skill.voice ? soundTempo(params.sound.bpm, skill.bpm) : undefined;
  const fit = talk
    ? { n: talk.pieces.length, bpm: skill.bpm }
    : soundBpm
      ? { n: params.contract?.duration ? skillFitAt(skill, params.contract.duration, soundBpm) : skillShotCount(skill, files), bpm: soundBpm }
      : params.contract?.duration
        ? skillFit(skill, params.contract.duration)
        : { n: skillShotCount(skill, files), bpm: skill.bpm };
  // Its first beat: the Reel's first image held that long, then every cut on the sound's beats.
  const lead = params.sound && soundBpm ? soundLead(params.sound.offset, soundBpm) : 0;
  const n = fit.n;
  const bpm = fit.bpm !== skill.bpm ? fit.bpm : undefined;
  // A model Edith picked gives the form, never the silence: its optional title is written (dressedFloorNote's floor).
  const wordsWanted = Boolean(params.followed.dressed) && !skill.texts.some((t) => t.required) && skill.texts.length > 0;
  // A correction keeps its words but what her request changes: the words of its texts, by slot.
  // A correction keeps the settings it had (« plus de cases » once asked) but what her request changes.
  const previousSettings = params.previous?.skill?.key === skill.key ? params.previous.skill.settings : undefined;
  const current = params.previous?.skill?.key === skill.key ? skillWordsOf(skill, params.previous.texts) : undefined;
  // On her voice, a correction keeps what it chose in what she says (her hook, her keywords, her lists) but what she changes.
  const currentSaid = skill.voice && params.previous?.skill?.key === skill.key ? saidCurrent(params.previous.texts) : undefined;
  const input = skillFillInput({
    skill,
    name,
    n,
    files,
    business: { name: params.studio.name, activity: params.studio.business, facts: memoryLines(params.studio.memory), booking: params.studio.booking, tone: params.profile.tone },
    request: params.brief?.slice(0, BRIEF_MAX) || "Un Reel fait sur ce modèle, avec ses fichiers.",
    contract: contractLines(params.contract),
    ...(current && Object.keys(current).length ? { current } : {}),
    ...(currentSaid?.length ? { currentSaid } : {}),
    ...(wordsWanted ? { wordsWanted } : {}),
    ...(bpm ? { bpm } : {}),
    ...(previousSettings && Object.keys(previousSettings).length ? { currentSettings: previousSettings } : {}),
    ...(talk ? { talk } : {}),
    ...(known ? { facts: known } : {}),
  });
  // One small call fills it; `again`: its answer and what the check said of it, for a second try.
  const fillIt = async (again?: { answer: SkillFillAnswer; note: string }): Promise<SkillFillAnswer | null> => {
    try {
      const response = await anthropic().beta.messages.parse({
        model: CHAT_MODEL,
        max_tokens: 6000,
        output_config: { effort: "medium", format: outputFormat(skillFillSchema) },
        system: SKILL_FILL_PROMPT,
        messages: [
          { role: "user", content: JSON.stringify(input) },
          ...(again ? [{ role: "assistant" as const, content: JSON.stringify(again.answer) }, { role: "user" as const, content: again.note }] : []),
        ],
      });
      await logClaudeCost(params.studioId, response.usage, "skill_fill", CHAT_MODEL);
      return response.parsed_output ? readAnswer(skillFillSchema, response.parsed_output) : null;
    } catch (error) {
      console.warn("skill: its filling failed, the editor makes the Reel", params.postId, error);
      return null;
    }
  };
  const facts: MediaFacts = { clips: Object.fromEntries(params.clips.map((c) => [c.media_id, c.analysis])), photos: params.photos, tracks: {} };
  // Her Reel from an answer: the plan by code, dressed as a model followed and finished as any montage, then checked.
  const made = async (answer: SkillFillAnswer): Promise<{ plan: EditPlan; error?: string } | null> => {
    const read = readSkillFill(skill, files, n, answer, { wordsWanted, ...(talk ? { talk } : {}), ...(known ? { facts: known } : {}) });
    if (!read) return null;
    // A correction keeps the settings it had but what her request changes (a new Reel: only those she asks).
    const settings = mergeSkillSettings(skill, previousSettings, answer.settings);
    const fill = { ...read, settings };
    // The model's lettering when she chose it (her charter's when Edith picked it), and its finish (its grade, its grain)
    // without what its code does itself (its own black and white, with its red over it); else her own look. On her voice,
    // her talk cut is its shots.
    const plan = dressSkillPlan(leadPlan(skillPlan({ skill, name, files, fill, ...(bpm ? { bpm } : {}), ...(talk ? { talk } : {}) }), lead), skill, params.followed, params.profile.look);
    // Each shot framed on its subject and its light corrected, as any montage.
    const durations = Object.fromEntries(files.map((f) => [f.id, f.photo ? plan.duration : f.seconds]));
    Object.assign(plan, finishPlan(plan, facts, durations));
    // Its composition checked as any composition, never written again.
    const checked = await checkSkill(params.studioId, plan, facts, params.profile, params.studio.name ?? "", name, params.brief).catch((error: unknown) => ({
      error: `le contrôle n'a pas pu tourner : ${error instanceof Error ? error.message : String(error)}`.slice(0, 600),
    }));
    if ("error" in checked) return { plan, error: checked.error };
    const layer = plan.layers![0]!;
    plan.layers = [{ ...layer, motion: { ...layer.motion, js: checked.js, ...(checked.fonts.length ? { fonts: checked.fonts } : {}) } }];
    return { plan };
  };

  let answer = await fillIt();
  if (!answer) return null;
  if (!answer.fits) {
    console.log("skill: her request needs the editor", params.postId, skill.key, answer.missing);
    // What the skill could not do, noted: a gap that comes back becomes a tool (toolkit).
    await noteGap({ studioId: params.studioId, postId: params.postId, source: "skill", label: answer.missing.trim().slice(0, 200) || `une demande hors du modèle « ${name} »`, request: params.brief });
    return null;
  }
  let result = await made(answer);
  // Refused by the check (her words too long for their place, most often): filled once more with what it said, for a
  // cent, before the whole chain takes the Reel (the director's 0,80 € for a title one word too long, on the first bench).
  if (result?.error) {
    console.warn("skill: the check refused it, filled again", params.postId, skill.key, result.error.slice(0, 300));
    const again = await fillIt({
      answer,
      note: `Le contrôle des scènes a refusé ce Reel : ${result.error.slice(0, 600)} Garde les mêmes plans et raccourcis les mots qui débordent (moins de lettres, un mot plus court), sans changer leur sens. Réponds de nouveau en entier.`,
    });
    if (again?.fits) {
      answer = again;
      result = await made(again);
    }
  }
  if (!result || result.error) {
    if (result?.error) console.warn("skill: its composition did not pass the check, the editor makes the Reel", name, result.error.slice(0, 300));
    return null;
  }
  const plan = result.plan;

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  await supabaseAdmin().from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  return {
    plan,
    editPlanId: row.id,
    version: row.version,
    rationale: [`Je l'ai monté sur le modèle « ${name} ».`, answer.why.trim().slice(0, 300)].filter(Boolean).join(" "),
  };
}

/**
 * Her talk for a skill timed on her voice: the video where she says the most (its speech read: her words timed, her « euh »
 * and pauses measured), cut as a creator cuts it, with her other videos of the same take (two phones filming her at
 * once: the same words, synced on their sound once, takes.ts). None without a video where she speaks.
 */
async function talkOf(studioId: string, clips: { media_id: string; analysis: ClipAnalysis }[]): Promise<SkillTalk | undefined> {
  const talks = clips.filter((c) => c.analysis.speech && hasSpeech(c.analysis) && (c.analysis.words?.length ?? 0) >= 3);
  if (!talks.length) return undefined;
  const main = talks.reduce((a, b) => ((b.analysis.words?.length ?? 0) > (a.analysis.words?.length ?? 0) ? b : a));
  const others = talks.filter((c) => c !== main);
  const synced = others.length ? await syncTakes(studioId, main, others).catch(() => []) : [];
  const takes = synced.flatMap((s) => {
    const other = others.find((c) => c.media_id === s.media_id);
    return other ? [{ clip: s.media_id, offset: s.offset, seconds: other.analysis.duration }] : [];
  });
  return skillTalk({ clip: main.media_id, seconds: main.analysis.duration, words: main.analysis.words ?? [], speech: main.analysis.speech! }, { takes }) ?? undefined;
}

/** What the engine knows and writes itself in a skill's slots: her place's coordinates, when her door was found. */
async function placeFacts(studioId: string): Promise<SkillFacts | undefined> {
  const place = await studioPlace(studioId).catch((error: unknown) => {
    console.warn("geo: no coordinates for this Reel", studioId, error instanceof Error ? error.message : error);
    return null;
  });
  return place ? { coordinates: place.label } : undefined;
}

/** The scene check of a skill's composition on her Reel (its shots as grey cards, its texts and marks): its js, or what it refused. */
async function checkSkill(
  studioId: string,
  plan: EditPlan,
  facts: MediaFacts,
  profile: Partial<BrandProfile>,
  business: string,
  name: string,
  asked?: string,
): Promise<{ js: string; fonts: string[] } | { error: string }> {
  const layer = plan.layers?.find((l) => l.compose);
  if (!layer?.motion.code) return { error: "pas de composition" };
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
  if (!result?.js) return { error: result?.error ?? "le contrôle n'a rien rendu" };
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
  const gate = await skillGate(studioId);
  const skill = inspiration?.source === "house" ? gate(skillFor(inspiration.external_id as string | null)) : undefined;
  if (!skill) return null;
  const files = new Set(mediaIds.length ? mediaIds : ((post.media_ids as string[] | null) ?? [])).size;
  return fewFiles(skill, files) ? { name: houseModel(skill.key)?.name ?? skill.key, least: skill.files[0], files } : null;
}

/**
 * The length she asked for is past what her model does (Tristan: « si un modèle fait 10 secondes mais qu'elle veut un
 * Reel de 30 ? »): stretched further, a model made for a moment loses what makes it good, so Edith tells her first and
 * offers its longest, or a model made to last. Its longest (s, rounded down) and the models that reach her length.
 */
export async function skillTooShort(studioId: string, postId: string, seconds: number): Promise<{ name: string; max: number; others: string[] } | null> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("inspiration_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post?.inspiration_id) return null;
  const { data: inspiration } = await db.from("inspirations").select("source, external_id").eq("id", post.inspiration_id).maybeSingle();
  const gate = await skillGate(studioId);
  const skill = inspiration?.source === "house" ? gate(skillFor(inspiration.external_id as string | null)) : undefined;
  if (!skill) return null;
  const { max } = skillLengths(skill);
  if (seconds <= max + 1) return null;
  const others = Object.values(MONTAGE_SKILLS)
    .filter((s) => s.key !== skill.key && gate(s) && skillLengths(s).max + 1 >= seconds)
    .flatMap((s) => houseModel(s.key)?.name ?? [])
    .slice(0, 2);
  return { name: houseModel(skill.key)?.name ?? skill.key, max: Math.floor(max), others };
}
