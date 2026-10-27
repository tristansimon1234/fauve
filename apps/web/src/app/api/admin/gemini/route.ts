import { GoogleGenAI } from "@google/genai";
import { type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { adminKeyAuthorized } from "@/lib/test-studio";

// Admin helper for the Gemini setup, protected by FAUVE_TEST_KEY (Authorization: Bearer …, never in the address):
//   lists the models this key can call, and the one GEMINI_MODEL points to.
// The same in POST with CRON_SECRET, from the database (select public.call_app('/api/admin/gemini')).

export async function GET(request: NextRequest) {
  if (!adminKeyAuthorized(request)) return new Response("Forbidden", { status: 403 });
  return models();
}

export async function POST(request: NextRequest) {
  if (!cronAuthorized(request)) return new Response("Forbidden", { status: 403 });
  return models();
}

async function models() {
  try {
    const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
    const models: { name: string; displayName?: string; actions?: string[] }[] = [];
    for await (const model of await ai.models.list({ config: { pageSize: 100 } })) {
      if (!model.supportedActions?.includes("generateContent")) continue;
      models.push({ name: model.name ?? "", displayName: model.displayName, actions: model.supportedActions });
    }
    const configured = env("GEMINI_MODEL");
    return Response.json({
      configured,
      configuredAvailable: models.some((m) => m.name === `models/${configured}`),
      models: models.map((m) => m.name.replace(/^models\//, "")).sort(),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
