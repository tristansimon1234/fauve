import "server-only";
import {
  brandColorsFromLook,
  CHAT_MODEL,
  findVoice,
  measuredTitles,
  pageFacts,
  pageFonts,
  pageMeasureSchema,
  snapPalette,
  withArtDirection,
  type BrandSignature,
  type PageMeasure,
  type SiteLookReading,
} from "@fauve/agent";
import sharp from "sharp";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { DEFAULT_TONE } from "@/app/(app)/style/style-profile";
import { readSiteImages } from "@/lib/agent/moodboard";
import { fetchPublicImage } from "@/lib/agent/website";
import { googleFont } from "@/lib/fonts";
import { pageInSandbox, screenshotInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The look of the studio's website, read once while it gets started, in two steps so she
// never waits long: first its photos land in her moodboard (a few seconds), then Edith
// reads the site as a visitor sees it: captures of its home page with what was measured
// on it (the fonts its titles and texts really use, the colours that fill it), and its
// photos. She writes its art direction and its signature (the same direction as settings
// every Reel applies), keeps the photos that show the business itself (its place, its
// work, its products, not its merch nor its press) for her media library, and gives each
// of its fonts that Google does not serve its closest free twin. Never over a moodboard
// the manager already made. A new site, or hers redone (`again`), is read once more: its photos
// replace the old site's in her moodboard, and its charter, signature and example replace the old
// site's; what she set by hand (colours, fonts, art direction) and her own moodboard stay.

/** Photos kept for her moodboard and her library; candidates shown to the reading. */
const MAX_PHOTOS = 6;
const MAX_LIBRARY = 8;
const MAX_CANDIDATES = 14;
const SITE_NOTE = "Photo de ton site";

/** A real photo: large enough, not a banner strip nor a sliver. */
async function toPhoto(bytes: Buffer): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (!meta?.width || !meta.height) return null;
  const ratio = meta.width / meta.height;
  if (Math.min(meta.width, meta.height) < 360 || ratio > 2.6 || ratio < 0.4) return null;
  // A logo or a graphic on a transparent background is not a photo (in JPEG its
  // background turns black); nor is a plain colour (a placeholder, a blank image).
  const stats = await sharp(bytes).stats().catch(() => null);
  if (!stats || (meta.hasAlpha && !stats.isOpaque)) return null;
  if (Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev)) < 12) return null;
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * The colours that fill a page, counted on its pixels: flat areas only (a pixel the same
 * colour as its right and lower neighbours), so the page's own colours count and a photo
 * hardly does. Close shades are merged; each share is of the whole page.
 */
export async function pageColors(jpeg: Buffer): Promise<{ color: string; share: number }[]> {
  const { data, info } = await sharp(jpeg).resize({ width: 320 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const key = (i: number) => ((data[i]! >> 3) << 10) | ((data[i + 1]! >> 3) << 5) | (data[i + 2]! >> 3);
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 3;
      const c = key(i);
      if (c !== key(i + 3) || c !== key(i + w * 3)) continue;
      const e = counts.get(c) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += data[i]!;
      e.g += data[i + 1]!;
      e.b += data[i + 2]!;
      counts.set(c, e);
    }
  }
  const merged: { r: number; g: number; b: number; n: number }[] = [];
  for (const e of [...counts.values()].sort((a, b) => b.n - a.n)) {
    const [r, g, b] = [e.r / e.n, e.g / e.n, e.b / e.n];
    const near = merged.find((m) => Math.hypot(m.r - r, m.g - g, m.b - b) < 26);
    if (near) near.n += e.n;
    else merged.push({ r, g, b, n: e.n });
  }
  const total = w * h;
  return merged
    .filter((m) => m.n / total >= 0.01)
    .slice(0, 8)
    .map((m) => ({ color: hex(m.r, m.g, m.b), share: Math.round((m.n / total) * 1000) / 1000 }));
}

type MoodItems = { items?: { note?: string; path?: string }[] } | undefined;

