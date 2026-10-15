import "server-only";
import { FileState, GoogleGenAI } from "@google/genai";
import {
  CLIP_DETECT_PROMPT,
  clipDetectionSchema,
  PHOTO_DETECT_PROMPT,
  photoDetectionSchema,
  type ClipDetection,
  type PhotoDetection,
} from "@fauve/agent";
import sharp from "sharp";
import { z } from "zod";
import { env } from "@/lib/env";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { supabaseAdmin } from "@/lib/supabase/admin";

// What Gemini sees in a photo or a clip for retouching and blurring: sensitive
// zones (faces, plates, screens) with their boxes, a suggested light and
// framing retouch for photos, and the source size. Read once per file and kept
// on media_assets.regions; the render applies it deterministically.

const PROCESSING_TIMEOUT_MS = 120_000;
const DETECT_EDGE = 1536;

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

/** Gemini accepts a subset of JSON Schema. */
function geminiSchema(schema: z.ZodType): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$schema" && key !== "additionalProperties")
        .map(([key, v]) => [key, strip(v)]),
    );
  };
  return strip(z.toJSONSchema(schema));
}

const storedSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("photo"), width: z.number(), height: z.number(), detection: photoDetectionSchema, model: z.string() }),
  z.object({ kind: z.literal("clip"), aspect: z.number(), detection: clipDetectionSchema, model: z.string() }),
]);
export type StoredRegions = z.infer<typeof storedSchema>;

async function loadAsset(studioId: string, mediaId: string) {
  const { data, error } = await supabaseAdmin()
    .from("media_assets")
    .select("id, kind, storage_path, mime_type, regions")
    .eq("id", mediaId)
    .eq("studio_id", studioId)
    .single();
  if (error) throw new Error(`Média introuvable (${mediaId})`);
  return data;
}

async function keep(mediaId: string, stored: StoredRegions) {
  await supabaseAdmin().from("media_assets").update({ regions: stored, regions_at: new Date().toISOString() }).eq("id", mediaId);
}

/** A photo's zones and suggested retouch (cached). Sizes are those of the photo as displayed (EXIF rotation applied). */
export async function photoRegions(studioId: string, mediaId: string): Promise<Extract<StoredRegions, { kind: "photo" }>> {
  const asset = await loadAsset(studioId, mediaId);
  const cached = storedSchema.safeParse(asset.regions);
  if (cached.success && cached.data.kind === "photo") return cached.data;
  if (asset.kind !== "image") throw new Error("Ce média n'est pas une photo");

  const download = await supabaseAdmin().storage.from("media").download(asset.storage_path as string);
  if (download.error) throw new Error("Photo illisible");
  const oriented = sharp(Buffer.from(await download.data.arrayBuffer())).rotate();
  const meta = await oriented.metadata();
  // .rotate() applies the EXIF orientation: a quarter turn swaps width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new Error("Taille de la photo inconnue");
  const jpeg = await oriented.resize({ width: DETECT_EDGE, height: DETECT_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

  const model = env("GEMINI_MODEL");
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } }, { text: PHOTO_DETECT_PROMPT }] }],
    config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(photoDetectionSchema) },
  });
  await logGeminiCost({ studioId, kind: "region_detection", model, usage: response.usageMetadata as GeminiUsage });
  const detection: PhotoDetection = photoDetectionSchema.parse(JSON.parse(response.text ?? ""));
  const stored = { kind: "photo" as const, width, height, detection, model };
  await keep(mediaId, stored);
  return stored;
}

/** A clip's tracked zones (cached). The aspect comes from the clip analysis (portrait 9:16 by default). */
export async function clipRegions(studioId: string, mediaId: string): Promise<Extract<StoredRegions, { kind: "clip" }>> {
  const asset = await loadAsset(studioId, mediaId);
  const cached = storedSchema.safeParse(asset.regions);
  if (cached.success && cached.data.kind === "clip") return cached.data;
  if (asset.kind !== "video" && !String(asset.mime_type ?? "").startsWith("video/")) throw new Error("Ce média n'est pas une vidéo");

  const db = supabaseAdmin();
  const { data: analysis } = await db.from("clip_analyses").select("analysis").eq("media_id", mediaId).order("created_at", { ascending: false }).limit(1);
  const orientation = (analysis?.[0]?.analysis as { orientation?: string } | undefined)?.orientation;
  const aspect = orientation === "landscape" ? 16 / 9 : orientation === "square" ? 1 : 9 / 16;

  const download = await db.storage.from("media").download(asset.storage_path as string);
  if (download.error) throw new Error("Vidéo illisible");
  const mimeType = (asset.mime_type as string | null) ?? "video/mp4";
  const ai = gemini();
  let file = await ai.files.upload({ file: download.data, config: { mimeType, displayName: `regions-${mediaId}` } });
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  while (file.state === FileState.PROCESSING) {
    if (Date.now() > deadline) throw new Error("Gemini file processing timed out");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== FileState.ACTIVE || !file.uri) throw new Error(`Gemini file ${file.state}`);
  const model = env("GEMINI_MODEL");
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ fileData: { fileUri: file.uri, mimeType }, videoMetadata: { fps: 4 } }, { text: CLIP_DETECT_PROMPT }] }],
      config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(clipDetectionSchema) },
    });
    await logGeminiCost({ studioId, kind: "region_detection", model, usage: response.usageMetadata as GeminiUsage });
    const detection: ClipDetection = clipDetectionSchema.parse(JSON.parse(response.text ?? ""));
    const stored = { kind: "clip" as const, aspect, detection, model };
    await keep(mediaId, stored);
    return stored;
  } finally {
    await ai.files.delete({ name: file.name! }).catch(() => {});
  }
}
