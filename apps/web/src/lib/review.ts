import "server-only";
import {
  captionForInstagram,
  editPlanSchema,
  effectWords,
  findVoice,
  isBaked,
  postStatusSchema,
  publishWhen,
  type EditPlan,
  type EffectWord,
  type PostStatus,
  type PublishWhen,
} from "@fauve/agent";
import { after } from "next/server";
import type { TikTokPanel } from "@/components/montage/where-to-post";
import { localInstant, parseIsoDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { montageStatus } from "@/lib/montage-status";
import { modelState, type ModelState } from "@/lib/reel-models";
import { readPostMusic } from "@/lib/render/music";
import { ensureSceneSprite } from "@/lib/render/scene-sprite";
import { freeSlots } from "@/lib/slots";
import { instagramAccount } from "@/lib/social/publish";
import { tiktokPanel } from "@/lib/social/tiktok-panel";
import { signMediaUrls, type Db } from "@/lib/studio";
import { runningJobs } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownVoiceOf } from "@/lib/voice-clone";
import { socialConnect } from "@/lib/social/connect";

// « Ta publication », the simple page of a Reel: the video as it will go out, its scenes,
// when and where, its caption, and whether a new version is on its way (changes saved
// by hand, or Edith redoing it). Everything else is a change she asks for from there.

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
  /** A new version on its way: a render of texts saved by hand, or Edith redoing the montage. */
  making: { kind: "render" | "montage"; step: string | null; minutes?: number } | null;
  /** The video could not be made (no older one to show). */
  failed: boolean;
  /** The video to save on her phone, under the post's name. */
  downloadUrl: string | null;
  /** One small image per scene of the video shown, side by side (null: plain tiles). */
  scenes: { url: string; count: number } | null;
  /** The plan shown, whose texts she edits. */
  plan: EditPlan;
  /** Made by the effects agent: its texts are in the image, a change is asked of Edith. */
  baked: boolean;
  /** The texts of its effect she changes herself (its kit draws them again); none without a kit. */
  words: EffectWord[];
  version: number;
  /** The version before, when its video exists: « Revenir à l'ancienne ». */
  previous: number | null;
  /** A newer version with its video, after going back: « Reprendre la nouvelle ». */
  next: number | null;
  /** The versions that have their video, oldest first (« Version 2 sur 3 »). */
  versions: number[];
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
  /** Connecting Instagram offered (lib/social/connect.ts). */
  connect: boolean;
  publishByHand: boolean;
  /** Edith's music (null: the music service is not set up). */
  music: { on: boolean; made: boolean } | null;
  /** The voice on the Reel: Edith's (which one) or her own voice note. */
  voice: { who: "simone" | "hers"; name: string | null; /** Edith's voice (or her clone) it was read with. */ id?: string | null } | null;
  /** Her own voice (a clone made in Style), to pick for this Reel. */
  ownVoice: { id: string; sampleUrl: string | null } | null;
  /** Days to move it to: the next free days at her usual hour. */
  slots: ReviewSlot[];
  timezone: string;
  /** TikTok, when the app offers it: connected or not, and her choices for a direct post. */
  tiktok: TikTokPanel | null;
  /** Kept as a model (« Garder comme modèle »): new Reels can be made like it. */
  model: ModelState | null;
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
  tiktok: unknown;
  external_ids: unknown;
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
    .select("id, edit_plan_id, status, storage_path, scenes_path, created_at")
    .in("edit_plan_id", list.map((p) => p.id as string))
    .order("created_at", { ascending: false });
  const done = (planId: string) => (renders.data ?? []).find((r) => r.edit_plan_id === planId && r.status === "done" && r.storage_path);
  // The video shown: the current version's, else the post's last one (while the new one renders).
  const shown = done(current.id as string) ?? (post.render_id ? (renders.data ?? []).find((r) => r.id === post.render_id && r.status === "done") : undefined);
  const videoUrl = shown?.storage_path ? ((await signMediaUrls(db, studioId, [shown.storage_path as string])).get(shown.storage_path as string) ?? null) : null;
  // The strip of scenes: the shown video's, when it is this version's (else its scenes are not the plan's).
  const own = Boolean(shown && shown.edit_plan_id === current.id);
  const spritePath = own ? ((shown?.scenes_path as string | null) ?? null) : null;
  const spriteUrl = spritePath ? ((await signMediaUrls(db, studioId, [spritePath])).get(spritePath) ?? null) : null;

  const status = postStatusSchema.parse(post.status);
  const locked = status === "published" || status === "measured";
  // A video made before the strips existed gets its own, in the background.
  if (own && shown && !spritePath && !locked) {
    const renderId = shown.id as string;
    after(() => ensureSceneSprite(studioId, renderId));
  }
  const fileName = `${post.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "reel"}.mp4`;
  const ownVoice = await ownVoiceOf(studioId);
  const [jobs, replays, account, slots, voice, tiktok, download, model, ownSample] = await Promise.all([
    locked ? Promise.resolve([]) : montageStatus(studioId, post.id),
    // Her new words on its effect, drawn again by its own script.
    locked || !isBaked(plan.data) ? Promise.resolve([]) : runningJobs(studioId, { postId: post.id, kind: "effect_words" }),
    instagramAccount(studioId),
    locked ? Promise.resolve([]) : reviewSlots(studioId, timezone),
    loadVoice(studioId, post.voice_media_id, ownVoice?.id ?? null),
    tiktokPanel(studioId, { kind: "reel", platforms: post.platforms, caption: post.caption, hashtags: post.hashtags, tiktok: post.tiktok, external_ids: post.external_ids }, !locked),
    shown?.storage_path ? admin.storage.from("media").createSignedUrl(shown.storage_path as string, 3600, { download: fileName }) : Promise.resolve(null),
    modelState(studioId, post.id).catch(() => null),
    ownVoice?.sample_path ? admin.storage.from("media").createSignedUrl(ownVoice.sample_path, 3600) : Promise.resolve(null),
  ]);
  const running = jobs.find((j) => j.step !== "livré" && !j.late);
  const latest = (renders.data ?? []).find((r) => r.edit_plan_id === current.id);
  const rendering = !done(current.id as string) && (latest?.status === "rendering" || latest?.status === "queued");
  const failed = !shown && !running && latest?.status === "failed";
  const making = running
    ? { kind: "montage" as const, step: running.step, minutes: running.minutes }
    : replays.length || rendering || (!shown && !locked && !failed)
      ? { kind: "render" as const, step: null }
      : null;

  // The versions that have their video: the one before this one, and the one after when she went back.
  const versions = list.filter((p) => p.id === current.id || done(p.id as string)).map((p) => p.version as number).sort((a, b) => a - b);
  const previous = versions.filter((v) => v < (current.version as number)).at(-1);
  const next = versions.find((v) => v > (current.version as number));
  const music = readPostMusic(post.music);
  const handle = await instagramHandle(studioId);

  return {
    postId: post.id,
    title: post.title,
    status,
    locked,
    videoUrl,
    renderId: (shown?.id as string | undefined) ?? null,
    making,
    failed,
    downloadUrl: download?.data?.signedUrl ?? null,
    scenes: spriteUrl ? { url: spriteUrl, count: plan.data.segments.length } : null,
    plan: plan.data,
    baked: isBaked(plan.data),
    words: effectWords(plan.data),
    version: current.version as number,
    previous: previous ?? null,
    next: next ?? null,
    versions,
    scheduledAt: post.scheduled_at,
    when: post.scheduled_at ? publishWhen(post.scheduled_at, timezone) : null,
    upcoming: post.scheduled_at !== null && new Date(post.scheduled_at).getTime() > Date.now() + 60_000,
    platforms: post.platforms,
    caption: post.caption ?? "",
    captionShown: captionForInstagram(post.caption, post.hashtags),
    handle,
    instagram: Boolean(account),
    connect: socialConnect(),
    publishByHand: post.publish_by_hand,
    music: env("ELEVENLABS_API_KEY") ? { on: music.mode === "on", made: Boolean(music.track) } : null,
    voice,
    ownVoice: ownVoice ? { id: ownVoice.id, sampleUrl: ownSample?.data?.signedUrl ?? null } : null,
    slots,
    timezone,
    tiktok,
    model,
  };
}

