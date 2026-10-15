import { timingSafeEqual } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { ambiancePrompt, improvePrompt, PHOTO_IMPROVEMENTS } from "@fauve/agent";
import sharp from "sharp";
import { generate } from "@/lib/ai-images";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Admin check of the image model, with CRON_SECRET (sent from the database through
// pg_net): the image models this key can call and whether GEMINI_IMAGE_MODEL is one;
// ?test=1 also makes an ambiance image and improves the landing's first carousel
// photo, saved in the public landing bucket under ai-tests/ (no studio, no credit).
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const configured = env("GEMINI_IMAGE_MODEL");
  const out: Record<string, unknown> = { configured };
  try {
    const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
    const names: string[] = [];
    for await (const model of await ai.models.list({ config: { pageSize: 200 } })) {
      const name = (model.name ?? "").replace(/^models\//, "");
      if (/image|banana/i.test(name)) names.push(name);
    }
    out.imageModels = names.sort();
    out.configuredAvailable = names.includes(configured);
  } catch (error) {
    out.listError = error instanceof Error ? error.message : String(error);
  }
  if (new URL(request.url).searchParams.get("test") !== "1") return Response.json(out);

  const db = supabaseAdmin();
  const save = async (name: string, bytes: Buffer) => {
    const jpeg = await sharp(bytes).jpeg({ quality: 88 }).toBuffer();
    const meta = await sharp(bytes).metadata();
    await db.storage.from("landing").upload(`ai-tests/${name}.jpg`, jpeg, { contentType: "image/jpeg", upsert: true });
    return `${meta.width}x${meta.height}`;
  };
  const started = Date.now();
  try {
    const { bytes } = await generate([{ text: ambiancePrompt("des serviettes roulées et une branche d'eucalyptus sur du bois clair, lumière douce du matin", "4:5", { business: "studio de Pilates", colors: ["#5B3FD9", "#F2694E"] }) }], "4:5");
    out.ambiance = { size: await save("ambiance", bytes), ms: Date.now() - started };
  } catch (error) {
    out.ambianceError = error instanceof Error ? error.message : String(error);
  }
  const t2 = Date.now();
  try {
    const photo = await db.storage.from("landing").download("carrousel-1.jpg");
    if (!photo.data) throw new Error("no landing photo");
    const input = await sharp(Buffer.from(await photo.data.arrayBuffer())).resize({ width: 2048, height: 2048, fit: "inside" }).jpeg().toBuffer();
    const { bytes } = await generate(
      [{ inlineData: { mimeType: "image/jpeg", data: input.toString("base64") } }, { text: improvePrompt(PHOTO_IMPROVEMENTS.light.instruction, "4:5", "salon de coiffure") }],
      "4:5",
    );
    out.improve = { size: await save("improve", bytes), ms: Date.now() - t2 };
  } catch (error) {
    out.improveError = error instanceof Error ? error.message : String(error);
  }
  return Response.json(out);
}
