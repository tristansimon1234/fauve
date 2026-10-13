import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Emoji reactions on a stored message ({ fauve?: "👍", me?: "🔥" }), whatever
// the channel: Fauve's reactions on WhatsApp, the manager's reactions on
// WhatsApp, and both in the web chat. The web chat shows them under the bubble.

export type Reactions = { fauve?: string; me?: string };
export type Reactor = keyof Reactions;

/** One emoji per person: a new one replaces the last, null removes it. */
export async function setReaction(
  target: { id: string } | { waMessageId: string },
  who: Reactor,
  emoji: string | null,
): Promise<void> {
  const db = supabaseAdmin();
  const column = "id" in target ? "id" : "wa_message_id";
  const value = "id" in target ? target.id : target.waMessageId;
  const { data } = await db.from("whatsapp_messages").select("id, reactions").eq(column, value).maybeSingle();
  if (!data) return;
  const reactions: Reactions = { ...((data.reactions as Reactions | null) ?? {}) };
  if (emoji) reactions[who] = emoji;
  else delete reactions[who];
  const { error } = await db.from("whatsapp_messages").update({ reactions }).eq("id", data.id);
  if (error) console.warn("reaction not stored", error.message);
}
