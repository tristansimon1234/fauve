import "server-only";
import { brandColorsFromLook, findVoice, imagesOwnCharter, logoColors, snapPalette, withArtDirection, type BrandLookReading, type LogoColor } from "@fauve/agent";
import sharp from "sharp";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { readBrandImages } from "@/lib/agent/moodboard";
import { googleFont } from "@/lib/fonts";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her brand read from what she shows (Tristan: « si le gars a pas de site… il peut envoyer son logo
// et on crée sa DA à partir de ça ») : her logo first, its colours measured on its pixels, then her
// moodboard's images, or an ambiance she picked. One reading writes her art direction and its
// settings (signature) and, while her charter is neither her site's nor set by her hand
// (imagesOwnCharter), its colours (her logo's first), its fonts (the Google families closest to her
// logo's lettering) and an example in her words for the Style step. Her site, when she has one, is
// read by site-look.ts.

export type MoodItem = { path: string; note?: string };
export type BrandRead = { reading: BrandLookReading; colors: string[]; fonts: string[] };

/** On a mid grey, a white logo and a black one both show (as when its letters are read, logo-tone.ts). */
const LOGO_GREY = "#8c8c8c";

async function logoImage(path: string): Promise<{ jpeg: Buffer; colors: LogoColor[] } | null> {
  const { data } = await supabaseAdmin().storage.from("media").download(path);
  if (!data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  // A vector logo is drawn sharp.
  const raw = await sharp(bytes, { density: 200 }).ensureAlpha().resize(160, 160, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const jpeg = await sharp(bytes, { density: 200 }).resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: LOGO_GREY }).jpeg({ quality: 88 }).toBuffer();
  return { jpeg, colors: logoColors(raw.data, raw.info.width, raw.info.height) };
}

const percent = (share: number) => `${Math.round(share * 100)} %`;

/** Reads her brand from her logo, her images and an ambiance; null when there is nothing to read. Throws when the reading fails. */
export async function readBrand(studioId: string, input: { items: MoodItem[]; logoPath?: string | null; ambiance?: string | null }): Promise<BrandRead | null> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("name, business_type, website_url").eq("id", studioId).single();
  const logo = input.logoPath ? await logoImage(input.logoPath).catch((error: unknown) => (console.warn("brand read: logo unreadable", error), null)) : null;
  const signed = input.items.length ? ((await db.storage.from("media").createSignedUrls(input.items.map((i) => i.path), 3600)).data ?? []) : [];
  const images = input.items.flatMap((item, i) => {
    const url = signed[i]?.signedUrl;
    return url ? [{ url, note: item.note, label: `Image ${i + 1} de son moodboard${item.note ? ` — sa note : ${item.note}` : ""}` }] : [];
  });
  const ambiance = input.ambiance?.trim() || null;
  if (!logo && !images.length && !ambiance) return null;

  const name = (studio?.name as string | null) ?? "ce commerce";
  const business = (studio?.business_type as string | null) ?? null;
  const drawn = logo?.colors ?? [];
  const intro = [
    `« ${name} »${business ? ` (${business})` : ""}.${studio?.website_url ? "" : " Pas de site : sa charte (couleurs, polices, façon d'écrire ses titres) vient de ce qui suit, et ses Reels doivent lui ressembler au point qu'on reconnaisse son commerce sans voir son nom."}`,
    logo
      ? [
          "La première image est son logo (posé sur un gris neutre pour qu'on le voie, ce gris n'est pas à lui).",
          drawn.length ? `Couleurs mesurées sur ses pixels (des faits) : ${drawn.map((c) => `${c.color} (${percent(c.share)}${c.background ? ", son fond" : ""})`).join(", ")}.` : "",
          "La palette part de ses couleurs, la principale en premier (celle qui le signe), complétée par celles des images si elles en apportent. S'il porte des lettres, la police des titres est la famille Google Fonts qui ressemble le plus à son lettrage (structure, largeur, graisse, empattements, contraste) ; celle du texte, une famille sobre qui va avec. Sans lettres, celles que son dessin appelle.",
        ]
          .filter(Boolean)
          .join(" ")
      : "",
    images.length ? `${logo ? "Puis son moodboard" : "Son moodboard"} : ${images.length} image${images.length > 1 ? "s" : ""} de ce qu'elle aime ou de son commerce, avec ses notes.` : "",
    ambiance ? `L'ambiance qu'elle a choisie, avec ses mots : ${ambiance}. ${images.length || logo ? "Elle passe avant les images pour l'atmosphère." : "C'est tout ce qu'on a : déduis-en une direction juste pour son métier, sa palette et ses polices."}` : "",
    "Dans « sample », une accroche et une phrase comme elle parlerait de son commerce : rien d'inventé (ni prix, ni adresse, ni horaire).",
  ]
    .filter(Boolean)
    .join("\n\n");

  const reading = await readBrandImages(studioId, intro, [...(logo ? [{ jpeg: logo.jpeg, label: "Son logo" }] : []), ...images]);
  // Her palette as her logo draws it (a colour the reading names close to one measured on it takes that one).
  const colors = brandColorsFromLook(snapPalette(reading.palette, drawn.map((c) => c.color)));
  const fonts = (await Promise.all([reading.fonts.display, reading.fonts.body].map((f) => googleFont(f).catch(() => null)))).filter((f): f is string => Boolean(f));
  return { reading, colors, fonts: [...new Set(fonts)] };
}

