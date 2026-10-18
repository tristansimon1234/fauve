"use server";

import {
  creationPhase,
  DEFAULT_EFFORT,
  EFFECT_MINUTES,
  EFFORTS,
  effortSchema,
  findVoice,
  imaginedBrief,
  JOB_STALE_MINUTES,
  MAX_MONTAGE_FILES,
  postKindSchema,
  TRIAL_DAYS,
  type CreationPhase,
  type Effort,
  type PostKind,
} from "@fauve/agent";
import { after } from "next/server";
import { z } from "zod";
import { createPost } from "@/app/(app)/calendrier/actions";
import { effectRoute } from "@/lib/agent/effects-agent";
import { studioAccess } from "@/lib/billing/access";
import { acceptQuote, createMontageQuote, pricedAsEffect } from "@/lib/credits";
import { env } from "@/lib/env";
import { startMontage } from "@/lib/montage-start";
import { isFirstReel } from "@/lib/onboarding";
import { pendingSteal } from "@/lib/steal";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";

// « C'est parti » on the Créer screen: her new files join her library, the publication
// is created (where it goes, and for a Reel with or without a voice over, as she chose),
// and a Reel starts at once (her tap is her yes; charged on delivery, like any montage).
// The other formats go on with Simone in the chat, who writes their texts.

const uploadSchema = z.object({ path: z.string().max(300), mime: z.string().max(100), size: z.number().int().positive() });
const launchSchema = z.object({
  kind: postKindSchema,
  date: z.string().max(10),
  time: z.string().max(5),
  /** What she imagines (the scenario, an offer, a message), in her words. */
  idea: z.string().max(500),
  /** In the order she picked them: from her library, or just sent (already in Storage). */
  items: z.array(z.union([z.object({ media: z.uuid() }), z.object({ upload: uploadSchema })])).min(1).max(MAX_MONTAGE_FILES),
  /** A Reel's voice over: as the studio's setting (auto), none, or one of Simone's voices. */
  voice: z.union([z.literal("auto"), z.literal("off"), z.string().regex(/^[A-Za-z0-9]{10,40}$/)]).default("auto"),
  /** Where it goes (TikTok only takes a Reel); by default the usual places. */
  platforms: z.array(z.enum(["instagram", "tiktok"])).min(1).max(2).optional(),
  /** A Reel made like the one she sent Simone to copy (« Steal »), when there is one: by default, yes. */
  copy: z.boolean().default(true),
});

export type LaunchInput = z.input<typeof launchSchema>;

export type LaunchResult =
  | {
      ok: true;
      postId: string;
      title: string;
      kind: PostKind;
      mediaIds: string[];
      /** A Reel: the montage that started, to follow on the working screen (effect: the effects agent makes it). */
      montage: { quoteId: string; effort: Effort; minutes: string; music: boolean; effect: boolean } | null;
    }
  | { ok: false; error: string; locked?: "subscribe" | "credits"; postId?: string };

