import { type NextRequest } from "next/server";
import { replyInConversation } from "@/lib/agent/conversation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateTestMember, isValidTestKey } from "@/lib/test-studio";

// Admin helper to test the chat end to end on the test studio, protected by FAUVE_TEST_KEY:
//   ?cle=…&text=…   sends one message as the test manager and returns Fauve's reply
// (same path as the in-app chat; jobs such as a montage start after the reply).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
  const text = params.get("text")?.trim().slice(0, 2000);
  if (!text) return Response.json({ error: "text=… attendu" }, { status: 400 });

  const member = await getOrCreateTestMember();
  const db = supabaseAdmin();
  const inserted = await db
    .from("whatsapp_messages")
    .insert({ studio_id: member.studioId, channel: "web", direction: "inbound", type: "text", body: text })
    .select("id")
    .single();
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 500 });

  const result = await replyInConversation({ studioId: member.studioId, memberId: member.memberId, reactToRowId: inserted.data.id as string });
  if (result.reply) {
    await db.from("whatsapp_messages").insert({ studio_id: member.studioId, channel: "web", direction: "outbound", type: "text", body: result.reply });
  }
  for (const job of result.afterReply) await job().catch((e) => console.error("admin chat: after-reply job failed", e));
  return Response.json({ studio: member.studioId, reply: result.reply, reactions: result.reactions, usage: result.usage, jobs: result.afterReply.length });
}
