"use server";

import { addFacts, effortSchema, MAX_FACT_CHARS, readMemory, type Effort } from "@fauve/agent";
import { revalidatePath } from "next/cache";
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
  revalidatePath("/reglages");
  return { ok: true };
}

/** What Fauve keeps about the business: the manager adds a fact or removes one (by its text). */
export async function editMemory(change: { add?: string; remove?: string }): Promise<{ ok: true; facts: string[] } | { ok: false; error: string }> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const db = supabaseAdmin();
  const { data } = await db.from("studios").select("memory").eq("id", member.studio.id).single();
  let memory = readMemory(data?.memory);
  if (typeof change.remove === "string") memory = memory.filter((f) => f.fact !== change.remove);
  if (typeof change.add === "string" && change.add.trim().length >= 3) memory = addFacts(memory, [change.add.slice(0, MAX_FACT_CHARS)], new Date().toISOString());
  const { error } = await db.from("studios").update({ memory }).eq("id", member.studio.id);
  if (error) return { ok: false, error: "Ce n’est pas enregistré. Réessaie dans un instant." };
  return { ok: true, facts: memory.map((f) => f.fact) };
}

/** Her posting days (0 = Monday) and hour: what Simone plans each week on. */
export async function setPostingDays(days: number[], time: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const valid = days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && days.length > 0 && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!valid) return { ok: false, error: "Choisis au moins un jour." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const { error } = await supabaseAdmin()
    .from("content_plans")
    .upsert({ studio_id: member.studio.id, post_days: [...new Set(days)].sort((a, b) => a - b), post_time: time }, { onConflict: "studio_id" });
  if (error) {
    console.warn("setPostingDays failed", error.message);
    return { ok: false, error: "Le réglage n’a pas été enregistré. Réessaie dans un instant." };
  }
  revalidatePath("/reglages");
  return { ok: true };
}
