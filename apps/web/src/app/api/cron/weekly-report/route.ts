import { timingSafeEqual } from "node:crypto";
import { periodTotals, WEEKLY_IDEA_OPTIONS, weeklyPublicParams, weeklyReportText, weeklySummaryParams, type DailyRow } from "@fauve/agent";
import { after } from "next/server";
import { env } from "@/lib/env";
import { analyzePerformance, type StoredReport } from "@/lib/performance";
import { studioAccess } from "@/lib/billing/access";
import { messageOwner } from "@/lib/owner-message";
import { publicHistory } from "@/lib/social/public-stats";
import { instagramAccount } from "@/lib/social/publish";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The Sunday report ("ce qui marche"), called weekly by pg_cron with CRON_SECRET: every studio with
// Instagram connected or followed from its @ gets its analysis, then a message from Edith, always warm
// and encouraging (Tristan: « friendly et encourageant toujours »): the week's figures against the week
// before, the analyst's summary, the lesson that matters most and one idea she can say yes to
// (messageOwner: on WhatsApp with its buttons inside the 24 h window, else the weekly_summary template
// with the figures; always in the app's conversation, where Edith reads it at her next answer).
// Each studio in its own invocation (?studio=…): one after the other in a single 300 s function, the
// studios past the fiftieth or so were never reached.
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function notify(studioId: string, report: StoredReport) {
  const figures = await weekFigures(studioId);
  const idea = report.ideas[0];
  await messageOwner(studioId, {
    text: weeklyReportText({ figures, summary: report.summary, lesson: report.lessons[0]?.lesson, idea }),
    kind: "weekly_report",
    ...(idea ? { options: WEEKLY_IDEA_OPTIONS } : {}),
    template: { name: "weekly_summary", params: figures },
  });
}

/**
 * The week's three figures. Instagram connected: posts put online, profile visits and link taps. From
 * her @: the videos she put online, the views her videos gained and her followers, each against the
 * week before (Tristan: « vs la semaine précédente hein ? »).
 */
async function weekFigures(studioId: string): Promise<string[]> {
  if (!(await instagramAccount(studioId))) {
    const { all, fresh } = await publicHistory(studioId, 2);
    const [before, week] = all;
    return weeklyPublicParams({ ...week!, fresh }, before ?? null);
  }
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [posts, days] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "published").gte("published_at", since.toISOString()),
    db.from("account_daily").select("*").eq("studio_id", studioId).eq("platform", "instagram").gte("day", since.toISOString().slice(0, 10)),
  ]);
  const totals = periodTotals((days.data ?? []) as DailyRow[], since.toISOString().slice(0, 10));
  return weeklySummaryParams({ posts: posts.count ?? 0, profileVisits: totals.profileViews, linkTaps: totals.linkTaps });
}

/** One studio's report and its message. */
async function reportOne(studioId: string) {
  try {
    if (!(await studioAccess(studioId)).unlock) return;
    const report = await analyzePerformance(studioId);
    if ("error" in report) {
      console.warn("weekly report not made", studioId, report.error);
      return;
    }
    await notify(studioId, report).catch((e) => console.warn("weekly report: notification failed", studioId, e));
  } catch (error) {
    console.error("weekly report failed", studioId, error);
  }
}

const PAGE = 500;
/** Invocations started together, then a pause: the analyses (Sonnet) run side by side, never hundreds at once. */
const FAN_OUT = 10;
const PAUSE_MS = 5_000;
/** Past this, the rest is handed to a new invocation (?from=…): this one has 300 s. */
const HAND_OVER_MS = 220_000;

const call = (query: string) =>
  fetch(`${env("APP_URL")}/api/cron/weekly-report?${query}`, { method: "POST", headers: { authorization: `Bearer ${env("CRON_SECRET")}` } });

/** Every studio with Instagram connected or an @ (page by page: a query returns 1 000 rows at most), each sent to its own invocation. */
async function fanOut(start: number) {
  const began = Date.now();
  const studios = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin()
      .from("social_accounts")
      .select("studio_id")
      .eq("platform", "instagram")
      .eq("status", "connected")
      .order("studio_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) studios.add(row.studio_id as string);
    if ((data ?? []).length < PAGE) break;
  }
  // And those followed from their @ without connecting (public-stats.ts: paid plans only, checked by the analysis).
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin()
      .from("studios")
      .select("id")
      .or("instagram_handle.not.is.null,tiktok_handle.not.is.null")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) studios.add(row.id as string);
    if ((data ?? []).length < PAGE) break;
  }
  const list = [...studios].sort();
  for (let i = start; i < list.length; i += FAN_OUT) {
    if (Date.now() - began > HAND_OVER_MS) {
      const res = await call(`from=${i}`).catch((error: unknown) => error as Error);
      if (res instanceof Error || !res.ok) console.error("weekly reports: the rest not handed over", i, list.length);
      return;
    }
    await Promise.all(
      list.slice(i, i + FAN_OUT).map(async (studioId) => {
        const res = await call(`studio=${encodeURIComponent(studioId)}`).catch((error: unknown) => error as Error);
        // Its own invocation refused (a loop Vercel stops): this one makes it.
        if (res instanceof Error || !res.ok) await reportOne(studioId);
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  console.log("weekly reports sent", list.length - start);
}

async function handle(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const studio = new URL(request.url).searchParams.get("studio");
  // pg_cron does not wait: answer now, work in the background.
  if (studio) {
    if (!/^[0-9a-f-]{36}$/.test(studio)) return Response.json({ error: "studio" }, { status: 400 });
    after(() => reportOne(studio));
    return Response.json({ queued: studio }, { status: 202 });
  }
  const from = Number(new URL(request.url).searchParams.get("from") ?? 0);
  after(() => fanOut(Number.isInteger(from) && from >= 0 ? from : 0).catch((error) => console.error("weekly reports: fan-out failed", error)));
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
