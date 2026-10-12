import { type NextRequest } from "next/server";
import { env, type EnvKey } from "@/lib/env";
import { isValidTestKey } from "@/lib/test-studio";
import { graph, WhatsAppError } from "@/lib/whatsapp/client";

// Admin helper for the WhatsApp setup, protected by FAUVE_TEST_KEY:
//   ?action=status              phone number + subscription diagnostics
//   ?action=register&pin=123456 register the number on the Cloud API (2-step PIN)
//   ?action=subscribe           subscribe this app to the WABA's webhooks

const REQUIRED: EnvKey[] = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_WABA_ID",
  "ANTHROPIC_API_KEY",
  "SUPABASE_SECRET_KEY",
];

function configured() {
  return Object.fromEntries(
    REQUIRED.map((key) => {
      try {
        env(key);
        return [key, true];
      } catch {
        return [key, false];
      }
    }),
  );
}

async function attempt<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (error) {
    if (error instanceof WhatsAppError) return { ok: false as const, status: error.status, error: error.body };
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });

  const action = params.get("action") ?? "status";

  if (action === "register") {
    const pin = params.get("pin") ?? "";
    if (!/^\d{6}$/.test(pin)) return Response.json({ error: "pin must be 6 digits" }, { status: 400 });
    const result = await attempt(() =>
      graph(`${env("WHATSAPP_PHONE_ID")}/register`, {
        method: "POST",
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      }),
    );
    return Response.json({ action, result });
  }

  if (action === "subscribe") {
    const result = await attempt(() => graph(`${env("WHATSAPP_WABA_ID")}/subscribed_apps`, { method: "POST" }));
    return Response.json({ action, result });
  }

  const [phone, subscriptions] = await Promise.all([
    attempt(() =>
      graph(
        `${env("WHATSAPP_PHONE_ID")}?fields=display_phone_number,verified_name,name_status,status,quality_rating,code_verification_status,platform_type,messaging_limit_tier`,
      ),
    ),
    attempt(() => graph(`${env("WHATSAPP_WABA_ID")}/subscribed_apps`)),
  ]);
  return Response.json({ action: "status", configured: configured(), phone, subscriptions });
}
