"use server";

import { platformSchema, tiktokSettingsSchema } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Where a post goes (Instagram, TikTok or both) and her choices for TikTok.

export async function setPlatforms(postId: string, platforms: string[]): Promise<{ ok: boolean }> {
  const parsed = z.array(platformSchema).min(1).max(2).safeParse([...new Set(platforms)]);
  if (!z.uuid().safeParse(postId).success || !parsed.success) return { ok: false };
  const { member } = await getStudioContext();
  if (!member) return { ok: false };
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ platforms: parsed.data })
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath(`/publications/${postId}`);
  revalidatePath("/calendrier");
  return { ok: true };
}

export async function setTikTokSettings(postId: string, settings: unknown): Promise<{ ok: boolean }> {
  const parsed = tiktokSettingsSchema.safeParse(settings);
  if (!z.uuid().safeParse(postId).success || !parsed.success) return { ok: false };
  const { member } = await getStudioContext();
  if (!member) return { ok: false };
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ tiktok: parsed.data })
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath(`/publications/${postId}`);
  return { ok: true };
}
