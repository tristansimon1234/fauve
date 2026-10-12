import { GoogleGenAI } from "@google/genai";
import { type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isValidTestKey } from "@/lib/test-studio";

// Admin helper for the Gemini setup, protected by FAUVE_TEST_KEY:
//   ?cle=…  lists the models this key can call, and the one GEMINI_MODEL points to.

export async function GET(request: NextRequest) {
  if (!isValidTestKey(request.nextUrl.searchParams.get("cle"))) return new Response("Forbidden", { status: 403 });

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
