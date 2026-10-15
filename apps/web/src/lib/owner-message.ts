import "server-only";
import { isInSessionWindow } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendReply, sendTemplate } from "@/lib/whatsapp/client";

// A message Simone sends on her own (the week's proposal, the day's filming
// mission, a plan B): on WhatsApp while the 24 h window is open, with its
// buttons; outside it, the Meta template if one is given, and always in the
// app's conversation with the same buttons and memo, so nothing is lost.

export type OwnerMessage = {
  text: string;
  /** Answer buttons (3 at most on WhatsApp, a list beyond). */
  options?: string[];
  /** Memos kept for Simone's next turns (ids she needs). */
  notes?: string[];
  /** What kind of message it is, kept in its payload (e.g. « nudge », counted by lib/nudge.ts). */
  kind?: string;
  /** Outside the 24 h window: an approved template and its parameters. */
  template?: { name: string; params: string[] };
};

export async function messageOwner(studioId: string, message: OwnerMessage): Promise<"whatsapp" | "template" | "app"> {
  const db = supabaseAdmin();
  const { data: owner } = await db
    .from("members")
    .select("phone_e164")
    .eq("studio_id", studioId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const phone = (owner?.phone_e164 as string | undefined) ?? null;
  const payload = { ...(message.kind ? { kind: message.kind } : {}), ...(message.options?.length ? { options: message.options } : {}), ...(message.notes?.length ? { notes: message.notes } : {}) };

  if (phone) {
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
    if (isInSessionWindow(last ? new Date(last.created_at as string) : null)) {
      const id = await sendReply(waId, message.text, message.options);
      await db.from("whatsapp_messages").insert({ studio_id: studioId, channel: "whatsapp", wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body: message.text, payload });
      return "whatsapp";
    }
    if (message.template) {
      // Outside the window only an approved template opens the conversation; her answer
      // reopens it and Simone sees the waiting message in her context.
      await sendTemplate(waId, message.template.name, message.template.params).catch((error) =>
        console.warn("template refused", message.template!.name, error instanceof Error ? error.message : error),
      );
    }
  }
  await db.from("whatsapp_messages").insert({ studio_id: studioId, channel: "web", direction: "outbound", type: "text", body: message.text, payload });
  return phone && message.template ? "template" : "app";
}
