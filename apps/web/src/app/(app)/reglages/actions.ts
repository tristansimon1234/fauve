"use server";

import { createLinkCode } from "@/lib/instagram-dm";
import { getStudioContext } from "@/lib/studio";

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
