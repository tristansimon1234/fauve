import "server-only";
import {
  beyondSkills,
  BRIEF_MAX,
  CHAT_MODEL,
  compositionShots,
  compositionTexts,
  copyByModel,
  copyByModelWords,
  dressSkillPlan,
  fewFiles,
  finishPlan,
  handMoves,
  headMoves,
  measuredFiles,
  houseModel,
  isClipSegment,
  keptSoundTempo,
  mayCopyByModel,
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
  skillFramed,
  skillLengths,
  skillWordsOf,
  skillWordsWanted,
  mergeSkillSettings,
  leadPlan,
  soundLead,
  soundTempo,
  hasSpeech,
  saidCurrent,
  skillTalk,
  laysVoice,
  MAX_REEL_SECONDS,
  paleSpans,
  SKILL_VOICE_TAIL,
  skillSubtitleRow,
  skillVoiceFit,
  voiceEnd,
  voicePhrases,
  heardCurrent,
  ownLeadMiss,
  ownTalk,
  readHeard,
  withoutVoiceVideo,
  type SkillHeard,
  type BrandProfile,
  type ClipAnalysis,
  type EditPlan,
  type FileReading,
  type FileReadKind,
  type FollowedStyle,
  type MediaFacts,
  type MontageSkill,
  type ReelContract,
  type SkillFacts,
  type SkillFile,
  type SkillFillAnswer,
  type SkillTalk,
  type SceneGround,
  type VoiceTranscript,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { MONTAGE_SKILLS, skillFor } from "@fauve/agent/skills";
import { insertPlanVersion } from "@/lib/edit-plans";
import { modelVoiceFor, sayModelWords } from "@/lib/model-voice";
import { ownVoiceOnReel } from "@/lib/own-voice";
import { usableFonts } from "@/lib/fonts";
import { ensureFileReadings } from "@/lib/render/readings";
import { ensureTracks, loadTracks } from "@/lib/render/tracks";
import { studioPlace } from "@/lib/geo";
import { copyNearest } from "@/lib/model-scout";
import { readPostMusic } from "@/lib/render/music";
import { skillGate } from "@/lib/skill-reviews";
import { postStyle } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { noteGap } from "@/lib/toolkit";
import { syncTakes } from "@/lib/video/takes";
import { designMotionScenes, type SceneRequest } from "./motion-designer";
import { skillContract } from "./reel-frame";
import { anthropic, logClaudeCost } from "./run";

// A Reel made on a montage skill (packages/agent/src/skills.ts): one of Edith's models coded once for the whole Reel,
// like an Edits or CapCut template. One small call (Sonnet) says whether her request is served by it, casts her files
// on its shots and writes its words; the plan is code; its composition is played as it is, only checked (never written
// again by the motion designer). A voice is laid over it (her voice note, Edith's voice written to its length: the model
// played as it is, its music under the voice, the engine's subtitles off its texts; docs/voix.md). Anything else
// (another layout, more than its slots), the editor, whose motion designer starts from the skill's code.

export type SkillDesign = { plan: EditPlan; editPlanId: string; version: number; rationale: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The skill a Reel can be made on before anything is asked: one of Edith's models with a skill, without a layout of
 * hers; with a voice (hers, Edith's, the words she gives to say) only one that lays it (never one timed on her filmed
 * talk: laysVoice).
 */
export function skillCandidate(followed: FollowedStyle | undefined, contract: ReelContract | undefined, voice: boolean): MontageSkill | undefined {
  const skill = skillFor(followed?.house);
  if (!skill || beyondSkills(contract, voice, laysVoice(skill))) return undefined;
  return skill;
}

/**
 * The model a voice is written for, before it is recorded: its name, how it goes and its length (s, without its ending
 * card); `says`, a model whose words are what its voice says (MontageSkill.saysWords): no voice is written for it, its
 * voice says its words (model-voice.ts).
 */
export type VoiceSkill = { key: string; name: string; how: string; seconds: number; says: boolean };

/**
 * Before Edith's voice is written (the model is picked before it, ensureEdithModel): the model this Reel will be played
 * by with a voice laid over it (skillCandidate with a voice: one of Edith's models this studio plays, that lays one), and
 * its length at her files (her passages, as designSkill counts them) or at the length she asked, without its ending
 * card, at its tempo: the voice is written to stop a breath before it (voiceWordsForSkill), never the model cut on the
 * voice. Null when the chain will make the Reel (the voice written for her footage, as before).
 */
export async function voiceSkill(input: { studioId: string; postId: string; files: SkillFile[]; contract?: ReelContract }): Promise<VoiceSkill | null> {
  if (!input.files.length) return null;
  const [followed, gate] = await Promise.all([postStyle(input.studioId, input.postId).catch(() => undefined), skillGate(input.studioId)]);
  const skill = gate(skillCandidate(followed, input.contract, true));
  if (!skill) return null;
  const fit = input.contract?.duration ? skillFit(skill, input.contract.duration) : { n: skillShotCount(skill, input.files), bpm: skill.bpm };
  const seconds = skill.timeline(fit.n, { end: false, ...(fit.bpm !== skill.bpm ? { bpm: fit.bpm } : {}) }).duration;
  return { key: skill.key, name: houseModel(skill.key)?.name ?? skill.key, how: skill.how, seconds: Math.round(seconds * 100) / 100, says: Boolean(skill.saysWords) };
}

/**
 * The skill that plays a Reel she sent by its link to copy (copy-model.ts; docs/recopie.md, « Un Reel recopié joué par un
 * modèle d'Edith »): its nearest of Edith's models (copyNearest: the scout's judgement, or one made now) when its form
 * comes as close as COPY_BY_MODEL_AT, a skill this studio plays (skillGate) that her files fill, nothing she asks that no
 * skill does; for a correction, only of a version made on a skill (the editor keeps it on that one). When she keeps the
 * sound of the Reel she copies (added by her in Instagram, the Reel silent), the model plays at that Reel's measured
 * tempo, its cuts on its beats as the chain's are; without a steady beat, at its own. Undefined: the chain, as before.
 */
export async function copySkill(input: {
  studioId: string;
  followed: FollowedStyle | undefined;
  contract: ReelContract | undefined;
  voice: boolean;
  /** Her distinct files for this Reel. */
  files: number;
  gate: Awaited<ReturnType<typeof skillGate>>;
  correction: boolean;
  /** The skill the version a correction corrects was made on. */
  previousSkill?: string | null;
  /** The post's music (posts.music). */
  music?: unknown;
}): Promise<{ skill: MontageSkill; sound?: { bpm: number; offset: number } } | undefined> {
  const { followed } = input;
  if (!followed || !mayCopyByModel({ followed, contract: input.contract, voice: input.voice, correction: input.correction, previousSkill: input.previousSkill })) return undefined;
  const nearest = await copyNearest(input.studioId, followed.inspiration_id);
  const skill = copyByModel(nearest, (key) => input.gate(skillFor(key)), input.files);
  if (!skill) {
    if (nearest) console.log("copy: no model of Edith's plays it", followed.inspiration_id, nearest.key, nearest.closeness, nearest.by, `${input.files} files`);
    return undefined;
  }
  console.log("copy: played by a model of Edith's", followed.inspiration_id, skill.key, nearest!.closeness, nearest!.by);
  const kept = keptSoundTempo(readPostMusic(input.music), followed.bpm);
  return { skill, ...(kept ? { sound: kept } : {}) };
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

/** How long a model that times its effects on her gestures waits for her videos to be followed before it fills without them. */
const GESTURES_WAIT_MS = 120_000;

/**
 * What was measured on her files for the filler: her camera's fast moves, the moments her lens is covered, her colours
 * (read now when the model asks and they were not yet: lib/render/readings.ts), and what the hands and heads in her
 * videos do when they were followed (followed now when the model asks: its effects are timed on them). Never fails a fill.
 */
async function measuredOf(
  studioId: string,
  postId: string,
  skill: MontageSkill,
  mediaIds: string[],
  clips: { media_id: string; analysis: ClipAnalysis }[],
): Promise<[Record<string, FileReading>, Record<string, { start: number; end: number; what: string }[]>]> {
  const reads = skill.reads ?? [];
  const kinds = reads.filter((r): r is FileReadKind => r !== "gestures");
  const videos = clips.map((c) => c.media_id);
  const [readings] = await Promise.all([
    ensureFileReadings(studioId, postId, mediaIds, kinds).catch((error: unknown) => {
      console.warn("skill: her files not measured, the filler goes without", error instanceof Error ? error.message : error);
      return {} as Record<string, FileReading>;
    }),
    reads.includes("gestures") && videos.length
      ? Promise.race([ensureTracks(studioId, videos).catch(() => undefined), new Promise((resolve) => setTimeout(resolve, GESTURES_WAIT_MS))])
      : null,
  ]);
  // Her tracks are files of their own (a few hundred kilobytes each): read only for a model that times its effects on them.
  const tracks = reads.includes("gestures") && videos.length ? await loadTracks(studioId, videos).catch(() => ({}) as Awaited<ReturnType<typeof loadTracks>>) : {};
  const gestures = Object.fromEntries(
    Object.entries(tracks).map(([id, file]) => {
      const t = { fps: file.fps, from: file.from, frames: file.frames, aspect: file.w / file.h };
      return [id, [...handMoves(t), ...headMoves(t)].sort((a, b) => a.start - b.start)];
    }),
  );
  return [readings, gestures];
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
  /**
   * A Reel she sent to copy that this model plays (copySkill): `followed` is that Reel, which dresses it like her copy
   * (its fonts and colours, or her charter when she asked for it); its words when it has some; said in one sentence.
   */
  copied?: boolean;
  /**
   * A voice laid over it (docs/voix.md, « Une voix sur un modèle »): her voice note, or Edith's voice written to its
   * length, from `at` on the Reel's clock (its words, `transcript`); `own`, her note (a fixed length the model fits to),
   * or her voice taken from one of her videos (`transcript.video`). Hers on a model whose words are what its voice says
   * leads it instead, when what she says makes it (« Sa voix mène le modèle »).
   */
  voice?: { media_id: string; at: number; transcript: VoiceTranscript; own: boolean };
}): Promise<SkillDesign | null> {
  const { skill } = params;
  const name = houseModel(skill.key)?.name ?? skill.key;
  // A voice over a model timed on her filmed talk is the chain's (skillCandidate never sends one here).
  if (params.voice && !laysVoice(skill)) return null;
  // Her voice taken from one of her videos: that video is never shown under it (her lips would not follow it), unless it
  // is her only file.
  const mediaIds = withoutVoiceVideo(params.mediaIds, params.voice?.transcript.video?.media_id);
  const files = measuredFiles(skillFiles(mediaIds, params.clips, params.photos), ...(await measuredOf(params.studioId, params.postId, skill, mediaIds, params.clips)));
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
  let fit = talk
    ? { n: talk.pieces.length, bpm: skill.bpm }
    : soundBpm
      ? { n: params.contract?.duration ? skillFitAt(skill, params.contract.duration, soundBpm) : skillShotCount(skill, files), bpm: soundBpm }
      : params.contract?.duration
        ? skillFit(skill, params.contract.duration)
        : { n: skillShotCount(skill, files), bpm: skill.bpm };
  // A voice laid over it lasts to its last word and a breath (never cut by a shorter model): her own note, a fixed
  // length, has the model fit to it (its shots, then its tempo); Edith's, written to its length, moves it only when it
  // came out longer. Longer than the model can play: the chain makes the Reel on it.
  const laid = params.voice;
  const laidFit = (from: { n: number; bpm: number }) => {
    const needed = voiceEnd(laid!.transcript, laid!.at) + SKILL_VOICE_TAIL;
    const reach = needed <= MAX_REEL_SECONDS ? skillVoiceFit(skill, needed, from, { follow: laid!.own && !params.contract?.duration, fixed: Boolean(soundBpm) }) : null;
    if (!reach) console.log("skill: her voice is longer than this model plays, the editor makes the Reel", params.postId, skill.key, `${needed} s`);
    return reach;
  };
  // Her own voice on a model whose words are what its voice says (« Celui-là, celui-là… »): it leads the model, played
  // whole (her « euh » and long pauses cut), the model's words hers and its cuts on them, when what she says makes it;
  // else (no such model, too few words, longer than a Reel, or her words not the model's once read) laid over it as any.
  const miss = laid?.own ? ownLeadMiss(skill, ownTalk(laid.media_id, laid.transcript, Infinity)) : "model";
  let hers = laid && !miss ? ownTalk(laid.media_id, laid.transcript) : null;
  if (laid?.own && skill.saysWords?.hers && miss) console.log("own voice: laid over the model, it cannot lead it", params.postId, skill.key, miss);
  const nominal = fit;
  if (laid && !hers) {
    const reach = laidFit(fit);
    if (!reach) return null;
    fit = reach;
  }
  // A model whose words are what its voice says (« Celui-là, celui-là… »): the voice chosen for this Reel (none under a
  // voice of hers laid over it), known before its filler writes them, so that each one can be said in its time.
  const saying = skill.saysWords && !laid
    ? await modelVoiceFor({ studioId: params.studioId, postId: params.postId, skill, contract: params.contract, ...(params.copied ? { copied: params.followed.look.voice } : {}) }).catch((error: unknown) => {
        console.warn("said words: no voice chosen, the Reel goes without it", params.postId, error);
        return null;
      })
    : null;
  // Its first beat: the Reel's first image held that long, then every cut on the sound's beats.
  const lead = params.sound && soundBpm ? soundLead(params.sound.offset, soundBpm) : 0;
  // A model Edith picked gives the form, never the silence: its optional title is written (dressedFloorNote's floor). A Reel
  // she copies has the words of the Reel she sent, or none.
  const wordsWanted = skillWordsWanted(skill, params.followed, params.copied);
  // A correction keeps its words but what her request changes: the words of its texts, by slot.
  // A correction keeps the settings it had (« plus de cases » once asked) but what her request changes.
  const previousSettings = params.previous?.skill?.key === skill.key ? params.previous.skill.settings : undefined;
  const current = params.previous?.skill?.key === skill.key && !params.previous.skill.heard ? skillWordsOf(skill, params.previous.texts) : undefined;
  // On her voice, a correction keeps what it chose in what she says (her hook, her keywords, her lists) but what she changes.
  const currentSaid = skill.voice && params.previous?.skill?.key === skill.key ? saidCurrent(params.previous.texts) : undefined;
  // Her voice leading it, a correction keeps her words it showed but what her request changes.
  const currentHeard = params.previous?.skill?.key === skill.key ? heardCurrent(params.previous) : undefined;
  // Its input for a count and a tempo: her voice leading it (its cases what she says), else laid over it, else none.
  const inputFor = (count: { n: number; bpm: number }) =>
    skillFillInput({
      skill,
      name,
      n: count.n,
      files,
      business: { name: params.studio.name, activity: params.studio.business, facts: memoryLines(params.studio.memory), booking: params.studio.booking, tone: params.profile.tone },
      request: params.brief?.slice(0, BRIEF_MAX) || "Un Reel fait sur ce modèle, avec ses fichiers.",
      // Her frame is the model's format (« cadre »: its band when she wants her videos whole), never the editor's line.
      ...skillContract(params.contract),
      ...(current && Object.keys(current).length ? { current } : {}),
      ...(currentSaid?.length ? { currentSaid } : {}),
      ...(wordsWanted ? { wordsWanted } : {}),
      ...(count.bpm !== skill.bpm ? { bpm: count.bpm } : {}),
      ...(previousSettings && Object.keys(previousSettings).length ? { currentSettings: previousSettings } : {}),
      ...(talk ? { talk } : {}),
      ...(known ? { facts: known } : {}),
      ...(params.copied ? { copied: true } : {}),
      // Her own voice leading it: what she says, numbered, where its filler finds the model's words.
      ...(hers ? { hers: { talk: hers, ...(currentHeard?.length ? { current: currentHeard } : {}) } } : {}),
      // The voice laid over it, written before it: its words on screen go with what it says, when it says it.
      ...(laid && !hers ? { voiceOver: { text: laid.transcript.text, phrases: voicePhrases(laid.transcript, laid.at) } } : {}),
      // Its own words said by a voice: each one told how many times and in how long, to be said in time.
      ...(saying ? { says: true } : {}),
    });
  let input = inputFor(fit);
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
  // Her voice leading it, once its filler found the model's words in what she says: her words, the count of its shots,
  // and her recording as the Reel plays it (whole, or its track with her « euh » and long pauses cut).
  let heard: { said: SkillHeard; n: number; voice: { media_id: string; at: number }; key: string } | null = null;
  // Her Reel from an answer: the plan by code, dressed as a model followed and finished as any montage, then checked.
  const made = async (answer: SkillFillAnswer): Promise<{ plan: EditPlan; error?: string } | null> => {
    const n = heard?.n ?? fit.n;
    const bpm = !heard && fit.bpm !== skill.bpm ? fit.bpm : undefined;
    // What she asked (her request and what she fixed): an offer she never spoke of is not written (unaskedOffer).
    const asked = [input.demande, ...(input.contrat ?? [])].join("\n");
    const read = readSkillFill(skill, files, n, answer, { wordsWanted, asked, ...(talk ? { talk } : {}), ...(known ? { facts: known } : {}), ...(heard ? { heard: heard.said } : {}) });
    if (!read) return null;
    // A correction keeps the settings it had but what her request changes (a new Reel: only those she asks); her videos
    // kept whole (the contract's frame) play its band when her words chose no format (vertical full frame by default).
    const settings = skillFramed(skill, mergeSkillSettings(skill, previousSettings, answer.settings), params.contract?.frame);
    const fill = { ...read, settings };
    // Her voice leading it: its timeline on her words, with its ending card when she has one (45 s at most).
    const line = heard ? skill.heard!(heard.said, { end: Boolean(fill.end), settings }) : null;
    if (heard && (!line || line.shots.length !== n || line.duration > MAX_REEL_SECONDS)) return null;
    const leads = heard && line ? { heard: { line, leads: { media_id: laid!.media_id, key: heard.key } }, voice: heard.voice } : null;
    // The model's lettering when she chose it (her charter's when Edith picked it), and its finish (its grade, its grain)
    // without what its code does itself (its own black and white, with its red over it); else her own look. On her voice,
    // her talk cut is its shots.
    const voiced = leads ?? (laid ? { voice: { media_id: laid.media_id, at: laid.at } } : {});
    const plan = dressSkillPlan(leadPlan(skillPlan({ skill, name, files, fill, ...(bpm ? { bpm } : {}), ...(talk ? { talk } : {}), ...voiced }), lead), skill, params.followed, params.profile.look);
    // Each shot framed on its subject and its light corrected, as any montage.
    const durations = Object.fromEntries(files.map((f) => [f.id, f.photo ? plan.duration : f.seconds]));
    Object.assign(plan, finishPlan(plan, facts, durations));
    // Its composition checked as any composition, never written again.
    const checked = await checkSkill(params.studioId, plan, facts, params.profile, params.studio.name ?? "", name, params.brief).catch((error: unknown) => ({
      error: `le contrôle n'a pas pu tourner : ${error instanceof Error ? error.message : String(error)}`.slice(0, 600),
    }));
    if ("error" in checked) return { plan, error: checked.error };
    const layer = plan.layers![0]!;
    // A voice laid over it: its subtitles for the whole Reel on the skill's row, else off what its composition writes
    // and draws of its own on her Reel (the check measured it; the render keeps a composition's row as it is), written
    // dark where its composition paints a pale ground under them. None under her voice leading it: her words are its own.
    const subtitleY = laid && !heard ? skillSubtitleRow(skill, checked.own, plan.duration) : undefined;
    const pale = subtitleY !== undefined ? paleSpans(checked.ground, subtitleY, Math.round((layer.to - layer.from) * 30)) : [];
    const row = subtitleY !== undefined ? { subtitle_y: subtitleY, ...(pale.length ? { subtitle_pale: pale } : {}) } : {};
    plan.layers = [{ ...layer, motion: { ...layer.motion, js: checked.js, ...(checked.fonts.length ? { fonts: checked.fonts } : {}), ...row } }];
    return { plan };
  };

  // Her request beyond the model: noted (a gap that comes back becomes a tool, toolkit), the editor makes the Reel.
  const beyond = async (answer: SkillFillAnswer) => {
    console.log("skill: her request needs the editor", params.postId, skill.key, answer.missing);
    await noteGap({ studioId: params.studioId, postId: params.postId, source: "skill", label: answer.missing.trim().slice(0, 200) || `une demande hors du modèle « ${name} »`, request: params.brief });
  };
  let answer = await fillIt();
  if (!answer) return null;
  if (!answer.fits) {
    await beyond(answer);
    return null;
  }
  // Her voice leading it: the model's words where she says them, its timeline on them (her ending card in it, 45 s at
  // most), her recording as the Reel will play it. What she says that does not make it (« suit » false, too few things
  // pointed at, a Reel too long), or her voice's track not made: laid over the model as any voice, filled again so (a
  // cent); longer than the model plays, the chain.
  if (hers && laid) {
    const said = readHeard(skill, hers, answer.sa_voix);
    const ending = skill.end && Boolean(answer.end?.title.trim());
    const line = said ? skill.heard!(said, { end: ending }) : null;
    const placed =
      line && line.duration <= MAX_REEL_SECONDS
        ? await ownVoiceOnReel({ studioId: params.studioId, postId: params.postId, source: laid.media_id, talk: hers, lead: line.lead ?? 0, duration: round2(hers.duration + (line.lead ?? 0)), previous: params.previous }).catch((error: unknown) => {
            console.warn("own voice: her track not made, laid over the model", params.postId, error instanceof Error ? error.message.slice(0, 300) : error);
            return null;
          })
        : null;
    if (said && line && placed) {
      heard = { said, n: line.shots.length, ...placed };
      console.log("own voice: leads the model", params.postId, skill.key, said.words.map((w) => `${w.slot} « ${w.text} » ${w.at} s`).join(", "));
    } else {
      console.log("own voice: her words do not make this model, laid over it", params.postId, skill.key, !answer.sa_voix?.suit ? "not its words" : !said ? "too few of its words" : !line ? "out of its order" : `${line.duration} s`);
      hers = null;
      const reach = laidFit(nominal);
      if (!reach) return null;
      fit = reach;
      input = inputFor(fit);
      answer = await fillIt();
      if (!answer) return null;
      if (!answer.fits) {
        await beyond(answer);
        return null;
      }
    }
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
  // Its words said by the voice chosen, each at its moments, on one track (subtitles off: they are on screen); the track
  // of the version it corrects kept when it says the same. A failure leaves the Reel without its voice, never without it.
  if (saying) {
    const said = await sayModelWords({ studioId: params.studioId, postId: params.postId, skill, plan, voiceId: saying, previous: params.previous }).catch((error: unknown) => {
      console.warn("said words: the Reel goes without its voice", params.postId, skill.key, error instanceof Error ? error.message.slice(0, 300) : error);
      return null;
    });
    if (said) Object.assign(plan, said, { subtitles: false });
  }

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  await supabaseAdmin().from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  return {
    plan,
    editPlanId: row.id,
    version: row.version,
    // A Reel she sent, played by one of Edith's models: one sentence on the post, nothing more (the delivery says none of it).
    rationale: params.copied
      ? copyByModelWords(name)
      : [heard ? `Je l'ai monté sur le modèle « ${name} », sur ta voix : chaque mot s'affiche quand tu le dis.` : `Je l'ai monté sur le modèle « ${name} ».`, answer.why.trim().slice(0, 300)].filter(Boolean).join(" "),
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

/**
 * The scene check of a skill's composition on her Reel (its shots as grey cards, its texts and marks): its js, and what it
 * writes and draws of its own row by row (`own`, for a voice's subtitles laid over it), or what it refused.
 */
async function checkSkill(
  studioId: string,
  plan: EditPlan,
  facts: MediaFacts,
  profile: Partial<BrandProfile>,
  business: string,
  name: string,
  asked?: string,
): Promise<{ js: string; fonts: string[]; own?: number[]; ground?: SceneGround } | { error: string }> {
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
  return { js: result.js, fonts: result.fonts ?? [], ...(result.own?.length ? { own: result.own } : {}), ...(result.ground ? { ground: result.ground } : {}) };
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
