"use server";

import { CREDIT_PRICES, findVoice, MOODBOARD_MAX_ITEMS, onboardingStepOf, withArtDirection, type MoodboardReading } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readMoodboard } from "@/lib/agent/moodboard";
import { chargeCredits, creditBalance } from "@/lib/credits";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { insertProfileVersion } from "./profile";
import { MOODBOARD_NOTE_MAX } from "./style-options";
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

export type SaveMoodboardResult =
  | { status: "ok"; version: number; reading: string | null; palette: string[]; warning?: string }
  | { status: "error"; message: string };

const moodboardInput = z
  .array(z.object({ path: z.string().max(300), note: z.string().trim().max(MOODBOARD_NOTE_MAX).optional() }))
  .max(MOODBOARD_MAX_ITEMS, `${MOODBOARD_MAX_ITEMS} images au maximum.`);

/**
 * Saves the moodboard (images the browser uploaded to `media` + notes) as a new
 * version of the brand profile, with Fauve's reading of it. An empty list
 * removes the moodboard.
 */
export async function saveMoodboard(input: unknown): Promise<SaveMoodboardResult> {
  const parsed = moodboardInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Moodboard invalide." };
  const { db, member } = await getStudioContext();
  if (!member) return { status: "error", message: NO_STUDIO };
  const studioId = member.studio.id;

  const items = parsed.data.map((item) => ({ path: item.path, ...(item.note ? { note: item.note } : {}) }));
  const expected = new RegExp(`^${studioId}/brand/mood-\\d{10,16}-[a-z0-9]{4,12}\\.jpg$`);
  if (items.some((item) => !expected.test(item.path))) return { status: "error", message: "Image invalide." };

  let reading: MoodboardReading | null = null;
  let warning: string | undefined;
  if (items.length) {
    // Signed with the member's own client (storage RLS): also proves the files exist.
    const signed = await db.storage.from("media").createSignedUrls(
      items.map((item) => item.path),
      SIGNED_URL_SECONDS,
    );
    const urls = new Map((signed.data ?? []).flatMap((s) => (s.path && s.signedUrl && !s.error ? [[s.path, s.signedUrl] as const] : [])));
    if (signed.error || items.some((item) => !urls.has(item.path))) {
      return { status: "error", message: "Une image n’a pas été trouvée. Dépose-la à nouveau." };
    }
    // Free while she is getting started (the moodboard is a step of it).
    const { data: studio } = await supabaseAdmin().from("studios").select("onboarding_step").eq("id", studioId).single();
    const free = onboardingStepOf(studio?.onboarding_step) !== "done";
    if (!free && (await creditBalance(studioId)) < CREDIT_PRICES.moodboard) {
      return { status: "error", message: "Plus assez de crédits pour la lecture du moodboard (1 crédit). Ton solde remonte le 1er du mois." };
    }
    try {
      reading = await readMoodboard(
        studioId,
        member.studio.name ?? "Ton studio",
        items.map((item) => ({ url: urls.get(item.path)!, note: item.note })),
      );
      if (!free) await chargeCredits(studioId, CREDIT_PRICES.moodboard, "moodboard", "Lecture du moodboard", { images: items.length });
    } catch (error) {
      console.warn("moodboard reading failed", error);
      warning = "Moodboard enregistré, mais Simone n’a pas pu le lire. Réessaie dans un instant.";
    }
  }

  try {
    const { version } = await insertProfileVersion(studioId, (current) => {
      const next: Record<string, unknown> = withArtDirection({ ...current } as Record<string, unknown>, reading?.direction);
      // Her moodboard is her art direction: its settings (signature) follow its reading.
      if (reading) {
        next.signature = reading.signature;
        // The voice that sounds like it, unless she chose one.
        const voice = (next.voice ?? {}) as { use?: string; voice_id?: string };
        const narrator = findVoice(reading.signature.narrator.voice);
        if (!voice.voice_id && narrator) next.voice = { use: voice.use ?? "auto", voice_id: narrator.id };
      }
      if (!items.length) delete next.moodboard;
      else next.moodboard = { items, ...(reading ? { reading: reading.reading, palette: reading.palette, ...(reading.fonts ? { fonts: reading.fonts } : {}), read_at: new Date().toISOString() } : {}) };
      return next;
    });
    revalidatePath("/style");
    return { status: "ok", version, reading: reading?.reading ?? null, palette: reading?.palette ?? [], warning };
  } catch (error) {
    console.warn("saveMoodboard failed", error);
    return { status: "error", message: FAILED };
  }
}


