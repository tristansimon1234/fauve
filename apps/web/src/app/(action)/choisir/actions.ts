"use server";

import { MAX_PICK } from "@fauve/agent";
import { after } from "next/server";
import { z } from "zod";
import { deliverPick } from "@/lib/media-pick";
import { getStudioContext } from "@/lib/studio";
import { replyOnWhatsApp } from "@/lib/whatsapp/inbound";

// « Choisir mes fichiers » on her phone (/choisir): her pick goes to her WhatsApp conversation as her message
// (« Je prends ces 4 dans la médiathèque, dans cet ordre (media_id : …) », as from the app's card), and Edith
// answers it there with the files of the Reel she is making. Outside the 24 h window Edith cannot write first:
// the button back to WhatsApp has « C’est choisi ! » ready, and her message brings Edith's answer.

const pickSchema = z.array(z.uuid()).min(1).max(MAX_PICK);

/** `answered`: Edith answers on WhatsApp by herself; else her own message (prefilled) opens the conversation. */
export type PickResult = { ok: true; count: number; answered: boolean } | { ok: false; error: string };

export async function sendPick(ids: string[]): Promise<PickResult> {
  const parsed = pickSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Choisis une photo ou une vidéo." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ce lien a expiré : demande-m’en un nouveau sur WhatsApp." };
  const studioId = member.studio.id;
  const sent = await deliverPick({ studioId, phone: member.phone_e164, ids: parsed.data });
  if (!sent.ok) return sent;
  if (sent.open) {
    const waId = member.phone_e164.replace(/^\+/, "");
    after(() => replyOnWhatsApp({ studioId, memberId: member.id, waId, phone: member.phone_e164 }).catch((e: unknown) => console.error("media pick: reply failed", e)));
  }
  return { ok: true, count: sent.count, answered: sent.open };
}
