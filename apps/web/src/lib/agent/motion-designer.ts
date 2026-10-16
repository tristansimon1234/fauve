import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, checkMotionCode, MOTION_DESIGNER_PROMPT, motionSceneOutputSchema, type MotionSlot, type ReelProps } from "@fauve/agent";
import { transform } from "sucrase";
import { smokeTestScenes } from "@/lib/render/sandbox";
import { anthropic, logClaudeCost } from "./run";

// The motion designer: one Opus call per free scene, which writes the component.
// Code is checked statically, transpiled (never executed here), then smoke-
// rendered in the sandbox; a failing scene gets one round of fixes, and if it
// still fails the renderer uses the scene's fixed fallback.

/** busy: the rows of the footage under the scene that must stay seen (faces, lettering; shares of the height). */
export type SceneRequest = { id: string; brief: string; durationInFrames: number; previousCode?: string; busy?: { y: number; h: number }[] };
export type SceneResult = {
  id: string;
  code: string | null;
  js: string | null;
  error: string | null;
  /** For the template library: a short name and the scene's text slots. */
  name?: string;
  slots?: MotionSlot[];
};

type Brand = Pick<ReelProps["brand"], "name" | "accent" | "accentInk" | "displayFont" | "bodyFont" | "logoUrl" | "logoOnDark">;

/** The business's motion kit: its latest scenes, whose language a new one keeps (never their code as such). */
export type MotionKit = { name: string; code: string }[];

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

async function writeScene(
  studioId: string,
  request: SceneRequest,
  brand: Brand,
  artDirection: string | undefined,
  kit: MotionKit,
  fix?: { code: string; error: string },
) {
  const content = fix
    ? `Ce code a échoué : ${fix.error}\nCorrige-le en gardant la même intention.\n\nBrief : ${request.brief}\n\nCode :\n${fix.code}`
    : JSON.stringify({
        brief: request.brief,
        duree_images: request.durationInFrames,
        fps: 30,
        format: "1080 × 1920",
        marque: brand,
        direction_artistique: artDirection,
        ...(kit.length ? { kit_du_commerce: kit } : {}),
        // Faces and lettering of the picture under the scene, in px of the 1920 high frame: the words go around them.
        ...(request.busy?.length
          ? { sous_la_scene: request.busy.map((b) => ({ a_laisser_visible: `de y = ${Math.round(b.y * 1920)} à y = ${Math.round((b.y + b.h) * 1920)}` })) }
          : {}),
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
  const meta = { name: response.parsed_output?.name ?? "", slots: response.parsed_output?.slots ?? [] };
  const problems = checkMotionCode(code);
  if (problems.length) return { code, js: null, error: `code refusé : ${problems.join(", ")}`, ...meta };
  try {
    return { code, js: transpile(code), error: null, ...meta };
  } catch (error) {
    return { code, js: null, error: `syntaxe : ${error instanceof Error ? error.message : String(error)}`, ...meta };
  }
}

export async function designMotionScenes(
  studioId: string,
  requests: SceneRequest[],
  artDirection: string | undefined,
  brand: Brand,
  kit: MotionKit = [],
): Promise<SceneResult[]> {
  if (!requests.length) return [];
  let results: SceneResult[] = await Promise.all(
    requests.map(async (r) => ({ id: r.id, ...(await writeScene(studioId, r, brand, artDirection, kit).catch((e: unknown) => ({ code: null, js: null, error: String(e) }))) })),
  );

  for (let round = 0; round < 2; round++) {
    const smoke = await smokeTestScenes(
      results.filter((r) => r.js).map((r) => ({ id: r.id, js: r.js!, durationInFrames: requests.find((q) => q.id === r.id)!.durationInFrames })),
      brand,
    )
      .then((checks) => checks.errors)
      .catch((e: unknown) => Object.fromEntries(results.map((r) => [r.id, `smoke indisponible : ${String(e)}`])));
    results = results.map((r) => (r.js && smoke[r.id] ? { ...r, js: null, error: smoke[r.id]! } : r));
    const failed = results.filter((r) => !r.js && r.code);
    if (round === 1 || !failed.length) break;
    // One round of fixes, with the error, for the scenes that failed.
    const fixed = await Promise.all(
      failed.map(async (r) => ({
        id: r.id,
        ...(await writeScene(studioId, requests.find((q) => q.id === r.id)!, brand, artDirection, kit, { code: r.code!, error: r.error ?? "erreur" }).catch(
          (e: unknown) => ({ code: r.code, js: null, error: String(e) }),
        )),
      })),
    );
    results = results.map((r) => fixed.find((f) => f.id === r.id) ?? r);
  }
  return results;
}
