"use server";

import { after } from "next/server";

import { replyInConversation } from "@/lib/agent/conversation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getOrCreateTestMember,
  isValidTestKey,
  loadTestState,
  resetTestStudio,
  type TestState,
} from "@/lib/test-studio";

export type SendResult = { ok: true; state: TestState } | { ok: false; error: string };

export async function sendTestMessage(key: string, text: string): Promise<SendResult> {
  if (!isValidTestKey(key)) return { ok: false, error: "Lien de test invalide." };
  const body = text.trim().slice(0, 4000);
  if (!body) return { ok: false, error: "Message vide." };

  const member = await getOrCreateTestMember();
  const db = supabaseAdmin();
  const inserted = await db.from("whatsapp_messages").insert({
    studio_id: member.studioId,
    channel: "web",
    direction: "inbound",
    type: "text",
    body,
  });
  if (inserted.error) return { ok: false, error: inserted.error.message };

  try {
    const result = await replyInConversation({ studioId: member.studioId, memberId: member.memberId });
    if (result.reply) {
      await db.from("whatsapp_messages").insert({
        studio_id: member.studioId,
        channel: "web",
        direction: "outbound",
        type: "text",
        body: result.reply,
      });
    }
    after(async () => {
      for (const job of result.afterReply) await job().catch((e) => console.error("test chat: after-reply job failed", e));
    });
  } catch (error) {
    console.error("test chat: agent failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }

  return { ok: true, state: await loadTestState(member) };
}

export async function resetTest(key: string): Promise<SendResult> {
  if (!isValidTestKey(key)) return { ok: false, error: "Lien de test invalide." };
  await resetTestStudio();
  return { ok: true, state: await loadTestState(await getOrCreateTestMember()) };
}
