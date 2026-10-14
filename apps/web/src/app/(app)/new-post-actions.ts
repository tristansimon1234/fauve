"use server";

import { postIdeas, type ReelInputs } from "@fauve/agent";
import { listInspirations, type InspirationItem } from "@/lib/inspirations";
import { loadMontageInputs } from "@/lib/render/render-post";
import { freeSlots, type Slot } from "@/lib/slots";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { listElements } from "@/lib/elements";
import type { BankElementView } from "@/components/montage/elements-panel";

// What the « Nouvelle publication » steps offer: free days to post on, the
// studio's photos and videos to pick from, its inspirations (Reels) and its
// component kits (carousels and photos).

export type { Slot } from "@/lib/slots";
export type LibraryItem = { id: string; url: string; video: boolean; at: string };
export type NewPostOptions = {
  studioId: string;
  timezone: string;
  slots: Slot[];
  media: LibraryItem[];
  inspirations: InspirationItem[];
  /** The studio's components, by kit (the inspiration they came from). */
  kits: { id: string; name: string; elements: BankElementView[] }[];
  brand: ReelInputs["brand"];
  /** One-tap ideas by format, for this kind of business. */
  ideas: Record<"reel" | "carousel" | "post" | "story", string[]>;
};

export async function newPostOptions(): Promise<NewPostOptions | null> {
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const now = new Date();

  const [slots, assets, inspirations, elements, inputs] = await Promise.all([
    freeSlots(studioId, tz, 4, now),
    db.from("media_assets").select("id, storage_path, kind, created_at").eq("studio_id", studioId).in("kind", ["image", "video"]).order("created_at", { ascending: false }).limit(40),
    listInspirations(studioId, 8),
    listElements(studioId, 60),
    loadMontageInputs(studioId, { segments: [] }),
  ]);
  const { data: studio } = await db.from("studios").select("business_type").eq("id", studioId).maybeSingle();

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
    kits: kitsFrom(elements),
    brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts },
    ideas: postIdeas(studio?.business_type as string | null),
  };
}

function kitsFrom(elements: Awaited<ReturnType<typeof listElements>>): NewPostOptions["kits"] {
  const kits = new Map<string, NewPostOptions["kits"][number]>();
  for (const e of elements) {
    const id = e.kitId ?? e.id;
    const kit = kits.get(id) ?? { id, name: e.kitName ?? e.name, elements: [] };
    const { id: eid, name, role, slots, js, fonts, base, box, sample, kitId, kitName } = e;
    kit.elements.push({ id: eid, name, role, slots, js, fonts, base, box, sample, kitId, kitName });
    kits.set(id, kit);
  }
  return [...kits.values()].slice(0, 9);
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
