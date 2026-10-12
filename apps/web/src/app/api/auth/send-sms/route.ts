import { normalizePhone } from "@mila/agent";
import { Webhook } from "standardwebhooks";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendLoginCode } from "@/lib/whatsapp/client";

// Supabase Auth "Send SMS" hook: login codes go out on WhatsApp instead of SMS.
// Configure in Supabase → Authentication → Hooks → Send SMS (HTTPS) with this URL.

const payloadSchema = z.object({
  user: z.object({ phone: z.string() }),
  sms: z.object({ otp: z.string().regex(/^\d{4,10}$/) }),
});

function hookError(httpCode: number, message: string) {
  return Response.json({ error: { http_code: httpCode, message } }, { status: httpCode });
}

function verify(rawBody: string, headers: Headers): unknown {
  const secrets = env("SEND_SMS_HOOK_SECRET").split("|");
  const webhookHeaders = Object.fromEntries(headers);
  for (const secret of secrets) {
    try {
      return new Webhook(secret.trim().replace(/^v1,whsec_/, "")).verify(rawBody, webhookHeaders);
    } catch {
      // try the next secret (rotation)
    }
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verify(rawBody, request.headers);
  if (!verified) return hookError(401, "Invalid signature");

  const parsed = payloadSchema.safeParse(verified);
  if (!parsed.success) return hookError(400, "Unexpected payload");
  const phone = normalizePhone(`+${parsed.data.user.phone.replace(/^\+/, "")}`);
  if (!phone) return hookError(400, "Invalid phone");
  const { otp } = parsed.data.sms;
  const db = supabaseAdmin();

  // Server-initiated login (WhatsApp link, QR code): keep the code, don't send it.
  const pending = await db
    .from("pending_server_logins")
    .update({ otp })
    .eq("phone_e164", phone)
    .is("otp", null)
    .gt("expires_at", new Date().toISOString())
    .select("phone_e164");
  if (pending.error) return hookError(500, "Database error");
  if (pending.data.length) return Response.json({});

  // Only studio members can log in.
  const member = await db.from("members").select("studio_id").eq("phone_e164", phone).maybeSingle();
  if (member.error) return hookError(500, "Database error");
  if (!member.data) return hookError(403, "Ce numéro n’est pas encore inscrit. Écris d’abord à Mila sur WhatsApp.");

  try {
    await sendLoginCode(phone.slice(1), otp);
  } catch (error) {
    console.error("login code delivery failed", error);
    return hookError(502, "Impossible d’envoyer le code sur WhatsApp.");
  }

  await db.from("cost_events").insert({
    studio_id: member.data.studio_id,
    kind: "whatsapp_template",
    provider: "meta",
    units: 1,
    meta: { template: "login_code", category: "authentication" },
  });
  return Response.json({});
}
