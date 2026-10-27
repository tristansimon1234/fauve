import "server-only";
import {
  BRIEF_MAX,
  CLAUDE_MODEL,
  checkMotionCode,
  type CompositionTexts,
  GEMINI_MODEL_ID,
  isKimiModel,
  motionDesignerPrompt,
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
};

/** One image of the Reel as it renders, with the instant it shows. */
export type SceneFrame = { label: string; jpeg: Buffer };

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
/** Its answer: a scene written. */
type SceneOutput = z.output<typeof motionSceneOutputSchema>;
/** The prompt of one call: its base, the same for every animation, and the parts this call needs. */
type Prompt = ReturnType<typeof motionDesignerPrompt>;
const whole = (prompt: Prompt) => [prompt.base, prompt.parts].filter(Boolean).join("\n\n");

async function askClaude(studioId: string, prompt: Prompt, content: string | Block[]): Promise<SceneOutput | null> {
  // Streamed, with room: a composition of a whole Reel is long code, and its answer was cut off mid-string at
  // 16 000 tokens, then again at 32 000 (18 000 of them thinking): Edith's split screen fell back to plain shots.
  const response = await anthropic()
    .beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 64000,
      // Medium: the code needs care, not long deliberation; most of the cost was thinking tokens.
      output_config: { effort: "medium", format: outputFormat(motionSceneOutputSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // The base is cached for every animation; the parts follow it.
      system: [{ type: "text", text: prompt.base, cache_control: CACHE_AN_HOUR }, ...(prompt.parts ? [{ type: "text" as const, text: prompt.parts }] : [])],
      messages: [{ role: "user", content }],
    })
    .finalMessage();
  await logClaudeCost(studioId, response.usage, "motion_designer");
  if (!response.parsed_output) throw new Error(`pas de réponse lisible (${response.stop_reason})`);
  return response.parsed_output;
}

// Gemini as the motion designer, for a lab studio only (studios.motion_model): the same prompt,
// the same request and the same checks, to compare the two on the same cases.
let geminiClient: GoogleGenAI | undefined;
const gemini = () => (geminiClient ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));
// Patterns and bounds are left to readAnswer, which repairs them (Gemini may refuse a pattern).
const GEMINI_SCENE_SCHEMA = toGeminiSchema(z.toJSONSchema(motionSceneOutputSchema), ["pattern"]);

async function askGemini(studioId: string, model: string, prompt: Prompt, content: string | Block[]): Promise<SceneOutput | null> {
  const parts = (typeof content === "string" ? [{ type: "text" as const, text: content }] : content).map((b) =>
    b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } },
  );
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { systemInstruction: whole(prompt), responseMimeType: "application/json", responseJsonSchema: GEMINI_SCENE_SCHEMA, maxOutputTokens: 32000 },
  });
  await logGeminiCost({ studioId, kind: "llm", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "motion_designer" } });
  if (!response.text) return null;
  return readAnswer(motionSceneOutputSchema, JSON.parse(response.text));
}

// Kimi as the motion designer, for a lab studio only, through Vercel AI Gateway: the same prompt,
// the same request (its images as data URLs) and the same checks.
const KIMI_SCENE_SCHEMA = strictShape(z.toJSONSchema(motionSceneOutputSchema));

async function askKimi(studioId: string, model: string, prompt: Prompt, content: string | Block[]): Promise<SceneOutput | null> {
  const parts = (typeof content === "string" ? [{ type: "text" as const, text: content }] : content).map((b) =>
    b.type === "text" ? { type: "text" as const, text: b.text } : { type: "image_url" as const, image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } },
  );
  const answer = await askKimiJson({
    studioId,
    model,
    system: whole(prompt),
    content: parts,
    name: "motion_scene",
    schema: KIMI_SCENE_SCHEMA,
    maxTokens: 64000,
    purpose: "motion_designer",
  });
  // What it leaves empty (null) is left out, as an optional field never written.
  const written = Object.fromEntries(Object.entries((answer ?? {}) as Record<string, unknown>).filter(([, v]) => v !== null));
  return readAnswer(motionSceneOutputSchema, written);
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

/** The images it is shown, each with its instant, then what it is asked. */
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

/** One call of the motion designer: a scene written from its request; with `fix`, its code corrected from a check's error. */
async function writeScene(
  studioId: string,
  model: string,
  request: SceneRequest,
  brand: SceneBrand,
  artDirection: string | undefined,
  kit: MotionKit,
  existing: Existing,
  fix?: { code: string; error: string; photos?: string[]; fonts?: string[] },
): Promise<Omit<SceneResult, "id">> {
  const kept = [fix?.photos?.length && `the same photos (${fix.photos.join(", ")})`, fix?.fonts?.length && `the same fonts (${fix.fonts.join(", ")})`].filter(Boolean);
  // A correction looks at its earlier render first: each image with its instant, then the request.
  const seen = !fix && request.seen?.frames.length ? request.seen : undefined;
  // A first draft sees the Reel it is written for, as it will come out without its animations.
  const canvas = !fix && !seen && request.canvas?.length ? request.canvas : undefined;
  // Its prompt: the base, and only the parts this animation needs (a fix keeps those of its request).
  const parts: MotionPromptParts = {
    photos: Boolean(request.photos?.length || request.compose?.plans.some((p) => p.cut_out)),
    cuts: Boolean(request.cuts && !request.compose),
    moves: Boolean(request.moves || request.track?.length || request.compose?.shots.some((x) => x.track)),
    composition: Boolean(request.compose),
    correction: Boolean(seen),
  };
  const text = fix
    ? `This code failed: ${fix.error}\nFix it, keeping the same intention${kept.length ? ` and ${kept.join(" and ")}` : ""}.\n\nBrief: ${request.brief}\n\nCode:\n${fix.code}`
    : JSON.stringify({
        ...(request.request ? { request: request.request.slice(0, BRIEF_MAX) } : {}),
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
      });
  const content: string | Block[] = seen
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
  const prompt = motionDesignerPrompt(parts);
  const output =
    model === CLAUDE_MODEL
      ? await askClaude(studioId, prompt, content)
      : isKimiModel(model)
        ? await askKimi(studioId, model, prompt, content)
        : await askGemini(studioId, model, prompt, content);
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
/** The Reel shown to the motion designer before it writes: its media copied, then two dozen images (a minute or so). */
const SHOW_MS = 90_000;

export type SceneContext = {
  /** The Reel's animations that keep their code (name or brief), and the names of the business's latest ones. */
  kept?: string[];
  done?: string[];
  /** The Reel's rhythm and look, for the test render of a scene that follows what moves. */
  look?: SmokeScene["look"];
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
