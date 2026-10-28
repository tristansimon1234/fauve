"use server";

import { voiceIn, voiceSettingSchema } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { ownerWhatsApp } from "@/lib/owner-message";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownVoiceOf } from "@/lib/voice-clone";
import { sendText } from "@/lib/whatsapp/client";

// The voice page opened from WhatsApp (/voix): when her Reels get a voice over, and which one,
// heard before choosing. Saved at once (one tap, no form), then Edith says so on WhatsApp when
// she can write first (24 h window); otherwise the button back has her message ready.

export type VoiceChoiceResult = { ok: true; answered: boolean } | { ok: false; error: string };

const input = voiceSettingSchema.pick({ use: true }).extend({ voice_id: voiceSettingSchema.shape.voice_id.unwrap() });

/** Her voice setting for her next Reels: a voice of Edith's gallery or her own clone, and when to use it. */
export async function chooseVoice(raw: unknown): Promise<VoiceChoiceResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Choix invalide." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Reconnecte-toi pour continuer." };
  const studioId = member.studio.id;
  const voice = voiceIn(parsed.data.voice_id, await ownVoiceOf(studioId));
  if (!voice) return { ok: false, error: "Cette voix n’existe pas." };
  try {
    await insertProfileVersion(studioId, (current) => ({ ...current, voice: { use: parsed.data.use, voice_id: voice.id } }));
  } catch (error) {
    console.warn("chooseVoice failed", error);
    return { ok: false, error: "Ce n’est pas enregistré. Réessaie." };
  }
  revalidatePath("/style");
  const line =
    parsed.data.use === "never"
      ? "C’est noté : plus de voix off sur tes Reels, juste la musique. Tu peux toujours m’en demander une pour un Reel précis."
      : `C’est noté 🎙️ ${voice.own ? "Tes Reels seront racontés avec ta propre voix" : `Tes Reels seront racontés par ${voice.name}`}${parsed.data.use === "always" ? ", sur chacun d’eux" : ", quand tes images racontent quelque chose"}.`;
  return { ok: true, answered: await tellOnWhatsApp(studioId, member.phone_e164, line) };
}

/** Edith's line in her WhatsApp conversation, when she can write first; false otherwise. */
async function tellOnWhatsApp(studioId: string, phone: string, line: string): Promise<boolean> {
  const owner = await ownerWhatsApp(studioId).catch(() => null);
  if (!owner?.open) return false;
  const id = await sendText(owner.waId, line).catch((e: unknown) => void console.warn("voice page: message not sent", e));
  if (!id) return false;
  await supabaseAdmin().from("whatsapp_messages").insert({ studio_id: studioId, channel: "whatsapp", wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body: line });
  return true;
}
