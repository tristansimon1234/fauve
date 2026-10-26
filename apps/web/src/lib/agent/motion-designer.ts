import "server-only";
import {
  CLAUDE_MODEL,
  checkMotionCode,
  type CompositionTexts,
  GEMINI_MODEL_ID,
  isKimiModel,
  LOOK_MODEL,
  MOTION_LOOK_PROMPT,
  motionDesignerPrompt,
  motionJudgeOutputSchema,
  motionLookOutputSchema,
  motionSceneOutputSchema,
  type ComposeShot,
  type CompositionShot,
  type DesignerMoves,
  type MotionPromptParts,
  type MotionSlot,
  type ReelProps,
  type ScenePhoto,
  type TrackPiece,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { GoogleGenAI } from "@google/genai";
import { transform } from "sucrase";
import { z } from "zod";
import { env } from "@/lib/env";
import { googleFont } from "@/lib/fonts";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { toGeminiSchema } from "@/lib/gemini-schema";
import { askKimiJson, strictShape } from "@/lib/kimi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { smokeTestScenes, type SceneChecks, type SmokeScene } from "@/lib/render/sandbox";
import { timeLeft } from "@/lib/step-clock";
import { anthropic, CACHE_AN_HOUR, logClaudeCost } from "./run";

// The motion designer: one Opus call per free scene, which writes the component.
// Code is checked statically, transpiled (never executed here), then smoke-
// rendered in the sandbox; a failing scene gets one round of fixes, and if it
// still fails the renderer uses the scene's fixed fallback. The scenes of one Reel
// are written one after the other, each knowing what the earlier ones do, so that
// they go together; the business's latest ones are named too, not to be redone.
// Then, as a director looks at a render before it goes out, Sonnet looks at the
// animations rendered over her footage, in the Reel as it will come out, and sends
// the ones below the bar back to the motion designer, who reworks them once.

/** A photo of hers a scene may compose with: its id and what it shows (for the designer), its links (for the test render). */
export type OfferedPhoto = { id: string; shows: string; photo: ScenePhoto };

/**
 * busy: the rows of the footage under the scene where faces and lettering show (shares of the height): no words on them while they show;
 * photos: her photos it may compose with; cuts: for an animation over several shots, where the shot changes under it (frames from its start);
 * compose: a collage's composition, which lays the Reel's shots itself: what each one shows and when (plans), where the
 * Reel's texts go over it (texts), and each shot's span and shape for its test render (shots).
 * track / moves: what moves in the footage under it, for its test render and for the designer.
 */
export type SceneRequest = {
  id: string;
  brief: string;
  /** What she asked for (the montage's request, her own words when there are some): it prevails over the editor's brief. */
  request?: string;
  durationInFrames: number;
  busy?: { y: number; h: number }[];
  photos?: OfferedPhoto[];
  cuts?: number[];
  compose?: { plans: CompositionShot[]; shots: ComposeShot[] } & CompositionTexts;
  /** What moves in the footage under it: the pieces its `track` reads (its test render follows them), and what the designer is told of them. */
  track?: TrackPiece[];
  moves?: DesignerMoves | { by_shot: ({ shot: number } & DesignerMoves)[] };
  /** A correction: the animation it reworks as it was rendered on her images (frames with their instant) and its code (what is asked is its request). */
  seen?: { code: string; frames: SceneFrame[] };
  /** A first draft: the Reel as it will come out without the animations being written (frames with their instant), seen before writing. */
  canvas?: SceneFrame[];
  /** The row where a voice's subtitles show during the scene (shares of the height): its words keep off it. */
  subtitles?: { y: number; h: number };
  /** A library scene placed in this Reel (written for another one): looked at, it stays only if it really serves this brief. */
  fromLibrary?: boolean;
};

/** One image of an animation as it renders in the Reel, with the instant it shows (in the animation's frames). */
export type SceneFrame = { label: string; jpeg: Buffer };

/** The images of each written animation over her footage, by its id: what the motion designer looks at before it goes out. */
export type SceneLooks = Map<string, SceneFrame[]>;
export type SceneResult = {
  id: string;
  code: string | null;
  js: string | null;
  error: string | null;
  /** For the template library: a short name and the scene's text slots. */
  name?: string;
  slots?: MotionSlot[];
  /** The designer's intention, in a sentence (what the next scenes of the Reel must not repeat). */
  notes?: string;
  /** The photos its code reads, in order (media ids, among those offered). */
  photos?: string[];
  /** The Google Fonts families its code brings besides the Reel's two (a universe she names, the Reel she copies). */
  fonts?: string[];
  /** A composition: where it wants a voice's subtitles (share of the height). */
  subtitleY?: number;
  /** Looking at its render: it keeps the animation as it is (nothing new written), and what it saw. */
  keep?: boolean;
  seen?: string;
};

/** What already exists, so that a new scene takes another idea. */
type Existing = {
  /** The Reel's other animations: written ones (name and intention) or still to come (their brief). */
  reel: string[];
  /** The business's latest animations, by name. */
  done: string[];
};

/** The brand as an animation sees it. */
export type SceneBrand = Pick<ReelProps["brand"], "name" | "accent" | "accentInk" | "palette" | "displayFont" | "bodyFont" | "logoUrl" | "logoOnDark">;

/** The business's motion kit: its latest scenes, whose language a new one keeps (never their code as such). */
export type MotionKit = { name: string; code: string }[];

/** The most photos one scene composes with. */
const MAX_SCENE_PHOTOS = 4;
/** The most fonts one scene brings besides the Reel's two. */
const MAX_SCENE_FONTS = 2;

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } };
/** Its answer: a scene written, or its look at a scene rendered (with whether it keeps it). */
type SceneOutput = z.output<typeof motionSceneOutputSchema> & Partial<Pick<z.output<typeof motionLookOutputSchema>, "keep" | "seen">>;
type AnswerSchema = typeof motionSceneOutputSchema | typeof motionLookOutputSchema;
/** The prompt of one call: its base, the same for every animation, and the parts this call needs. */
type Prompt = ReturnType<typeof motionDesignerPrompt>;
const whole = (prompt: Prompt) => [prompt.base, prompt.parts].filter(Boolean).join("\n\n");