/** Days to move a post to: the next free days at her usual hour. */
export async function reviewSlots(studioId: string, timezone: string): Promise<ReviewSlot[]> {
  return (await freeSlots(studioId, timezone, 4)).flatMap((s) => {
    const day = parseIsoDate(s.date);
    const [h, m] = s.time.split(":").map(Number);
    if (!day || h === undefined || m === undefined) return [];
    const iso = localInstant(day, h, m, timezone).toISOString();
    return [{ iso, label: publishWhen(iso, timezone).full, hint: s.hint }];
  });
}

/** Her Instagram name, as the feed shows it over her posts: her connected account's while connecting is on, else the @ she gave Edith. */
export async function instagramHandle(studioId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const [account, studio] = await Promise.all([
    socialConnect() ? db.from("social_accounts").select("handle").eq("studio_id", studioId).eq("platform", "instagram").maybeSingle() : null,
    db.from("studios").select("instagram_handle").eq("id", studioId).maybeSingle(),
  ]);
  return (account?.data?.handle as string | null) ?? (studio.data?.instagram_handle as string | null) ?? null;
}

/** The voice over the Reel: Edith's (her name) or the manager's own voice note; null: none. */
async function loadVoice(studioId: string, mediaId: string | null, ownId: string | null): Promise<ReviewData["voice"]> {
  if (!mediaId) return null;
  const { data } = await supabaseAdmin().from("media_assets").select("source, ai").eq("id", mediaId).eq("studio_id", studioId).maybeSingle();
  if (!data) return null;
  if (data.source !== "ai") return { who: "hers", name: null };
  const id = (data.ai as { voice_id?: string } | null)?.voice_id ?? null;
  // Read by her clone: her voice, as she hears it in Style.
  return { who: "simone", name: id && id === ownId ? "Ta voix" : (findVoice(id)?.name ?? null), id };
}
