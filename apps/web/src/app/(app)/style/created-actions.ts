"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DeleteResult } from "@/components/delete-button";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { insertProfileVersion } from "./profile";

// What Edith made for the studio, in « Ton style »: an animation she no longer wants to
// see again, a saved text style she no longer wants.

/** Takes an animated scene out of the studio's library (the publications made with it do not change). */
export async function archiveAnimation(id: string): Promise<DeleteResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Animation introuvable." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const { error } = await supabaseAdmin()
    .from("motion_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("studio_id", member.studio.id);
  if (error) return { ok: false, error: "Le retrait n’a pas abouti. Réessaie dans un instant." };
  revalidatePath("/style");
  return { ok: true };
}

/** Removes one of the studio's saved text styles (a new version of its brand profile). */
export async function removeTextStyle(name: string): Promise<DeleteResult> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  try {
    await insertProfileVersion(member.studio.id, (current) => {
      const looks = Array.isArray(current.text_looks) ? (current.text_looks as { name?: string }[]) : [];
      return { ...current, text_looks: looks.filter((l) => l.name !== name) };
    });
    revalidatePath("/style");
    return { ok: true };
  } catch {
    return { ok: false, error: "Le style n’a pas pu être retiré. Réessaie." };
  }
}
