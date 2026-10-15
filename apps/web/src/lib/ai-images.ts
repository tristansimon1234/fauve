import "server-only";
import { assertCanCreate } from "@/lib/billing/access";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import {
  AI_IMAGE_SIZES,
  alignSlides,
  ambiancePrompt,
  CREDIT_PRICES,
  improvePrompt,
  MAX_AMBIANCE_IMAGES,
  slidesPlanSchema,
  usdToEur,
  type AiImage,
  type AiImageFormat,
} from "@fauve/agent";
import sharp from "sharp";
import { availableCredits, chargeCredits } from "@/lib/credits";
import { env } from "@/lib/env";
import { hasTexts, saveSlides } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Images from the image model (Google's, behind this one module so another can
// be tried): a real photo improved (extended to its frame, tidier background,
// better light, an object removed) or an ambiance image to carry a text when she
// has no photo. Each one is a new photo of her library (the original is kept),
// 1 credit, charged once it is made.

const READ_EDGE = 2048;

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

/** The model gave no image (refused or failed): the message is for the manager. */
export class AiImageError extends Error {}

export type MadeImage = { mediaId: string; path: string };

/** Credits she can spend on n images, or the error to give her. */
export async function canAffordImages(studioId: string, count: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const needed = count * CREDIT_PRICES.image;
  const available = await availableCredits(studioId);
  if (available >= needed) return { ok: true };
  return { ok: false, error: `Il faut ${needed} crédit${needed > 1 ? "s" : ""} et il en reste ${available}.` };
}

async function studioLook(studioId: string) {
  const db = supabaseAdmin();
  const [studio, brand] = await Promise.all([
    db.from("studios").select("business_type").eq("id", studioId).maybeSingle(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const profile = (brand.data?.profile ?? {}) as { colors?: string[]; visual_notes?: string; art_direction?: string; moodboard?: { palette?: string[]; reading?: string } };
  return {
    business: (studio.data?.business_type as string | null) ?? null,
    colors: profile.colors?.length ? profile.colors : (profile.moodboard?.palette ?? []),
    mood: [profile.art_direction, profile.visual_notes].filter(Boolean).join(" ").slice(0, 300) || null,
  };
}

/** One image from the model, as bytes. */
export async function generate(parts: { text?: string; inlineData?: { mimeType: string; data: string } }[], format: AiImageFormat): Promise<{ bytes: Buffer; model: string }> {
  const model = env("GEMINI_IMAGE_MODEL");
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: format, imageSize: "2K" } },
  });
  const candidate = response.candidates?.[0];
  const image = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    const why = [candidate?.finishReason, response.promptFeedback?.blockReason, response.text].filter(Boolean).join(" · ");
    console.warn("image model gave no image", why);
    throw new AiImageError("Simone n’a pas pu faire cette image (demande refusée ou trop floue). Essaie avec d’autres mots.");
  }
  return { bytes: Buffer.from(image.inlineData.data, "base64"), model };
}