async function askClaude(studioId: string, prompt: Prompt, content: string | Block[], schema: AnswerSchema): Promise<SceneOutput | null> {
  // Streamed, with room: a composition of a whole Reel is long code, and its answer was cut off mid-string at
  // 16 000 tokens, then again at 32 000 (18 000 of them thinking): Simone's split screen fell back to plain shots.
  const response = await anthropic()
    .beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 64000,
      // Medium: the code needs care, not long deliberation; most of the cost was thinking tokens.
      output_config: { effort: "medium", format: outputFormat<AnswerSchema>(schema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // The base is cached for every animation; the parts follow it.
      system: [{ type: "text", text: prompt.base, cache_control: CACHE_AN_HOUR }, ...(prompt.parts ? [{ type: "text" as const, text: prompt.parts }] : [])],
      messages: [{ role: "user", content }],
    })
    .finalMessage();
  await logClaudeCost(studioId, response.usage, "motion_designer");
  if (!response.parsed_output) throw new Error(`pas de réponse lisible (${response.stop_reason})`);
  return response.parsed_output as SceneOutput;
}

// Gemini as the motion designer, for a lab studio only (studios.motion_model): the same prompt,
// the same request and the same checks, to compare the two on the same cases.
let geminiClient: GoogleGenAI | undefined;
const gemini = () => (geminiClient ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));
// Patterns and bounds are left to readAnswer, which repairs them (Gemini may refuse a pattern).
const GEMINI_SCENE_SCHEMA = toGeminiSchema(z.toJSONSchema(motionSceneOutputSchema), ["pattern"]);
const GEMINI_LOOK_SCHEMA = toGeminiSchema(z.toJSONSchema(motionLookOutputSchema), ["pattern"]);

