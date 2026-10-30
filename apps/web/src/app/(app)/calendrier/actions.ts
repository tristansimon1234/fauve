"use server";

import { completeFirstPost } from "@/lib/onboarding";
import {
  intentionTitle,
  MAX_CAROUSEL_PHOTOS,
  MAX_MONTAGE_FILES,
  motionTemplateSchema,
  postKindSchema,
  postStatusSchema,
  type PostKind,
  type PostStatus,
} from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, localDateOf, localInstant, localTimeOf, parseIsoDate, toIsoDate } from "@/lib/dates";
import { scheduleValidated } from "@/lib/posts";
import { postCovers, type Cover, type CoverPost } from "@/lib/covers";
import { instagramAccount } from "@/lib/social/publish";
import { defaultPlatforms } from "@/lib/social/tiktok-account";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deletePost } from "../publications/[id]/actions";

const input = z.object({ id: z.uuid(), done: z.boolean() });

/** Ticks a shot off the "À filmer" list (or back on). */
export async function setShotDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  const parsed = input.safeParse({ id, done });
  if (!parsed.success) return { ok: false };

  const { member } = await getStudioContext();
  if (!member) return { ok: false };

  const { data, error } = await supabaseAdmin()
    .from("shot_requests")
    .update({ done: parsed.data.done })
    .eq("id", parsed.data.id)
    .eq("studio_id", member.studio.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.warn("setShotDone failed", error.message);
    return { ok: false };
  }
  revalidatePath("/calendrier");
  revalidatePath("/fauve");
  return { ok: true };
}

const LOCKED = new Set(["published", "measured"]);
const DEFAULT_TIME = { hours: 18, minutes: 0 };
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export type CalendarResult = { ok: true } | { ok: false; error: string };

function revalidateCalendar(postId?: string) {
  revalidatePath("/calendrier");
  revalidatePath("/fauve");
  if (postId) revalidatePath(`/publications/${postId}`);
}

/**
 * Moves a post to another day (drag and drop) or time: same local time when
 * only the day changes, 18:00 for an idea that had no date.
 */
export async function movePost(postId: string, date: string, time?: string): Promise<CalendarResult> {
  if (!z.uuid().safeParse(postId).success || !isoDate.safeParse(date).success || (time && !hhmm.safeParse(time).success)) {
    return { ok: false, error: "Date invalide." };
  }
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const tz = member.studio.timezone;
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("status, scheduled_at, publish_started_at").eq("id", postId).eq("studio_id", member.studio.id).maybeSingle();
  if (!post) return { ok: false, error: "Publication introuvable." };
  if (LOCKED.has(post.status as string)) return { ok: false, error: "Cette publication est déjà en ligne : sa date ne change plus." };
  if (post.publish_started_at && Date.now() - new Date(post.publish_started_at as string).getTime() < 10 * 60_000) {
    return { ok: false, error: "Elle est en train de partir sur Instagram." };
  }
  const day = parseIsoDate(date)!;
  const at = time
    ? { hours: Number(time.slice(0, 2)), minutes: Number(time.slice(3)) }
    : post.scheduled_at
      ? localTimeOf(new Date(post.scheduled_at as string), tz)
      : DEFAULT_TIME;
  const { error } = await db
    .from("posts")
    .update({ scheduled_at: localInstant(day, at.hours, at.minutes, tz).toISOString() })
    .eq("id", postId)
    .eq("studio_id", member.studio.id);
  if (error) return { ok: false, error: "Le déplacement n’a pas été enregistré. Réessaie." };
  revalidateCalendar(postId);
  return { ok: true };
}

