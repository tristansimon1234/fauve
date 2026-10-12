import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, checkMotionCode, MOTION_DESIGNER_PROMPT, motionSceneOutputSchema, type ReelProps } from "@fauve/agent";
import { transform } from "sucrase";
import { smokeTestScenes } from "@/lib/render/sandbox";
import { anthropic, logClaudeCost } from "./run";

// The motion designer: one Opus call per free scene, which writes the component.
// Code is checked statically, transpiled (never executed here), then smoke-
// rendered in the sandbox; a failing scene gets one round of fixes, and if it
// still fails the renderer uses the scene's fixed fallback.

export type SceneRequest = { id: string; brief: string; durationInFrames: number; previousCode?: string };
export type SceneResult = { id: string; code: string | null; js: string | null; error: string | null };

type Brand = Pick<ReelProps["brand"], "name" | "accent" | "accentInk" | "displayFont" | "bodyFont" | "logoUrl">;

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

async function writeScene(
  studioId: string,
  request: SceneRequest,
  brand: Brand,
  artDirection: string | undefined,
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
        code_precedent: request.previousCode,
      });
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: betaZodOutputFormat(motionSceneOutputSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: MOTION_DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  await logClaudeCost(studioId, response.usage, "motion_designer");
  const code = response.parsed_output?.code ?? "";
  const problems = checkMotionCode(code);
  if (problems.length) return { code, js: null, error: `code refusé : ${problems.join(", ")}` };
  try {
    return { code, js: transpile(code), error: null };
  } catch (error) {
    return { code, js: null, error: `syntaxe : ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function designMotionScenes(
  studioId: string,
  requests: SceneRequest[],
  artDirection: string | undefined,
  brand: Brand,
): Promise<SceneResult[]> {
  if (!requests.length) return [];
  let results: SceneResult[] = await Promise.all(
    requests.map(async (r) => ({ id: r.id, ...(await writeScene(studioId, r, brand, artDirection).catch((e: unknown) => ({ code: null, js: null, error: String(e) }))) })),
  );

  for (let round = 0; round < 2; round++) {
    const smoke = await smokeTestScenes(
      results.filter((r) => r.js).map((r) => ({ id: r.id, js: r.js!, durationInFrames: requests.find((q) => q.id === r.id)!.durationInFrames })),
    ).catch((e: unknown) => Object.fromEntries(results.map((r) => [r.id, `smoke indisponible : ${String(e)}`])));
    results = results.map((r) => (r.js && smoke[r.id] ? { ...r, js: null, error: smoke[r.id]! } : r));
    const failed = results.filter((r) => !r.js && r.code);
    if (round === 1 || !failed.length) break;
    // One round of fixes, with the error, for the scenes that failed.
    const fixed = await Promise.all(
      failed.map(async (r) => ({
        id: r.id,
        ...(await writeScene(studioId, requests.find((q) => q.id === r.id)!, brand, artDirection, { code: r.code!, error: r.error ?? "erreur" }).catch(
          (e: unknown) => ({ code: r.code, js: null, error: String(e) }),
        )),
      })),
    );
    results = results.map((r) => fixed.find((f) => f.id === r.id) ?? r);
  }
  return results;
}