async function askGemini(studioId: string, model: string, prompt: Prompt, content: string | Block[], schema: AnswerSchema): Promise<SceneOutput | null> {
  const parts = (typeof content === "string" ? [{ type: "text" as const, text: content }] : content).map((b) =>
    b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } },
  );
  const look = schema === motionLookOutputSchema;
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { systemInstruction: whole(prompt), responseMimeType: "application/json", responseJsonSchema: look ? GEMINI_LOOK_SCHEMA : GEMINI_SCENE_SCHEMA, maxOutputTokens: 32000 },
  });
  await logGeminiCost({ studioId, kind: "llm", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "motion_designer" } });
  if (!response.text) return null;
  return look ? readAnswer(motionLookOutputSchema, JSON.parse(response.text)) : readAnswer(motionSceneOutputSchema, JSON.parse(response.text));
}

// Kimi as the motion designer, for a lab studio only, through Vercel AI Gateway: the same prompt,
// the same request (its images as data URLs) and the same checks.
const KIMI_SCENE_SCHEMA = strictShape(z.toJSONSchema(motionSceneOutputSchema));
const KIMI_LOOK_SCHEMA = strictShape(z.toJSONSchema(motionLookOutputSchema));

async function askKimi(studioId: string, model: string, prompt: Prompt, content: string | Block[], schema: AnswerSchema): Promise<SceneOutput | null> {
  const parts = (typeof content === "string" ? [{ type: "text" as const, text: content }] : content).map((b) =>
    b.type === "text" ? { type: "text" as const, text: b.text } : { type: "image_url" as const, image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } },
  );
  const look = schema === motionLookOutputSchema;
  const answer = await askKimiJson({
    studioId,
    model,
    system: whole(prompt),
    content: parts,
    name: look ? "motion_look" : "motion_scene",
    schema: look ? KIMI_LOOK_SCHEMA : KIMI_SCENE_SCHEMA,
    maxTokens: 64000,
    purpose: "motion_designer",
  });
  // What it leaves empty (null) is left out, as an optional field never written.
  const written = Object.fromEntries(Object.entries((answer ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null));
  return look ? readAnswer(motionLookOutputSchema, written) : readAnswer(motionSceneOutputSchema, written);
}

/**
 * The model that writes this studio's scenes: Opus, or the Gemini or Kimi model it is set to (studios.motion_model),
 * read only where models are tried: a lab studio, or the team's own (never a real business).
 */
async function designerModel(studioId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("studios").select("website_url, motion_model, team").eq("id", studioId).maybeSingle();
  const trial = data?.team === true || (typeof data?.website_url === "string" && data.website_url.startsWith("lab://"));
  const asked = data?.motion_model as string | null | undefined;
  return trial && asked && (GEMINI_MODEL_ID.test(asked) || isKimiModel(asked)) ? asked : CLAUDE_MODEL;
}

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

/** The images a look shows it, each with its instant, then what it is asked. */
function withFrames(intro: string, frames: SceneFrame[], text: string): Block[] {
  return [
    { type: "text", text: intro },
    ...frames.flatMap((f): Block[] => [
      { type: "text", text: f.label },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.jpeg.toString("base64") } },
    ]),
    { type: "text", text },
  ];
}

const px = (share: number) => Math.round(share * 1920);

/**
 * One call of the motion designer: a scene written from its request; with `fix`, its code corrected from
 * a check's error; with `look`, its scene rendered over her footage looked at, kept (`keep`) or rewritten whole.
 */
