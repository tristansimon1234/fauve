import "server-only";
import { brandColorsFromLook, CHAT_MODEL } from "@fauve/agent";
import sharp from "sharp";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { readMoodboard } from "@/lib/agent/moodboard";
import { fetchPublicImage } from "@/lib/agent/website";
import { screenshotInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The look of the studio's website, read once while it gets started, in two steps
// so she never waits long: first its best photos land in her moodboard and her
// media library (a few seconds; she can make her first post with them), then
// Brigitte reads them with a capture of the home page (light, colours, typography,
// layout, mood) and the montage follows that reading. Never over a moodboard the
// manager already made.

/** Photos kept from the site. */
const MAX_PHOTOS = 6;
const SITE_NOTE = "Photo de ton site";

/** A real photo: large enough, not a banner strip nor a sliver. */
async function toPhoto(bytes: Buffer): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (!meta?.width || !meta.height) return null;
  const ratio = meta.width / meta.height;
  if (Math.min(meta.width, meta.height) < 360 || ratio > 2.6 || ratio < 0.4) return null;
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

type MoodItems = { items?: { note?: string }[] } | undefined;
const hersOwn = (moodboard: MoodItems) => (moodboard?.items ?? []).some((i) => i.note !== SITE_NOTE);

export async function readSiteLook(studioId: string, pageUrl: string, imageUrls: string[]): Promise<{ photos: number; reading: boolean }> {
  const db = supabaseAdmin();
  const started = Date.now();
  const [{ data: latest }, { data: studio }, { count: fromSite }] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("studios").select("name, business_type").eq("id", studioId).single(),
    db.from("media_assets").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("source", "website"),
  ]);
  const moodboard = (latest?.profile as { moodboard?: MoodItems } | null)?.moodboard;
  // Read once: her own moodboard wins, and a second reading of the same site adds nothing.
  if ((moodboard?.items?.length ?? 0) > 0 || (fromSite ?? 0) > 0) return { photos: 0, reading: false };

  // The capture takes the longest (the sandbox's browser): it runs while the photos come in.
  const capturing = screenshotInSandbox(`site-${studioId.slice(0, 8)}-${Date.now()}`, pageUrl).catch(() => null);
  const signal = AbortSignal.timeout(12_000);
  const downloads = await Promise.all(
    imageUrls.slice(0, 10).map((url) =>
      fetchPublicImage(url, signal)
        .then(toPhoto)
        .catch(() => null),
    ),
  );
  const photos = downloads.filter((p) => p !== null).slice(0, MAX_PHOTOS);

  // Step 1: the photos, at once. In her moodboard (brand/) and her media library
  // (site/, a copy: the library's files expire, the moodboard's stay).
  const items: { path: string; note: string }[] = [];
  for (const photo of photos) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mood = `${studioId}/brand/mood-${key}.jpg`;
    const media = `${studioId}/site/site-${key}.jpg`;
    const [a, b] = await Promise.all([
      db.storage.from("media").upload(mood, photo.jpeg, { contentType: "image/jpeg" }),
      db.storage.from("media").upload(media, photo.jpeg, { contentType: "image/jpeg" }),
    ]);
    if (!a.error) items.push({ path: mood, note: SITE_NOTE });
    if (!b.error) {
      await db.from("media_assets").insert({
        studio_id: studioId,
        storage_path: media,
        kind: "image",
        source: "website",
        mime_type: "image/jpeg",
        size_bytes: photo.jpeg.length,
        width: photo.width,
        height: photo.height,
        consent_ok: true,
      });
    }
  }
  if (items.length) {
    await insertProfileVersion(studioId, (profile) =>
      // She made her own moodboard meanwhile: hers wins.
      hersOwn((profile as { moodboard?: MoodItems }).moodboard) ? profile : { ...profile, moodboard: { items } },
    );
  }
  const photosAt = Date.now() - started;

  // Step 2: the reading (capture + photos), then her colours as seen on the page.
  const capture = await capturing;
  const page = capture ? await sharp(capture).resize({ width: 1000 }).jpeg({ quality: 80 }).toBuffer().catch(() => null) : null;
  if (!photos.length && !page) return { photos: 0, reading: false };
  const name = (studio?.name as string | null) ?? "ce commerce";
  // Her site's fonts, as saved from its CSS by now (read_website): the reading names them, not look-alikes.
  const { data: current } = await db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle();
  const siteFonts = ((current?.profile as { fonts?: unknown } | null)?.fonts as string[] | undefined)?.filter((f) => typeof f === "string").slice(0, 3) ?? [];
  const business = (studio?.business_type as string | null) ?? null;
  let reading: { reading: string; palette: string[]; fonts?: { display: string; body: string } } | null = null;
  try {
    reading = await readMoodboard(
      studioId,
      name,
      [
        ...(page ? [{ jpeg: page, note: "capture de la page d'accueil de son site, telle qu'un visiteur la voit (mise en page, typographie, couleurs)" }] : []),
        ...photos.map((p) => ({ jpeg: p.jpeg, note: "photo de son site" })),
      ],
      {
        model: CHAT_MODEL,
        intro: `Le site de « ${name} »${business ? ` (${business})` : ""} : la gérante n'a pas encore fait de moodboard, son site est le meilleur indice de son style. Lis-en la direction artistique comme pour un moodboard (lumière, couleurs, typographie, cadrages, mise en page, ambiance), pour que ses Reels et ses visuels lui ressemblent.${siteFonts.length ? ` Les polices de son site sont ${siteFonts.join(", ")} : ce sont elles que ses visuels utilisent ; pour la typographie, décris comment elles sont employées (graisse, capitales, espacement, taille) sans proposer d'autres polices.` : ""}`,
      },
    );
  } catch (error) {
    console.warn("site look reading failed", error);
  }
  console.info("site look timing", { studioId, photos: items.length, photosMs: photosAt, capture: Boolean(page), totalMs: Date.now() - started });
  if (!reading) return { photos: items.length, reading: false };

  await insertProfileVersion(studioId, (profile) => {
    const current = (profile as { moodboard?: MoodItems & Record<string, unknown> }).moodboard;
    if (hersOwn(current)) return profile;
    // What she sees on her site beats the CSS: its palette becomes the brand's colours (the first is the accent).
    const colors = reading.palette.length ? brandColorsFromLook(reading.palette) : null;
    // Her fonts: the ones found in the site's CSS, else the closest Google fonts to what the reading saw.
    const known = (profile as { fonts?: string[] }).fonts;
    const fonts = known?.length ? null : reading.fonts ? [...new Set([reading.fonts.display, reading.fonts.body])] : null;
    const look = { reading: reading.reading, palette: reading.palette };
    return {
      ...profile,
      ...(colors?.length ? { colors } : {}),
      ...(fonts?.length ? { fonts } : {}),
      moodboard: { ...(current ?? {}), items: current?.items ?? items, ...look, read_at: new Date().toISOString() },
    };
  });
  return { photos: items.length, reading: true };
}
