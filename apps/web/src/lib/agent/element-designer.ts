import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  brandProfileSchema,
  buildSlideProps,
  checkElementCode,
  clampBox,
  CLAUDE_MODEL,
  ELEMENT_EDIT_PROMPT,
  elementTexts,
  ELEMENTS_DESIGNER_PROMPT,
  kitDesignOutputSchema,
  LAYER_CRITIC_PROMPT,
  layerReviewSchema,
  layerSlotSchema,
  resolveReelBrand,
  SLIDE_FRAME,
  slidesPlanSchema,
  type KitDesignOutput,
  type SlideElement,
} from "@fauve/agent";
import { transform } from "sucrase";
import { z } from "zod";
import { loadElement } from "@/lib/elements";
import { loadMontageInputs } from "@/lib/render/render-post";
import { renderStillsInSandbox } from "@/lib/render/sandbox";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

// The component designer: from an inspiration, Opus takes out the pieces that
// can live on their own (a title, a tag, a checklist…), codes each one as a
// component and places them on the photos; or it changes one component of the
// bank. One round per call (the job route chains them): design or fix, static
// checks, a test render of the photos in the sandbox, then a critic.

export const MAX_ROUNDS = 3;

function transpile(code: string): string {
  return transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
}

async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUrl(path, 3600);
  if (error || !data) throw new Error(`media: ${error?.message ?? "introuvable"}`);
  return data.signedUrl;
}

export type ElementsRequest = {
  studioId: string;
  /** Create a kit from an inspiration, or change one component. */
  mode: "create" | "edit";
  /** For « edit »: the component to change. */
  elementId?: string;
  /** Put them on this post's photos (else they are shown on a photo of the studio, or a neutral one). */
  postId?: string;
  /** What to do, in Fauve's or the manager's words. */
  request: string;
  /** The inspiration: an image the manager sent (media_assets), or one kept in Storage. */
  exampleMediaId?: string;
  examplePath?: string;
  /** Photos to cover (1-based); default all. */
  photos?: number[];
};

export type KitDraft = KitDesignOutput;

export type ElementsRound =
  | { status: "done"; draft: KitDraft; js: Record<string, string>; review: string | null }
  | { status: "retry"; draft: KitDraft | null; feedback: string }
  | { status: "failed"; error: string };

/** A neutral photo when there is none to show the components on. */
const BACKDROP =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#b9aea4'/><stop offset='1' stop-color='#5d544e'/></linearGradient></defs><rect width='1080' height='1350' fill='url(#g)'/></svg>",
  );

type Photo = { index: number; mediaId: string; url: string; real: boolean };

async function postPhotos(studioId: string, postId: string, only?: number[]): Promise<{ photos: Photo[]; template: string | null }> {
  const db = supabaseAdmin();
  const { data: post, error } = await db.from("posts").select("media_ids, slides").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  const mediaIds = ((post.media_ids as string[] | null) ?? []).slice(0, 10);
  const { data: assets } = await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", mediaIds.length ? mediaIds : ["00000000-0000-0000-0000-000000000000"]);
  const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
  const photos: Photo[] = [];
  for (const [i, id] of mediaIds.entries()) {
    const asset = byId.get(id);
    if (!asset || asset.kind === "video" || String(asset.mime_type ?? "").startsWith("video/")) continue;
    if (only?.length && !only.includes(i + 1)) continue;
    photos.push({ index: i + 1, mediaId: id, url: await signedUrl(await jpegPath(studioId, asset.storage_path as string, (asset.mime_type as string | null) ?? null)), real: true });
  }
  if (!photos.length) throw new Error("Cette publication n'a pas de photo à couvrir");
  const slides = slidesPlanSchema.safeParse(post.slides);
  return { photos, template: slides.success ? slides.data.template : null };
}

/** The studio's latest photo, to show a component on something real. */
async function studioPhoto(studioId: string): Promise<Photo> {
  const { data } = await supabaseAdmin()
    .from("media_assets")
    .select("id, storage_path, mime_type")
    .eq("studio_id", studioId)
    .eq("kind", "image")
    .order("created_at", { ascending: false })
    .limit(1);
  const asset = data?.[0];
  if (asset) {
    try {
      return { index: 1, mediaId: asset.id as string, url: await signedUrl(await jpegPath(studioId, asset.storage_path as string, (asset.mime_type as string | null) ?? null)), real: true };
    } catch {
      // A neutral backdrop instead.
    }
  }
  return { index: 1, mediaId: "00000000-0000-4000-8000-000000000000", url: BACKDROP, real: false };
}

