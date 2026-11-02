import "server-only";
import { FileState, GoogleGenAI, PartMediaResolutionLevel, type File as GeminiFile, type Part } from "@google/genai";
import { clampLook, FONT_PICK_PROMPT, fontCheckOf, fontPickSchema, measuresLine, STEAL_PROMPT, stealFps, stolenLookReadingSchema, type ReelMeasures, type StolenLook, type StolenLookReading } from "@fauve/agent";
import { readAnswer } from "@fauve/agent/answer";
import { env } from "@/lib/env";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { geminiSchema } from "./gemini-schema";

// A Reel or post a manager shared with Fauve on Instagram: Gemini watches it
// once and says what makes it work, for the studio's art direction. The video
// itself is not kept (it is someone else's content): only this reading.

const MAX_BYTES = 60 * 1024 * 1024;
const PROCESSING_TIMEOUT_MS = 90_000;
const LOOK_SCHEMA = geminiSchema(stolenLookReadingSchema);

const PROMPT = `You are Edith's art director; Edith edits the Instagram Reels of a neighbourhood business (gym, hair or beauty salon, restaurant, shop…).
The person who runs the business (a woman or a man: make no gender agreement, say neither « elle » nor « il ») shared this content with you because it inspires them. Say in 3 short sentences what probably appeals and can be taken into their own Reels:
the hook of the first seconds, the rhythm of the cuts, the on-screen texts (font, size, animation, placement), the colours and the light, the transitions.
Concrete and reusable, without describing the person nor copying the content. In French.`;

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

const at = (s: number) => String(Math.round(s * 10) / 10).replace(".", ",");
const HIGH = PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH;

/**
 * Gemini's reading of a Reel's style (« Steal »): its form, hook, texts and how they are set,
 * effect, light, movement and music, from its small copy, with what the sandbox measured as
 * facts. Watched fast enough for a short Reel's every shot (stealFps), in high resolution, with
 * an image from the middle of each shot: at 2 frames a second Tristan's model, cut every 0.3 to
 * 0.6 s, lost its cut-outs. Its words are taken as written, then kept within their lengths; null when unreadable.
 */
export async function readStolenLook(
  studioId: string,
  video: Buffer,
  measures: ReelMeasures,
  shots: { from: number; to: number; jpeg: Buffer }[] = [],
): Promise<{ look: StolenLook; fonts: ReturnType<typeof fontCheckOf> } | null> {
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
            // The resolution is set on the part: in the request's config, Gemini 3 kept the video at 66 tokens a frame.
            { fileData: { fileUri: file.uri!, mimeType: "video/mp4" }, videoMetadata: { fps: stealFps(measures.duration) }, mediaResolution: { level: HIGH } },
            ...shots.flatMap((s, i): Part[] => [
              { text: `Plan ${i + 1}, de ${at(s.from)} à ${at(s.to)} s (image du milieu) :` },
              { inlineData: { mimeType: "image/jpeg", data: s.jpeg.toString("base64") }, mediaResolution: { level: HIGH } },
            ]),
            { text: `${STEAL_PROMPT}\n\nMesuré sur la vidéo (des faits, ne les recompte pas) : ${measuresLine(measures)}.` },
          ],
        },
      ],
      config: { responseMimeType: "application/json", responseJsonSchema: LOOK_SCHEMA },
    });
    await logGeminiCost({ studioId, kind: "video_analysis", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "steal", shots: shots.length, fps: stealFps(measures.duration) } });
    let reading: StolenLookReading;
    try {
      reading = readAnswer(stolenLookReadingSchema, JSON.parse(response.text ?? "null"));
    } catch (error) {
      console.warn("steal: reading refused", (error instanceof Error ? error.message : String(error)).slice(0, 300));
      return null;
    }
    return { look: clampLook(reading), fonts: fontCheckOf(reading) };
  } finally {
    await ai.files.delete({ name: uploaded.name! }).catch(() => {});
  }
}

const PICK_SCHEMA = geminiSchema(fontPickSchema);

/**
 * Which candidate font writes the Reel's title most like it does (`frame`: the Reel with its title; `sheet`: the same
 * words in each candidate, rows numbered from 1): its number, 0 when none is as fine, null when the answer is unusable.
 */
export async function pickStolenFont(studioId: string, frame: Buffer, sheet: Buffer, count: number): Promise<number | null> {
  const model = env("GEMINI_MODEL");
  const response = await gemini().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: frame.toString("base64") }, mediaResolution: { level: HIGH } },
          { inlineData: { mimeType: "image/png", data: sheet.toString("base64") }, mediaResolution: { level: HIGH } },
          { text: `${FONT_PICK_PROMPT}\nRows: 1 to ${count}.` },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: PICK_SCHEMA },
  });
  await logGeminiCost({ studioId, kind: "video_analysis", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "steal_font", candidates: count } });
  const answer = readAnswer(fontPickSchema, JSON.parse(response.text ?? "null"));
  return answer.choice >= 0 && answer.choice <= count ? answer.choice : null;
}
