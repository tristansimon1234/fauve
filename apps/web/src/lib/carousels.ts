import "server-only";
import { CREDIT_PRICES, jobStepLabel, postStatusSchema, slidesPlanSchema, type CarouselDesign } from "@fauve/agent";
import { assertCanCreate } from "@/lib/billing/access";
import { creditBalance } from "@/lib/credits";
import { queueJob } from "@/lib/jobs";
import { towardsDraft } from "@/lib/render/render-post";
import { saveSlides, slidesKey } from "@/lib/render/slides";
import { finishJob, runningJobs, startJob } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Designed carousels (lib/agent/carousel-designer.ts): started from the chat or the app,
// never twice for the same post, never without the credits; kept on the post with the
// slides of their test render, which are what is published.

/**
 * Keeps a designed carousel on its post: its photos among the post's, the post a carousel
 * (or a photo post for one slide), the design in its slides plan and its rendered slides
 * as the plan's render (they are published instead of the photos).
 */
export async function storeCarousel(studioId: string, postId: string, design: CarouselDesign, stills: string[]): Promise<void> {
  const db = supabaseAdmin();
  const { data: post, error } = await db.from("posts").select("kind, status, media_ids, slides").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  const before = (post.media_ids as string[] | null) ?? [];
  // Its photos stay the post's (the retention keeps them while it needs them).
  const mediaIds = [...new Set([...before, ...design.photos])];
  const kind = post.kind === "carousel" || post.kind === "post" ? (design.count > 1 ? "carousel" : "post") : post.kind;
  if (mediaIds.length !== before.length || kind !== post.kind) {
    const { error: postError } = await db.from("posts").update({ media_ids: mediaIds, kind }).eq("id", postId).eq("studio_id", studioId);
    if (postError) throw new Error(postError.message);
  }
  const current = slidesPlanSchema.safeParse(post.slides);
  const plan = await saveSlides(studioId, postId, current.success ? current.data : { template: "libre", slides: [] }, { design });
  let status = postStatusSchema.parse(post.status);
  for (const next of towardsDraft(status)) status = next;
  const { error: renderError } = await db
    .from("posts")
    .update({ slides_render: { key: slidesKey(plan), paths: stills, pending: null, pending_at: null, error: null }, status })
    .eq("id", postId)
    .eq("studio_id", studioId);
  if (renderError) throw new Error(renderError.message);
}

export type CarouselStart = {
  studioId: string;
  postId: string;
  /** What she wants it to say, in her words (or Simone's brief). */
  request: string;
  /** Her photos for it, in her order (default: the post's). */
  mediaIds?: string[];
  /** Composed anew, not a correction of the carousel the post already has. */
  fresh?: boolean;
  /** Images of carousels she likes (her media): their form is followed, never their words or pictures. */
  examples?: string[];
  waId?: string;
  replyTo?: string;
  /** The app's conversation she asked in: the carousel is delivered there. */
  conversationId?: string;
  /** The lab's carousels are never charged. */
  charge?: boolean;
};

export type CarouselStarted =
  | { status: "started"; jobId: string; credits: number }
  | { status: "already_running"; stage: string; minutes: number }
  | { status: "error"; error: string };

export async function startCarousel(start: CarouselStart): Promise<CarouselStarted> {
  const charge = start.charge !== false;
  if (charge) await assertCanCreate(start.studioId);
  // The same post already being composed: never a second time (it would be charged twice).
  const [running] = await runningJobs(start.studioId, { postId: start.postId, kind: "carousel" });
  if (running) {
    return { status: "already_running", stage: jobStepLabel(running.kind, running.stage), minutes: Math.round((Date.now() - new Date(running.startedAt).getTime()) / 60_000) };
  }
  const credits = charge ? CREDIT_PRICES.carousel : 0;
  if (credits) {
    const balance = await creditBalance(start.studioId);
    if (balance < credits) return { status: "error", error: `Il faut ${credits} crédits, il en reste ${balance}.` };
  }
  // Followed like the other work; a database not yet migrated for it only loses the progress pill.
  const jobId = await startJob({ studioId: start.studioId, postId: start.postId, kind: "carousel", stage: "design" }).catch((error: unknown) => {
    console.warn("carousel: not followed", error instanceof Error ? error.message : error);
    return undefined;
  });
  try {
    await queueJob("carousel", { ...start, charge, jobId, round: 0 });
    return { status: "started", jobId: jobId ?? "", credits };
  } catch (error) {
    await finishJob(jobId, true);
    return { status: "error", error: error instanceof Error ? error.message : "La composition n’a pas pu démarrer" };
  }
}
