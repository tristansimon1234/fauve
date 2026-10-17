import "server-only";
import { CREDIT_PRICES, findVoice, MOODBOARD_MAX_ITEMS, withArtDirection, type MoodboardReading } from "@fauve/agent";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { readMoodboard } from "@/lib/agent/moodboard";
import { chargeCredits, creditBalance } from "@/lib/credits";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Images the manager sent (WhatsApp, chat) added to her moodboard: copied to
// `{studio}/brand/` (the chat's files are deleted after a few days), then the
// whole moodboard is read again. Free while she is getting started.

export async function addToMoodboard(studioId: string, mediaIds: string[], options: { free: boolean }): Promise<{ added: number; reading: string | null } | { error: string }> {
  const db = supabaseAdmin();
  const [{ data: assets }, { data: latest }, { data: studio }] = await Promise.all([
    db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", mediaIds),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("studios").select("name").eq("id", studioId).single(),
  ]);
  const images = (assets ?? []).filter((a) => a.kind === "image");
  if (!images.length) return { error: "Aucune image parmi ces fichiers (les vidéos ne vont pas dans le moodboard)." };
  const current = ((latest?.profile as { moodboard?: { items?: { path: string; note?: string }[] } } | null)?.moodboard?.items ?? []).slice();
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

  let reading: MoodboardReading | null = null;
  if (options.free || (await creditBalance(studioId)) >= CREDIT_PRICES.moodboard) {
    const signed = await db.storage.from("media").createSignedUrls(items.map((i) => i.path), 3600);
    const urls = (signed.data ?? []).flatMap((s, i) => (s.signedUrl ? [{ url: s.signedUrl, note: items[i]?.note }] : []));
    try {
      reading = await readMoodboard(studioId, (studio?.name as string | null) ?? "Ton commerce", urls);
      if (!options.free) await chargeCredits(studioId, CREDIT_PRICES.moodboard, "moodboard", "Lecture du moodboard", { images: items.length });
    } catch (error) {
      console.warn("moodboard reading failed", error);
    }
  }
  await insertProfileVersion(studioId, (profile) => ({
    ...withArtDirection(profile as { art_direction?: unknown }, reading?.direction),
    // Her moodboard is her art direction: its settings (signature) follow its reading.
    ...(reading
      ? {
          signature: reading.signature,
          // The voice that sounds like it, unless she chose one.
          ...((profile as { voice?: { voice_id?: string } }).voice?.voice_id || !findVoice(reading.signature.narrator.voice)
            ? {}
            : { voice: { use: (profile as { voice?: { use?: string } }).voice?.use ?? "auto", voice_id: findVoice(reading.signature.narrator.voice)!.id } }),
        }
      : {}),
    moodboard: { items, ...(reading ? { reading: reading.reading, palette: reading.palette, read_at: new Date().toISOString() } : {}) },
  }));
  return { added: added.length, reading: reading?.reading ?? null };
}
