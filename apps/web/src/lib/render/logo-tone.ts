import "server-only";
import { GoogleGenAI } from "@google/genai";
import { LOGO_WORDS_PROMPT, logoOnDark, logoSaysName, type LogoOnDark } from "@fauve/agent";
import { readAnswer } from "@fauve/agent/answer";
import sharp from "sharp";
import { z } from "zod";
import { fetchPublicImage } from "@/lib/agent/website";
import { env } from "@/lib/env";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { geminiSchema } from "@/lib/video/gemini-schema";

// How the studio's logo shows on the Reel's dark end card, read once per logo
// from its pixels (a 64 px thumbnail) and kept while the server is warm; and
// whether it already writes her name, read once per montage by Gemini.

type LogoSource = { path: string } | { url: string };

const known = new Map<string, Promise<LogoOnDark>>();

async function bytesOf(source: LogoSource): Promise<Buffer> {
  if ("path" in source) {
    const { data } = await supabaseAdmin().storage.from("media").download(source.path);
    if (!data) throw new Error("logo illisible");
    return Buffer.from(await data.arrayBuffer());
  }
  return fetchPublicImage(source.url, AbortSignal.timeout(6000));
}

async function read(source: LogoSource): Promise<LogoOnDark> {
  const { data } = await sharp(await bytesOf(source)).ensureAlpha().resize(64, 64, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  return logoOnDark(data);
}

/** The logo's tone; "as_is" when it cannot be read (the end card then shows it unchanged). */
export function logoTone(source: LogoSource): Promise<LogoOnDark> {
  const key = "path" in source ? source.path : source.url;
  let tone = known.get(key);
  if (!tone) {
    tone = read(source).catch((error: unknown) => {
      console.warn("logo tone unreadable", error);
      known.delete(key);
      return "as_is" as const;
    });
    known.set(key, tone);
  }
  return tone;
}

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));
const wordsSchema = z.object({ words: z.string().max(200) });
const written = new Map<string, Promise<string | null>>();

async function readWords(studioId: string, source: LogoSource): Promise<string> {
  // On a mid grey, a white logo and a black one both show; a vector logo is drawn sharp.
  const png = await sharp(await bytesOf(source), { density: 200 }).resize(512, 512, { fit: "inside" }).flatten({ background: "#8c8c8c" }).png().toBuffer();
  const model = env("GEMINI_MODEL");
  const response = await gemini().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }, { text: LOGO_WORDS_PROMPT }] }],
    config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(wordsSchema) },
  });
  await logGeminiCost({ studioId, kind: "logo_read", model, usage: response.usageMetadata as GeminiUsage });
  return readAnswer(wordsSchema, JSON.parse(response.text ?? "")).words;
}

/** Whether her logo already writes her name, the end card then not writing it again; undefined when it cannot be read. */
export async function logoNamed(studioId: string, name: string, source: LogoSource): Promise<boolean | undefined> {
  const key = "path" in source ? source.path : source.url;
  let words = written.get(key);
  if (!words) {
    words = readWords(studioId, source).catch((error: unknown) => {
      console.warn("logo words unreadable", error);
      written.delete(key);
      return null;
    });
    written.set(key, words);
  }
  const said = await words;
  return said === null ? undefined : logoSaysName(said, name);
}
