"use server";

import { type ReelInputs } from "@fauve/agent";
import { listInspirations, type InspirationItem } from "@/lib/inspirations";
import { loadMontageInputs } from "@/lib/render/render-post";
import { freeSlots, type Slot } from "@/lib/slots";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { layoutsForEditor } from "@/lib/text-layers";

// What the « Nouvelle publication » steps offer: free days to post on, the
// studio's photos and videos to pick from, its inspirations and text layouts.

export type { Slot } from "@/lib/slots";
export type LibraryItem = { id: string; url: string; video: boolean; at: string };
export type NewPostOptions = {
  studioId: string;
  timezone: string;
  slots: Slot[];
  media: LibraryItem[];
  inspirations: InspirationItem[];
  layouts: Awaited<ReturnType<typeof layoutsForEditor>>;
  brand: ReelInputs["brand"];
};

export async function newPostOptions(): Promise<NewPostOptions | null> {
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const now = new Date();

  const [slots, assets, inspirations, layouts, inputs] = await Promise.all([
    freeSlots(studioId, tz, 4, now),
    db.from("media_assets").select("id, storage_path, kind, created_at").eq("studio_id", studioId).in("kind", ["image", "video"]).order("created_at", { ascending: false }).limit(40),
    listInspirations(studioId, 8),
    layoutsForEditor(studioId, 9),
    loadMontageInputs(studioId, { segments: [] }),
  ]);

  const media = (assets.data ?? []).map((a) => ({ id: a.id as string, path: a.storage_path as string, video: a.kind === "video", at: a.created_at as string }));
  const urls = await signMediaUrls(db, studioId, media.map((m) => m.path));
  return {
    studioId,
    timezone: tz,
    slots,
    media: media.flatMap((m) => {
      const url = urls.get(m.path);
      return url ? [{ id: m.id, url, video: m.video, at: m.at }] : [];
    }),
    inspirations,
    layouts,
    brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, customFonts: inputs.customFonts },
  };
}

/** The studio's recent photos and/or videos, for the picker Fauve shows in the chat (reply_with pick_media). */
export async function libraryForPicker(kind: "photo" | "video" | "any"): Promise<LibraryItem[]> {
  const { db, member } = await getStudioContext();
  if (!member) return [];
  const studioId = member.studio.id;
  const kinds = kind === "photo" ? ["image"] : kind === "video" ? ["video"] : ["image", "video"];
  const { data } = await db.from("media_assets").select("id, storage_path, kind, created_at").eq("studio_id", studioId).in("kind", kinds).order("created_at", { ascending: false }).limit(24);
  const media = (data ?? []).map((a) => ({ id: a.id as string, path: a.storage_path as string, video: a.kind === "video", at: a.created_at as string }));
  const urls = await signMediaUrls(db, studioId, media.map((m) => m.path));
  return media.flatMap((m) => {
    const url = urls.get(m.path);
    return url ? [{ id: m.id, url, video: m.video, at: m.at }] : [];
  });
}
