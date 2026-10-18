import "server-only";
import { FileState, GoogleGenAI, type File as GeminiFile } from "@google/genai";
import { clampLook, measuresLine, STEAL_PROMPT, stolenLookReadingSchema, type ReelMeasures, type StolenLook } from "@fauve/agent";
import { env } from "@/lib/env";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { geminiSchema } from "./gemini-schema";

// A Reel or post a manager shared with Fauve on Instagram: Gemini watches it
// once and says what makes it work, for the studio's art direction. The video
// itself is not kept (it is someone else's content): only this reading.

const MAX_BYTES = 60 * 1024 * 1024;
const PROCESSING_TIMEOUT_MS = 90_000;
/** Frames a second Gemini watches a stolen Reel at: its texts appear and leave within a second. */
const STEAL_FPS = 2;
const LOOK_SCHEMA = geminiSchema(stolenLookReadingSchema);

const PROMPT = `Tu es la directrice artistique de Simone, qui monte les Reels Instagram d'un commerce de quartier (studio de sport, salon de coiffure ou de beauté, restaurant, boutique…).
La personne qui gère le commerce (femme ou homme : n'accorde rien, ne dis ni « elle » ni « il ») t'a partagé ce contenu parce qu'il l'inspire. Dis en 3 phrases courtes ce qui plaît probablement et qu'on peut reprendre dans ses propres Reels :
l'accroche des premières secondes, le rythme des coupes, les textes à l'écran (police, taille, animation, placement), les couleurs et la lumière, les transitions.
Concret et réutilisable, sans décrire la personne ni recopier le contenu. En français.`;

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

/** Gemini's reading of a shared Reel or image, or null if it could not be fetched or watched. */
export async function readInspiration(studioId: string, url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "video/mp4";
  if (!/^(video|image)\//.test(mimeType)) return null;
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return null;

  const ai = gemini();
  const uploaded = await ai.files.upload({ file: new Blob([bytes], { type: mimeType }), config: { mimeType } });
  try {
    const file = await ready(ai, uploaded);
    if (!file) return null;
    const model = env("GEMINI_MODEL");
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ fileData: { fileUri: file.uri!, mimeType } }, { text: PROMPT }] }],
    });
    await logGeminiCost({ studioId, kind: "video_analysis", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "inspiration" } });
    return response.text?.trim().slice(0, 1200) || null;
  } finally {
    await ai.files.delete({ name: uploaded.name! }).catch(() => {});
  }
}

/** Waits for Gemini to have a file ready to watch (null after the timeout or on failure). */
async function ready(ai: GoogleGenAI, uploaded: GeminiFile): Promise<GeminiFile | null> {
  let file = uploaded;
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  while (file.state === FileState.PROCESSING) {
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: file.name! });
  }
  return file.state === FileState.ACTIVE && file.uri ? file : null;
}

/**
 * Gemini's reading of a Reel's style (« Steal »): its form, hook, texts and how they are set,
 * effect, light, movement and music, from its small copy, with what the sandbox measured as
 * facts. Its words are taken as written, then kept within their lengths; null when unreadable.
 */
export async function readStolenLook(studioId: string, video: Buffer, measures: ReelMeasures): Promise<StolenLook | null> {
  const ai = gemini();
  const uploaded = await ai.files.upload({ file: new Blob([new Uint8Array(video)], { type: "video/mp4" }), config: { mimeType: "video/mp4", displayName: "steal" } });
  try {
    const file = await ready(ai, uploaded);
    if (!file) return null;
    const model = env("GEMINI_MODEL");
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: file.uri!, mimeType: "video/mp4" }, videoMetadata: { fps: STEAL_FPS } },
            { text: `${STEAL_PROMPT}\n\nMesuré sur la vidéo (des faits, ne les recompte pas) : ${measuresLine(measures)}.` },
          ],
        },
      ],
      config: { responseMimeType: "application/json", responseJsonSchema: LOOK_SCHEMA },
    });
    await logGeminiCost({ studioId, kind: "video_analysis", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "steal" } });
    const parsed = stolenLookReadingSchema.safeParse(JSON.parse(response.text ?? "null"));
    if (!parsed.success) {
      console.warn("steal: reading refused", parsed.error.message.slice(0, 300));
      return null;
    }
    return clampLook(parsed.data);
  } finally {
    await ai.files.delete({ name: uploaded.name! }).catch(() => {});
  }
}
