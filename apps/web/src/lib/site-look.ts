import "server-only";
import { brandColorsFromLook, CHAT_MODEL } from "@fauve/agent";
import sharp from "sharp";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { readMoodboard } from "@/lib/agent/moodboard";
import { fetchPublicImage } from "@/lib/agent/website";
import { screenshotInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The look of the studio's website, read once while it gets started: its best
// photos go into the moodboard, and Brigitte reads them with a capture of the
// home page (light, colours, typography, layout, mood). The montage then follows
// that reading. Never over a moodboard the manager already made.

/** Photos kept from the site. */
const MAX_PHOTOS = 6;

/** A real photo: large enough, not a banner strip nor a sliver. */
async function toPhoto(bytes: Buffer): Promise<Buffer | null> {
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (!meta?.width || !meta.height) return null;
  const ratio = meta.width / meta.height;
  if (Math.min(meta.width, meta.height) < 360 || ratio > 2.6 || ratio < 0.4) return null;
  return sharp(bytes).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
}

export async function readSiteLook(studioId: string, pageUrl: string, imageUrls: string[]): Promise<{ photos: number; reading: boolean }> {
  const db = supabaseAdmin();
  const [{ data: latest }, { data: studio }] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("studios").select("name, business_type").eq("id", studioId).single(),
  ]);
  const existing = (latest?.profile as { moodboard?: { items?: unknown[] } } | null)?.moodboard?.items ?? [];
  if (existing.length) return { photos: 0, reading: false };

  const signal = AbortSignal.timeout(20_000);
  const [capture, ...downloads] = await Promise.all([
    screenshotInSandbox(`site-${studioId.slice(0, 8)}-${Date.now()}`, pageUrl).catch(() => null),
    ...imageUrls.slice(0, 10).map((url) =>
      fetchPublicImage(url, signal)
        .then(toPhoto)
        .catch(() => null),
    ),
  ]);
  const photos = downloads.filter((p): p is Buffer => Boolean(p)).slice(0, MAX_PHOTOS);
  if (!photos.length && !capture) return { photos: 0, reading: false };

  const items: { path: string; note: string }[] = [];
  for (const photo of photos) {
    const path = `${studioId}/brand/mood-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await db.storage.from("media").upload(path, photo, { contentType: "image/jpeg" });
    if (!error) items.push({ path, note: "Photo de ton site" });
  }

  // The capture is read, never kept: it is a page, not an image she likes.
  const page = capture ? await sharp(capture).resize({ width: 1000 }).jpeg({ quality: 80 }).toBuffer().catch(() => null) : null;
  const name = (studio?.name as string | null) ?? "ce commerce";
  const business = (studio?.business_type as string | null) ?? null;
  let reading: { reading: string; palette: string[] } | null = null;
  try {
    reading = await readMoodboard(
      studioId,
      name,
      [
        ...(page ? [{ jpeg: page, note: "capture de la page d'accueil de son site, telle qu'un visiteur la voit (mise en page, typographie, couleurs)" }] : []),
        ...photos.map((jpeg) => ({ jpeg, note: "photo de son site" })),
      ],
      {
        model: CHAT_MODEL,
        intro: `Le site de « ${name} »${business ? ` (${business})` : ""} : la gérante n'a pas encore fait de moodboard, son site est le meilleur indice de son style. Lis-en la direction artistique comme pour un moodboard (lumière, couleurs, typographie, cadrages, mise en page, ambiance), pour que ses Reels et ses visuels lui ressemblent.`,
      },
    );
  } catch (error) {
    console.warn("site look reading failed", error);
  }
  if (!items.length && !reading) return { photos: 0, reading: false };

  await insertProfileVersion(studioId, (profile) => {
    const current = (profile as { moodboard?: { items?: unknown[] } }).moodboard;
    // She made her own moodboard meanwhile: hers wins.
    if (current?.items?.length) return profile;
    // What she sees on her site beats the CSS: its palette becomes the brand's colours (the first is the accent).
    const colors = reading?.palette.length ? brandColorsFromLook(reading.palette) : null;
    return {
      ...profile,
      ...(colors?.length ? { colors } : {}),
      moodboard: { items, ...(reading ? { ...reading, read_at: new Date().toISOString() } : {}) },
    };
  });
  return { photos: items.length, reading: Boolean(reading) };
}