export type OwnFont = { family: string; path: string; url: string };
export type SaveFontsResult = { status: "ok"; version: number; fonts: OwnFont[] } | { status: "error"; message: string };

const fontsInput = z
  .array(z.object({ family: z.string().trim().regex(/^[A-Za-z0-9 ]{2,40}$/, "Nom de police : lettres, chiffres et espaces."), path: z.string().max(300) }))
  .max(6, "6 polices au maximum.");

/** The studio's own fonts (files the browser uploaded to `media/{studio}/fonts/`), as a new version of the brand profile. */
export async function saveCustomFonts(input: unknown): Promise<SaveFontsResult> {
  const parsed = fontsInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Police invalide." };
  const { db, member } = await getStudioContext();
  if (!member) return { status: "error", message: NO_STUDIO };
  const studioId = member.studio.id;
  const expected = new RegExp(`^${studioId}/fonts/[a-z0-9-]{1,60}\\.(ttf|otf|woff2?)$`);
  if (parsed.data.some((f) => !expected.test(f.path))) return { status: "error", message: "Fichier de police invalide." };
  // Two fonts cannot share a name.
  const fonts = parsed.data.filter((f, i, all) => all.findIndex((g) => g.family.toLowerCase() === f.family.toLowerCase()) === i);
  try {
    const { version } = await insertProfileVersion(studioId, (current) => {
      const next: Record<string, unknown> = { ...current };
      if (fonts.length) next.custom_fonts = fonts;
      else delete next.custom_fonts;
      return next;
    });
    const signed = fonts.length ? ((await db.storage.from("media").createSignedUrls(fonts.map((f) => f.path), SIGNED_URL_SECONDS)).data ?? []) : [];
    revalidatePath("/style");
    return { status: "ok", version, fonts: fonts.flatMap((f, i) => (signed[i]?.signedUrl ? [{ ...f, url: signed[i]!.signedUrl }] : [])) };
  } catch (error) {
    console.warn("saveCustomFonts failed", error);
    return { status: "error", message: FAILED };
  }
}

const oneFont = z.object({ family: z.string().trim().regex(/^[A-Za-z0-9 ]{2,40}$/), path: z.string().max(300) });

/**
 * The file of one of her charter's fonts (Style step: « Ajouter ma police »): kept under the
 * charter's own name, so her Reels use it instead of its free twin. Replaces a file of the same name.
 */
export async function addCharterFont(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const parsed = oneFont.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Police invalide." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, message: NO_STUDIO };
  const studioId = member.studio.id;
  if (!new RegExp(`^${studioId}/fonts/[a-z0-9-]{1,60}\\.(ttf|otf|woff2?)$`).test(parsed.data.path)) return { ok: false, message: "Fichier de police invalide." };
  try {
    await insertProfileVersion(studioId, (current) => {
      const mine = ((current as { custom_fonts?: { family: string; path: string }[] }).custom_fonts ?? []).filter((f) => f.family.toLowerCase() !== parsed.data.family.toLowerCase());
      return { ...current, custom_fonts: [...mine, parsed.data].slice(-6) };
    });
    revalidatePath("/style");
    return { ok: true };
  } catch (error) {
    console.warn("addCharterFont failed", error);
    return { ok: false, message: FAILED };
  }
}