type Profile = Record<string, unknown> & {
  colors?: string[];
  fonts?: string[];
  style_sample?: unknown;
  voice?: { use?: string; voice_id?: string };
  moodboard?: { items?: MoodItem[] } & Record<string, unknown>;
};

/**
 * What a reading writes on her profile: her art direction (when she has not written one), its
 * settings, the voice that sounds like it (unless she chose one), her moodboard's reading; and her
 * colours, fonts and example while her logo and images own her charter (charter_from « images »).
 */
export function withBrandRead(current: Record<string, unknown>, read: BrandRead, items?: MoodItem[]): Record<string, unknown> {
  const profile = current as Profile;
  const { reading } = read;
  const owns = imagesOwnCharter(profile);
  const colors = owns.colors && read.colors.length ? read.colors : null;
  const fonts = owns.fonts && read.fonts.length ? read.fonts : null;
  const narrator = findVoice(reading.signature.narrator.voice);
  // An older reading kept its fonts here, where nothing read them.
  const moodboard: Record<string, unknown> = { ...(profile.moodboard ?? {}) };
  delete moodboard.fonts;
  return {
    ...withArtDirection(current as { art_direction?: unknown } & Record<string, unknown>, reading.direction),
    signature: reading.signature,
    ...(colors ? { colors } : {}),
    ...(fonts ? { fonts } : {}),
    // Her example in her words: the one this reading wrote when it made her charter, else hers stays.
    ...(colors || fonts ? { charter_from: "images", style_sample: reading.sample } : profile.style_sample ? {} : { style_sample: reading.sample }),
    ...(profile.voice?.voice_id || !narrator ? {} : { voice: { use: profile.voice?.use ?? "auto", voice_id: narrator.id } }),
    moodboard: { ...moodboard, items: items ?? profile.moodboard?.items ?? [], reading: reading.reading, palette: reading.palette, read_at: new Date().toISOString() },
  };
}

/** Whether a reading of her logo and images may still make her charter (neither her site's nor her hand's). */
export const charterFromImages = (profile: Record<string, unknown>) => {
  const owns = imagesOwnCharter(profile as Profile);
  return owns.colors || owns.fonts;
};

/**
 * Reads her brand again from her logo and her moodboard as they are now (and an ambiance she just
 * picked, kept in visual_notes), and keeps it as a new version of her profile. Called while she gets
 * started (free), when her logo or her ambiance arrives; null when there is nothing to read.
 */
export async function rereadBrand(studioId: string, ambiance?: string | null): Promise<BrandRead | null> {
  const { data: latest } = await supabaseAdmin().from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle();
  const profile = (latest?.profile ?? {}) as Profile & { logo_path?: string; visual_notes?: string };
  const read = await readBrand(studioId, { items: profile.moodboard?.items ?? [], logoPath: profile.logo_path ?? null, ambiance: ambiance ?? profile.visual_notes ?? null });
  if (!read) return null;
  await insertProfileVersion(studioId, (current) => withBrandRead(ambiance ? { ...current, visual_notes: ambiance } : current, read));
  return read;
}
