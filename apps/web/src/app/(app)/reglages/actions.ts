"use server";

import { effortSchema, type Effort } from "@fauve/agent";
import { createLinkCode } from "@/lib/instagram-dm";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getInstagramLinkCode(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  try {
    return { ok: true, code: await createLinkCode(member.studio.id) };
  } catch (error) {
    console.error("instagram link code failed", error);
    return { ok: false, error: "Le code n’a pas pu être créé. Réessaie dans un instant." };
  }
}

/** The level of care Fauve proposes for montages by default (each quote can still pick another one). */
export async function setMontageEffort(effort: Effort): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = effortSchema.safeParse(effort);
  if (!parsed.success) return { ok: false, error: "Niveau inconnu." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const { error } = await supabaseAdmin().from("studios").update({ montage_effort: parsed.data }).eq("id", member.studio.id);
  if (error) {
    console.warn("setMontageEffort failed", error.message);
    return { ok: false, error: "Le réglage n’a pas été enregistré. Réessaie dans un instant." };
  }
  // No revalidation: nothing else on Réglages reads it, the setting holds the value, and
  // « Enregistré » shows without waiting for the whole page (balance, ledger…) to render again.
  return { ok: true };
}
