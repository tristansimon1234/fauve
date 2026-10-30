"use server";

import { cleanHandle } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { currentMember } from "@/lib/social/current-member";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her @ on Instagram and TikTok, typed in the app (onboarding, /connect, Réglages) instead of
// connecting the accounts (not offered, lib/social/connect.ts): her public numbers are read from it
// (lib/social/public-stats.ts). The same cleaning as Edith's update_onboarding; an empty field
// forgets that @. A changed @ is read again on the next cron pass.

export type HandlesState = { ok?: boolean; error?: string; instagram?: string | null; tiktok?: string | null };

export async function saveHandles(_: HandlesState, form: FormData): Promise<HandlesState> {
  const member = await currentMember();
  if (!member) return { error: "Ta session a expiré. Reconnecte-toi." };
  const update: Record<string, string | null> = {};
  for (const platform of ["instagram", "tiktok"] as const) {
    const raw = String(form.get(platform) ?? "").trim();
    if (!form.has(platform)) continue;
    if (!raw) {
      update[`${platform}_handle`] = null;
      continue;
    }
    const handle = cleanHandle(platform, raw);
    if (!handle) return { error: `« ${raw.slice(0, 40)} » n’est pas un @ ${platform === "instagram" ? "Instagram" : "TikTok"}. Écris ton nom de compte, ou colle le lien de ton profil.` };
    update[`${platform}_handle`] = handle;
  }
  if (!Object.keys(update).length) return { ok: true };
  const { error } = await supabaseAdmin()
    .from("studios")
    .update({ ...update, public_stats_at: null })
    .eq("id", member.studio_id);
  if (error) return { error: "Je n’ai pas pu l’enregistrer. Réessaie dans un instant." };
  revalidatePath("/", "layout");
  return { ok: true, instagram: update.instagram_handle, tiktok: update.tiktok_handle };
}