/** A new idea on a day of the calendar (Fauve picks it up: content to request, draft…). */
export async function addPost(date: string, kind: PostKind, title: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = title.trim().slice(0, 120);
  if (!isoDate.safeParse(date).success || !postKindSchema.safeParse(kind).success || !name) return { ok: false, error: "Donne un titre à ton idée." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const at = localInstant(parseIsoDate(date)!, DEFAULT_TIME.hours, DEFAULT_TIME.minutes, member.studio.timezone);
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .insert({ studio_id: member.studio.id, kind, title: name, status: "planned", platforms: await defaultPlatforms(member.studio.id, kind), scheduled_at: at.toISOString() })
    .select("id")
    .single();
  if (error) return { ok: false, error: "L’idée n’a pas été ajoutée. Réessaie." };
  revalidateCalendar();
  return { ok: true, id: data.id as string };
}

const kindTitles: Record<PostKind, string> = { reel: "Reel", carousel: "Carrousel", post: "Photo", story: "Story" };

/**
 * A publication from the « Nouvelle publication » panel: its format, day, time
 * and, in a line, what it should say (also its title). Fauve does the rest.
 */
export async function createPost(input: {
  kind: PostKind;
  date: string;
  time: string;
  intention: string;
  /** Montage style and inspiration picked for a Reel or a story. */
  template?: string | null;
  inspirationId?: string | null;
  /** Photos and videos picked in the library, in order. */
  mediaIds?: string[];
  /** A Reel's sound: Edith's music, a sound of Instagram (she publishes it herself), or none. */
  music?: "simone" | "instagram" | "none" | null;
}): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  const kind = postKindSchema.safeParse(input.kind);
  const day = parseIsoDate(input.date);
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(input.time);
  if (!kind.success || !day || !time) return { ok: false, error: "Choisis un format, un jour et une heure." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  // The title: the intention, cut at a word; else the format and the day.
  const title = intentionTitle(input.intention) || `${kindTitles[kind.data]} du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(day.year, day.month - 1, day.day)))}`;
  const at = localInstant(day, Number(time[1]), Number(time[2]), member.studio.timezone);
  const db = supabaseAdmin();
  const template = motionTemplateSchema.safeParse(input.template);
  // Only one of this studio's inspirations.
  const inspiration =
    input.inspirationId && z.uuid().safeParse(input.inspirationId).success
      ? (await db.from("inspirations").select("id").eq("id", input.inspirationId).eq("studio_id", member.studio.id).maybeSingle()).data
      : null;
  // Only this studio's media, in the order she picked them.
  const wanted = (input.mediaIds ?? []).filter((id) => z.uuid().safeParse(id).success).slice(0, kind.data === "carousel" ? MAX_CAROUSEL_PHOTOS : MAX_MONTAGE_FILES);
  const owned = wanted.length ? new Set(((await db.from("media_assets").select("id").eq("studio_id", member.studio.id).in("id", wanted)).data ?? []).map((m) => m.id as string)) : new Set<string>();
  const mediaIds = wanted.filter((id) => owned.has(id));
  const video = kind.data === "reel" || kind.data === "story";
  const music = video && (input.music === "instagram" || input.music === "none") ? input.music : null;
  const { data, error } = await db
    .from("posts")
    .insert({
      studio_id: member.studio.id,
      kind: kind.data,
      title,
      status: "planned",
      platforms: await defaultPlatforms(member.studio.id, kind.data),
      scheduled_at: at.toISOString(),
      template: template.success ? template.data : null,
      inspiration_id: inspiration?.id ?? null,
      media_ids: mediaIds,
      ...(mediaIds.length ? { status: "media_received" } : {}),
      // A sound of Instagram: no music of Edith, and she publishes it herself (Instagram's sounds can only be added in its app).
      ...(music ? { music: { mode: "off" } } : {}),
      ...(music === "instagram" && kind.data === "reel" ? { publish_by_hand: true } : {}),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "La publication n’a pas été créée. Réessaie." };
  await completeFirstPost(member.studio.id);
  revalidateCalendar();
  return { ok: true, id: data.id as string, title };
}

export type PostSheet = {
  id: string;
  title: string;
  kind: PostKind;
  status: PostStatus;
  /** Local day and time, for the date fields. */
  date: string | null;
  time: string | null;
  cover: Cover | null;
  caption: string | null;
  steps: { label: string; done: boolean }[];
  /** What to do now, in a sentence. */
  todo: string;
  shots: { id: string; label: string; hint: string | null; done: boolean }[];
  publishError: string | null;
  permalink: string | null;
  instagramConnected: boolean;
  locked: boolean;
};

/** Everything the calendar's side panel shows for one post: where it stands and what is left to do. */
export async function getPostSheet(postId: string): Promise<PostSheet | null> {
  if (!z.uuid().safeParse(postId).success) return null;
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const { data: post } = await db
    .from("posts")
    .select("id, title, kind, status, scheduled_at, caption, media_ids, render_id, slides, slides_render, cover, publish_error, external_ids")
    .eq("id", postId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!post) return null;
  const status = postStatusSchema.parse(post.status);
  const kind = post.kind as PostKind;

  const ids = (post.media_ids as string[] | null) ?? [];
  const [covers, shots, instagram] = await Promise.all([
    postCovers(db, studioId, [post as unknown as CoverPost]),
    db.from("shot_requests").select("id, label, hint, done").eq("studio_id", studioId).eq("post_id", postId).order("created_at"),
    instagramAccount(studioId),
  ]);

  const reached = (list: PostStatus[]) => list.includes(status);
  const hasContent = ids.length > 0 || Boolean(post.render_id) || reached(["media_received", "draft", "validated", "scheduled", "published", "measured"]);
  const steps = [
    { label: kind === "reel" || kind === "story" ? "Vidéos reçues" : "Photos reçues", done: hasContent },
    { label: "Brouillon prêt", done: reached(["draft", "validated", "scheduled", "published", "measured"]) },
    { label: "Validé par toi", done: reached(["validated", "scheduled", "published", "measured"]) },
    { label: "Programmé sur Instagram", done: reached(["scheduled", "published", "measured"]) },
    { label: "En ligne", done: reached(["published", "measured"]) },
  ];
  const todo =
    status === "failed"
      ? "La publication a échoué : demande à Edith de réessayer."
      : status === "draft"
        ? "Relis le brouillon et valide-le."
        : status === "validated" && !instagram
          ? "Poste-la depuis ton téléphone, ou relie Instagram pour qu'Edith la publie."
          : status === "validated" || status === "scheduled"
            ? "Rien à faire : Edith la publie à l’heure prévue."
            : status === "published" || status === "measured"
              ? "En ligne. Edith suit ses résultats."
              : status === "skipped"
                ? "Mise de côté."
                : hasContent
                  ? "Edith a ton contenu : demande-lui de préparer le brouillon."
                  : kind === "reel" || kind === "story"
                    ? "Filme et envoie tes vidéos à Edith."
                    : "Envoie tes photos à Edith.";
  const scheduled = post.scheduled_at ? new Date(post.scheduled_at as string) : null;
  const local = scheduled ? localTimeOf(scheduled, tz) : null;
  return {
    id: post.id as string,
    title: post.title as string,
    kind,
    status,
    date: scheduled ? toIsoDate(localDateOf(scheduled, tz)) : null,
    time: local ? `${String(local.hours).padStart(2, "0")}:${String(local.minutes).padStart(2, "0")}` : null,
    cover: covers.get(postId) ?? null,
    caption: (post.caption as string | null) ?? null,
    steps,
    todo,
    shots: (shots.data ?? []).map((s) => ({ id: s.id as string, label: s.label as string, hint: (s.hint as string | null) ?? null, done: Boolean(s.done) })),
    publishError: (post.publish_error as string | null) ?? null,
    permalink: ((post.external_ids as { instagram?: { permalink?: string } } | null)?.instagram?.permalink as string | undefined) ?? null,
    instagramConnected: Boolean(instagram),
    locked: status === "published" || status === "measured",
  };
}

// Grouped actions: several posts selected in the calendar at once.

const ids = z.array(z.uuid()).min(1).max(100);
export type BulkResult = { ok: true; done: number; skipped: number } | { ok: false; error: string };

/** Validates the selected drafts (the others are left as they are), then schedules them when possible. */
export async function validatePosts(postIds: string[]): Promise<BulkResult> {
  const parsed = ids.safeParse(postIds);
  if (!parsed.success) return { ok: false, error: "Sélection invalide." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .update({ status: "validated" })
    .eq("studio_id", studioId)
    .eq("status", "draft")
    .in("id", parsed.data)
    .select("id");
  if (error) return { ok: false, error: "La validation n’a pas abouti. Réessaie." };
  for (const row of data ?? []) await scheduleValidated(studioId, row.id as string);
  revalidateCalendar();
  return { ok: true, done: data?.length ?? 0, skipped: parsed.data.length - (data?.length ?? 0) };
}

/**
 * Moves the selected posts: all to one day (`date`, each keeps its time) or
 * by a number of days (`days`, a drag of the selection). Posts already
 * online or leaving now stay where they are.
 */
export async function movePosts(postIds: string[], to: { date: string } | { days: number }): Promise<BulkResult> {
  const parsed = ids.safeParse(postIds);
  const target = z.union([z.object({ date: isoDate }), z.object({ days: z.number().int().min(-60).max(60) })]).safeParse(to);
  if (!parsed.success || !target.success) return { ok: false, error: "Déplacement invalide." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const tz = member.studio.timezone;
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("posts")
    .select("id, status, scheduled_at, publish_started_at")
    .eq("studio_id", member.studio.id)
    .in("id", parsed.data);
  let done = 0;
  for (const post of posts ?? []) {
    const leaving = post.publish_started_at && Date.now() - new Date(post.publish_started_at as string).getTime() < 10 * 60_000;
    if (LOCKED.has(post.status as string) || leaving) continue;
    const current = post.scheduled_at ? new Date(post.scheduled_at as string) : null;
    const time = current ? localTimeOf(current, tz) : DEFAULT_TIME;
    const day =
      "date" in target.data
        ? parseIsoDate(target.data.date)!
        : current
          ? addDays(localDateOf(current, tz), target.data.days)
          : null;
    if (!day) continue;
    const { error } = await db
      .from("posts")
      .update({ scheduled_at: localInstant(day, time.hours, time.minutes, tz).toISOString() })
      .eq("id", post.id)
      .eq("studio_id", member.studio.id);
    if (!error) done++;
  }
  revalidateCalendar();
  return { ok: true, done, skipped: parsed.data.length - done };
}

/** Deletes the selected posts (with their montages); posts leaving for Instagram right now are kept. */
export async function deletePosts(postIds: string[]): Promise<BulkResult> {
  const parsed = ids.safeParse(postIds);
  if (!parsed.success) return { ok: false, error: "Sélection invalide." };
  let done = 0;
  for (const id of parsed.data) if ((await deletePost(id)).ok) done++;
  return { ok: true, done, skipped: parsed.data.length - done };
}
