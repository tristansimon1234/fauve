import "server-only";
import { CREDIT_PRICES, MOODBOARD_MAX_ITEMS } from "@fauve/agent";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { readBrand, withBrandRead, type BrandRead } from "@/lib/brand-read";
import { chargeCredits, creditBalance } from "@/lib/credits";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Images the manager sent (WhatsApp, chat) added to her moodboard: copied to
// `{studio}/brand/` (the chat's files are deleted after a few days), then the
// whole moodboard is read again, with her logo (with no site, her charter starts from them).
// Free while she is getting started.

export async function addToMoodboard(studioId: string, mediaIds: string[], options: { free: boolean }): Promise<{ added: number; reading: string | null } | { error: string }> {
  const db = supabaseAdmin();
  const [{ data: assets }, { data: latest }] = await Promise.all([
    db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", mediaIds),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const images = (assets ?? []).filter((a) => a.kind === "image");
  if (!images.length) return { error: "Aucune image parmi ces fichiers (les vidéos ne vont pas dans le moodboard)." };
  const profile = latest?.profile as { moodboard?: { items?: { path: string; note?: string }[] }; logo_path?: string } | null;
  const current = (profile?.moodboard?.items ?? []).slice();
  const room = MOODBOARD_MAX_ITEMS - current.length;
  if (room <= 0) return { error: `Le moodboard est plein (${MOODBOARD_MAX_ITEMS} images) : elle peut en retirer dans Style.` };

  const added: { path: string; note?: string }[] = [];
  for (const asset of images.slice(0, room)) {
    const source = await jpegPath(studioId, asset.storage_path as string, (asset.mime_type as string | null) ?? null);
    const path = `${studioId}/brand/mood-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await db.storage.from("media").copy(source, path);
    if (!error) added.push({ path });
  }
  if (!added.length) return { error: "Les images n’ont pas pu être ajoutées." };
  const items = [...current, ...added];

  let read: BrandRead | null = null;
  if (options.free || (await creditBalance(studioId)) >= CREDIT_PRICES.moodboard) {
    try {
      read = await readBrand(studioId, { items, logoPath: profile?.logo_path ?? null });
      if (!options.free) await chargeCredits(studioId, CREDIT_PRICES.moodboard, "moodboard", "Lecture du moodboard", { images: items.length });
    } catch (error) {
      console.warn("moodboard reading failed", error);
    }
  }
  // Her moodboard is her art direction: its settings (signature) follow its reading, and her charter too while it is her images'.
  await insertProfileVersion(studioId, (current) => (read ? withBrandRead(current, read, items) : { ...current, moodboard: { ...(current.moodboard ?? {}), items } }));
  return { added: added.length, reading: read?.reading.reading ?? null };
}
