"use server";

import { MAX_MONTAGE_FILES } from "@fauve/agent";
import { after } from "next/server";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";
import { replyOnWhatsApp } from "@/lib/whatsapp/inbound";

// Her upload link from WhatsApp (/depot): the photos and videos she picks in her gallery go
// straight to Storage in full quality (WhatsApp compresses videos), then arrive in her WhatsApp
// conversation as if she had sent them there, one message per file, and Simone answers on WhatsApp.

const filesSchema = z
  .array(z.object({ path: z.string().max(300), mime: z.string().max(100), size: z.number().int().positive() }))
  .min(1)
  .max(MAX_MONTAGE_FILES);

export type DropResult = { ok: true; count: number } | { ok: false; error: string };

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

  // Read before Simone answers (as on WhatsApp), then her answer there.
  after(async () => {
    await Promise.all(
      added.map((m) =>
        (m.video ? ensureClipAnalysis(studioId, m.id) : photoRegions(studioId, m.id)).catch((e: unknown) => console.warn("upload link: reading failed", e)),
      ),
    );
    await replyOnWhatsApp({ studioId, memberId: member.id, waId: member.phone_e164.replace(/^\+/, ""), phone: member.phone_e164 }).catch((e: unknown) =>
      console.error("upload link: reply failed", e),
    );
  });
  return { ok: true, count: added.length };
}
