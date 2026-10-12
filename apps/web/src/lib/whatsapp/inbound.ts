import "server-only";
import { replyInConversation } from "@/lib/agent/conversation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { downloadMedia, markReadAndTyping, sendText } from "./client";
import { mediaOf, textOf, toE164, type InboundMessage } from "./schema";

// Several messages often arrive together (a caption + 5 clips). We wait briefly and
// let only the latest message of the burst run the agent, which sees them all.
const BURST_DEBOUNCE_MS = 4000;

type Member = { id: string; studio_id: string; first_name: string | null };

async function findOrCreateMember(phone: string, profileName?: string): Promise<Member> {
  const db = supabaseAdmin();
  const existing = await db.from("members").select("id, studio_id, first_name").eq("phone_e164", phone).maybeSingle();
  if (existing.data) return existing.data;

  // Unknown number: start onboarding with a fresh studio.
  const studio = await db.from("studios").insert({}).select("id").single();
  if (studio.error) throw new Error(studio.error.message);
  const firstName = profileName?.split(/\s+/)[0] ?? null;
  const created = await db
    .from("members")
    .insert({ studio_id: studio.data.id, phone_e164: phone, first_name: firstName, role: "owner" })
    .select("id, studio_id, first_name")
    .single();
  if (created.data) return created.data;

  // Lost a race with a concurrent first message: use the winner and drop our studio.
  await db.from("studios").delete().eq("id", studio.data.id);
  const winner = await db.from("members").select("id, studio_id, first_name").eq("phone_e164", phone).single();
  if (winner.error) throw new Error(winner.error.message);
  return winner.data;
}

const extensionByMime: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

async function storeMedia(studioId: string, message: InboundMessage): Promise<string | null> {
  const ref = mediaOf(message);
  if (!ref) return null;
  const db = supabaseAdmin();
  const file = await downloadMedia(ref.id);
  const ext = extensionByMime[file.mimeType] ?? "bin";
  const path = `${studioId}/whatsapp/${message.id}.${ext}`;
  const upload = await db.storage.from("media").upload(path, file.bytes, { contentType: file.mimeType, upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({
      studio_id: studioId,
      storage_path: path,
      kind: ref.kind,
      source: "whatsapp",
      mime_type: file.mimeType,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  return asset.data.id as string;
}

export async function handleInboundMessage(message: InboundMessage, profileName?: string): Promise<void> {
  const db = supabaseAdmin();
  const phone = toE164(message.from);
  const member = await findOrCreateMember(phone, profileName);

  // Idempotency: Meta retries deliveries, wa_message_id is unique.
  const inserted = await db
    .from("whatsapp_messages")
    .upsert(
      {
        studio_id: member.studio_id,
        wa_message_id: message.id,
        direction: "inbound",
        phone_e164: phone,
        type: message.type,
        body: textOf(message),
        payload: message,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (inserted.error) throw new Error(inserted.error.message);
  if (!inserted.data.length) return; // duplicate delivery

  // A reaction from the manager needs no answer.
  if (message.type === "reaction") return;

  await markReadAndTyping(message.id).catch((e) => console.warn("typing indicator failed", e));

  const mediaId = await storeMedia(member.studio_id, message).catch((e) => {
    console.error("media storage failed", e);
    return null;
  });
  if (mediaId) await db.from("whatsapp_messages").update({ media_id: mediaId }).eq("wa_message_id", message.id);

  await new Promise((resolve) => setTimeout(resolve, BURST_DEBOUNCE_MS));
  const latest = await db
    .from("whatsapp_messages")
    .select("wa_message_id")
    .eq("studio_id", member.studio_id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (latest.data?.wa_message_id !== message.id) return; // a newer message will answer

  const result = await replyInConversation({
    studioId: member.studio_id,
    memberId: member.id,
    waId: message.from,
    replyToMessageId: message.id,
  });

  if (!result.reply) return;
  const waMessageId = await sendText(message.from, result.reply);
  await db.from("whatsapp_messages").insert({
    studio_id: member.studio_id,
    wa_message_id: waMessageId,
    direction: "outbound",
    phone_e164: phone,
    type: "text",
    body: result.reply,
  });
}
