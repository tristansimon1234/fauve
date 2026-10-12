"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";

const input = z.object({ id: z.uuid(), done: z.boolean() });

/** Ticks a shot off the "À filmer" list (or back on). */
export async function setShotDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  const parsed = input.safeParse({ id, done });
  if (!parsed.success) return { ok: false };

  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };

  const { data, error } = await db
    .from("shot_requests")
    .update({ done: parsed.data.done })
    .eq("id", parsed.data.id)
    .eq("studio_id", member.studio.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.warn("setShotDone failed", error.message);
    return { ok: false };
  }
  revalidatePath("/calendrier");
  revalidatePath("/fauve");
  return { ok: true };
}
