import "server-only";
import {
  ANALYST_MODEL,
  weeklyGrowth,
  type DailyRow,
  editPlanSchema,
  isMotionSegment,
  MIN_POSTS_FOR_ANALYSIS,
  PERFORMANCE_PROMPT,
  performanceReportSchema,
  segmentSeconds,
  type PerformanceReport,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { z } from "zod";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { mediaInsights, recentMedia } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";
import { supabaseAdmin } from "@/lib/supabase/admin";

// "Ce qui marche": reads the studio's latest Instagram posts with their numbers,
// adds the recipe of the Reels Fauve made, and has the analyst say what works.
// The report is kept in weekly_reports; its lessons feed the editor.

const POSTS = 30;
const INSIGHT_CONCURRENCY = 6;

export type StoredReport = PerformanceReport & { createdAt: string; posts: number };

/** weekly_reports.suggestions as stored by analyzePerformance. */
const storedSuggestions = performanceReportSchema.omit({ summary: true }).extend({ posts: z.number().default(0) });

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

/** What Fauve's montage did, in a few fields the analyst can compare. */
function recipeOf(plan: unknown) {
  const parsed = editPlanSchema.safeParse(plan);
  if (!parsed.success) return undefined;
  const p = parsed.data;
  return {
    duree_s: Math.round(p.duration),
    gabarit: p.template,
    accroche: p.texts.find((t) => t.style === "hook")?.text,
    plans_video: p.segments.filter((s) => "clip_id" in s).length,
    scenes_animees: p.segments.filter((s) => isMotionSegment(s) || "scene" in s).length,
    ouverture_animee: p.segments[0] ? !("clip_id" in p.segments[0]) : false,
    premier_plan_s: p.segments[0] ? Math.round(segmentSeconds(p.segments[0]) * 10) / 10 : undefined,
    sous_titres: p.subtitles,
  };
}

/** The studio's latest report, if any. */
export async function latestReport(studioId: string): Promise<StoredReport | null> {
  const { data } = await supabaseAdmin()
    .from("weekly_reports")
    .select("summary, suggestions, created_at")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const parsed = storedSuggestions.safeParse(data.suggestions);
  if (!parsed.success) return null;
  return { summary: data.summary as string, ...parsed.data, createdAt: data.created_at as string };
}

/** Runs the analysis now and stores it. */
export async function analyzePerformance(studioId: string): Promise<StoredReport | { error: string }> {
  const account = await instagramAccount(studioId);
  if (!account) return { error: "Instagram n'est pas connecté." };

  const media = await recentMedia(account.userId, account.accessToken, POSTS);
  if (media.length < MIN_POSTS_FOR_ANALYSIS) return { error: `Pas encore assez de posts (${media.length}) pour en tirer des leçons.` };

  const db = supabaseAdmin();
  const [{ data: studio }, { data: fauvePosts }] = await Promise.all([
    db.from("studios").select("timezone").eq("id", studioId).single(),
    db.from("posts").select("external_ids, edit_plan_id").eq("studio_id", studioId).not("external_ids->instagram->>media_id", "is", null),
  ]);
  // Reels Fauve made: the recipe of their montage, by Instagram media id.
  const planIds = (fauvePosts ?? []).flatMap((p) => (p.edit_plan_id ? [p.edit_plan_id as string] : []));
  const { data: plans } = planIds.length ? await db.from("edit_plans").select("id, plan").in("id", planIds) : { data: [] };
  const planById = new Map((plans ?? []).map((p) => [p.id as string, p.plan]));
  const recipes = new Map<string, unknown>();
  for (const p of fauvePosts ?? []) {
    const mediaId = (p.external_ids as { instagram?: { media_id?: string } }).instagram?.media_id;
    if (mediaId && p.edit_plan_id) recipes.set(mediaId, recipeOf(planById.get(p.edit_plan_id as string)));
  }

  const timezone = (studio?.timezone as string | undefined) ?? "Europe/Paris";
  const when = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", timeZone: timezone });
  const rows = await inBatches(media, INSIGHT_CONCURRENCY, async (m) => {
    const insights = await mediaInsights(m.id, account.accessToken).catch(() => ({}));
    const caption = m.caption ?? "";
    return {
      id: m.id,
      type: m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carrousel" : m.media_type === "VIDEO" ? "vidéo" : "photo",
      date: m.timestamp ? when.format(new Date(m.timestamp)) : undefined,
      legende: caption.slice(0, 140),
      longueur_legende: caption.length,
      hashtags: (caption.match(/#\w+/gu) ?? []).length,
      ...insights,
      likes: (insights as { likes?: number }).likes ?? m.like_count,
      comments: (insights as { comments?: number }).comments ?? m.comments_count,
      fauve: recipes.get(m.id),
    };
  });

  // The account week by week (new followers, unfollows, views, profile visits, link taps), when read.
  const { data: days } = await supabaseAdmin()
    .from("account_daily")
    .select("day, followers, new_followers, unfollows, views, reach, profile_views, link_taps, interactions")
    .eq("studio_id", studioId)
    .eq("platform", "instagram")
    .gte("day", new Date(Date.now() - 9 * 7 * 86_400_000).toISOString().slice(0, 10))
    .order("day");
  const compte_par_semaine = weeklyGrowth((days ?? []) as DailyRow[], 8)
    .filter((w) => w.days > 0)
    .map((w) => ({ semaine_du: w.start, nouveaux_abonnes: w.newFollowers, desabonnements: w.unfollows, solde: w.net, abonnes: w.followers, vues: w.views, visites_profil: w.profileViews, clics_lien: w.linkTaps }));

  const response = await anthropic().beta.messages.parse({
    model: ANALYST_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: outputFormat(performanceReportSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: PERFORMANCE_PROMPT,
    messages: [{ role: "user", content: JSON.stringify({ posts: rows, ...(compte_par_semaine.length ? { compte_par_semaine } : {}) }) }],
  });
  await logClaudeCost(studioId, response.usage, "performance", ANALYST_MODEL);
  if (response.stop_reason === "refusal" || !response.parsed_output) return { error: "L'analyse n'a pas abouti." };
  const report = response.parsed_output;

  const today = new Date();
  const start = new Date(today.getTime() - 30 * 24 * 3600_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const { error } = await db.from("weekly_reports").upsert(
    {
      studio_id: studioId,
      period_start: day(start),
      period_end: day(today),
      summary: report.summary,
      suggestions: { lessons: report.lessons, ideas: report.ideas, best: report.best, posts: rows.length },
      created_at: today.toISOString(),
    },
    { onConflict: "studio_id,period_start,period_end" },
  );
  if (error) console.warn("weekly_reports: not stored", error.message);
  return { ...report, createdAt: today.toISOString(), posts: rows.length };
}
