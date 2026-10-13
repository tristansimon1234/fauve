import { timingSafeEqual } from "node:crypto";
import { isInSessionWindow } from "@fauve/agent";
import { after } from "next/server";
import { env } from "@/lib/env";
import { analyzePerformance } from "@/lib/performance";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate, sendText } from "@/lib/whatsapp/client";

// The Sunday report ("ce qui marche"), called weekly by pg_cron with CRON_SECRET:
// every studio with Instagram connected gets its analysis, then a short WhatsApp
// message (free text inside the 24 h window, the weekly_report template otherwise).
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function notify(studioId: string, summary: string) {
  const db = supabaseAdmin();
  const { data: owner } = await db
    .from("members")
    .select("phone_e164")
    .eq("studio_id", studioId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const phone = owner?.phone_e164 as string | undefined;
  if (!phone) return;
  const { data: last } = await db
    .from("whatsapp_messages")
    .select("created_at")
    .eq("studio_id", studioId)
    .eq("channel", "whatsapp")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const waId = phone.replace(/^\+/, "");
  const body = `Ton bilan de la semaine : ${summary}\n\nLe détail (leçons et idées de posts) est dans l'app, page Résultats.`;
  if (isInSessionWindow(last ? new Date(last.created_at as string) : null)) {
    const id = await sendText(waId, body);
    await db.from("whatsapp_messages").insert({ studio_id: studioId, wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body });
  } else {
    // Outside the window only a Meta-approved template can open the conversation.
    await sendTemplate(waId, "weekly_report", []);
  }
}

async function run() {
  const { data: accounts } = await supabaseAdmin()
    .from("social_accounts")
    .select("studio_id")
    .eq("platform", "instagram")
    .eq("status", "connected");
  const results: { studio: string; ok: boolean; error?: string }[] = [];
  for (const { studio_id } of accounts ?? []) {
    const studioId = studio_id as string;
    try {
      const report = await analyzePerformance(studioId);
      if ("error" in report) {
        results.push({ studio: studioId, ok: false, error: report.error });
        continue;
      }
      await notify(studioId, report.summary).catch((e) => console.warn("weekly report: notification failed", studioId, e));
      results.push({ studio: studioId, ok: true });
    } catch (error) {
      console.error("weekly report failed", studioId, error);
      results.push({ studio: studioId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log("weekly reports", JSON.stringify(results));
}

async function handle(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  // pg_cron does not wait: answer now, analyse every studio in the background.
  after(run);
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
