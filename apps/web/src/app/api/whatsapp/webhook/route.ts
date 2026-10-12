import { after, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { handleInboundMessage } from "@/lib/whatsapp/inbound";
import { webhookPayloadSchema } from "@/lib/whatsapp/schema";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/signature";

// The agent can take a while (tools, several model turns): it runs after the 200.
export const maxDuration = 300;

/** Meta's subscription handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === serverEnv().WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), serverEnv().WHATSAPP_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const parsed = webhookPayloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    // Acknowledge anyway: Meta would keep retrying a payload we will never understand.
    console.warn("Unhandled WhatsApp payload", parsed.error.issues);
    return new Response("ok", { status: 200 });
  }

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const names = new Map(change.value.contacts?.map((c) => [c.wa_id, c.profile?.name]));
      for (const message of change.value.messages ?? []) {
        after(() =>
          handleInboundMessage(message, names.get(message.from)).catch((error) =>
            console.error("WhatsApp message handling failed", message.id, error),
          ),
        );
      }
    }
  }

  return new Response("ok", { status: 200 });
}