export async function launchCreation(input: LaunchInput): Promise<LaunchResult> {
  const parsed = launchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisis au moins une photo ou une vidéo." };
  const { kind, date, time, items, voice, platforms, copy } = parsed.data;
  const idea = parsed.data.idea.trim();
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;

  // Before the subscription, only her first publication; without credits, no Reel (texts on photos are free).
  const access = await studioAccess(studioId);
  if (!access.create && (access.reason === "subscribe" || kind === "reel")) {
    return access.reason === "subscribe"
      ? { ok: false, locked: "subscribe", error: `Ta première publication est faite. Pour en créer d’autres, démarre ton essai : ${TRIAL_DAYS} jours offerts.` }
      : { ok: false, locked: "credits", error: "Tu n’as plus de crédits ce mois-ci : ils reviennent le 1er du mois." };
  }

  // Her new files become her library's, read once in the background (ready for the montage).
  const db = supabaseAdmin();
  const mediaIds: string[] = [];
  for (const item of items) {
    if ("media" in item) {
      mediaIds.push(item.media);
      continue;
    }
    const file = item.upload;
    if (!file.path.startsWith(`${studioId}/chat/`) || file.path.includes("..") || !/^(image|video)\//.test(file.mime)) {
      return { ok: false, error: "Un des fichiers n’est pas une photo ou une vidéo." };
    }
    const video = file.mime.startsWith("video/");
    const asset = await db
      .from("media_assets")
      .insert({ studio_id: studioId, storage_path: file.path, kind: video ? "video" : "image", source: "web_upload", mime_type: file.mime, size_bytes: file.size })
      .select("id")
      .single();
    if (asset.error) return { ok: false, error: "Un fichier n’a pas pu être ajouté. Réessaie." };
    const mediaId = asset.data.id as string;
    mediaIds.push(mediaId);
    after(() => (video ? ensureClipAnalysis(studioId, mediaId) : photoRegions(studioId, mediaId)).then(() => undefined, (e: unknown) => console.warn("create: file read failed", e)));
  }

  // The Reel she sent to copy: the model of this Reel only (one shot).
  const copying = kind === "reel" && copy ? await pendingSteal(studioId).catch(() => null) : null;
  const created = await createPost({ kind, date, time, intention: idea, mediaIds, inspirationId: copying?.id });
  if (!created.ok) return created;
  // Her choices, before anything is made: where it goes, and the voice over of a Reel.
  const where = platforms ? [...new Set(platforms.filter((p) => p === "instagram" || kind === "reel"))] : [];
  const spoken = kind === "reel" && voice !== "auto" ? (voice === "off" ? { mode: "off" as const } : findVoice(voice) ? { mode: "on" as const, voice_id: voice } : null) : null;
  if (where.length || spoken) {
    const patch = { ...(where.length ? { platforms: where } : {}), ...(spoken ? { voice_over: spoken } : {}) };
    const { error } = await db.from("posts").update(patch).eq("id", created.id).eq("studio_id", studioId);
    if (error) console.warn("create: choices not saved", error.message);
  }
  if (kind !== "reel") return { ok: true, postId: created.id, title: created.title, kind, mediaIds, montage: null };

  // The level of care of the studio (Réglages); her first Reel gets its made-to-measure animations, as in the chat.
  const { data: studio } = await db.from("studios").select("montage_effort").eq("id", studioId).single();
  const effort = effortSchema.catch(DEFAULT_EFFORT).parse(studio?.montage_effort);
  const scenes = (await isFirstReel(studioId, created.id)) ? 2 : 1;
  const quote = await createMontageQuote({
    studioId,
    postId: created.id,
    mediaIds,
    brief: imaginedBrief(idea),
    correction: false,
    maxNewScenes: scenes,
    effort,
  });
  if ("error" in quote) {
    return { ok: false, locked: "credits", postId: created.id, error: "Il ne te reste pas assez de crédits pour ce Reel : je l’ai gardé comme idée dans ta grille." };
  }
  const accepted = await acceptQuote(studioId, quote.id, new Date(), { immediate: true });
  if ("error" in accepted) return { ok: false, postId: created.id, error: accepted.error };
  // Who makes it, decided now so the working screen shows its steps and its time (the job keeps it).
  const route = await effectRoute(studioId, { postId: created.id, correction: false, brief: accepted.brief, mediaIds }).catch(() => undefined);
  // Delivered in the app and on WhatsApp (she may close the app meanwhile).
  after(() => startMontage(studioId, accepted, { notify: true, route }));
  const level = quote.effort ?? effort;
  const effect = route === "agent";
  return {
    ok: true,
    postId: created.id,
    title: created.title,
    kind,
    mediaIds,
    montage: { quoteId: quote.id, effort: level, minutes: effect ? EFFECT_MINUTES : EFFORTS[level].minutes, music: Boolean(env("ELEVENLABS_API_KEY")), effect },
  };
}

export type CreationProgress = {
  phase: CreationPhase;
  /** The effects agent makes this Reel: its steps and its time (creationSteps with effect). */
  effect: boolean;
  done: boolean;
  failed: boolean;
  /** The Reel's length once made. */
  seconds: number | null;
};

/** Never started this long after the tap: the job was lost. */
const START_MS = 4 * 60_000;

/** Where the Reel launched from the Créer screen stands, for its working screen. */
export async function creationProgress(quoteId: string, postId: string): Promise<CreationProgress | null> {
  if (!z.uuid().safeParse(quoteId).success || !z.uuid().safeParse(postId).success) return null;
  const { member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const db = supabaseAdmin();
  const [quote, job, post] = await Promise.all([
    db.from("credit_quotes").select("stage, created_at, params").eq("id", quoteId).eq("studio_id", studioId).maybeSingle(),
    db.from("studio_jobs").select("finished_at, failed, updated_at").eq("id", quoteId).eq("studio_id", studioId).maybeSingle(),
    db.from("posts").select("media_ids, render_id").eq("id", postId).eq("studio_id", studioId).maybeSingle(),
  ]);
  if (!quote.data || !post.data) return null;
  const stage = (quote.data.stage as string | null) ?? null;
  const ids = (post.data.media_ids as string[] | null) ?? [];
  const videos = ids.length ? ((await db.from("media_assets").select("analysis_status").in("id", ids).eq("kind", "video")).data ?? []) : [];
  const watched = videos.every((v) => v.analysis_status === "done");
  const now = Date.now();
  const finished = Boolean(job.data?.finished_at);
  // No news for a long while, or never started: it died (nothing is charged).
  const silent = job.data ? !finished && now - new Date(job.data.updated_at as string).getTime() > JOB_STALE_MINUTES * 60_000 : now - new Date(quote.data.created_at as string).getTime() > START_MS;
  const failed = Boolean(job.data?.failed) || (silent && stage !== "delivered");
  const done = !failed && (stage === "delivered" || finished);
  const render = done && post.data.render_id ? (await db.from("renders").select("duration_ms").eq("id", post.data.render_id as string).maybeSingle()).data : null;
  return {
    phase: creationPhase(stage, watched),
    effect: pricedAsEffect(quote.data.params),
    done,
    failed,
    seconds: render?.duration_ms ? Math.round((render.duration_ms as number) / 1000) : null,
  };
}
