import "server-only";
import {
  CLAUDE_MODEL,
  checkMotionCode,
  type CompositionTexts,
  GEMINI_MODEL_ID,
  MOTION_DESIGNER_PROMPT,
  motionLookOutputSchema,
  motionSceneOutputSchema,
  type ComposeShot,
  type CompositionShot,
  type DesignerMoves,
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
import { supabaseAdmin } from "@/lib/supabase/admin";
import { smokeTestScenes, type SceneChecks, type SmokeScene } from "@/lib/render/sandbox";
import { timeLeft } from "@/lib/step-clock";
import { anthropic, logClaudeCost } from "./run";

// The motion designer: one Opus call per free scene, which writes the component.
// Code is checked statically, transpiled (never executed here), then smoke-
// rendered in the sandbox; a failing scene gets one round of fixes, and if it
// still fails the renderer uses the scene's fixed fallback. The scenes of one Reel
// are written one after the other, each knowing what the earlier ones do, so that
// they go together; the business's latest ones are named too, not to be redone.
// Then, as a motion designer looks at a render before delivering it, it looks at its
// animations rendered over her footage, in the Reel as it will come out, and reworks
// the ones below the bar, once.

/** A photo of hers a scene may compose with: its id and what it shows (for the designer), its links (for the test render). */
export type OfferedPhoto = { id: string; shows: string; photo: ScenePhoto };

/**
 * busy: the rows of the footage under the scene that must stay seen (faces, lettering; shares of the height);
 * photos: her photos it may compose with; cuts: for an animation over several shots, where the shot changes under it (frames from its start);
 * compose: a collage's composition, which lays the Reel's shots itself: what each one shows and when (plans), where the
 * Reel's texts go over it (texts), and each shot's span and shape for its test render (shots).
 * track / moves: what moves in the footage under it, for its test render and for the designer.
 */
export type SceneRequest = {
  id: string;
  brief: string;
  durationInFrames: number;
  previousCode?: string;
  busy?: { y: number; h: number }[];
  photos?: OfferedPhoto[];
  cuts?: number[];
  compose?: { plans: CompositionShot[]; shots: ComposeShot[] } & CompositionTexts;
  /** What moves in the footage under it: the pieces its `track` reads (its test render follows them), and what the designer is told of them. */
  track?: TrackPiece[];
  moves?: DesignerMoves | { par_plan: ({ plan: number } & DesignerMoves)[] };
  /** A correction: the animation it reworks as it was rendered on her images (frames with their instant), its code, what is asked (her words, Simone's reading, the review). */
  seen?: { code: string; review: string; frames: SceneFrame[] };
  /** The row where a voice's subtitles show during the scene (shares of the height): its words keep off it. */
  subtitles?: { y: number; h: number };
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

type Brand = Pick<ReelProps["brand"], "name" | "accent" | "accentInk" | "displayFont" | "bodyFont" | "logoUrl" | "logoOnDark">;

/** The business's motion kit: its latest scenes, whose language a new one keeps (never their code as such). */
export type MotionKit = { name: string; code: string }[];

/** The most photos one scene composes with. */
const MAX_SCENE_PHOTOS = 4;
/** The most fonts one scene brings besides the Reel's two. */
const MAX_SCENE_FONTS = 2;

const EDGE_WORDS = { top: "le haut", bottom: "le bas", left: "la gauche", right: "la droite" } as const;

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } };
/** Its answer: a scene written, or its look at a scene rendered (with whether it keeps it). */
type SceneOutput = z.output<typeof motionSceneOutputSchema> & Partial<Pick<z.output<typeof motionLookOutputSchema>, "keep" | "seen">>;
type AnswerSchema = typeof motionSceneOutputSchema | typeof motionLookOutputSchema;

async function askClaude(studioId: string, content: string | Block[], schema: AnswerSchema): Promise<SceneOutput | null> {
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
      system: [{ type: "text", text: MOTION_DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
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

async function askGemini(studioId: string, model: string, content: string | Block[], schema: AnswerSchema): Promise<SceneOutput | null> {
  const parts = (typeof content === "string" ? [{ type: "text" as const, text: content }] : content).map((b) =>
    b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } },
  );
  const look = schema === motionLookOutputSchema;
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { systemInstruction: MOTION_DESIGNER_PROMPT, responseMimeType: "application/json", responseJsonSchema: look ? GEMINI_LOOK_SCHEMA : GEMINI_SCENE_SCHEMA, maxOutputTokens: 32000 },
  });
  await logGeminiCost({ studioId, kind: "llm", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "motion_designer" } });
  if (!response.text) return null;
  return look ? readAnswer(motionLookOutputSchema, JSON.parse(response.text)) : readAnswer(motionSceneOutputSchema, JSON.parse(response.text));
}