async function writeScene(
  studioId: string,
  model: string,
  request: SceneRequest,
  brand: SceneBrand,
  artDirection: string | undefined,
  kit: MotionKit,
  existing: Existing,
  fix?: { code: string; error: string; photos?: string[]; fonts?: string[] },
  look?: { code: string; frames: SceneFrame[]; review?: { what_he_sees: string; what_to_achieve: string } },
): Promise<Omit<SceneResult, "id">> {
  const kept = [fix?.photos?.length && `the same photos (${fix.photos.join(", ")})`, fix?.fonts?.length && `the same fonts (${fix.fonts.join(", ")})`].filter(Boolean);
  // A correction looks at its earlier render first: each image with its instant, then the request.
  const seen = !fix && !look && request.seen?.frames.length ? request.seen : undefined;
  // A first draft sees the Reel it is written for, as it will come out without its animations.
  const canvas = !fix && !look && !seen && request.canvas?.length ? request.canvas : undefined;
  // Its prompt: the base, and only the parts this animation needs (a fix keeps those of its request).
  const parts: MotionPromptParts = {
    photos: Boolean(request.photos?.length || request.compose?.plans.some((p) => p.cut_out)),
    cuts: Boolean(request.cuts && !request.compose),
    moves: Boolean(request.moves || request.track?.length || request.compose?.shots.some((x) => x.track)),
    composition: Boolean(request.compose),
    correction: Boolean(seen),
    look: Boolean(look),
  };
  const text = fix
    ? `This code failed: ${fix.error}\nFix it, keeping the same intention${kept.length ? ` and ${kept.join(" and ")}` : ""}.\n\nBrief: ${request.brief}\n\nCode:\n${fix.code}`
    : JSON.stringify({
        ...(request.request ? { request: request.request.slice(0, 3000) } : {}),
        brief: request.brief,
        duration_frames: request.durationInFrames,
        fps: 30,
        format: "1080 × 1920",
        brand,
        art_direction: artDirection,
        ...(kit.length ? { brand_kit: kit } : {}),
        ...(existing.reel.length ? { reel_animations: existing.reel } : {}),
        ...(existing.done.length ? { done_before: existing.done } : {}),
        // Faces and lettering of the picture under the scene, in px of the 1920 high frame: no words on them while they show.
        ...(request.busy?.length ? { faces_under: request.busy.map((b) => `y ${px(b.y)} to ${px(b.y + b.h)}`) } : {}),
        // Her voice's subtitles show all along: its words keep off their row.
        ...(request.subtitles ? { subtitles: `y ${px(request.subtitles.y)} to ${px(request.subtitles.y + request.subtitles.h)}` } : {}),
        // Her photos it may compose with: their id, what they show, and whether their subject is cut out.
        ...(request.photos?.length
          ? {
              reel_photos: request.photos.map((p) => ({
                id: p.id,
                shows: p.shows,
                cut_out: Boolean(p.photo.cutout),
                format: p.photo.aspect >= 1 ? "landscape" : "portrait",
                // The edges of the photo that cut its subject: it comes in from there.
                ...(p.photo.cutEdges?.length ? { subject_cut_by: p.photo.cutEdges } : {}),
              })),
            }
          : {}),
        // What moves in the footage under it (hands, faces, bodies, the gestures seen): its code follows it with `track`.
        ...(request.moves ? { moves: request.moves } : {}),
        // A collage's composition lays the shots itself (nothing plays under it); another animation over several shots, the cuts under it.
        ...(request.compose
          ? {
              composition: {
                shots: request.compose.plans,
                // The texts and the end are its own: its code gets them as reelTexts and end.
                texts: request.compose.texts,
                end: request.compose.end,
                ...(request.compose.subtitles ? { engine_subtitles: request.compose.subtitles } : {}),
                cut_frames: request.cuts ?? [],
              },
            }
          : request.cuts
            ? { shots_under: { shots: request.cuts.length + 1, cut_frames: request.cuts } }
            : {}),
        ...(seen ? { previous_version: { frames: `${seen.frames.length} images attached, above`, code: seen.code } } : {}),
        ...(canvas ? { reel_frames: `${canvas.length} images attached, above` } : {}),
        // Its look at its render: the images above, its code as it is, and what the director who sent it back saw.
        ...(look ? { your_render: { frames: `${look.frames.length} images attached, above` }, current_code: look.code, ...(look.review ? { review: look.review } : {}) } : {}),
        // A library scene, written for another Reel: kept only if it really serves this brief and is well made here.
        ...(look && request.fromLibrary
          ? {
              origin:
                "A scene from the business's library, written for another Reel and placed here with these words: keep it only if its idea really serves this brief and it is well made on these images; otherwise write your own for this moment.",
            }
          : {}),
      });
  const content: string | Block[] = look
    ? withFrames("Your animation, rendered over her footage in the Reel as it will come out:", look.frames, text)
    : seen
      ? withFrames("Your earlier animation, rendered on her images:", seen.frames, text)
      : canvas
        ? withFrames(
            request.compose
              ? "Her shots as filmed and retouched, full frame one after the other (your composition will lay them where you want), with the Reel's texts and her voice's subtitles, a frame a second:"
              : "The Reel as it will come out without the animations being written (its shots, its texts, her voice's subtitles in place), a frame a second, then closer together during your moment:",
            canvas,
            text,
          )
        : text;
  const schema = look ? motionLookOutputSchema : motionSceneOutputSchema;
  const prompt = motionDesignerPrompt(parts);
  const output =
    model === CLAUDE_MODEL
      ? await askClaude(studioId, prompt, content, schema)
      : isKimiModel(model)
        ? await askKimi(studioId, model, prompt, content, schema)
        : await askGemini(studioId, model, prompt, content, schema);
  // Its render is at the level: nothing new (an answer without code keeps it too).
  if (look && (output?.keep || !output?.code?.trim())) return { code: look.code, js: null, error: null, keep: true, seen: output?.seen ?? "" };
  const code = output?.code ?? "";
  // Only photos it was offered, each once, in its order.
  const offered = new Set((request.photos ?? []).map((p) => p.id));
  const photos = [...new Set(output?.photos ?? [])].filter((id) => offered.has(id)).slice(0, MAX_SCENE_PHOTOS);
  // The fonts it brings: only families Google Fonts serves, by the name it serves them under (the render loads them from there).
  const named = [...new Set((output?.fonts ?? []).map((f) => f.trim()))]
    .filter((f) => f && f !== brand.displayFont && f !== brand.bodyFont)
    .slice(0, MAX_SCENE_FONTS);
  const fonts = (await Promise.all(named.map((f) => googleFont(f).catch(() => null)))).filter((f): f is string => Boolean(f));
  // A composition's choice of row for a voice's subtitles, kept within the frame's safe rows.
  const subtitleY = request.compose && typeof output?.subtitle_y === "number" ? Math.min(0.8, Math.max(0.1, output.subtitle_y)) : undefined;
  const meta = {
    name: output?.name ?? "",
    slots: output?.slots ?? [],
    notes: output?.notes ?? "",
    photos,
    fonts,
    ...(subtitleY !== undefined ? { subtitleY } : {}),
    ...(look ? { keep: false, seen: output?.seen ?? "" } : {}),
  };
  const problems = checkMotionCode(code);
  if (problems.length) return { code, js: null, error: `code refusé : ${problems.join(", ")}`, ...meta };
  try {
    return { code, js: transpile(code), error: null, ...meta };
  } catch (error) {
    return { code, js: null, error: `syntaxe : ${error instanceof Error ? error.message : String(error)}`, ...meta };
  }
}

