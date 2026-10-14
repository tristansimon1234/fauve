import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  buildSlideProps,
  checkLayerCode,
  CLAUDE_MODEL,
  LAYER_CRITIC_PROMPT,
  layerDesignOutputSchema,
  layerReviewSchema,
  layerSlotSchema,
  resolveReelBrand,
  SLIDE_FRAME,
  slidesPlanSchema,
  slotTexts,
  TEXT_DESIGNER_PROMPT,
  type LayerDesignOutput,
  type LayerSlot,
  type TextLayer,
} from "@fauve/agent";
import { transform } from "sucrase";
import { z } from "zod";
import { loadMontageInputs } from "@/lib/render/render-post";
import { renderStillsInSandbox } from "@/lib/render/sandbox";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

// The text designer: Opus draws the text layer of a carousel or photo post as
// code, from the manager's example and her photos. One round per call (the job
// route chains them, each in its own invocation): design or fix, static checks,
// a test render of every covered photo in the sandbox (errors, texts out of the
// frame), then a critic who compares the result with the example. At most three
// rounds; the last one that renders is kept.

export const MAX_ROUNDS = 3;

export type LayerDraft = Pick<LayerDesignOutput, "code" | "name" | "notes" | "slots" | "fonts" | "slides">;

export type DesignRequest = {
  studioId: string;
  postId: string;
  /** What to write, photo by photo, in Fauve's words. */
  request: string;
  /** The example to reproduce (an image the manager sent), if any. */
  exampleMediaId?: string;
  /** Photos to cover (1-based); default all. */
  photos?: number[];
};

export type RoundResult =
  | { status: "done"; draft: LayerDraft; js: string; review: string | null }
  | { status: "retry"; draft: LayerDraft | null; feedback: string }
  | { status: "failed"; error: string };

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUrl(path, 3600);
  if (error || !data) throw new Error(`media: ${error?.message ?? "introuvable"}`);
  return data.signedUrl;
}

/** The post's photos (index 1-based, signed JPEG URL), the example, the brand. */
async function loadContext(input: DesignRequest) {
  const db = supabaseAdmin();
  const { data: post, error } = await db.from("posts").select("id, kind, media_ids, slides").eq("id", input.postId).eq("studio_id", input.studioId).single();
  if (error) throw new Error(error.message);
  const mediaIds = ((post.media_ids as string[] | null) ?? []).slice(0, 10);
  const { data: assets } = await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", input.studioId).in("id", mediaIds.length ? mediaIds : ["00000000-0000-0000-0000-000000000000"]);
  const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
  const photos: { index: number; mediaId: string; url: string }[] = [];
  for (const [i, id] of mediaIds.entries()) {
    const asset = byId.get(id);
    if (!asset || asset.kind === "video" || String(asset.mime_type ?? "").startsWith("video/")) continue;
    if (input.photos?.length && !input.photos.includes(i + 1)) continue;
    photos.push({ index: i + 1, mediaId: id, url: await signedUrl(await jpegPath(input.studioId, asset.storage_path as string, (asset.mime_type as string | null) ?? null)) });
  }
  if (!photos.length) throw new Error("Cette publication n'a pas de photo à couvrir");

  let exampleUrl: string | null = null;
  if (input.exampleMediaId) {
    const { data: example } = await db.from("media_assets").select("storage_path, kind").eq("id", input.exampleMediaId).eq("studio_id", input.studioId).maybeSingle();
    if (!example || example.kind !== "image") throw new Error("L'exemple doit être une image");
    exampleUrl = await signedUrl(example.storage_path as string);
  }

  const inputs = await loadMontageInputs(input.studioId, { segments: [] });
  const brandIn = { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, customFonts: inputs.customFonts };
  const { data: profileRow } = await db.from("brand_profiles").select("profile").eq("studio_id", input.studioId).order("version", { ascending: false }).limit(1);
  const profile = brandProfileSchema.partial().catch({}).parse(profileRow?.[0]?.profile ?? {});
  const slides = slidesPlanSchema.safeParse(post.slides);
  const template = slides.success ? slides.data.template : (profile.default_template ?? "doux");
  const brand = resolveReelBrand({}, template, brandIn);
  return { photos, exampleUrl, brandIn, brand, template, artDirection: profile.art_direction ?? profile.moodboard?.reading, plan: slides.success ? slides.data : null };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

async function design(input: DesignRequest, ctx: Context, fix?: { draft: LayerDraft; feedback: string }): Promise<LayerDraft> {
  const shown = ctx.photos.slice(0, 3);
  const brief = {
    demande: input.request,
    photos_a_couvrir: ctx.photos.map((p) => p.index),
    format: "1080 × 1350 (4:5)",
    marque: { name: ctx.brand.name, accent: ctx.brand.accent, accentInk: ctx.brand.accentInk, displayFont: ctx.brand.displayFont, bodyFont: ctx.brand.bodyFont, logo: Boolean(ctx.brand.logoUrl) },
    direction_artistique: ctx.artDirection,
    // Her own font files: already loaded, use them by name (fontFamily) and do not list them in "fonts".
    ...(ctx.brand.customFonts?.length ? { polices_du_studio: ctx.brand.customFonts.map((f) => f.family) } : {}),
  };
  const content = [
    ...(ctx.exampleUrl
      ? [
          { type: "text" as const, text: "Exemple à reproduire :" },
          { type: "image" as const, source: { type: "url" as const, url: ctx.exampleUrl } },
        ]
      : []),
    ...shown.flatMap((p) => [
      { type: "text" as const, text: `Photo ${p.index} de la publication :` },
      { type: "image" as const, source: { type: "url" as const, url: p.url } },
    ]),
    {
      type: "text" as const,
      text: fix
        ? `${JSON.stringify(brief)}\n\nTa version précédente doit être corrigée : ${fix.feedback}\nGarde ce qui va, corrige le reste, et réponds avec la version complète.\n\nCode précédent :\n${fix.draft.code}\n\nSlots et textes précédents :\n${JSON.stringify({ slots: fix.draft.slots, fonts: fix.draft.fonts, slides: fix.draft.slides })}`
        : JSON.stringify(brief),
    },
  ];
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 20000,
    output_config: { effort: "high", format: betaZodOutputFormat(layerDesignOutputSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: TEXT_DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  await logClaudeCost(input.studioId, response.usage, "text_designer");
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Le calque n'a pas pu être dessiné (${response.stop_reason})`);
  return response.parsed_output;
}

async function review(input: DesignRequest, ctx: Context, stills: { index: number; jpeg: Buffer }[]): Promise<z.infer<typeof layerReviewSchema>> {
  const content = [
    ...(ctx.exampleUrl
      ? [
          { type: "text" as const, text: "Exemple que la gérante voulait reproduire :" },
          { type: "image" as const, source: { type: "url" as const, url: ctx.exampleUrl } },
        ]
      : []),
    ...stills.slice(0, 3).flatMap((s) => [
      { type: "text" as const, text: `Rendu de la photo ${s.index} :` },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: s.jpeg.toString("base64") } },
    ]),
    { type: "text" as const, text: `Demande : ${input.request}` },
  ];
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: betaZodOutputFormat(layerReviewSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: LAYER_CRITIC_PROMPT,
    messages: [{ role: "user", content }],
  });
  await logClaudeCost(input.studioId, response.usage, "text_critic");
  // A critic that cannot answer does not block the layer.
  return response.parsed_output ?? { ok: true, issues: [] };
}

