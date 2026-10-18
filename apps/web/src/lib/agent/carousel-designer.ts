import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  buildCarouselProps,
  CAROUSEL_CRITIC_PROMPT,
  CAROUSEL_DESIGNER_PROMPT,
  carouselFromOutput,
  carouselOutputSchema,
  checkCarouselCode,
  CLAUDE_MODEL,
  CRITIC_MODEL,
  layerReviewSchema,
  readMemory,
  resolveReelBrand,
  signatureLines,
  SLIDE_FRAME,
  slidesPlanSchema,
  type CarouselDesign,
  type CarouselOutput,
  type MotionTemplate,
  type PhotoEdit,
} from "@fauve/agent";
import sharp from "sharp";
import { transform } from "sucrase";
import { carouselPhotos, type CarouselSource } from "@/lib/render/carousel";
import { ensureCutouts } from "@/lib/render/cutout";
import { loadMontageInputs } from "@/lib/render/render-post";
import { renderStillsInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

// The carousel designer: from her photos, her charter and her words, Opus composes the
// whole carousel as one component (Carousel), like a graphic designer lays out a
// series. One round per call (the job route chains them): design, static checks, a
// test render of every slide in the sandbox (texts cut or too small, fonts or photos
// missing fail it), then a critic looks at the slides; one correction, which sees its
// own render. The test render is the delivered one: nothing is rendered twice.

/** Designer calls at most: a code its test render refuses takes one too. */
export const CAROUSEL_ROUNDS = 3;
/** The photos the designer sees, shrunk (it reads a layout, not pixels): about a thousand tokens each. */
const SEEN_EDGE = 900;

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

export type CarouselRequest = {
  studioId: string;
  postId: string;
  /** What she asked, in her words (or Simone's brief). */
  request: string;
  /** Her photos for it, in her order (default: the post's photos). */
  mediaIds?: string[];
  /** Composed anew, not a correction of the carousel the post already has. */
  fresh?: boolean;
  /** Images of carousels she likes (her media): their form is followed, never their words or pictures. */
  examples?: string[];
};

/** What a round hands to the next: the answer to correct, why, and the slides it rendered (Storage paths). */
export type CarouselPrevious = { output: CarouselOutput; feedback: string; stills?: string[] };

export type CarouselRound =
  | { status: "done"; design: CarouselDesign; stills: string[]; review: string | null }
  | { status: "retry"; previous: CarouselPrevious; design?: CarouselDesign; stills?: string[] }
  | { status: "failed"; error: string };

type Context = Awaited<ReturnType<typeof loadContext>>;

async function loadContext(input: CarouselRequest, options: { cutouts: boolean }) {
  const db = supabaseAdmin();
  const [post, studio, profileRow] = await Promise.all([
    db.from("posts").select("id, title, kind, media_ids, slides").eq("id", input.postId).eq("studio_id", input.studioId).single(),
    db.from("studios").select("name, business_type, booking_url, website_url, memory").eq("id", input.studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", input.studioId).order("version", { ascending: false }).limit(1),
  ]);
  if (post.error) throw new Error("Publication introuvable");
  const plan = slidesPlanSchema.safeParse(post.data.slides);
  const ids = (input.mediaIds?.length ? input.mediaIds : ((post.data.media_ids as string[] | null) ?? [])).slice(0, 10);
  const { data: kinds } = await db.from("media_assets").select("id, kind").eq("studio_id", input.studioId).in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const photoIds = ids.filter((id) => kinds?.some((k) => k.id === id && k.kind === "image"));
  // Her subjects cut out once (their own sandbox), before the designer decides what to do with them.
  if (options.cutouts && photoIds.length) await ensureCutouts(input.studioId, photoIds);
  // The zones she asked to blur on a photo (its slide's retouch) stay blurred in the design.
  const blur: Record<string, PhotoEdit["blur"]> = Object.fromEntries(plan.success ? plan.data.slides.flatMap((s) => (s.edit?.blur?.length ? [[s.media_id, s.edit.blur]] : [])) : []);
  const [photos, inputs] = await Promise.all([carouselPhotos(input.studioId, photoIds, blur), loadMontageInputs(input.studioId, { segments: [] })]);
  const profile = brandProfileSchema.partial().catch({}).parse(profileRow.data?.[0]?.profile ?? {});
  const template: MotionTemplate = plan.success ? plan.data.template : "libre";
  const brandIn = { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, logoOnDark: inputs.logoOnDark, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts, signature: inputs.signature };
  const brand = resolveReelBrand({}, template, brandIn);
  return {
    post: post.data,
    plan: plan.success ? plan.data : null,
    photos: photos.filter((p) => p.found),
    template,
    brandIn,
    brand,
    studio: {
      nom: studio.data?.name ?? brand.name,
      activite: studio.data?.business_type ?? undefined,
      ce_qu_on_sait: readMemory(studio.data?.memory).map((f) => f.fact),
      site: studio.data?.website_url ?? undefined,
      reservation: studio.data?.booking_url ?? undefined,
      ton: profile.tone,
    },
    charter: {
      polices: { titres: brand.displayFont, texte: brand.bodyFont, ...(brand.customFonts?.length ? { ses_fichiers: brand.customFonts.map((f) => f.family) } : {}) },
      couleurs: { accent: brand.accent, encre_sur_accent: brand.accentInk, ...(brand.palette ?? {}) },
      logo: brand.logoUrl ? (brand.logoOnDark && brand.logoOnDark !== "as_is" ? `oui (sur fond sombre : ${brand.logoOnDark})` : "oui") : "non",
      signature: signatureLines(brandIn.signature),
      direction_artistique: profile.art_direction,
      moodboard: profile.moodboard?.reading,
    },
  };
}

/** A photo or a slide as the model sees it: shrunk to a JPEG, base64. */
async function seen(source: Buffer | string): Promise<{ type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } } | null> {
  try {
    const buffer = typeof source === "string" ? Buffer.from(await (await fetch(source)).arrayBuffer()) : source;
    const jpeg = await sharp(buffer).rotate().resize({ width: SEEN_EDGE, height: SEEN_EDGE, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
    return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } };
  } catch {
    return null;
  }
}

const shape = (aspect: number) => (aspect > 1.1 ? "paysage" : aspect < 0.9 ? "portrait" : "carré");

/** Her photos as the designer is told about them (their images follow, in the same order). */
const photoLines = (photos: CarouselSource[]) =>
  photos.map((p) => ({
    id: p.id,
    montre: p.shows || undefined,
    format: `${shape(p.photo.aspect)} (${p.photo.aspect.toFixed(2)})`,
    visages: p.faces || undefined,
    detouree: Boolean(p.photo.cutout),
    ...(p.photo.cutout && p.photo.subject ? { sujet: p.photo.subject, ...(p.photo.cutEdges?.length ? { sujet_coupe_par: p.photo.cutEdges } : {}) } : {}),
  }));

/** Her examples (images of her library), signed for the designer. */
async function exampleUrls(input: CarouselRequest): Promise<string[]> {
  if (!input.examples?.length) return [];
  const db = supabaseAdmin();
  const { data } = await db.from("media_assets").select("storage_path, kind").eq("studio_id", input.studioId).in("id", input.examples);
  const paths = (data ?? []).filter((a) => a.kind === "image").map((a) => a.storage_path as string);
  return paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 3600)).data ?? []).flatMap((d) => (d.signedUrl ? [d.signedUrl] : [])) : [];
}

