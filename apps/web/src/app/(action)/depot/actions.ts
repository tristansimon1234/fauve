"use server";

import { isInSessionWindow, MAX_MONTAGE_FILES } from "@fauve/agent";
import { after } from "next/server";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";
import { sendText } from "@/lib/whatsapp/client";
import { replyOnWhatsApp } from "@/lib/whatsapp/inbound";

// Her upload link from WhatsApp (/depot): the photos and videos she picks in her gallery go
// straight to Storage in full quality (WhatsApp compresses videos), then arrive in her WhatsApp
// conversation as if she had sent them there, one message per file, and Simone answers on WhatsApp:
// at once « C'est arrivé », so a message waits when she taps back to WhatsApp, then her answer
// once she has looked at them. Outside the 24 h window Simone cannot write first: the button
// back to WhatsApp has « C'est envoyé ! » ready, and her message opens the window.

const filesSchema = z
  .array(z.object({ path: z.string().max(300), mime: z.string().max(100), size: z.number().int().positive() }))
  .min(1)
  .max(MAX_MONTAGE_FILES);

/** `answered`: Simone writes to her on WhatsApp herself; else her own message (prefilled) opens the conversation. */
export type DropResult = { ok: true; count: number; answered: boolean } | { ok: false; error: string };

/** « tes 2 vidéos et ta photo » */
function filesLine(videos: number, photos: number): string {
  const part = (n: number, one: string, many: string) => (n === 1 ? `ta ${one}` : `tes ${n} ${many}`);
  return [videos ? part(videos, "vidéo", "vidéos") : "", photos ? part(photos, "photo", "photos") : ""].filter(Boolean).join(" et ");
}

export async function sendDropped(input: z.input<typeof filesSchema>): Promise<DropResult> {
  const parsed = filesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisis des photos ou des vidéos." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ce lien a expiré : demande-m’en un nouveau sur WhatsApp." };
  const studioId = member.studio.id;
  const files = parsed.data;
  if (!files.every((f) => f.path.startsWith(`${studioId}/chat/`) && !f.path.includes("..") && /^(image|video)\//.test(f.mime))) {
    return { ok: false, error: "Un des fichiers n’est pas une photo ou une vidéo." };
  }

  const db = supabaseAdmin();
  const waId = member.phone_e164.replace(/^\+/, "");
  // Before her files are stored (they count as WhatsApp messages): can Simone write first?
  const { data: last } = await db
    .from("whatsapp_messages")
    .select("created_at")
    .eq("studio_id", studioId)
    .eq("channel", "whatsapp")
    .eq("direction", "inbound")
    .is("payload->>via", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const open = isInSessionWindow(last ? new Date(last.created_at as string) : null);
  const added: { id: string; video: boolean }[] = [];
  for (const file of files) {
    const video = file.mime.startsWith("video/");
    const asset = await db
      .from("media_assets")
      .insert({ studio_id: studioId, storage_path: file.path, kind: video ? "video" : "image", source: "web_upload", mime_type: file.mime, size_bytes: file.size })
      .select("id")
      .single();
    if (asset.error) return { ok: false, error: "Un fichier n’a pas pu être ajouté. Réessaie." };
    const mediaId = asset.data.id as string;
    // In her WhatsApp conversation, like a file she sent there (the conversation is found by its trigger).
    const row = await db
      .from("whatsapp_messages")
      .insert({ studio_id: studioId, channel: "whatsapp", direction: "inbound", phone_e164: member.phone_e164, type: video ? "video" : "image", media_id: mediaId, payload: { via: "upload_link" } });
    if (row.error) return { ok: false, error: "Un fichier n’a pas pu être ajouté. Réessaie." };
    added.push({ id: mediaId, video });
  }

  // Waiting for her in WhatsApp when she taps back.
  if (open) {
    const videos = added.filter((m) => m.video).length;
    const ack = `C’est arrivé 👍 ${filesLine(videos, added.length - videos).replace(/^./, (c) => c.toUpperCase())}, en pleine qualité. Je regarde et je reviens vers toi.`;
    const id = await sendText(waId, ack).catch((e: unknown) => void console.warn("upload link: ack not sent", e));
    if (id) await db.from("whatsapp_messages").insert({ studio_id: studioId, channel: "whatsapp", wa_message_id: id, direction: "outbound", phone_e164: member.phone_e164, type: "text", body: ack });
  }

  // Read before Simone answers (as on WhatsApp), then her answer there (outside the window, her own message brings it).
  after(async () => {
    await Promise.all(
      added.map((m) =>
        (m.video ? ensureClipAnalysis(studioId, m.id) : photoRegions(studioId, m.id)).catch((e: unknown) => console.warn("upload link: reading failed", e)),
      ),
    );
    if (!open) return;
    await replyOnWhatsApp({ studioId, memberId: member.id, waId, phone: member.phone_e164 }).catch((e: unknown) => console.error("upload link: reply failed", e));
  });
  return { ok: true, count: added.length, answered: open };
}