/** The photos a written scene reads, with their links, for its test render. */
function photosOf(result: SceneResult, request: SceneRequest): ScenePhoto[] {
  return (result.photos ?? []).flatMap((id) => {
    const offered = request.photos?.find((p) => p.id === id);
    return offered ? [offered.photo] : [];
  });
}

/** What a motion designer call can take (up to 64 000 tokens streamed: 1.5 to 4.5 min), and a check of its scenes. */
const SCENE_CALL_MS = 290_000;
const SMOKE_MS = 60_000;
/** The director's look at one animation (Sonnet, a few images, a short answer). */
const JUDGE_MS = 60_000;
/** The Reel shown to the motion designer before it writes: its media copied, then two dozen images (a minute or so). */
const SHOW_MS = 90_000;
/** Its look at its render: the frames over her footage (a minute or so), the director's looks then the rewrites side by side, a check of the reworked ones. */
const LOOK_NEEDS_MS = 90_000 + JUDGE_MS + SCENE_CALL_MS + SMOKE_MS;

export type SceneContext = {
  /** The Reel's animations that keep their code (name or brief), and the names of the business's latest ones. */
  kept?: string[];
  done?: string[];
  /** The Reel's rhythm and look, for the test render of a scene that follows what moves. */
  look?: SmokeScene["look"];
  /** Its written animations rendered over her footage, in the Reel as it will come out: what it looks at before delivering. */
  rendered?: (written: SceneResult[]) => Promise<SceneLooks>;
  /** The Reel as it will come out without the animations being written, given to their first drafts (`canvas`) before they are written. */
  show?: (requests: SceneRequest[]) => Promise<void>;
};