async function signedStills(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await supabaseAdmin().storage.from("media").createSignedUrls(paths, 3600);
  return (data ?? []).flatMap((d) => (d.signedUrl ? [d.signedUrl] : []));
}

async function design(input: CarouselRequest, ctx: Context, previous?: CarouselPrevious): Promise<CarouselOutput> {
  // The carousel she has, to correct (unless she asked for a new one).
  const current = input.fresh ? undefined : ctx.plan?.design;
  const brief = {
    demande: input.request,
    publication: { titre: ctx.post.title, format: ctx.post.kind === "post" ? "une seule image (count = 1)" : "carrousel" },
    commerce: ctx.studio,
    charte: ctx.charter,
    photos: photoLines(ctx.photos),
    // A correction she asked for on the carousel she has: its code and words are the starting point.
    ...(current?.code && !previous ? { carrousel_actuel: { name: current.name, count: current.count, outline: current.outline, photos: current.photos, slots: current.slots, texts: current.texts, fonts: current.fonts, code: current.code } } : {}),
  };
  const photoBlocks = (await Promise.all(ctx.photos.map(async (p) => ({ p, image: await seen(p.photo.src) })))).flatMap(({ p, image }) =>
    image ? [{ type: "text" as const, text: `Photo ${p.id} :` }, image] : [],
  );
  // A carousel she likes (a capture): its form, its typography, its rhythm; never its words, its pictures or its brand.
  const exampleBlocks = (await Promise.all((await exampleUrls(input)).map((url) => seen(url)))).flatMap((image, i) =>
    image ? [{ type: "text" as const, text: `Exemple qu'elle aime ${i + 1} (suis sa forme, sa typographie et son rythme ; jamais ses mots, ses images ni sa marque) :` }, image] : [],
  );
  const stills = previous?.stills?.length ? await signedStills(previous.stills) : [];
  const renderBlocks = (await Promise.all(stills.map((url) => seen(url)))).flatMap((image, i) => (image ? [{ type: "text" as const, text: `Ton rendu, diapositive ${i + 1} :` }, image] : []));
  const content = [
    ...exampleBlocks,
    ...photoBlocks,
    ...renderBlocks,
    {
      type: "text" as const,
      text: previous
        ? `${JSON.stringify(brief)}\n\nTa version précédente doit être corrigée : ${previous.feedback}\n${renderBlocks.length ? "Tu vois son rendu ci-dessus. " : ""}Garde ce qui va, corrige le reste, et réponds avec la version complète.\n\nVersion précédente :\n${JSON.stringify(previous.output)}`
        : current?.code
          ? `${JSON.stringify(brief)}\n\nC'est une correction de « carrousel_actuel » : fais exactement ce que dit la demande, garde tout le reste (mêmes slots, mêmes mots ailleurs), et réponds avec la version complète.`
          : JSON.stringify(brief),
    },
  ];
  // Streamed: a whole carousel is long to write, and the SDK refuses a request this size without a stream.
  const response = await anthropic()
    .beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 48000,
      output_config: { effort: "high", format: betaZodOutputFormat(carouselOutputSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: CAROUSEL_DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    })
    .finalMessage();
  await logClaudeCost(input.studioId, response.usage, "carousel_designer");
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Le carrousel n'a pas pu être composé (${response.stop_reason})`);
  return response.parsed_output;
}

