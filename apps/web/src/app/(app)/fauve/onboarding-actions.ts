"use server";

import { brandProfileSchema, nextOnboardingStep, ONBOARDING_STEPS, onboardingStepOf, PLANS, planOf, reelsPerMonth, type OnboardingStep } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Getting started in the app: where the studio is, and the steps' own actions
// (rhythm, moving on, « plus tard »). Fauve does the same in the chat.

export type OnboardingView = {
  studioId: string;
  step: OnboardingStep;
  website: string | null;
  businessType: string | null;
  brand: { colors: string[]; fonts: string[]; logoUrl: string | null };
  /** fromSite: Simone took these photos from her website (she has not made her own moodboard yet). */
  moodboard: { items: { path: string; url: string }[]; reading: string | null; fromSite: boolean };
  rhythm: { posts: number; stories: number; days: number[] | null };
  /** Her offer: what its credits hold, to choose a rhythm she can keep with care. */
  offer: { label: string; credits: number; postsPerWeek: number; reels: number };
  instagram: string | null;
};

export async function onboardingView(): Promise<OnboardingView | null> {
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const admin = supabaseAdmin();
  const [studio, profileRow, plan, account] = await Promise.all([
    admin.from("studios").select("onboarding_step, website_url, business_type, plan").eq("id", studioId).single(),
    admin.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("content_plans").select("posts_per_week, stories_per_week, post_days").eq("studio_id", studioId).maybeSingle(),
    admin.from("social_accounts").select("handle").eq("studio_id", studioId).eq("platform", "instagram").eq("status", "connected").limit(1).maybeSingle(),
  ]);
  const profile = brandProfileSchema.partial().catch({}).parse(profileRow.data?.profile ?? {});
  const offerId = planOf(studio.data?.plan);
  const offer = PLANS[offerId];
  const items = profile.moodboard?.items ?? [];
  const paths = [...items.map((i) => i.path), ...(profile.logo_path ? [profile.logo_path] : [])];
  const urls = paths.length ? await signMediaUrls(db, studioId, paths) : new Map<string, string>();
  return {
    studioId,
    step: onboardingStepOf(studio.data?.onboarding_step),
    website: (studio.data?.website_url as string | null) ?? null,
    businessType: (studio.data?.business_type as string | null) ?? null,
    brand: {
      colors: (profile.colors ?? []).slice(0, 6),
      fonts: (profile.fonts ?? []).slice(0, 2),
      logoUrl: (profile.logo_path ? urls.get(profile.logo_path) : null) ?? profile.logo_url ?? null,
    },
    moodboard: { items: items.flatMap((i) => (urls.get(i.path) ? [{ path: i.path, url: urls.get(i.path)! }] : [])), reading: profile.moodboard?.reading ?? null, fromSite: items.some((i) => i.note === "Photo de ton site") },
    rhythm: { posts: (plan.data?.posts_per_week as number | null) ?? offer.postsPerWeek, stories: (plan.data?.stories_per_week as number | null) ?? 4, days: (plan.data?.post_days as number[] | null) ?? null },
    offer: { label: offer.label, credits: offer.credits, postsPerWeek: offer.postsPerWeek, reels: reelsPerMonth(offerId) },
    instagram: (account.data?.handle as string | null) ?? null,
  };
}

async function studioOf(): Promise<string | null> {
  const { member } = await getStudioContext();
  return member?.studio.id ?? null;
}

/** Moves on (or « plus tard »): never backwards, so a step Fauve already passed stays passed. */
export async function goToStep(step: OnboardingStep): Promise<{ ok: boolean }> {
  if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) return { ok: false };
  const studioId = await studioOf();
  if (!studioId) return { ok: false };
  const db = supabaseAdmin();
  const { data } = await db.from("studios").select("onboarding_step").eq("id", studioId).single();
  const current = onboardingStepOf(data?.onboarding_step);
  if (ONBOARDING_STEPS.indexOf(step) <= ONBOARDING_STEPS.indexOf(current)) return { ok: true };
  await db.from("studios").update({ onboarding_step: step }).eq("id", studioId);
  revalidatePath("/fauve");
  return { ok: true };
}

/** The step after this one (the card's « on continue » / « plus tard »). */
export async function finishStep(step: OnboardingStep): Promise<{ ok: boolean }> {
  return goToStep(nextOnboardingStep(step));
}

/** Posts and stories a week: what Fauve plans the week with (and reminds her of). */
export async function saveRhythm(posts: number, stories: number, days?: number[]): Promise<{ ok: boolean }> {
  const parsed = z
    .object({ posts: z.number().int().min(0).max(21), stories: z.number().int().min(0).max(50), days: z.array(z.number().int().min(0).max(6)).max(7).optional() })
    .safeParse({ posts, stories, days });
  const studioId = await studioOf();
  if (!parsed.success || !studioId) return { ok: false };
  const { error } = await supabaseAdmin()
    .from("content_plans")
    .upsert(
      {
        studio_id: studioId,
        posts_per_week: parsed.data.posts,
        stories_per_week: parsed.data.stories,
        ...(parsed.data.days?.length ? { post_days: [...new Set(parsed.data.days)].sort((a, b) => a - b) } : {}),
      },
      { onConflict: "studio_id" },
    );
  if (error) return { ok: false };
  return goToStep(nextOnboardingStep("rhythm"));
}
