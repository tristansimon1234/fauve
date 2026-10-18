"use server";

import { filmIdeas, postIdeas, publishWhen, readVoiceSetting, type PostIdea } from "@fauve/agent";
import { localInstant, localDateOf, localTimeOf, parseIsoDate, toIsoDate } from "@/lib/dates";
import { freeSlots, type Slot } from "@/lib/slots";
import { pendingSteal } from "@/lib/steal";
import { getStudioContext, signMediaUrls } from "@/lib/studio";

// What the « Nouvelle publication » screen offers: the studio's photos and videos to
// pick from, free days to post on, ideas in a tap and things easy to film.

export type { Slot } from "@/lib/slots";
export type LibraryItem = { id: string; url: string; video: boolean; at: string; /** A video's length, once watched. */ duration?: number | null };
/** A free day to post on, with when it is in her words (« vendredi à 18 h »). */
export type SlotOption = Slot & { iso: string; full: string; short: string };
export type NewPostOptions = {
  studioId: string;
  timezone: string;
  slots: SlotOption[];
  /** The studio's local date and time now (YYYY-MM-DDTHH:MM): another date she types is read against it. */
  nowLocal: string;
  /** Things easy to film this week, when she has nothing at hand. */
  film: { idea: string; how: string }[];
  media: LibraryItem[];
  /** One-tap ideas by format, for this kind of business: a label, and the request it fills in. */
  ideas: Record<"reel" | "carousel" | "post" | "story", PostIdea[]>;
  /** Her voice-over setting (Style), the first choice for a Reel. */
  voice: { use: "auto" | "always" | "never"; voiceId: string | null };
  /** TikTok connected: a Reel goes there too, unless she says otherwise. */
  tiktok: boolean;
  /** The Reel she sent Simone to copy (« Steal »): her next Reel follows it, unless she says otherwise. */
  copy: { name: string | null } | null;
};

export async function newPostOptions(): Promise<NewPostOptions | null> {
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const now = new Date();

  const [slots, assets] = await Promise.all([
    freeSlots(studioId, tz, 4, now),
    db.from("media_assets").select("id, storage_path, kind, created_at, duration").eq("studio_id", studioId).in("kind", ["image", "video"]).order("created_at", { ascending: false }).limit(40),
  ]);
  const [{ data: studio }, { data: brand }, { data: tiktok }, copy] = await Promise.all([
    db.from("studios").select("business_type").eq("id", studioId).maybeSingle(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("social_accounts").select("status").eq("studio_id", studioId).eq("platform", "tiktok").maybeSingle(),
    pendingSteal(studioId).catch(() => null),
  ]);
  const voice = readVoiceSetting((brand?.profile as { voice?: unknown } | null)?.voice);

  const media = (assets.data ?? []).map((a) => ({
    id: a.id as string,
    path: a.storage_path as string,
    video: a.kind === "video",
    at: a.created_at as string,
    duration: (a.duration as number | null) ?? null,
  }));
  const urls = await signMediaUrls(db, studioId, media.map((m) => m.path));
  const today = localDateOf(now, tz);
  const clock = localTimeOf(now, tz);
  return {
    studioId,
    timezone: tz,
    slots: slots.flatMap((s) => {
      const day = parseIsoDate(s.date);
      const [h, m] = s.time.split(":").map(Number);
      if (!day || h === undefined || m === undefined) return [];
      const iso = localInstant(day, h, m, tz).toISOString();
      const when = publishWhen(iso, tz, now);
      return [{ ...s, iso, full: when.full, short: when.short }];
    }),
    nowLocal: `${toIsoDate(today)}T${String(clock.hours).padStart(2, "0")}:${String(clock.minutes).padStart(2, "0")}`,
    film: filmIdeas(studio?.business_type as string | null),
    media: media.flatMap((m) => {
      const url = urls.get(m.path);
      return url ? [{ id: m.id, url, video: m.video, at: m.at, duration: m.duration }] : [];
    }),
    ideas: postIdeas(studio?.business_type as string | null),
    voice: { use: voice.use, voiceId: voice.voice_id ?? null },
    tiktok: tiktok?.status === "connected",
    copy: copy ? { name: copy.name } : null,
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