async function review(input: CarouselRequest, ctx: Context, made: CarouselDesign, stills: Buffer[]) {
  const slides = (await Promise.all(stills.map((jpeg) => seen(jpeg)))).flatMap((image, i) => (image ? [{ type: "text" as const, text: `Diapositive ${i + 1} :` }, image] : []));
  const content = [
    ...slides,
    {
      type: "text" as const,
      text: [
        `Demande : ${input.request}`,
        `Commerce : ${ctx.studio.nom}${ctx.studio.activite ? ` (${ctx.studio.activite})` : ""}`,
        made.outline.length ? `Ce que dit chaque diapositive : ${made.outline.map((line, i) => `${i + 1}. ${line}`).join(" ; ")}` : "",
        `Sa charte : polices ${ctx.charter.polices.titres} et ${ctx.charter.polices.texte}, couleur ${ctx.charter.couleurs.accent}`,
        ctx.charter.signature ? `Sa direction en réglages :\n${ctx.charter.signature}` : "",
        ctx.charter.direction_artistique ? `Sa direction artistique : ${ctx.charter.direction_artistique}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const response = await anthropic().beta.messages.parse({
    model: CRITIC_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: betaZodOutputFormat(layerReviewSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: CAROUSEL_CRITIC_PROMPT,
    messages: [{ role: "user", content }],
  });
  await logClaudeCost(input.studioId, response.usage, "carousel_critic", CRITIC_MODEL);
  return response.parsed_output ?? { ok: true, issues: [] };
}

/** Keeps a test render's slides (the next round looks at them; the delivered carousel is this render). */
async function keepStills(studioId: string, postId: string, round: number, stills: Buffer[]): Promise<string[]> {
  const db = supabaseAdmin();
  const stamp = Date.now();
  return Promise.all(
    stills.map(async (jpeg, i) => {
      const path = `${studioId}/slides/${postId}/try-${stamp}-${round}-${i}.jpg`;
      const upload = await db.storage.from("media").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
      if (upload.error) throw new Error(upload.error.message);
      return path;
    }),
  );
}

/**
 * One round: design (or correct), check, render every slide in check mode, keep the
 * slides, and on the first passing version have them looked at (one correction at most).
 * `fixed`: this round is the correction the critic asked for (it is then delivered as it is).
 */
export async function carouselRound(
  input: CarouselRequest,
  round: number,
  previous?: CarouselPrevious & { fixed?: boolean },
  onStage?: (stage: "design" | "review") => Promise<void>,
): Promise<CarouselRound> {
  const ctx = await loadContext(input, { cutouts: round === 0 });
  // Its subjects cut out (a few minutes on a cold sandbox): the job is still alive.
  await onStage?.("design");
  let output: CarouselOutput;
  try {
    output = await design(input, ctx, previous);
  } catch (error) {
    return round + 1 < CAROUSEL_ROUNDS && previous
      ? { status: "retry", previous }
      : { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
  const next = (feedback: string): CarouselRound => (round + 1 < CAROUSEL_ROUNDS ? { status: "retry", previous: { output, feedback } } : { status: "failed", error: feedback });

  const problems = checkCarouselCode(output.code);
  if (problems.length) return next(`code refusé : ${problems.join(", ")}`);
  let js: string;
  try {
    js = transpile(output.code);
  } catch (error) {
    return next(`syntaxe : ${error instanceof Error ? error.message : String(error)}`);
  }
  const built = carouselFromOutput(output, js, ctx.photos.map((p) => p.id));
  if (built.problems.length) return next(built.problems.join(" ; "));
  // Its source is kept with it: a later correction starts from what was written, not from the compiled code.
  const made: CarouselDesign = { ...built.design, code: output.code };
  const photos = made.photos.map((id) => ctx.photos.find((p) => p.id === id)!.photo);

  // Test render of every slide, in check mode (errors, texts cut or too small, missing fonts or photos fail it).
  const jobs = Array.from({ length: made.count }, (_, i) => ({ id: `s${i}`, frame: SLIDE_FRAME, props: buildCarouselProps(made, i, { template: ctx.template, brand: ctx.brandIn, photos, check: true }) }));
  const images = await renderStillsInSandbox(`carousel-${input.postId.slice(0, 8)}-${Date.now()}`, jobs);
  const errors = jobs.flatMap((j, i) => {
    const image = images[j.id];
    return image instanceof Error ? [`diapositive ${i + 1} : ${image.message.slice(0, 500)}`] : image ? [] : [`diapositive ${i + 1} : pas d'image`];
  });
  if (errors.length) return next(`le rendu d'essai a refusé : ${errors.slice(0, 4).join(" | ")}`);
  const stills = jobs.map((j) => images[j.id] as Buffer);
  const kept = await keepStills(input.studioId, input.postId, round, stills);

  // The correction the critic asked for is delivered as it is (a second look would cost a third round).
  if (previous?.fixed) return { status: "done", design: made, stills: kept, review: null };
  await onStage?.("review");
  const verdict = await review(input, ctx, made, stills);
  if (!verdict.ok && verdict.issues.length && round + 1 < CAROUSEL_ROUNDS) {
    return { status: "retry", previous: { output, feedback: `relecture du rendu : ${verdict.issues.join(" ; ")}`, stills: kept }, design: made, stills: kept };
  }
  return { status: "done", design: made, stills: kept, review: verdict.ok ? null : verdict.issues.join(" ; ") };
}
