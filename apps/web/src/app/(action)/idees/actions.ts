"use server";

import { z } from "zod";
import { launchCreation } from "@/app/(app)/create-actions";
import { chooseOffered, readOffer } from "@/lib/house-ideas";
import { houseInspiration } from "@/lib/house-models";
import { ownerWhatsApp } from "@/lib/owner-message";
import { freeSlots } from "@/lib/slots";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";

// « Regarde nos idées » on her phone (/idees/<offer>): one tap on an idea, « C'est parti », and her Reel starts as from
// the Créer screen (launchCreation: her subscription and credits checked, charged on delivery for what was made), made
// in that idea with the files of this Reel, her charter and her music. Edith says so on WhatsApp when she can write
// first (24 h window), with the post's id kept for her next turns; the Reel comes there once made.

export type IdeaLaunch =
  | { ok: true; minutes: string; answered: boolean }
  | { ok: false; error: string; locked?: "subscribe" | "credits" };

const inputSchema = z.object({ offerId: z.uuid(), key: z.string().min(1).max(40) });

export async function launchIdea(offerId: string, key: string): Promise<IdeaLaunch> {
  const parsed = inputSchema.safeParse({ offerId, key });
  if (!parsed.success) return { ok: false, error: "Cette idée n’existe plus." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Reconnecte-toi pour continuer." };
  const studioId = member.studio.id;
  const offer = await readOffer(studioId, parsed.data.offerId);
  if (!offer || !offer.keys.includes(parsed.data.key)) return { ok: false, error: "Cette idée n’existe plus." };
  if (offer.postId) return { ok: false, error: "Ce Reel est déjà lancé : je te l’envoie sur WhatsApp dès qu’il est prêt." };
  if (!offer.mediaIds.length) return { ok: false, error: "Il me faut tes photos ou vidéos : envoie-les-moi sur WhatsApp." };
  const [chosen, house] = await Promise.all([
    chooseOffered(studioId, offer.id, parsed.data.key).catch(() => false),
    houseInspiration(studioId, parsed.data.key).catch(() => null),
  ]);
  if (!chosen || !house) return { ok: false, error: "Je n’arrive pas à prendre cette idée pour l’instant. Réessaie dans un instant." };
  // The day Edith will remind her to post it: her next free one, as on the Créer screen.
  const [slot] = await freeSlots(studioId, member.studio.timezone, 1).catch(() => []);
  const when = slot ?? { date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), time: "18:00" };
  const res = await launchCreation({
    kind: "reel",
    date: when.date,
    time: when.time,
    idea: "",
    items: offer.mediaIds.map((media) => ({ media })),
    voice: "auto",
    copy: house.id,
    ideaOffer: offer.id,
  }).catch((error: unknown) => {
    console.warn("idea launch failed", error);
    return { ok: false as const, error: "Ça n’est pas parti. Réessaie dans un instant." };
  });
  if (!res.ok) return { ok: false, error: res.error, ...("locked" in res && res.locked ? { locked: res.locked } : {}) };
  const minutes = res.montage?.minutes ?? "10 à 30";
  const line = `C’est parti pour ton Reel ! Je te l’envoie ici dès qu’il est prêt, dans ${minutes} min environ.`;
  const answered = await tellOnWhatsApp(studioId, member.phone_e164, line, `montage lancé depuis la page des idées pour « ${res.title} » post_id=${res.postId}`);
  return { ok: true, minutes, answered };
}

/** Edith's line in her WhatsApp conversation when she can write first, its memo kept for her next turns; false otherwise. */
async function tellOnWhatsApp(studioId: string, phone: string, line: string, note: string): Promise<boolean> {
  const owner = await ownerWhatsApp(studioId).catch(() => null);
  if (!owner?.open) return false;
  const id = await sendText(owner.waId, line).catch((e: unknown) => void console.warn("ideas page: message not sent", e));
  if (!id) return false;
  await supabaseAdmin().from("whatsapp_messages").insert({ studio_id: studioId, channel: "whatsapp", wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body: line, payload: { notes: [note] } });
  return true;
}