/** Kept as a JPEG at the format's size (Instagram publishes JPEG photos), in her library. */
async function keep(studioId: string, bytes: Buffer, ai: AiImage, consentOk: boolean): Promise<MadeImage> {
  const db = supabaseAdmin();
  const { width, height } = AI_IMAGE_SIZES[ai.format];
  // The model's frame is the format's; cover only trims a stray pixel row (or a frame it ignored).
  const jpeg = await sharp(bytes).rotate().resize(width, height, { fit: "cover", position: "attention" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const path = `${studioId}/ai/${randomUUID()}.jpg`;
  const upload = await db.storage.from("media").upload(path, jpeg, { contentType: "image/jpeg" });
  if (upload.error) throw new Error(`storage: ${upload.error.message}`);
  const { data, error } = await db
    .from("media_assets")
    .insert({
      studio_id: studioId,
      storage_path: path,
      kind: "image",
      source: "ai",
      mime_type: "image/jpeg",
      size_bytes: jpeg.length,
      width,
      height,
      consent_ok: consentOk,
      tags: [ai.mode === "improve" ? "retouchée" : "ambiance"],
      ai,
    })
    .select("id")
    .single();
  if (error) throw new Error(`media_assets: ${error.message}`);
  return { mediaId: data.id as string, path };
}

async function account(studioId: string, made: MadeImage, ai: AiImage, label: string) {
  const usd = env("GEMINI_IMAGE_USD");
  await Promise.all([
    supabaseAdmin()
      .from("cost_events")
      .insert({ studio_id: studioId, kind: "image", provider: "google", units: 1, cost_eur: usdToEur(usd, env("USD_TO_EUR")), meta: { model: ai.model, mode: ai.mode, cost_usd: usd, purpose: "image", media_id: made.mediaId } }),
    chargeCredits(studioId, CREDIT_PRICES.image, "image", label, { media_id: made.mediaId, mode: ai.mode }),
  ]);
}

/** A real photo improved as she asked; the original stays in her library. */
export async function improvePhoto(studioId: string, mediaId: string, instruction: string, format: AiImageFormat): Promise<MadeImage> {
  await assertCanCreate(studioId);
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("kind, storage_path, consent_ok").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!asset || asset.kind !== "image") throw new AiImageError("Ce fichier n’est pas une photo.");
  const download = await db.storage.from("media").download(asset.storage_path as string);
  if (download.error) throw new AiImageError("Cette photo n’est plus disponible.");
  const photo = await sharp(Buffer.from(await download.data.arrayBuffer()))
    .rotate()
    .resize({ width: READ_EDGE, height: READ_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const look = await studioLook(studioId);
  const { bytes, model } = await generate([{ inlineData: { mimeType: "image/jpeg", data: photo.toString("base64") } }, { text: improvePrompt(instruction, format, look.business) }], format);
  const ai: AiImage = { mode: "improve", instruction: instruction.slice(0, 400), from_media_id: mediaId, format, model };
  const made = await keep(studioId, bytes, ai, Boolean(asset.consent_ok));
  await account(studioId, made, ai, "Photo améliorée");
  return made;
}

/** Ambiance images (1 to 4) in the studio's colours, made side by side; those that fail are skipped. */
export async function makeAmbiance(studioId: string, description: string, format: AiImageFormat, count = 1): Promise<MadeImage[]> {
  await assertCanCreate(studioId);
  const look = await studioLook(studioId);
  const n = Math.max(1, Math.min(MAX_AMBIANCE_IMAGES, Math.round(count)));
  // Each image its own call: the model gives one image per answer, and they come out varied.
  const results = await Promise.allSettled(
    Array.from({ length: n }, async (_, i) => {
      const variation = n > 1 ? `\n- Variation ${i + 1} of ${n}: another composition and point of view than the others.` : "";
      const { bytes, model } = await generate([{ text: ambiancePrompt(description, format, look) + variation }], format);
      const ai: AiImage = { mode: "ambiance", instruction: description.slice(0, 400), from_media_id: null, format, model };
      const made = await keep(studioId, bytes, ai, true);
      await account(studioId, made, ai, "Image d’ambiance");
      return made;
    }),
  );
  const made = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!made.length) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
    throw first instanceof Error ? first : new AiImageError("Simone n’a pas pu faire ces images.");
  }
  return made;
}

/**
 * Puts the new photos on a carousel or photo post: an improved photo takes the
 * original's place (its texts stay on it, its old retouch goes), ambiance photos
 * come after the others (10 at most). Returns whether the photos need a render.
 */
export async function placeOnPost(studioId: string, postId: string, made: MadeImage[], replaces?: string): Promise<{ render: boolean }> {
  const db = supabaseAdmin();
  const { data: post, error } = await db.from("posts").select("kind, status, media_ids, slides").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  if (post.status === "published" || post.status === "measured") throw new AiImageError("Cette publication est déjà en ligne.");
  const before = (post.media_ids as string[] | null) ?? [];
  const ids = made.map((m) => m.mediaId);
  const single = post.kind === "post" || post.kind === "story";
  const media_ids =
    replaces && before.includes(replaces)
      ? before.flatMap((id) => (id === replaces ? ids : [id]))
      : single
        ? ids.slice(0, 1) // A photo post or a story has one photo: the new one is it.
        : [...before, ...ids.filter((id) => !before.includes(id))];
  const capped = media_ids.slice(0, single ? 1 : 10);
  const { error: updateError } = await db.from("posts").update({ media_ids: capped }).eq("id", postId).eq("studio_id", studioId);
  if (updateError) throw new Error(updateError.message);
  if (post.kind !== "carousel" && post.kind !== "post") return { render: false };
  const current = slidesPlanSchema.safeParse(post.slides);
  if (!current.success) return { render: false };
  // The texts written on the original follow the improved photo; its retouch was for the old one.
  const slides = current.data.slides.map((s) => (replaces && s.media_id === replaces ? { ...s, media_id: ids[0]!, edit: undefined } : s));
  const plan = alignSlides({ ...current.data, slides }, capped);
  if (!hasTexts(plan)) {
    await db.from("posts").update({ slides: plan }).eq("id", postId).eq("studio_id", studioId);
    return { render: false };
  }
  await saveSlides(studioId, postId, plan);
  return { render: true };
}
