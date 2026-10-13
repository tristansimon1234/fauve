import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  CLAUDE_MODEL,
  editPlanSchema,
  MONTAGE_CRITIC_PROMPT,
  montageReviewSchema,
  planDigest,
  reviewMoments,
  type EditPlan,
  type MontageIssue,
  type MontageReview,
} from "@fauve/agent";
import { videoFramesInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

// The critic of a montage (Soigné, Max): key frames of each rendered version
// are cut in the sandbox, Opus looks at them with what the plan puts on screen,
// keeps the best version and says whether it can go out or what the editor
// must correct. It never blocks a delivery: without frames or an answer, the
// latest version goes out as it is.

export type ReviewedVersion = { planId: string; renderId: string };

export type CriticVerdict = {
  /** Index of the kept version in the list given. */
  best: number;
  review: MontageReview;
};

async function loadVersion(studioId: string, version: ReviewedVersion) {
  const db = supabaseAdmin();
  const [plan, render] = await Promise.all([
    db.from("edit_plans").select("plan").eq("id", version.planId).eq("studio_id", studioId).single(),
    db.from("renders").select("storage_path, status").eq("id", version.renderId).eq("studio_id", studioId).single(),
  ]);
  const parsed = editPlanSchema.safeParse(plan.data?.plan);
  if (!parsed.success || render.data?.status !== "done" || !render.data.storage_path) return null;
  const signed = await db.storage.from("media").createSignedUrl(render.data.storage_path as string, 900);
  if (!signed.data) return null;
  const moments = reviewMoments(parsed.data);
  const frames = await videoFramesInSandbox(
    `review-${version.renderId.slice(0, 8)}-${Date.now()}`,
    signed.data.signedUrl,
    moments.map((m) => m.t),
  ).catch((error: unknown) => {
    console.warn("critic: no frames for", version.renderId, error);
    return [];
  });
  return { plan: parsed.data, moments, frames };
}

const quote = (texts: string[]) => texts.map((t) => `« ${t.slice(0, 120)} »`).join(", ");

/**
 * Has the rendered versions reviewed. `asked`: the corrections the last version
 * was made for (it is then compared with the one before it).
 */
export async function reviewMontage(input: {
  studioId: string;
  postId: string;
  versions: ReviewedVersion[];
  request?: string | null;
  asked?: MontageIssue[];
}): Promise<CriticVerdict | null> {
  if (!input.versions.length) return null;
  const db = supabaseAdmin();
  const [studio, brand, loaded] = await Promise.all([
    db.from("studios").select("name, business_type").eq("id", input.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", input.studioId).order("version", { ascending: false }).limit(1),
    Promise.all(input.versions.map((v) => loadVersion(input.studioId, v))),
  ]);
  if (!loaded.some((v) => v?.frames.length)) return null;
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.[0]?.profile ?? {});

  const context = [
    `Commerce : ${(studio.data?.name as string | null) ?? "?"}${studio.data?.business_type ? ` (${studio.data.business_type as string})` : ""}.`,
    profile.tone ? `Ton de la marque : ${profile.tone}.` : "",
    profile.art_direction ? `Direction artistique : ${profile.art_direction.slice(0, 600)}` : "",
    input.request ? `Demande de la gérante : ${input.request.slice(0, 1500)}` : "",
    `${input.versions.length} version${input.versions.length > 1 ? "s" : ""} à regarder.`,
  ]
    .filter(Boolean)
    .join("\n");

  type Block =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } };
  const content: Block[] = [{ type: "text", text: context }];
  loaded.forEach((version, i) => {
    const last = i === loaded.length - 1;
    const correction = last && i > 0 && input.asked?.length;
    content.push({
      type: "text",
      text: version
        ? `Version ${i + 1}${correction ? ` (correction de la version ${i})` : ""} : ${planDigest(version.plan as EditPlan)}`
        : `Version ${i + 1} : images indisponibles, ne la retiens pas.`,
    });
    if (correction) {
      content.push({ type: "text", text: `Corrections demandées : ${input.asked!.map((a) => `${a.scene ? `scène ${a.scene} : ` : ""}${a.fix}`).join(" ; ")}` });
    }
    for (const frame of version?.frames ?? []) {
      const moment = version!.moments.find((m) => m.t === frame.t);
      content.push({
        type: "text",
        text: `Version ${i + 1} · ${frame.t.toFixed(1)} s · ${moment?.label ?? ""}${moment?.texts.length ? ` · textes prévus : ${quote(moment.texts)}` : ""}`,
      });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame.jpeg.toString("base64") } });
    }
  });

  try {
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      output_config: { effort: "medium", format: betaZodOutputFormat(montageReviewSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: MONTAGE_CRITIC_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });
    await logClaudeCost(input.studioId, response.usage, "montage_critic");
    const review = response.parsed_output;
    if (!review) return null;
    // A version without frames is never kept.
    let best = Math.min(Math.max(1, review.best), input.versions.length) - 1;
    if (!loaded[best]?.frames.length) best = loaded.findLastIndex((v) => v?.frames.length);
    return { best, review };
  } catch (error) {
    console.warn("critic unavailable", input.postId, error);
    return null;
  }
}