/** The layer as stored on a covered photo. */
export function layerFor(draft: LayerDraft, js: string, photo: number, templateId?: string): TextLayer | null {
  const entry = draft.slides.find((s) => s.photo === photo);
  if (!entry) return null;
  return {
    ...(templateId ? { template_id: templateId } : {}),
    name: draft.name.slice(0, 80),
    js,
    slots: z.array(layerSlotSchema).catch([]).parse(draft.slots),
    texts: slotTexts(entry.texts),
    fonts: draft.fonts.slice(0, 4),
  };
}

/** One round: design (or fix), check, render the covered photos, have them reviewed. */
export async function designRound(
  input: DesignRequest,
  round: number,
  previous?: { draft: LayerDraft; feedback: string },
  /** Where the round is (the app's progress pill). */
  onStage?: (stage: "review") => Promise<void>,
): Promise<RoundResult> {
  const ctx = await loadContext(input);
  let draft: LayerDraft;
  try {
    draft = await design(input, ctx, previous);
  } catch (error) {
    return round + 1 < MAX_ROUNDS && previous
      ? { status: "retry", draft: previous.draft, feedback: previous.feedback }
      : { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
  const next = (feedback: string): RoundResult =>
    round + 1 < MAX_ROUNDS ? { status: "retry", draft, feedback } : { status: "failed", error: feedback };

  const problems = checkLayerCode(draft.code);
  if (problems.length) return next(`code refusé : ${problems.join(", ")}`);
  // The words must be the business's, not the slots' descriptions.
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const labels = draft.slides.flatMap((slide) =>
    slide.texts.filter((t) => {
      const slot = draft.slots.find((s) => s.name === t.slot);
      return slot && norm(t.text) && (norm(t.text) === norm(slot.role) || norm(t.text) === norm(slot.name));
    }),
  );
  if (labels.length) return next(`textes à remplacer par les vrais mots de la demande (ce sont les descriptions des slots) : ${labels.map((t) => `${t.slot} = « ${t.text} »`).join(", ")}`);
  let js: string;
  try {
    js = transpile(draft.code);
  } catch (error) {
    return next(`syntaxe : ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test render of every covered photo, in check mode (errors and texts out of the frame fail it).
  const jobs = ctx.photos.flatMap((p) => {
    const layer = layerFor(draft, js, p.index);
    if (!layer) return [];
    const props = buildSlideProps({ media_id: p.mediaId, texts: [], layer }, { template: ctx.template, imageUrl: p.url, brand: ctx.brandIn });
    return [{ id: `p${p.index}`, frame: SLIDE_FRAME, props: { ...props, layer: { ...props.layer!, check: true } } }];
  });
  if (!jobs.length) return next("slides ne couvre aucune des photos demandées : donne les textes de chaque photo à couvrir");
  const images = await renderStillsInSandbox(`layer-${input.postId.slice(0, 8)}-${Date.now()}`, jobs);
  const errors = Object.entries(images).flatMap(([id, image]) => (image instanceof Error ? [`photo ${id.slice(1)} : ${image.message.slice(0, 400)}`] : []));
  if (errors.length) return next(`le rendu test a échoué : ${errors.slice(0, 3).join(" | ")}`);

  const stills = Object.entries(images).flatMap(([id, image]) => (image instanceof Buffer ? [{ index: Number(id.slice(1)), jpeg: image }] : []));
  await onStage?.("review");
  const verdict = await review(input, ctx, stills);
  if (!verdict.ok && verdict.issues.length && round + 1 < MAX_ROUNDS) return { status: "retry", draft, feedback: `relecture du rendu : ${verdict.issues.join(" ; ")}` };
  return { status: "done", draft, js, review: verdict.ok ? null : verdict.issues.join(" ; ") };
}

export type { LayerSlot };