/** The test render of written scenes: each with its photos, fonts, cuts, composition and what moves under it. */
function smokeScenes(results: SceneResult[], requestOf: (id: string) => SceneRequest, context: SceneContext): SmokeScene[] {
  return results
    .filter((r) => r.js)
    .map((r) => {
      const request = requestOf(r.id);
      const photos = photosOf(r, request);
      return {
        id: r.id,
        js: r.js!,
        durationInFrames: request.durationInFrames,
        ...(photos.length ? { photos } : {}),
        ...(r.fonts?.length ? { fonts: r.fonts } : {}),
        ...(request.cuts ? { cuts: request.cuts } : {}),
        ...(request.compose ? { shots: request.compose.shots, reelTexts: request.compose.texts, end: request.compose.end } : {}),
        // A scene that follows what moves is checked where it goes, with the Reel's camera moves.
        ...(request.track?.length || request.compose?.shots.some((x) => x.track) ? { ...(request.track?.length ? { track: request.track } : {}), look: context.look } : {}),
      };
    });
}

export async function designMotionScenes(
  studioId: string,
  requests: SceneRequest[],
  artDirection: string | undefined,
  brand: SceneBrand,
  kit: MotionKit = [],
  context: SceneContext = {},
): Promise<SceneResult[]> {
  if (!requests.length) return [];
  const model = await designerModel(studioId);
  const requestOf = (id: string) => requests.find((q) => q.id === id)!;
  // A first draft sees the Reel it is written for, when the step has the time for its images and a call after them;
  // images that take longer than that are not waited for (they reach the drafts still to be written).
  if (context.show && requests.some((r) => !r.seen && !r.canvas) && timeLeft() >= SHOW_MS + SCENE_CALL_MS + SMOKE_MS) {
    let state: "showing" | "shown" | "failed" = "showing";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const showing = context.show(requests).then(
      () => {
        state = "shown";
      },
      (error: unknown) => {
        state = "failed";
        console.warn("motion: the Reel could not be shown, its animations are written blind", error);
      },
    );
    await Promise.race([showing, new Promise<void>((resolve) => (timer = setTimeout(resolve, SHOW_MS)))]);
    clearTimeout(timer);
    if (state === "showing") console.warn("motion: the Reel not shown in time, its first animation is written without it");
  }
  // One after the other: each scene knows what the earlier ones of the Reel do (a minute more for a second one).
  const results: SceneResult[] = [];
  for (const [i, r] of requests.entries()) {
    const existing: Existing = {
      reel: [
        ...(context.kept ?? []),
        ...results.map((w) => (w.name ? `${w.name} : ${w.notes ?? ""}`.trim() : requestOf(w.id).brief)),
        ...requests.slice(i + 1).map((q) => `to come: ${q.brief}`),
      ],
      done: context.done ?? [],
    };
    const write = () => writeScene(studioId, model, r, brand, artDirection, kit, existing).catch((e: unknown) => ({ code: null, js: null, error: String(e) }));
    // Not started without the time to finish it: the step would die with nothing (its fixed scene, or none, plays).
    if (timeLeft() < SCENE_CALL_MS) {
      console.warn("motion scene skipped, the step has no time left", r.brief.slice(0, 80));
      results.push({ id: r.id, code: null, js: null, error: "plus le temps dans cette étape" });
      continue;
    }
    // An answer with no code at all (cut off, unreadable) has nothing to correct: it is asked once more.
    let written = await write();
    if (!written.code?.trim() && timeLeft() >= SCENE_CALL_MS) {
      console.warn("motion scene without code, asked again", r.brief.slice(0, 80), written.error);
      written = await write();
    }
    results.push({ id: r.id, ...written });
  }
  return checkScenes(studioId, model, results, requestOf, brand, artDirection, kit, context);
}

/**
 * The check of written scenes, then one round of fixes, with the reason, for those that fail it or leave a text
 * on a face of the footage they follow or too quick to read. Those that passed are kept as they are if their fix
 * fails (a scene that works beats none); the others have no js (their fixed scene, or none, plays).
 */
