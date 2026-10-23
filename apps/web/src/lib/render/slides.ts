import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  alignSlides,
  buildCarouselProps,
  buildSlideProps,
  postStatusSchema,
  SLIDE_FRAME,
  slidesPlanSchema,
  type CarouselDesign,
  type ReelInputs,
  type SlidesPlan,
} from "@fauve/agent";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carouselPhotos } from "./carousel";
import { loadMontageInputs, towardsDraft } from "./render-post";
import { renderStillsInSandbox, sandboxCostEur } from "./sandbox";

// Text over the photos of a carousel or photo post: the plan lives in
// posts.slides, the rendered JPEGs in posts.slides_render (published instead of
// the raw photos while their key matches the plan).

export type SlidesRender = {
  /** Key of the plan the paths were rendered from. */
  key: string | null;
  /** One rendered image per photo of the post, or null (a video, or a photo left as is); for a designed carousel, one per slide. */
  paths: (string | null)[];
  /** Key being rendered, and since when (publishing waits for it). */
  pending?: string | null;
  pending_at?: string | null;
  error?: string | null;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

/** The plan as it reads back from the database: its JSON, through its schema (defaults, known fields). */
const asStored = (plan: SlidesPlan): SlidesPlan => slidesPlanSchema.safeParse(JSON.parse(JSON.stringify(plan))).data ?? plan;

/**
 * Its JSON with each object's keys in order. Postgres keeps a jsonb object's keys in its own
 * order: the texts of a designed carousel came back in another order than the designer's, its
 * key no longer matched its slides, and the Grille lost its cover.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}

/** The key of a slides plan: the same for the plan saved and the plan read back. */
export const slidesKey = (plan: SlidesPlan) => digest(canonical(asStored(plan)));

/** Whether a render was made from this plan (read back from its post): its key, or the one renders were stored with before. */
export const rendersPlan = (key: string | null | undefined, plan: SlidesPlan) => Boolean(key) && (key === slidesKey(plan) || key === digest(JSON.stringify(plan)));
export const hasTexts = (plan: SlidesPlan) => Boolean(plan.design) || plan.slides.some((s) => s.texts.length > 0 || s.layer || s.elements?.length || s.logo || s.edit);

/** A post's slides plan, one slide per photo in order; null without one. */
export function postSlides(post: { slides: unknown; media_ids: string[] | null }): SlidesPlan | null {
  const plan = slidesPlanSchema.safeParse(post.slides);
  return plan.success ? alignSlides(plan.data, post.media_ids ?? []) : null;
}

/**
 * The rendered image to publish for each photo, by media id, when the render is
 * the current plan's; for a designed carousel, its slides in order (`designed`), published
 * instead of the photos. `state`: "ready" (nothing to render or rendered),
 * "rendering" (wait for it) or "failed".
 */
export function slidesToPublish(post: { slides: unknown; slides_render: unknown; media_ids: string[] | null }): {
  state: "ready" | "rendering" | "failed";
  rendered: Record<string, string>;
  designed?: string[];
} {
  const plan = postSlides(post);
  if (!plan || !hasTexts(plan)) return { state: "ready", rendered: {} };
  const render = (post.slides_render ?? null) as SlidesRender | null;
  if (render && rendersPlan(render.key, plan) && plan.design) return { state: "ready", rendered: {}, designed: render.paths.filter((p): p is string => Boolean(p)) };
  if (render && rendersPlan(render.key, plan)) {
    const rendered: Record<string, string> = {};
    plan.slides.forEach((s, i) => {
      const path = render.paths[i];
      if (path) rendered[s.media_id] = path;
    });
    return { state: "ready", rendered };
  }
  const recent = rendersPlan(render?.pending, plan) && render?.pending_at && Date.now() - new Date(render.pending_at).getTime() < 15 * 60_000;
  return { state: recent ? "rendering" : "failed", rendered: {} };
}

/** Layer and component code this post may use: what is already on it, and the studio's and Fauve's library. */
export async function knownLayerCode(studioId: string, postId: string): Promise<Set<string>> {
  const db = supabaseAdmin();
  const [post, library] = await Promise.all([
    db.from("posts").select("slides").eq("id", postId).eq("studio_id", studioId).maybeSingle(),
    db.from("motion_templates").select("js").in("kind", ["layer", "element"]).or(`studio_id.eq.${studioId},studio_id.is.null`).is("archived_at", null),
  ]);
  const current = slidesPlanSchema.safeParse(post.data?.slides);
  return new Set([
    ...(current.success ? current.data.slides.flatMap((s) => [...(s.layer ? [s.layer.js] : []), ...(s.elements ?? []).map((e) => e.js)]) : []),
    ...(library.data ?? []).map((t) => t.js as string),
  ]);
}

/**
 * Saves a slides plan for the post (aligned with its photos) and marks it to render. Its designed
 * carousel stays the one kept on the post (its code never comes from a caller's plan) unless
 * `design` sets a new one (the carousel designer) or null removes it.
 */
export async function saveSlides(studioId: string, postId: string, input: unknown, options: { design?: CarouselDesign | null } = {}): Promise<SlidesPlan> {
  const db = supabaseAdmin();
  const { data: post, error } = await db.from("posts").select("media_ids, slides, slides_render").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  const kept = slidesPlanSchema.safeParse(post.slides).data?.design;
  const design = options.design === undefined ? kept : (options.design ?? undefined);
  const given = slidesPlanSchema.parse(input);
  const plan = alignSlides({ template: given.template, slides: given.slides, ...(design ? { design } : {}) }, (post.media_ids as string[] | null) ?? []);
  if (!plan.slides.length && !plan.design) throw new Error("Cette publication n'a pas encore de photos");
  const render = (post.slides_render ?? { key: null, paths: [] }) as SlidesRender;
  const { error: saveError } = await db
    .from("posts")
    .update({ slides: plan, slides_render: { ...render, pending: slidesKey(plan), pending_at: new Date().toISOString(), error: null } })
    .eq("id", postId)
    .eq("studio_id", studioId);
  if (saveError) throw new Error(saveError.message);
  return plan;
}

type SlideJob = { id: string; frame: number; props: ReturnType<typeof buildSlideProps> };

/** Every photo of the post through the render, texts or not: the slides share one 4:5 frame. */
async function photoJobs(studioId: string, plan: SlidesPlan, brand: ReelInputs["brand"]): Promise<SlideJob[]> {
  const db = supabaseAdmin();
  const ids = plan.slides.map((s) => s.media_id);
  const { data: assets } = await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", ids);
  const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
  const jobs: SlideJob[] = [];
  for (const [i, slide] of plan.slides.entries()) {
    const asset = byId.get(slide.media_id);
    if (!asset || asset.kind === "video" || String(asset.mime_type ?? "").startsWith("video/")) continue;
    const jpeg = await jpegPath(studioId, asset.storage_path as string, (asset.mime_type as string | null) ?? null);
    const signed = await db.storage.from("media").createSignedUrl(jpeg, 3600);
    if (!signed.data) throw new Error(`Photo ${slide.media_id} introuvable`);
    jobs.push({ id: `s${i}`, frame: SLIDE_FRAME, props: buildSlideProps(slide, { template: plan.template, imageUrl: signed.data.signedUrl, brand }) });
  }
  return jobs;
}

/** The slides of a designed carousel, each a still of its code, with her photos in its order (and the zones she asked to blur). */
async function designJobs(studioId: string, plan: SlidesPlan, design: CarouselDesign, brand: ReelInputs["brand"]): Promise<SlideJob[]> {
  const blur = Object.fromEntries(plan.slides.flatMap((s) => (s.edit?.blur?.length ? [[s.media_id, s.edit.blur]] : [])));
  const photos = (await carouselPhotos(studioId, design.photos, blur)).map((p) => p.photo);
  return Array.from({ length: design.count }, (_, i) => ({ id: `s${i}`, frame: SLIDE_FRAME, props: buildCarouselProps(design, i, { template: plan.template, brand, photos }) }));
}

/** Renders the post's slides (photos with their texts) and stores the images. */
export async function renderSlides(studioId: string, postId: string): Promise<SlidesRender> {
  const db = supabaseAdmin();
  const { data: post, error } = await db
    .from("posts")
    .select("status, media_ids, slides, slides_render")
    .eq("id", postId)
    .eq("studio_id", studioId)
    .single();
  if (error) throw new Error(error.message);
  const plan = postSlides(post);
  if (!plan) return { key: null, paths: [] };
  const key = slidesKey(plan);
  const previous = (post.slides_render ?? null) as SlidesRender | null;
  if (previous && rendersPlan(previous.key, plan)) return previous;

  const started = Date.now();
  try {
    let paths: (string | null)[] = plan.slides.map(() => null);
    if (hasTexts(plan)) {
      const inputs = await loadMontageInputs(studioId, { segments: [] });
      const brand = { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, logoOnDark: inputs.logoOnDark, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts, signature: inputs.signature };
      const jobs = plan.design ? await designJobs(studioId, plan, plan.design, brand) : await photoJobs(studioId, plan, brand);
      const images = await renderStillsInSandbox(`slides-${randomUUID()}`, jobs);
      // A designed carousel publishes its slides; else one image per photo.
      const count = plan.design ? plan.design.count : plan.slides.length;
      paths = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const image = images[`s${i}`];
          if (!image) return null;
          if (image instanceof Error) throw image;
          const path = `${studioId}/slides/${postId}/${key}-${i}.jpg`;
          const upload = await db.storage.from("media").upload(path, image, { contentType: "image/jpeg", upsert: true });
          if (upload.error) throw new Error(upload.error.message);
          return path;
        }),
      );
      const seconds = Math.round((Date.now() - started) / 1000);
      await db.from("cost_events").insert({
        studio_id: studioId,
        kind: "render",
        provider: "vercel_sandbox",
        units: seconds,
        cost_eur: sandboxCostEur(seconds),
        meta: { post_id: postId, engine: "remotion_still", slides: jobs.length, ...(plan.design ? { design: plan.design.name } : {}) },
      });
    }
    const render: SlidesRender = { key, paths, pending: null, pending_at: null, error: null };
    let status = postStatusSchema.parse(post.status);
    for (const next of towardsDraft(status)) status = next;
    const { error: saveError } = await db.from("posts").update({ slides_render: render, status }).eq("id", postId).eq("studio_id", studioId);
    if (saveError) throw new Error(saveError.message);
    return render;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("posts")
      .update({ slides_render: { ...(previous ?? { key: null, paths: [] }), pending: null, pending_at: null, error: message.slice(0, 500) } })
      .eq("id", postId);
    throw error;
  }
}
