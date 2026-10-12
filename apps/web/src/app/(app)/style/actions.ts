"use server";

import { revalidatePath } from "next/cache";
import { getStudioContext } from "@/lib/studio";
import { insertProfileVersion } from "./profile";
import { applyStyleForm, styleFormSchema } from "./style-profile";

export type SaveStyleResult = { status: "ok"; version: number } | { status: "error"; message: string };
export type SaveLogoResult = { status: "ok"; version: number; logoUrl: string | null } | { status: "error"; message: string };

const NO_STUDIO = "Ton numéro n’est relié à aucun studio.";
const FAILED = "L’enregistrement a échoué. Réessaie dans un instant.";

/** Saves the Style form as a new version of the studio's brand profile (the logo has its own action). */
export async function saveStyle(input: unknown): Promise<SaveStyleResult> {
  const parsed = styleFormSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Style invalide." };

  const { member } = await getStudioContext();
  if (!member) return { status: "error", message: NO_STUDIO };

  try {
    const { version } = await insertProfileVersion(member.studio.id, (current) => applyStyleForm(current, parsed.data));
    revalidatePath("/style");
    return { status: "ok", version };
  } catch (error) {
    console.warn("saveStyle failed", error);
    return { status: "error", message: FAILED };
  }
}

const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Sets the logo the browser just uploaded to `media` (or removes it with null),
 * as a new version of the brand profile. Removing also drops the logo found on
 * the website, so the Reels end on the studio name.
 */
export async function saveLogo(path: string | null): Promise<SaveLogoResult> {
  const { db, member } = await getStudioContext();
  if (!member) return { status: "error", message: NO_STUDIO };
  const studioId = member.studio.id;

  let logoUrl: string | null = null;
  if (path !== null) {
    const expected = new RegExp(`^${studioId}/brand/logo-\\d{10,16}\\.(png|svg|webp|jpg)$`);
    if (typeof path !== "string" || !expected.test(path)) return { status: "error", message: "Logo invalide." };
    // Signed with the member's own client (storage RLS): also proves the file exists.
    const signed = await db.storage.from("media").createSignedUrl(path, SIGNED_URL_SECONDS);
    if (signed.error || !signed.data) {
      return { status: "error", message: "Le logo n’a pas été trouvé. Dépose-le à nouveau." };
    }
    logoUrl = signed.data.signedUrl;
  }

  try {
    const { version } = await insertProfileVersion(studioId, (current) => {
      const next: Record<string, unknown> = { ...current };
      if (path) {
        next.logo_path = path;
      } else {
        delete next.logo_path;
        delete next.logo_url;
      }
      return next;
    });
    revalidatePath("/style");
    return { status: "ok", version, logoUrl };
  } catch (error) {
    console.warn("saveLogo failed", error);
    return { status: "error", message: FAILED };
  }
}
