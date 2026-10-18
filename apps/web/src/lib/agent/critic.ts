import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  ambianceLine,
  brandProfileSchema,
  followedLine,
  MAX_AVERAGE_SHOT,
  paceCeiling,
  signatureLines,
  signatureOf,
  CRITIC_MODEL,
  editPlanSchema,
  formatLine,
  MONTAGE_CRITIC_PROMPT,
  montageReviewSchema,
  normalizeReview,
  planTimeline,
  withoutScenes,
  planDigest,
  reviewMoments,
  type EditPlan,
  type MontageIssue,
  type MontageReview,
  type ReelFormat,
  voiceLine,
  voiceTranscriptSchema,
} from "@fauve/agent";
import { videoFramesInSandbox } from "@/lib/render/sandbox";
import { postStyle } from "@/lib/steal";
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
  /** The kept version was rendered by the fallback engine (no animations): not the editor's to fix. */
  fallback: boolean;
};

async function loadVersion(studioId: string, version: ReviewedVersion) {
  const db = supabaseAdmin();
  const [plan, render] = await Promise.all([
    db.from("edit_plans").select("plan").eq("id", version.planId).eq("studio_id", studioId).single(),
    db.from("renders").select("storage_path, status, duration_ms").eq("id", version.renderId).eq("studio_id", studioId).single(),
  ]);
  const parsed = editPlanSchema.safeParse(plan.data?.plan);
  if (!parsed.success || render.data?.status !== "done" || !render.data.storage_path) return null;
  // The voice's first sentence, which the frames cannot let the critic hear.
  const transcript = parsed.data.voice
    ? voiceTranscriptSchema.safeParse((await db.from("media_assets").select("transcript").eq("id", parsed.data.voice.media_id).eq("studio_id", studioId).maybeSingle()).data?.transcript)
    : null;
  const voice = voiceLine(parsed.data, transcript?.success ? transcript.data : null);
  const signed = await db.storage.from("media").createSignedUrl(render.data.storage_path as string, 900);
  if (!signed.data) return null;
  // A video shorter than its plan came from the ffmpeg fallback, which keeps only the clips:
  // the frames are taken on what was really rendered.
  const planned = planTimeline(parsed.data).duration * 1000;
  const fallback = typeof render.data.duration_ms === "number" && render.data.duration_ms < planned - 100;
  const shown = fallback ? withoutScenes(parsed.data) : parsed.data;
  const moments = shown.segments.length ? reviewMoments(shown) : [];
  const frames = await videoFramesInSandbox(
    `review-${version.renderId.slice(0, 8)}-${Date.now()}`,
    signed.data.signedUrl,
    moments.map((m) => m.t),
  ).catch((error: unknown) => {
    console.warn("critic: no frames for", version.renderId, error);
    return [];
  });
  return { plan: shown, moments, frames, fallback, voice };
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
  /** The Reel's form (a key message held on screen, a told one): judged on its own terms. */
  format?: ReelFormat;
}): Promise<CriticVerdict | null> {
  if (!input.versions.length) return null;
  const db = supabaseAdmin();
  const [studio, brand, post, loaded] = await Promise.all([
    db.from("studios").select("name, business_type").eq("id", input.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", input.studioId).order("version", { ascending: false }).limit(1),
    // The ambiance she chose for this Reel (none: the editor's choice, judged like the rest).
    db.from("posts").select("template").eq("id", input.postId).maybeSingle(),
    Promise.all(input.versions.map((v) => loadVersion(input.studioId, v))),
  ]);
  if (!loaded.some((v) => v?.frames.length)) return null;
  const profile = brandProfileSchema.partial().catch({}).parse(brand.data?.[0]?.profile ?? {});
  // The Reel this one copies (« Steal »): it is compared with it, its pace included.
  const followed = await postStyle(input.studioId, input.postId).catch(() => undefined);
  const signature = signatureOf({ signature: profile.signature, followed });
  const ceiling = paceCeiling(MAX_AVERAGE_SHOT, followed);

  const context = [
    `Commerce : ${(studio.data?.name as string | null) ?? "?"}${studio.data?.business_type ? ` (${studio.data.business_type as string})` : ""}.`,
    profile.tone ? `Ton de la marque : ${profile.tone}.` : "",
    profile.art_direction ? `Direction artistique : ${profile.art_direction.slice(0, 600)}` : "",
    signature ? `Sa charte en réglages (le Reel doit la porter : on doit reconnaître ce commerce sans voir son nom) :\n${signatureLines(signature)}` : "",
    followed ? `${followedLine(followed)}. Ce Reel le recopie : il doit en reprendre la forme, le rythme et le texte, avec ses images et ses mots à elle.` : "",
    input.request ? `Demande de la gérante : ${input.request.slice(0, 1500)}` : "",
    ambianceLine(post.data?.template as string | null | undefined) ?? "",
    formatLine(input.format) ?? "",
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
    if (!version?.frames.length) {
      content.push({ type: "text", text: `Version ${i + 1} : images indisponibles, ne la retiens pas.` });
      return;
    }
    content.push({
      type: "text",
      text: `Version ${i + 1}${correction ? ` (correction de la version ${i})` : ""} : ${planDigest(version.plan as EditPlan, { paceCeiling: ceiling })}${version.voice ? ` ${version.voice}` : ""}${
        version.fallback ? " Rendue par le moteur de secours, sans les animations : leur absence n'est pas un défaut à corriger." : ""
      }`,
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
      model: CRITIC_MODEL,
      max_tokens: 6000,
      output_config: { effort: "medium", format: betaZodOutputFormat(montageReviewSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: MONTAGE_CRITIC_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });
    await logClaudeCost(input.studioId, response.usage, "montage_critic", CRITIC_MODEL);
    if (!response.parsed_output) return null;
    const review = normalizeReview(response.parsed_output, input.versions.length);
    const best = review.best - 1;
    // A version without frames is never kept, and the verdict about it is not reused for another one.
    if (!loaded[best]?.frames.length) {
      const seen = loaded.findLastIndex((v) => v?.frames.length);
      return { best: seen, review: { ...review, ok: true, issues: [], summary: "", why: "" }, fallback: Boolean(loaded[seen]?.fallback) };
    }
    return { best, review, fallback: Boolean(loaded[best]?.fallback) };
  } catch (error) {
    console.warn("critic unavailable", input.postId, error);
    return null;
  }
}
