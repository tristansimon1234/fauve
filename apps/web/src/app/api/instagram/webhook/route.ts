import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { dmEventSchema, handleDm } from "@/lib/instagram-dm";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/signature";

// DMs to Fauve's Instagram account (Meta app → Instagram → Webhooks, field
// "messages"). Signed with the Instagram app secret; handled after the 200.
export const maxDuration = 300;

const payloadSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({ id: z.string().optional(), messaging: z.array(z.unknown()).optional() })),
});

/** Meta's subscription handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === env("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  // Same X-Hub-Signature-256 scheme as WhatsApp, with the Instagram app's secret.
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), env("INSTAGRAM_APP_SECRET"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const parsed = payloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    console.warn("Unhandled Instagram payload", parsed.error.issues);
    return new Response("ok", { status: 200 });
  }
  for (const entry of parsed.data.entry) {
    for (const raw of entry.messaging ?? []) {
      const event = dmEventSchema.safeParse(raw);
      if (!event.success) continue;
      after(() => handleDm(event.data).catch((error) => console.error("Instagram DM handling failed", error)));
    }
  }
  return new Response("ok", { status: 200 });
}
