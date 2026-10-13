"use server";

import { savedLookSchema, type SavedLook } from "@fauve/agent";
import { getStudioContext } from "@/lib/studio";
import { keepTextLooks, loadTextLooks } from "@/lib/text-looks";

/** Keeps a text look made by hand in the studio's style, under a name. */
export async function saveTextLook(name: string, role: SavedLook["role"], look: unknown): Promise<{ ok: true; looks: SavedLook[] } | { ok: false }> {
  const parsed = savedLookSchema.safeParse({ name: name.trim().slice(0, 40), role, look });
  if (!parsed.success) return { ok: false };
  const { member } = await getStudioContext();
  if (!member) return { ok: false };
  await keepTextLooks(member.studio.id, [parsed.data]);
  return { ok: true, looks: await loadTextLooks(member.studio.id) };
}