/** The model that writes this studio's scenes: Opus, or the Gemini model a lab studio is set to (studios.motion_model). */
async function designerModel(studioId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("studios").select("website_url, motion_model").eq("id", studioId).maybeSingle();
  const lab = typeof data?.website_url === "string" && data.website_url.startsWith("lab://");
  const asked = data?.motion_model as string | null | undefined;
  return lab && asked && GEMINI_MODEL_ID.test(asked) ? asked : CLAUDE_MODEL;
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
  brand: Brand,
  artDirection: string | undefined,
  kit: MotionKit,
  existing: Existing,
  fix?: { code: string; error: string; photos?: string[]; fonts?: string[] },
  look?: { code: string; frames: SceneFrame[] },
): Promise<Omit<SceneResult, "id">> {
  const kept = [fix?.photos?.length && `les mêmes photos (${fix.photos.join(", ")})`, fix?.fonts?.length && `les mêmes polices (${fix.fonts.join(", ")})`].filter(Boolean);
  // A correction looks at its earlier render first: each image with its instant, then the request.
  const seen = !fix && !look && request.seen?.frames.length ? request.seen : undefined;
  const text = fix
    ? `Ce code a échoué : ${fix.error}\nCorrige-le en gardant la même intention${kept.length ? ` et ${kept.join(" et ")}` : ""}.\n\nBrief : ${request.brief}\n\nCode :\n${fix.code}`
    : JSON.stringify({
        brief: request.brief,
        duree_images: request.durationInFrames,
        fps: 30,
        format: "1080 × 1920",
        marque: brand,
        direction_artistique: artDirection,
        ...(kit.length ? { kit_du_commerce: kit } : {}),
        ...(existing.reel.length ? { autres_animations_du_reel: existing.reel } : {}),
        ...(existing.done.length ? { deja_faites: existing.done } : {}),
        // Faces and lettering of the picture under the scene, in px of the 1920 high frame: no words on them while they show.
        ...(request.busy?.length ? { sous_la_scene: request.busy.map((b) => ({ visage_ou_enseigne: `de y = ${px(b.y)} à y = ${px(b.y + b.h)}` })) } : {}),
        // Her voice's subtitles show all along: its words keep off their row.
        ...(request.subtitles ? { sous_titres: `de y = ${px(request.subtitles.y)} à y = ${px(request.subtitles.y + request.subtitles.h)}` } : {}),
        // Her photos it may compose with: their id, what they show, and whether their subject is cut out.
        ...(request.photos?.length
          ? {
              photos_du_reel: request.photos.map((p) => ({
                id: p.id,
                montre: p.shows,
                detouree: Boolean(p.photo.cutout),
                format: p.photo.aspect >= 1 ? "paysage" : "portrait",
                // The edges of the photo that cut its subject: it comes in from there.
                ...(p.photo.cutEdges?.length ? { sujet_coupe_par: p.photo.cutEdges.map((e) => EDGE_WORDS[e]) } : {}),
              })),
            }
          : {}),
        // What moves in the footage under it (hands, faces, bodies, the gestures seen): its code follows it with `track`.
        ...(request.moves ? { ce_qui_bouge: request.moves } : {}),
        // A collage's composition lays the shots itself (nothing plays under it); another animation over several shots, the cuts under it.
        ...(request.compose
          ? {
              composition_du_reel: {
                plans: request.compose.plans,
                // The texts and the end are its own: its code gets them as reelTexts and end.
                textes: request.compose.texts,
                fin: request.compose.end,
                ...(request.compose.subtitles ? { sous_titres_du_moteur: request.compose.subtitles } : {}),
                coupes_images: request.cuts ?? [],
              },
            }
          : request.cuts
            ? { plans_dessous: { plans: request.cuts.length + 1, coupes_images: request.cuts } }
            : {}),
        ...(seen ? { version_precedente: { demande: seen.review.slice(0, 2500), images: `${seen.frames.length} images jointes, au-dessus` } } : {}),
        // Its look at its render: the images above, and its code as it is.
        ...(look ? { ton_rendu: { images: `${look.frames.length} images jointes, au-dessus` }, code_actuel: look.code } : { code_precedent: seen?.code ?? request.previousCode }),
      });
  const content: string | Block[] = look
    ? withFrames("Ton animation, rendue sur sa vidéo dans le Reel tel qu'il sortira :", look.frames, text)
    : seen
      ? withFrames("Ton animation d'avant, rendue sur ses images :", seen.frames, text)
      : text;
  const schema = look ? motionLookOutputSchema : motionSceneOutputSchema;
  const output = model === CLAUDE_MODEL ? await askClaude(studioId, content, schema) : await askGemini(studioId, model, content, schema);
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
/** Its look at its render: the frames over her footage (a minute or so), its calls side by side, a check of the reworked ones. */
const LOOK_NEEDS_MS = 90_000 + SCENE_CALL_MS + SMOKE_MS;

type Context = {
  /** The Reel's animations that keep their code (name or brief), and the names of the business's latest ones. */
  kept?: string[];
  done?: string[];
  /** The Reel's rhythm and look, for the test render of a scene that follows what moves. */
  look?: SmokeScene["look"];
  /** Its written animations rendered over her footage, in the Reel as it will come out: what it looks at before delivering. */
  rendered?: (written: SceneResult[]) => Promise<SceneLooks>;
};

/** The test render of written scenes: each with its photos, fonts, cuts, composition and what moves under it. */
function smokeScenes(results: SceneResult[], requestOf: (id: string) => SceneRequest, context: Context): SmokeScene[] {
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
  brand: Brand,
  kit: MotionKit = [],
  context: Context = {},
): Promise<SceneResult[]> {
  if (!requests.length) return [];
  const model = await designerModel(studioId);
  const requestOf = (id: string) => requests.find((q) => q.id === id)!;
  // One after the other: each scene knows what the earlier ones of the Reel do (a minute more for a second one).
  let results: SceneResult[] = [];
  for (const [i, r] of requests.entries()) {
    const existing: Existing = {
      reel: [
        ...(context.kept ?? []),
        ...results.map((w) => (w.name ? `${w.name} : ${w.notes ?? ""}`.trim() : requestOf(w.id).brief)),
        ...requests.slice(i + 1).map((q) => `à venir : ${q.brief}`),
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

  // Scenes that passed the check but leave a text on a face of the footage they follow: kept as they
  // are if their fix fails (a scene that works beats none).
  const working = new Map<string, SceneResult>();
  for (let round = 0; round < 2; round++) {
    const checks = await smokeTestScenes(smokeScenes(results, requestOf, context), brand).catch(
      (e: unknown): SceneChecks => ({ errors: Object.fromEntries(results.map((r) => [r.id, `smoke indisponible : ${String(e)}`])), faces: {} }),
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
  // Before they go out, it looks at them rendered over her footage, in the Reel as it will come out, as a motion
  // designer looks at a render: written blind, a florist's WhatsApp chat was squeezed into a strip of the screen,
  // its words overflowing their bubbles. Only with the time for it: a step cut short would deliver nothing.
  if (context.rendered && results.some((r) => r.js)) {
    if (timeLeft() >= LOOK_NEEDS_MS) results = await lookAtRender(studioId, model, requests, results, brand, artDirection, kit, context);
    else console.warn("motion look skipped, the step has no time left", Math.round(timeLeft() / 1000));
  }
  return results;
}

/**
 * Each written animation, rendered over her footage at a few instants, goes back to the motion designer, who keeps
 * it as it is or rewrites it whole, once (side by side). A rewrite goes out only if it passes the check; else, and
 * when anything fails on the way, the animation stays as it was.
 */
async function lookAtRender(
  studioId: string,
  model: string,
  requests: SceneRequest[],
  results: SceneResult[],
  brand: Brand,
  artDirection: string | undefined,
  kit: MotionKit,
  context: Context,
): Promise<SceneResult[]> {
  const requestOf = (id: string) => requests.find((q) => q.id === id)!;
  const looks = await context.rendered!(results.filter((r) => r.js)).catch((error: unknown): SceneLooks => {
    console.warn("motion look: frames not rendered", error);
    return new Map();
  });
  const looked = results.filter((r) => r.js && r.code && looks.get(r.id)?.length);
  if (!looked.length || timeLeft() < SCENE_CALL_MS + SMOKE_MS) return results;
  const answers = await Promise.all(
    looked.map(async (r) => {
      // The Reel's other animations, as they are now: the reworked one stays in their family.
      const others = results.filter((o) => o.id !== r.id && o.js).map((o) => (o.name ? `${o.name} : ${o.notes ?? ""}`.trim() : requestOf(o.id).brief));
      const answer = await writeScene(studioId, model, requestOf(r.id), brand, artDirection, kit, { reel: [...(context.kept ?? []), ...others], done: context.done ?? [] }, undefined, {
        code: r.code!,
        frames: looks.get(r.id)!,
      }).catch((e: unknown) => ({ code: null, js: null, error: String(e) }) as Omit<SceneResult, "id">);
      return { r, answer };
    }),
  );
  for (const { r, answer } of answers) console.log("motion look", r.id, r.name ?? "", answer.keep ? "kept" : answer.js ? "reworked" : `left as it was (${answer.error ?? "no code"})`, answer.seen?.slice(0, 300) ?? "");
  // The reworked ones keep the photos and fonts they had when they name none.
  const reworked = answers.flatMap(({ r, answer }): SceneResult[] =>
    !answer.keep && answer.js
      ? [{ ...r, ...answer, id: r.id, photos: answer.photos?.length ? answer.photos : r.photos, fonts: answer.fonts?.length ? answer.fonts : r.fonts, subtitleY: answer.subtitleY ?? r.subtitleY }]
      : [],
  );
  if (!reworked.length) return results;
  const checks = await smokeTestScenes(smokeScenes(reworked, requestOf, context), brand).catch((e: unknown): SceneChecks => {
    console.warn("motion look: reworked scenes not checked, kept as they were", e);
    return { errors: Object.fromEntries(reworked.map((r) => [r.id, String(e)])), faces: {} };
  });
  return results.map((r) => {
    const better = reworked.find((x) => x.id === r.id);
    if (!better) return r;
    if (checks.errors[r.id]) {
      console.warn("motion look: the rework failed its check, the animation stays as it was", r.id, checks.errors[r.id]);
      return r;
    }
    return better;
  });
}