async function checkScenes(
  studioId: string,
  model: string,
  written: SceneResult[],
  requestOf: (id: string) => SceneRequest,
  brand: SceneBrand,
  artDirection: string | undefined,
  kit: MotionKit,
  context: SceneContext,
): Promise<SceneResult[]> {
  let results = written;
  const working = new Map<string, SceneResult>();
  for (let round = 0; round < 2; round++) {
    const checks = await smokeTestScenes(smokeScenes(results, requestOf, context), brand).catch(
      (e: unknown): SceneChecks => ({ errors: Object.fromEntries(results.map((r) => [r.id, `smoke indisponible : ${String(e)}`])), faces: {}, cover: {} }),
    );
    results = results.map((r) => {
      if (!r.js || !checks.errors[r.id]) return r;
      return working.get(r.id) ?? { ...r, js: null, error: checks.errors[r.id]! };
    });
    if (round === 1) break;
    for (const r of results) if (r.js && checks.faces[r.id]) working.set(r.id, r);
    const toFix = results.filter((r) => (!r.js && r.code) || working.has(r.id));
    // A fix is a call and a check more: not without the time for both.
    if (!toFix.length || timeLeft() < SCENE_CALL_MS + SMOKE_MS) break;
    // One round of fixes, with the error (or the text to move off a face), for those scenes (they keep their photos).
    const fixed = await Promise.all(
      toFix.map(async (r) => ({
        id: r.id,
        ...(await writeScene(studioId, model, requestOf(r.id), brand, artDirection, kit, { reel: [], done: [] }, {
          code: r.code!,
          error: r.error ?? checks.faces[r.id] ?? "erreur",
          photos: r.photos,
          fonts: r.fonts,
        }).catch((e: unknown) => ({ code: r.code, js: null, error: String(e) }))),
      })),
    );
    results = results.map((r) => {
      const f = fixed.find((x) => x.id === r.id);
      if (!f) return r;
      // A fix that does not even compile: the scene that worked stays.
      if (!f.js && working.has(r.id)) return working.get(r.id)!;
      return {
        ...f,
        photos: "photos" in f && f.photos?.length ? f.photos : r.photos,
        fonts: "fonts" in f && f.fonts?.length ? f.fonts : r.fonts,
      };
    });
  }
  return results;
}

/**
 * The director's look (Sonnet, LOOK_MODEL): an animation rendered over her footage, with its brief, kept as it is or
 * sent back with what to change.
 */
async function judgeLook(studioId: string, request: SceneRequest, frames: SceneFrame[], artDirection: string | undefined) {
  const text = JSON.stringify({
    ...(request.request ? { request: request.request.slice(0, 3000) } : {}),
    brief: request.brief,
    art_direction: artDirection,
    ...(request.fromLibrary ? { origin: "written for another Reel of the business, placed here with these words" } : {}),
  });
  const response = await anthropic().beta.messages.parse({
    model: LOOK_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: outputFormat(motionJudgeOutputSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: MOTION_LOOK_PROMPT, cache_control: CACHE_AN_HOUR }],
    messages: [{ role: "user", content: withFrames("The animation, rendered over her footage in the Reel as it will come out:", frames, text) }],
  });
  await logClaudeCost(studioId, response.usage, "motion_look", LOOK_MODEL);
  if (!response.parsed_output) throw new Error(`pas de réponse lisible (${response.stop_reason})`);
  return response.parsed_output;
}

/**
 * Before they go out, as a director looks at a render (its own step of the montage, after the design): each animation
 * just written, rendered over her footage in the Reel as it will come out (`context.rendered`), is looked at by Sonnet,
 * who keeps it as it is or sends it back with what to change; the motion designer rewrites those sent back, whole and
 * once (side by side), and may still keep one when the images show the director is wrong. Written blind, a florist's
 * WhatsApp chat was squeezed into a strip of the screen, its words overflowing their bubbles; and the motion designer
 * looking itself cost an Opus call per animation, most of them to keep it. When the director cannot look, the motion
 * designer looks itself, as before. A rewrite goes out only if it passes the check; else, and when anything fails on
 * the way, the animation stays as it was. Only the reworked ones are returned.
 */