async function loadContext(input: ElementsRequest) {
  const db = supabaseAdmin();
  const target = input.postId ? await postPhotos(input.studioId, input.postId, input.photos) : { photos: [await studioPhoto(input.studioId)], template: null };

  let exampleUrl: string | null = null;
  if (input.exampleMediaId) {
    const { data: example } = await db.from("media_assets").select("storage_path, kind").eq("id", input.exampleMediaId).eq("studio_id", input.studioId).maybeSingle();
    if (!example || example.kind !== "image") throw new Error("L'exemple doit être une image");
    exampleUrl = await signedUrl(example.storage_path as string);
  } else if (input.examplePath?.startsWith(`${input.studioId}/`)) {
    exampleUrl = await signedUrl(input.examplePath);
  }

  const element = input.mode === "edit" && input.elementId ? await loadElement(input.studioId, input.elementId) : null;
  if (input.mode === "edit" && !element) throw new Error("Composant introuvable");

  const inputs = await loadMontageInputs(input.studioId, { segments: [] });
  const brandIn = { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, customFonts: inputs.customFonts };
  const { data: profileRow } = await db.from("brand_profiles").select("profile").eq("studio_id", input.studioId).order("version", { ascending: false }).limit(1);
  const profile = brandProfileSchema.partial().catch({}).parse(profileRow?.[0]?.profile ?? {});
  const template = (target.template ?? profile.default_template ?? "doux") as "doux";
  const brand = resolveReelBrand({}, template, brandIn);
  return { photos: target.photos, exampleUrl, element, brandIn, brand, template, artDirection: profile.art_direction ?? profile.moodboard?.reading };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

const imageBlock = (url: string) =>
  url.startsWith("data:") ? [] : [{ type: "image" as const, source: { type: "url" as const, url } }];

async function design(input: ElementsRequest, ctx: Context, fix?: { draft: KitDraft; feedback: string }): Promise<KitDraft> {
  const brief = {
    demande: input.request,
    photos_a_couvrir: ctx.photos.map((p) => p.index),
    format: "1080 × 1350 (4:5)",
    marque: { name: ctx.brand.name, accent: ctx.brand.accent, accentInk: ctx.brand.accentInk, displayFont: ctx.brand.displayFont, bodyFont: ctx.brand.bodyFont, logo: Boolean(ctx.brand.logoUrl) },
    direction_artistique: ctx.artDirection,
    ...(ctx.brand.customFonts?.length ? { polices_du_studio: ctx.brand.customFonts.map((f) => f.family) } : {}),
    ...(ctx.element
      ? {
          composant: {
            name: ctx.element.name,
            role: ctx.element.role,
            base_width: ctx.element.base,
            slots: ctx.element.slots,
            textes_exemple: ctx.element.sample,
            pose_actuelle: ctx.element.box,
            code: ctx.element.code,
          },
        }
      : {}),
    ...(ctx.photos[0] && !ctx.photos[0].real ? { photo: "pas de photo : fond neutre (dégradé taupe)" } : {}),
  };
  const content = [
    ...(ctx.exampleUrl ? [{ type: "text" as const, text: input.mode === "edit" ? "Image d'exemple jointe à la demande :" : "Exemple à décomposer et reproduire :" }, ...imageBlock(ctx.exampleUrl)] : []),
    ...ctx.photos.slice(0, 3).flatMap((p) => (p.real ? [{ type: "text" as const, text: `Photo ${p.index} :` }, ...imageBlock(p.url)] : [])),
    {
      type: "text" as const,
      text: fix
        ? `${JSON.stringify(brief)}\n\nTa version précédente doit être corrigée : ${fix.feedback}\nGarde ce qui va, corrige le reste, et réponds avec la version complète.\n\nVersion précédente :\n${JSON.stringify(fix.draft)}`
        : JSON.stringify(brief),
    },
  ];
  const response = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 32000,
    output_config: { effort: "high", format: betaZodOutputFormat(kitDesignOutputSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: input.mode === "edit" ? ELEMENT_EDIT_PROMPT : ELEMENTS_DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  await logClaudeCost(input.studioId, response.usage, "element_designer");
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Les composants n'ont pas pu être dessinés (${response.stop_reason})`);
  const draft = response.parsed_output;
  // An edit stays one component.
  return input.mode === "edit" ? { ...draft, elements: draft.elements.slice(0, 1) } : draft;
}

async function review(input: ElementsRequest, ctx: Context, stills: { index: number; jpeg: Buffer }[]): Promise<z.infer<typeof layerReviewSchema>> {
  const content = [
    ...(ctx.exampleUrl ? [{ type: "text" as const, text: "Exemple que la gérante voulait reproduire :" }, ...imageBlock(ctx.exampleUrl)] : []),
    ...stills.slice(0, 3).flatMap((s) => [
      { type: "text" as const, text: `Rendu de la photo ${s.index} :` },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: s.jpeg.toString("base64") } },
    ]),
    {
      type: "text" as const,
      text: `${input.mode === "edit" ? `Changement demandé sur le composant « ${ctx.element?.name ?? ""} » : vérifie surtout qu'il est fait, et que le reste n'a pas bougé.` : "Les textes sont des composants séparés posés sur la photo."}\nDemande : ${input.request}`,
    },
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
  await logClaudeCost(input.studioId, response.usage, "element_critic");
  return response.parsed_output ?? { ok: true, issues: [] };
}

/** The components placed on one photo, as stored on a slide (element_id once they are in the bank). */
export function placedOn(draft: KitDraft, js: Record<string, string>, photo: number, ids: Record<string, string> = {}): SlideElement[] {
  const entry = draft.slides.find((s) => s.photo === photo);
  if (!entry) return [];
  return entry.placements.flatMap((p) => {
    const element = draft.elements.find((e) => e.ref === p.ref);
    const code = js[p.ref];
    if (!element || !code) return [];
    const slots = z.array(layerSlotSchema).catch([]).parse(element.slots);
    return [
      {
        ...(ids[p.ref] ? { element_id: ids[p.ref] } : {}),
        name: element.name.slice(0, 80),
        role: element.role,
        js: code,
        slots,
        texts: elementTexts(p.texts, slots),
        fonts: element.fonts.slice(0, 3),
        base: element.base_width,
        box: clampBox(p),
      },
    ];
  });
}

/** One round: design (or fix), check, render the covered photos, have them reviewed. */
export async function elementsRound(
  input: ElementsRequest,
  round: number,
  previous?: { draft: KitDraft; feedback: string },
  onStage?: (stage: "review") => Promise<void>,
): Promise<ElementsRound> {
  const ctx = await loadContext(input);
  let draft: KitDraft;
  try {
    draft = await design(input, ctx, previous);
  } catch (error) {
    return round + 1 < MAX_ROUNDS && previous
      ? { status: "retry", draft: previous.draft, feedback: previous.feedback }
      : { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
  const next = (feedback: string): ElementsRound => (round + 1 < MAX_ROUNDS ? { status: "retry", draft, feedback } : { status: "failed", error: feedback });

  const refs = new Set(draft.elements.map((e) => e.ref));
  if (refs.size !== draft.elements.length) return next("chaque composant doit avoir son propre ref (e1, e2…)");
  const js: Record<string, string> = {};
  for (const element of draft.elements) {
    const problems = checkElementCode(element.code);
    if (problems.length) return next(`code de ${element.ref} refusé : ${problems.join(", ")}`);
    try {
      js[element.ref] = transpile(element.code);
    } catch (error) {
      return next(`syntaxe de ${element.ref} : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // The words must be the business's, not the slots' descriptions.
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const labels = draft.slides.flatMap((slide) =>
    slide.placements.flatMap((p) => {
      const element = draft.elements.find((e) => e.ref === p.ref);
      return p.texts.filter((t) => {
        const slot = element?.slots.find((s) => s.name === t.slot);
        return slot && norm(t.text) && (norm(t.text) === norm(slot.role) || norm(t.text) === norm(slot.name));
      });
    }),
  );
  if (labels.length) return next(`textes à remplacer par de vrais mots (ce sont les descriptions des slots) : ${labels.map((t) => `${t.slot} = « ${t.text} »`).join(", ")}`);

  // Test render of every covered photo, in check mode (errors and texts out of the frame fail it).
  const jobs = ctx.photos.flatMap((p) => {
    const placed = placedOn(draft, js, p.index);
    if (!placed.length) return [];
    const props = buildSlideProps({ media_id: p.mediaId, texts: [], elements: placed }, { template: ctx.template, imageUrl: p.url, brand: ctx.brandIn });
    const refsOnPhoto = draft.slides.find((s) => s.photo === p.index)?.placements.map((pl) => pl.ref) ?? [];
    return [{ id: `p${p.index}`, frame: SLIDE_FRAME, props: { ...props, elements: props.elements?.map((e, i) => ({ ...e, label: refsOnPhoto[i] })), elementsCheck: true } }];
  });
  if (!jobs.length) return next("slides ne pose aucun composant sur les photos demandées : pose-les sur chaque photo à couvrir");
  const images = await renderStillsInSandbox(`kit-${(input.postId ?? input.elementId ?? input.studioId).slice(0, 8)}-${Date.now()}`, jobs);
  const errors = Object.entries(images).flatMap(([id, image]) => (image instanceof Error ? [`photo ${id.slice(1)} : ${image.message.slice(0, 400)}`] : []));
  if (errors.length) return next(`le rendu test a échoué : ${errors.slice(0, 3).join(" | ")}`);

  const stills = Object.entries(images).flatMap(([id, image]) => (image instanceof Buffer ? [{ index: Number(id.slice(1)), jpeg: image }] : []));
  await onStage?.("review");
  const verdict = await review(input, ctx, stills);
  if (!verdict.ok && verdict.issues.length && round + 1 < MAX_ROUNDS) return { status: "retry", draft, feedback: `relecture du rendu : ${verdict.issues.join(" ; ")}` };
  return { status: "done", draft, js, review: verdict.ok ? null : verdict.issues.join(" ; ") };
}
