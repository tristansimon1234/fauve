import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, checkMotionCode, MOTION_DESIGNER_PROMPT, motionSceneOutputSchema, type MotionSlot, type ReelProps, type ScenePhoto } from "@fauve/agent";
import { transform } from "sucrase";
import { smokeTestScenes } from "@/lib/render/sandbox";
import { anthropic, logClaudeCost } from "./run";

// The motion designer: one Opus call per free scene, which writes the component.
// Code is checked statically, transpiled (never executed here), then smoke-
// rendered in the sandbox; a failing scene gets one round of fixes, and if it
// still fails the renderer uses the scene's fixed fallback. The scenes of one Reel
// are written one after the other, each knowing what the earlier ones do, so that
// no two share an idea; the business's latest ones are named too.

/** A photo of hers a scene may compose with: its id and what it shows (for the designer), its links (for the test render). */
export type OfferedPhoto = { id: string; shows: string; photo: ScenePhoto };

/**
 * busy: the rows of the footage under the scene that must stay seen (faces, lettering; shares of the height);
 * photos: her photos it may compose with; cuts: for an animation over several shots, where the shot changes under it (frames from its start).
 */
export type SceneRequest = {
  id: string;
  brief: string;
  durationInFrames: number;
  previousCode?: string;
  busy?: { y: number; h: number }[];
  photos?: OfferedPhoto[];
  cuts?: number[];
};
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

const EDGE_WORDS = { top: "le haut", bottom: "le bas", left: "la gauche", right: "la droite" } as const;

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

async function writeScene(
  studioId: string,
  request: SceneRequest,
  brand: Brand,
  artDirection: string | undefined,
  kit: MotionKit,
  existing: Existing,
  fix?: { code: string; error: string; photos?: string[] },
) {
  const content = fix
    ? `Ce code a échoué : ${fix.error}\nCorrige-le en gardant la même intention${fix.photos?.length ? ` et les mêmes photos (${fix.photos.join(", ")})` : ""}.\n\nBrief : ${request.brief}\n\nCode :\n${fix.code}`
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
        // Faces and lettering of the picture under the scene, in px of the 1920 high frame: the words go around them.
        ...(request.busy?.length
          ? { sous_la_scene: request.busy.map((b) => ({ a_laisser_visible: `de y = ${Math.round(b.y * 1920)} à y = ${Math.round((b.y + b.h) * 1920)}` })) }
          : {}),
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
        // An animation over several shots: the cuts under it.
        ...(request.cuts ? { plans_dessous: { plans: request.cuts.length + 1, coupes_images: request.cuts } } : {}),
        code_precedent: request.previousCode,
      });
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    // Medium: the code needs care, not long deliberation; most of the cost was thinking tokens.
    output_config: { effort: "medium", format: betaZodOutputFormat(motionSceneOutputSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: MOTION_DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  await logClaudeCost(studioId, response.usage, "motion_designer");
  const code = response.parsed_output?.code ?? "";
  // Only photos it was offered, each once, in its order.
  const offered = new Set((request.photos ?? []).map((p) => p.id));
  const photos = [...new Set(response.parsed_output?.photos ?? [])].filter((id) => offered.has(id)).slice(0, MAX_SCENE_PHOTOS);
  const meta = { name: response.parsed_output?.name ?? "", slots: response.parsed_output?.slots ?? [], notes: response.parsed_output?.notes ?? "", photos };
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

/**
 * `kept`: the Reel's animations that keep their code (name or brief); `done`: the names of
 * the business's latest animations. Both, with the scenes written before, tell each new
 * scene what not to repeat.
 */
export async function designMotionScenes(
  studioId: string,
  requests: SceneRequest[],
  artDirection: string | undefined,
  brand: Brand,
  kit: MotionKit = [],
  context: { kept?: string[]; done?: string[] } = {},
): Promise<SceneResult[]> {
  if (!requests.length) return [];
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
    results.push({ id: r.id, ...(await writeScene(studioId, r, brand, artDirection, kit, existing).catch((e: unknown) => ({ code: null, js: null, error: String(e) }))) });
  }

  for (let round = 0; round < 2; round++) {
    const smoke = await smokeTestScenes(
      results
        .filter((r) => r.js)
        .map((r) => {
          const request = requestOf(r.id);
          const photos = photosOf(r, request);
          return { id: r.id, js: r.js!, durationInFrames: request.durationInFrames, ...(photos.length ? { photos } : {}), ...(request.cuts ? { cuts: request.cuts } : {}) };
        }),
      brand,
    )
      .then((checks) => checks.errors)
      .catch((e: unknown) => Object.fromEntries(results.map((r) => [r.id, `smoke indisponible : ${String(e)}`])));
    results = results.map((r) => (r.js && smoke[r.id] ? { ...r, js: null, error: smoke[r.id]! } : r));
    const failed = results.filter((r) => !r.js && r.code);
    if (round === 1 || !failed.length) break;
    // One round of fixes, with the error, for the scenes that failed (they keep their photos).
    const fixed = await Promise.all(
      failed.map(async (r) => ({
        id: r.id,
        ...(await writeScene(studioId, requestOf(r.id), brand, artDirection, kit, { reel: [], done: [] }, { code: r.code!, error: r.error ?? "erreur", photos: r.photos }).catch(
          (e: unknown) => ({ code: r.code, js: null, error: String(e) }),
        )),
      })),
    );
    results = results.map((r) => {
      const f = fixed.find((x) => x.id === r.id);
      if (!f) return r;
      return { ...f, photos: "photos" in f && f.photos?.length ? f.photos : r.photos };
    });
  }
  return results;
}