/** A site's page as a key: its host without « www. » and its path without the last slash (https://www.studio.fr/ = studio.fr). */
export function sitePage(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
const hersOwn = (moodboard: MoodItems) => (moodboard?.items ?? []).some((i) => i.note !== SITE_NOTE);
const smaller = (jpeg: Buffer, width: number) => sharp(jpeg).resize({ width, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
const key = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Its fonts as the business names them, and, for each one Google does not serve, the
 * twin the reading chose by looking at it (when Google serves that one).
 */
async function siteFonts(page: PageMeasure | null, reading: SiteLookReading): Promise<{ fonts: string[]; twins: Record<string, string> } | null> {
  const measured = page ? pageFonts(page) : { display: null, body: null };
  const roles = [
    { font: measured.display, twin: reading.fonts.display },
    { font: measured.body, twin: reading.fonts.body },
  ];
  if (!roles.some((r) => r.font)) return null;
  const fonts: string[] = [];
  const twins: Record<string, string> = {};
  for (const { font, twin } of roles) {
    if (!font) continue;
    const served = (await googleFont(font.raw)) ?? (await googleFont(font.name));
    const name = served ?? font.name;
    if (!fonts.includes(name)) fonts.push(name);
    if (!served) {
      const free = await googleFont(twin);
      if (free) twins[name] = free;
    }
  }
  return { fonts, twins };
}

export async function readSiteLook(studioId: string, pageUrl: string, imageUrls: string[], options: { again?: boolean } = {}): Promise<{ photos: number; reading: boolean }> {
  const db = supabaseAdmin();
  const started = Date.now();
  const [{ data: latest }, { data: studio }, { count: fromSite }] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("studios").select("name, business_type").eq("id", studioId).single(),
    db.from("media_assets").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("source", "website"),
  ]);
  const moodboard = (latest?.profile as { moodboard?: MoodItems } | null)?.moodboard;
  // Read once: her own moodboard wins, and a second reading of the same site adds nothing; a new site is read again.
  if (!options.again && ((moodboard?.items?.length ?? 0) > 0 || (fromSite ?? 0) > 0)) return { photos: 0, reading: false };
  // The old site's photos in her moodboard, replaced by the new one's (hers stay).
  const oldSite = (moodboard?.items ?? []).filter((i) => i.note === SITE_NOTE && i.path).map((i) => i.path!);

  // The page takes the longest (the sandbox's browser): it is read while the photos come in.
  const reading$ = pageInSandbox(`site-${studioId.slice(0, 8)}-${Date.now()}`, pageUrl).catch(() => null);
  const signal = AbortSignal.timeout(12_000);
  const downloads = await Promise.all(
    imageUrls.slice(0, 20).map((url) =>
      fetchPublicImage(url, signal)
        .then(toPhoto)
        .catch(() => null),
    ),
  );
  const photos = downloads.filter((p) => p !== null).slice(0, MAX_CANDIDATES);

  // Step 1: the first photos in her moodboard, at once (brand/, kept).
  const moodItem = async (photo: { jpeg: Buffer }) => {
    const path = `${studioId}/brand/mood-${key()}.jpg`;
    const { error } = await db.storage.from("media").upload(path, photo.jpeg, { contentType: "image/jpeg" });
    return error ? null : { path, note: SITE_NOTE };
  };
  // One slot per photo (null when its upload failed), so a photo finds its moodboard file again.
  const slots = await Promise.all(photos.slice(0, MAX_PHOTOS).map(moodItem));
  const first = slots.filter((i) => i !== null);
  if (first.length) {
    await insertProfileVersion(studioId, (profile) =>
      // She made her own moodboard meanwhile: hers wins.
      hersOwn((profile as { moodboard?: MoodItems }).moodboard) ? profile : { ...profile, moodboard: { items: first } },
    );
    if (options.again && oldSite.length && !hersOwn(moodboard)) await db.storage.from("media").remove(oldSite).catch(() => undefined);
  }
  const photosAt = Date.now() - started;

  // Step 2: the page as a visitor sees it, what was measured on it, and its photos.
  const page = await reading$;
  const measured = pageMeasureSchema.safeParse(page?.measured);
  const measures = measured.success ? measured.data : null;
  const capture = page?.capture ?? (await screenshotInSandbox(`site-${studioId.slice(0, 8)}-${Date.now()}`, pageUrl).catch(() => null));
  const pages = (
    await Promise.all([
      capture ? smaller(capture, 1000).catch(() => null) : null,
      page?.full ? sharp(page.full).resize({ width: 560, withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer().catch(() => null) : null,
    ])
  ).filter((p) => p !== null);
  const pixels = page?.full ? await pageColors(page.full).catch(() => []) : [];

  const name = (studio?.name as string | null) ?? "ce commerce";
  const business = (studio?.business_type as string | null) ?? null;
  let reading: SiteLookReading | null = null;
  if (pages.length || photos.length) {
    const fonts = measures ? pageFonts(measures) : { display: null, body: null };
    const intro = [
      `Le site de « ${name} »${business ? ` (${business})` : ""} : la gérante n'a pas encore fait de moodboard, son site est le meilleur indice de son style. Lis-en la direction artistique comme pour un moodboard (lumière, couleurs, typographie, cadrages, mise en page, ambiance) : ses Reels et ses visuels doivent lui ressembler au point qu'on reconnaisse son commerce sans voir son nom.`,
      measures ? `Mesuré sur sa page (des faits, pas des suppositions) :\n${pageFacts(measures, pixels)}` : "",
      "La palette de sa charte vient de ce qu'on voit : les couleurs mesurées, son logo, son enseigne et ce qui porte son nom ; la principale en premier (celle qui la signe, pas forcément la plus étendue) ; jamais la couleur d'un objet photographié par hasard (un plat, le vêtement d'un client, une fleur).",
      fonts.display
        ? `Ses polices sont celles mesurées : « ${fonts.display.raw} » pour les titres${fonts.body && fonts.body.raw !== fonts.display.raw ? `, « ${fonts.body.raw} » pour le texte` : ""}. Dans « fonts », donne pour chacune la famille Google Fonts qui lui ressemble le plus à l'œil (même largeur, mêmes formes, même contraste, avec ou sans empattements), ou la même si Google Fonts la sert. Décris dans ta lecture comment elles sont employées (graisse, capitales, espacement, taille).`
        : "",
      photos.length
        ? `Ses ${photos.length} photos suivent les captures. Dans « photos », garde celles qui montrent vraiment le commerce (son lieu, son travail, ses produits, son équipe, ses clients), les plus belles et les plus parlantes d'abord, ${MAX_LIBRARY} au plus : jamais un logo, une affiche, un article de presse, ni un objet dérivé (sweat, tote bag, casquette) qui n'est pas son métier.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      reading = await readSiteImages(studioId, intro, pages, await Promise.all(photos.map((p) => smaller(p.jpeg, 768))), CHAT_MODEL);
    } catch (error) {
      console.warn("site look reading failed", error);
    }
  }

  // Her media library: the photos that show the business (all of the first ones without a reading).
  const chosen = reading?.photos.length ? reading.photos.map((n) => photos[n - 1]!).filter(Boolean) : photos.slice(0, MAX_PHOTOS);
  for (const photo of chosen.slice(0, MAX_LIBRARY)) {
    const path = `${studioId}/site/site-${key()}.jpg`;
    const { error } = await db.storage.from("media").upload(path, photo.jpeg, { contentType: "image/jpeg" });
    if (error) continue;
    await db.from("media_assets").insert({
      studio_id: studioId,
      storage_path: path,
      kind: "image",
      source: "website",
      mime_type: "image/jpeg",
      size_bytes: photo.jpeg.length,
      width: photo.width,
      height: photo.height,
      consent_ok: true,
    });
  }
  console.info("site look timing", { studioId, photos: chosen.length, photosMs: photosAt, page: Boolean(page), measured: Boolean(measures), totalMs: Date.now() - started });
  if (!reading) return { photos: chosen.length, reading: false };

  // Her moodboard: the photos that show the business, in the reading's order.
  const keep = new Set(chosen.slice(0, MAX_PHOTOS));
  const items = (
    await Promise.all(
      chosen.slice(0, MAX_PHOTOS).map(async (photo) => {
        return slots[photos.indexOf(photo)] ?? (await moodItem(photo));
      }),
    )
  ).filter((i) => i !== null);
  const dropped = slots.flatMap((slot, i) => (slot && !keep.has(photos[i]!) ? [slot] : []));
  const fonts = await siteFonts(measures, reading);
  const seen = [...pixels, ...(measures?.areas ?? []), ...(measures?.texts ?? []), ...(measures?.buttons ?? [])].map((c) => c.color);
  const palette = snapPalette(reading.palette, seen);
  const signature: BrandSignature = measures ? { ...reading.signature, titles: measuredTitles(measures, reading.signature.titles) } : reading.signature;

  let saved = false;
  await insertProfileVersion(studioId, (profile) => {
    const current = (profile as { moodboard?: MoodItems & Record<string, unknown> }).moodboard;
    const own = hersOwn(current);
    // First reading: never over her own moodboard. A new site: its facts (charter, example) still replace the old site's.
    if (own && !options.again) return profile;
    saved = true;
    const p = profile as {
      fonts?: string[];
      tone?: string;
      art_direction?: string;
      art_direction_from?: string;
      charter_from?: string;
      font_twins?: Record<string, string>;
      voice?: { use?: string; voice_id?: string };
      site_read?: { direction?: string; tone?: string };
    };
    // The voice that sounds like it, unless she chose one (Style › Voix off).
    const narrator = findVoice(signature.narrator?.voice);
    // Colours and fonts she set by hand are hers; otherwise her site's palette becomes the brand's colours (the first is the accent).
    const byHand = p.charter_from === "hand";
    const colors = palette.length && !byHand ? brandColorsFromLook(palette) : null;
    const siteFonts = byHand ? null : fonts ? { fonts: fonts.fonts.slice(0, 2), font_twins: { ...(p.font_twins ?? {}), ...fonts.twins } } : p.fonts?.length && !options.again ? null : { fonts: [...new Set([reading.fonts.display, reading.fonts.body])] };
    // A new site replaces the art direction and the tone the old one wrote (her own moodboard's and hers stay).
    const fromOldSite = (value: string | undefined, written: string | undefined) => Boolean(options.again && value?.trim() && (written ? written === value : !own));
    const direction = p.art_direction_from !== "hand" && fromOldSite(p.art_direction, p.site_read?.direction) ? { ...profile, art_direction: reading.direction.slice(0, 600) } : withArtDirection(profile as { art_direction?: unknown }, reading.direction);
    const tone = fromOldSite(p.tone, p.site_read?.tone) || !p.tone?.trim() || p.tone === DEFAULT_TONE ? signature.voice : null;
    return {
      // Her « Direction artistique » too, when she has not written one.
      ...direction,
      ...(colors?.length ? { colors } : {}),
      // The fonts measured on her pages (their twins for the render), else the reading's look-alikes.
      ...(siteFonts ?? {}),
      // Her charter is her site's: a reading of her logo or images never rewrites it.
      ...(colors?.length || siteFonts ? { charter_from: "site" } : {}),
      // Her own moodboard keeps the settings it gave her.
      ...(own ? {} : { signature }),
      // A hook and a line in her words: her style shown on one of her photos at the Style step.
      style_sample: reading.sample,
      ...(p.voice?.voice_id || !narrator ? {} : { voice: { use: p.voice?.use ?? "auto", voice_id: narrator.id } }),
      // How it talks, read in its site's words, unless someone already said it.
      ...(tone ? { tone } : {}),
      site_read: { url: pageUrl.slice(0, 500), at: new Date().toISOString(), direction: reading.direction.slice(0, 600), ...(tone ? { tone: tone.slice(0, 300) } : {}) },
      ...(own ? {} : { moodboard: { ...(current ?? {}), items: items.length ? items : (current?.items ?? first), reading: reading.reading, palette: reading.palette, read_at: new Date().toISOString() } }),
    };
  });
  // The site's photos her moodboard no longer shows (they were not about the business).
  if (saved && dropped.length) await db.storage.from("media").remove(dropped.map((d) => d.path)).catch(() => undefined);
  return { photos: chosen.length, reading: true };
}