export async function lookAtScenes(
  studioId: string,
  requests: SceneRequest[],
  results: SceneResult[],
  artDirection: string | undefined,
  brand: SceneBrand,
  kit: MotionKit,
  context: SceneContext & Required<Pick<SceneContext, "rendered">>,
): Promise<SceneResult[]> {
  if (!results.some((r) => r.js) || timeLeft() < LOOK_NEEDS_MS) {
    if (results.length) console.warn("motion look skipped", results.some((r) => r.js) ? `the step has ${Math.round(timeLeft() / 1000)} s left` : "nothing to look at");
    return [];
  }
  const model = await designerModel(studioId);
  const requestOf = (id: string) => requests.find((q) => q.id === id)!;
  const looks = await context.rendered(results.filter((r) => r.js)).catch((error: unknown): SceneLooks => {
    console.warn("motion look: frames not rendered", error);
    return new Map();
  });
  const looked = results.filter((r) => r.js && r.code && looks.get(r.id)?.length);
  if (!looked.length || timeLeft() < SCENE_CALL_MS + SMOKE_MS) return [];
  const answers = await Promise.all(
    looked.map(async (r) => {
      const frames = looks.get(r.id)!;
      // The director looks first: an animation at the level goes out as it is, without a call to the motion designer.
      const verdict = await judgeLook(studioId, requestOf(r.id), frames, artDirection).catch((error: unknown) => {
        console.warn("motion look: the director could not look, the motion designer looks itself", r.id, error);
        return null;
      });
      if (verdict?.keep) return { r, verdict, answer: { code: r.code, js: null, error: null, keep: true, seen: verdict.seen } as Omit<SceneResult, "id"> };
      // A rewrite is a call and a check more: not without the time for both (the animation stays as it was).
      if (timeLeft() < SCENE_CALL_MS + SMOKE_MS) return { r, verdict, answer: { code: r.code, js: null, error: "plus le temps de la reprendre" } as Omit<SceneResult, "id"> };
      // The Reel's other animations, as they are now: the reworked one stays in their family.
      const others = results.filter((o) => o.id !== r.id && o.js).map((o) => (o.name ? `${o.name} : ${o.notes ?? ""}`.trim() : requestOf(o.id).brief));
      const answer = await writeScene(studioId, model, requestOf(r.id), brand, artDirection, kit, { reel: [...(context.kept ?? []), ...others], done: context.done ?? [] }, undefined, {
        code: r.code!,
        frames,
        ...(verdict ? { review: { what_he_sees: verdict.seen, what_to_achieve: verdict.fix } } : {}),
      }).catch((e: unknown) => ({ code: null, js: null, error: String(e) }) as Omit<SceneResult, "id">);
      return { r, verdict, answer };
    }),
  );
  for (const { r, verdict, answer } of answers) {
    const who = verdict ? (verdict.keep ? "kept by the director" : "sent back by the director") : "looked at by the designer";
    const outcome = answer.keep ? "kept" : answer.js ? "reworked" : `left as it was (${answer.error ?? "no code"})`;
    console.log("motion look", r.id, r.name ?? "", who, outcome, (verdict && !verdict.keep ? `${verdict.fix} | ${answer.seen ?? ""}` : (answer.seen ?? "")).slice(0, 400));
  }
  // The reworked ones keep the photos and fonts they had when they name none.
  const reworked = answers.flatMap(({ r, answer }): SceneResult[] =>
    !answer.keep && answer.js
      ? [{ ...r, ...answer, id: r.id, photos: answer.photos?.length ? answer.photos : r.photos, fonts: answer.fonts?.length ? answer.fonts : r.fonts, subtitleY: answer.subtitleY ?? r.subtitleY }]
      : [],
  );
  if (!reworked.length) return [];
  // Checked as a new animation is (a text on a face or too quick to read gets its round of fixes too).
  const checked = await checkScenes(studioId, model, reworked, requestOf, brand, artDirection, kit, context);
  return checked.filter((r) => {
    if (r.js) return true;
    console.warn("motion look: the rework failed its check, the animation stays as it was", r.id, r.error);
    return false;
  });
}
