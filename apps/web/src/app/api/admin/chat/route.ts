import { type NextRequest } from "next/server";
import { replyInConversation } from "@/lib/agent/conversation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateTestMember, isValidTestKey } from "@/lib/test-studio";

// Admin helper to test the chat end to end on the test studio, protected by FAUVE_TEST_KEY:
//   ?cle=…&text=…   sends one message as the test manager and returns Fauve's reply
// (same path as the in-app chat; jobs such as a montage start after the reply).
//   &studio=…       on a real studio instead, as its owner, in a separate web
//                   conversation (returned; pass &c=… to continue it).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
  const text = params.get("text")?.trim().slice(0, 2000);
  if (!text) return Response.json({ error: "text=… attendu" }, { status: 400 });

  const db = supabaseAdmin();
  let member: { studioId: string; memberId: string };
  let conversationId: string | undefined;
  const studio = params.get("studio");
  if (studio) {
    const owner = await db.from("members").select("id").eq("studio_id", studio).eq("role", "owner").limit(1).maybeSingle();
    if (!owner.data) return Response.json({ error: "studio inconnu" }, { status: 404 });
    member = { studioId: studio, memberId: owner.data.id as string };
    conversationId = params.get("c") ?? undefined;
    if (!conversationId) {
      const created = await db.from("conversations").insert({ studio_id: studio, started_by: "web", title: "Test admin" }).select("id").single();
      if (created.error) return Response.json({ error: created.error.message }, { status: 500 });
      conversationId = created.data.id as string;
    }
  } else {
    member = await getOrCreateTestMember();
  }
  const inserted = await db
    .from("whatsapp_messages")
    .insert({ studio_id: member.studioId, conversation_id: conversationId, channel: "web", direction: "inbound", type: "text", body: text })
    .select("id")
    .single();
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 500 });

  const result = await replyInConversation({ studioId: member.studioId, memberId: member.memberId, conversationId, reactToRowId: inserted.data.id as string });
  if (result.reply) {
    await db
      .from("whatsapp_messages")
      .insert({ studio_id: member.studioId, conversation_id: conversationId, channel: "web", direction: "outbound", type: "text", body: result.reply, payload: result.extras });
  }
  for (const job of result.afterReply) await job().catch((e) => console.error("admin chat: after-reply job failed", e));
  return Response.json({ studio: member.studioId, conversation: conversationId, reply: result.reply, reactions: result.reactions, extras: result.extras, usage: result.usage, jobs: result.afterReply.length });
}
