import "server-only";
import {
  captionForInstagram,
  editPlanSchema,
  findVoice,
  postStatusSchema,
  publishWhen,
  type EditPlan,
  type PostStatus,
  type PublishWhen,
} from "@fauve/agent";
import { localInstant, parseIsoDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { montageStatus } from "@/lib/montage-status";
import { readPostMusic } from "@/lib/render/music";
import { freeSlots } from "@/lib/slots";
import { instagramAccount } from "@/lib/social/publish";
import { signMediaUrls, type Db } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// « Ta publication », the simple page of a Reel: the video as it will go out, when
// and where, its caption, and whether a new version is on its way (texts saved by
// hand, or Simone redoing it). Everything else is a change she asks for from there.

export type ReviewSlot = { iso: string; label: string; hint: string };

export type ReviewData = {
  postId: string;
  title: string;
  status: PostStatus;
  /** Online already: nothing can change. */
  locked: boolean;
  /** The video as it will be published (the current version's render), signed. */
  videoUrl: string | null;
  /** The current version's render, for the page to start over when it changes. */
  renderId: string | null;
  /** A new version on its way: a render of texts saved by hand, or Simone redoing the montage. */
  making: { kind: "render" | "montage"; step: string | null } | null;
  /** The video could not be made (no older one to show). */
  failed: boolean;
  /** The plan shown, whose texts she edits. */
  plan: EditPlan;
  version: number;
  /** The version before, when its video exists: « Revenir à l'ancienne ». */
  previous: number | null;
  scheduledAt: string | null;
  when: PublishWhen | null;
  /** The date is still ahead (else it goes out as soon as she says yes). */
  upcoming: boolean;
  platforms: string[];
  caption: string;
  /** The caption as Instagram shows it (cleaned, at most 5 hashtags). */
  captionShown: string;
  handle: string | null;
  instagram: boolean;
  publishByHand: boolean;
  /** Simone's music (null: the music service is not set up). */
  music: { on: boolean; made: boolean } | null;
  /** The voice on the Reel: Simone's (which one) or her own voice note. */
  voice: { who: "simone" | "hers"; name: string | null } | null;
  /** Days to move it to: the next free days at her usual hour. */
  slots: ReviewSlot[];
  timezone: string;
};

type ReviewPost = {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  platforms: string[];
  caption: string | null;
  hashtags: string[];
  edit_plan_id: string | null;
  render_id: string | null;
  publish_by_hand: boolean;
  music: unknown;
  voice_media_id: string | null;
};

/** What the simple page needs, or null when the Reel has no montage yet (the full page shows its state). */
export async function loadReview(db: Db, studioId: string, post: ReviewPost, timezone: string): Promise<ReviewData | null> {
  const admin = supabaseAdmin();
  const plans = await admin.from("edit_plans").select("id, version").eq("post_id", post.id).order("version", { ascending: false }).limit(20);
  const list = plans.data ?? [];
  const current = (post.edit_plan_id ? list.find((p) => p.id === post.edit_plan_id) : undefined) ?? list[0];
  if (!current) return null;
  // Only the version shown is read in full (plans carry the animations' code).
  const plan = editPlanSchema.safeParse((await admin.from("edit_plans").select("plan").eq("id", current.id).single()).data?.plan);
  if (!plan.success) return null;

  const renders = await admin
    .from("renders")
    .select("id, edit_plan_id, status, storage_path, created_at")
    .in("edit_plan_id", list.map((p) => p.id as string))
    .order("created_at", { ascending: false });
  const done = (planId: string) => (renders.data ?? []).find((r) => r.edit_plan_id === planId && r.status === "done" && r.storage_path);
  // The video shown: the current version's, else the post's last one (while the new one renders).
  const shown = done(current.id as string) ?? (post.render_id ? (renders.data ?? []).find((r) => r.id === post.render_id && r.status === "done") : undefined);
  const videoUrl = shown?.storage_path ? ((await signMediaUrls(db, studioId, [shown.storage_path as string])).get(shown.storage_path as string) ?? null) : null;

  const status = postStatusSchema.parse(post.status);
  const locked = status === "published" || status === "measured";
  const [jobs, account, slots, voice] = await Promise.all([
    locked ? Promise.resolve([]) : montageStatus(studioId, post.id),
    instagramAccount(studioId),
    locked ? Promise.resolve([]) : freeSlots(studioId, timezone, 4),
    loadVoice(studioId, post.voice_media_id),
  ]);
  const running = jobs.find((j) => j.step !== "livré" && !j.late);
  const latest = (renders.data ?? []).find((r) => r.edit_plan_id === current.id);
  const rendering = !done(current.id as string) && (latest?.status === "rendering" || latest?.status === "queued");
  const failed = !shown && !running && latest?.status === "failed";
  const making = running ? { kind: "montage" as const, step: running.step } : rendering || (!shown && !locked && !failed) ? { kind: "render" as const, step: null } : null;

  // The version before this one that has its video.
  const previous = list.find((p) => (p.version as number) < (current.version as number) && done(p.id as string));
  const music = readPostMusic(post.music);
  const handle = ((await admin.from("social_accounts").select("handle").eq("studio_id", studioId).eq("platform", "instagram").maybeSingle()).data?.handle as string | null) ?? null;

  return {
    postId: post.id,
    title: post.title,
    status,
    locked,
    videoUrl,
    renderId: (shown?.id as string | undefined) ?? null,
    making,
    failed,
    plan: plan.data,
    version: current.version as number,
    previous: previous ? (previous.version as number) : null,
    scheduledAt: post.scheduled_at,
    when: post.scheduled_at ? publishWhen(post.scheduled_at, timezone) : null,
    upcoming: post.scheduled_at !== null && new Date(post.scheduled_at).getTime() > Date.now() + 60_000,
    platforms: post.platforms,
    caption: post.caption ?? "",
    captionShown: captionForInstagram(post.caption, post.hashtags),
    handle,
    instagram: Boolean(account),
    publishByHand: post.publish_by_hand,
    music: env("ELEVENLABS_API_KEY") ? { on: music.mode === "on", made: Boolean(music.track) } : null,
    voice,
    slots: slots.flatMap((s) => {
      const day = parseIsoDate(s.date);
      const [h, m] = s.time.split(":").map(Number);
      if (!day || h === undefined || m === undefined) return [];
      const iso = localInstant(day, h, m, timezone).toISOString();
      return [{ iso, label: publishWhen(iso, timezone).full, hint: s.hint }];
    }),
    timezone,
  };
}

/** The voice over the Reel: Simone's (her name) or the manager's own voice note; null: none. */
async function loadVoice(studioId: string, mediaId: string | null): Promise<ReviewData["voice"]> {
  if (!mediaId) return null;
  const { data } = await supabaseAdmin().from("media_assets").select("source, ai").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!data) return null;
  if (data.source !== "ai") return { who: "hers", name: null };
  return { who: "simone", name: findVoice((data.ai as { voice_id?: string } | null)?.voice_id)?.name ?? null };
}
