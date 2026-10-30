import "server-only";
import { periodTotals, WEEKLY_IDEA_OPTIONS, weeklyPublicParams, weeklyReportText, weeklySummaryParams, type DailyRow } from "@fauve/agent";
import { type StoredReport } from "@/lib/performance";
import { messageOwner, ownerWhatsApp } from "@/lib/owner-message";
import { publicHistory } from "@/lib/social/public-stats";
import { instagramAccount } from "@/lib/social/publish";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendFirstTemplate, sendReply } from "@/lib/whatsapp/client";

// The Sunday report as Edith sends it, always warm and encouraging (Tristan: « friendly et encourageant
// toujours »): the week's figures against the week before, the analyst's summary, the lesson that matters
// most and one idea she can say yes to. Inside the 24 h window, on WhatsApp at once, free. Outside it, no
// template straight away (Meta moved weekly_summary to Marketing, billed and capped per person): it waits
// in the app's conversation and goes on WhatsApp right after Edith's next answer to her (« Au fait, … »);
// only when she has not written for WAIT_DAYS does the neutral weekly_statement template carry its figures.

const DAY_MS = 86_400_000;
/** Days a report waits for her next message before its template goes. */
const WAIT_DAYS = 3;
/** Past this, a report still waiting is dropped: next Sunday's replaces it. */
const KEEP_DAYS = 7;

type Waiting = { id: string; studio_id: string; body: string; created_at: string; payload: Record<string, unknown> & { awaiting?: { params: string[] }; options?: string[] } };

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
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [posts, days] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "published").gte("published_at", since.toISOString()),
    db.from("account_daily").select("*").eq("studio_id", studioId).eq("platform", "instagram").gte("day", since.toISOString().slice(0, 10)),
  ]);
  const totals = periodTotals((days.data ?? []) as DailyRow[], since.toISOString().slice(0, 10));
  return weeklySummaryParams({ posts: posts.count ?? 0, profileVisits: totals.profileViews, linkTaps: totals.linkTaps });
}

/** Her reports still waiting for WhatsApp (in the app's conversation), newest first. */
async function waiting(studioId: string | null, olderThan?: number): Promise<Waiting[]> {
  let query = supabaseAdmin()
    .from("whatsapp_messages")
    .select("id, studio_id, body, created_at, payload")
    .eq("channel", "web")
    .eq("direction", "outbound")
    .eq("payload->>kind", "weekly_report")
    .not("payload->awaiting", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (studioId) query = query.eq("studio_id", studioId);
  if (olderThan) query = query.lt("created_at", new Date(olderThan).toISOString());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Waiting[];
}

/** No longer waiting: sent (its WhatsApp id kept, for Meta's delivery statuses) or dropped. */
async function settle(row: Waiting, sent?: { id: string | undefined; via: string }) {
  const payload = { ...row.payload };
  delete payload.awaiting;
  await supabaseAdmin()
    .from("whatsapp_messages")
    .update({ ...(sent?.id ? { wa_message_id: sent.id } : {}), payload: { ...payload, ...(sent ? { sent_via: sent.via } : { dropped: true }) } })
    .eq("id", row.id);
}

/** « Au fait, ton bilan de la semaine : … », after her own message was answered. */
const lateText = (body: string) => `Au fait, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;

/** The Sunday report of one studio, on WhatsApp now or waiting for her next message. */
export async function sendWeeklyReport(studioId: string, report: StoredReport): Promise<void> {
  const figures = await weekFigures(studioId);
  const idea = report.ideas[0];
  const owner = await ownerWhatsApp(studioId).catch(() => null);
  // Last week's, still waiting: this one replaces it.
  for (const row of await waiting(studioId)) await settle(row);
  await messageOwner(studioId, {
    text: weeklyReportText({ figures, summary: report.summary, lesson: report.lessons[0]?.lesson, idea }),
    kind: "weekly_report",
    ...(idea ? { options: WEEKLY_IDEA_OPTIONS } : {}),
    // Outside the window: kept in the app with what its template would say, until she writes.
    ...(owner && !owner.open ? { payload: { awaiting: { params: figures } } } : {}),
  });
}

/** Right after Edith answered her on WhatsApp: the report that waited for her, with its buttons. */
export async function deliverWaitingReport(studioId: string, waId: string): Promise<void> {
  const [row] = await waiting(studioId);
  if (!row || Date.now() - Date.parse(row.created_at) > KEEP_DAYS * DAY_MS) return;
  const id = await sendReply(waId, lateText(row.body), row.payload.options);
  await settle(row, { id, via: "reply" });
}

/**
 * Each morning: the reports that waited WAIT_DAYS without a message from her go as the weekly_statement
 * template (weekly_summary while Meta reviews it), or as a message if she wrote meanwhile; those older
 * than a week are dropped.
 */
export async function sendDueReports(): Promise<number> {
  const now = Date.now();
  let sent = 0;
  for (const row of await waiting(null, now - WAIT_DAYS * DAY_MS)) {
    try {
      if (now - Date.parse(row.created_at) > KEEP_DAYS * DAY_MS) {
        await settle(row);
        continue;
      }
      const owner = await ownerWhatsApp(row.studio_id);
      if (!owner) {
        await settle(row);
        continue;
      }
      if (owner.open) {
        await settle(row, { id: await sendReply(owner.waId, lateText(row.body), row.payload.options), via: "message" });
      } else {
        const params = row.payload.awaiting?.params ?? [];
        const done = await sendFirstTemplate(owner.waId, [
          { name: "weekly_statement", params },
          { name: "weekly_summary", params },
        ]);
        await settle(row, { id: done.id, via: done.name });
      }
      sent++;
    } catch (error) {
      console.error("weekly report not sent", row.studio_id, error);
    }
  }
  return sent;
}
