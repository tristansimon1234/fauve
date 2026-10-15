"use server";

import { photoEditFrom, type PhotoEdit } from "@fauve/agent";
import { z } from "zod";
import { getStudioContext } from "@/lib/studio";
import { photoRegions } from "@/lib/video/regions";

// The carousel editors' retouch switches: Gemini reads the photo once (cached on
// the media), and the edit comes back to the page, which shows it live and saves
// it with the rest. A Reel's clips are blurred by Simone (blur_video).

type Result<T> = { ok: true; value: T; note?: string } | { ok: false; error: string };

export async function photoRetouch(mediaId: string, options: { light: boolean; faces: boolean }): Promise<Result<PhotoEdit | null>> {
  if (!z.uuid().safeParse(mediaId).success) return { ok: false, error: "Photo introuvable." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  if (!options.light && !options.faces) return { ok: true, value: null };
  try {
    const regions = await photoRegions(member.studio.id, mediaId);
    const edit = photoEditFrom(regions.detection, { width: regions.width, height: regions.height }, { retouch: options.light, blur: options.faces ? ["face"] : [] });
    const faces = edit.blur?.length ?? 0;
    return { ok: true, value: edit, note: options.faces ? (faces ? `${faces} visage${faces > 1 ? "s" : ""} flouté${faces > 1 ? "s" : ""}` : "Aucun visage repéré") : undefined };
  } catch {
    return { ok: false, error: "Simone n’a pas pu regarder cette photo. Réessaie dans un instant." };
  }
}
