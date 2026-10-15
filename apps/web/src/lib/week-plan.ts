import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  ANALYST_MODEL,
  dayLabel,
  filmDay,
  normalizeWeekPlan,
  postDaysOf,
  readMemory,
  validTime,
  WEEK,
  shiftDate,
  WEEK_PLANNER_PROMPT,
  weekDates,
  weekMessage,
  weekPlanSchema,
  weekSlots,
  type PlannedItem,
} from "@fauve/agent";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { addDays, localDateOf, localInstant, mondayOf, toIsoDate, weekdayIndex } from "@/lib/dates";
import { messageOwner } from "@/lib/owner-message";
import { latestReport } from "@/lib/performance";
import { defaultPlatforms } from "@/lib/social/tiktok-account";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The weekly routine (see packages/agent/src/week.ts): Simone proposes a week on
// her posting days, she says yes, the publications and her filming list exist.

export const WEEK_OPTIONS = ["Valider ma semaine", "Modifier"];

export type StoredWeek = { id: string; weekStart: string; intro: string; items: PlannedItem[]; status: string };

/** The Monday to plan: next week from Friday on (and on Sunday's routine), this one before. */
export function weekToPlan(timezone: string, which: "this" | "next" | "auto" = "auto", now = new Date()) {
  const today = localDateOf(now, timezone);
  const next = which === "next" || (which === "auto" && weekdayIndex(today) >= 4);
  return { monday: toIsoDate(addDays(mondayOf(today), next ? 7 : 0)), today: toIsoDate(today), tomorrow: toIsoDate(addDays(today, 1)) };
}

const instantOf = (date: string, time: string, timezone: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return localInstant({ year: y!, month: m!, day: d! }, h!, min!, timezone);
};

/**
 * Drafts the week (Sonnet, from her rhythm, memory, last report, bank of shots
 * and site photos) and keeps it as a proposal. Nothing is added to her calendar.
 */
export async function proposeWeek(
  studioId: string,
  options: { which?: "this" | "next" | "auto"; notes?: string; now?: Date } = {},
): Promise<{ week: StoredWeek; message: string } | { error: string }> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("name, business_type, timezone, memory, website_url, booking_url").eq("id", studioId).single();
  if (!studio) return { error: "Studio introuvable." };
  const timezone = (studio.timezone as string) ?? "Europe/Paris";
  const { monday, tomorrow } = weekToPlan(timezone, options.which, options.now);
  const dates = weekDates(monday);
  const start = instantOf(dates[0]!, "00:00", timezone);
  const end = instantOf(shiftDate(dates[6]!, 1), "00:00", timezone);

  const [{ data: rhythm }, { data: existing }, { data: recent }, report, { data: bank }, { data: site }] = await Promise.all([
    db.from("content_plans").select("posts_per_week, stories_per_week, post_days, post_time").eq("studio_id", studioId).maybeSingle(),
    db
      .from("posts")
      .select("kind, scheduled_at")
      .eq("studio_id", studioId)
      .neq("status", "skipped")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString()),
    db.from("posts").select("kind, title, status").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(12),
    latestReport(studioId).catch(() => null),
    db.from("media_assets").select("id, created_at").eq("studio_id", studioId).eq("bank", true).order("created_at", { ascending: false }).limit(20),
    db.from("media_assets").select("id, regions").eq("studio_id", studioId).eq("source", "website").eq("kind", "image").limit(8),
  ]);

  const slots = weekSlots({
    monday,
    postDays: (rhythm?.post_days as number[] | null) ?? null,
    postTime: (rhythm?.post_time as string | null) ?? null,
    postsPerWeek: (rhythm?.posts_per_week as number | null) ?? 3,
    storiesPerWeek: (rhythm?.stories_per_week as number | null) ?? 0,
    existing: (existing ?? []).map((p) => ({
      date: toIsoDate(localDateOf(new Date(p.scheduled_at as string), timezone)),
      story: p.kind === "story",
    })),
    from: tomorrow,
  });
  if (!slots.length) return { error: "Sa semaine est déjà pleine : rien à proposer de plus." };

  const bankIds = (bank ?? []).map((b) => b.id as string);
  const { data: analyses } = bankIds.length
    ? await db.from("clip_analyses").select("media_id, analysis").in("media_id", bankIds).order("created_at", { ascending: false })
    : { data: [] };
  const seen = new Map<string, string>();
  for (const a of analyses ?? []) {
    const summary = (a.analysis as { summary?: string } | null)?.summary;
    if (summary && !seen.has(a.media_id as string)) seen.set(a.media_id as string, summary);
  }
  const known = new Set([...bankIds, ...(site ?? []).map((s) => s.id as string)]);

  const input = {
    commerce: {
      nom: studio.name,
      activite: studio.business_type,
      site: studio.website_url,
      reservation: studio.booking_url,
      memoire: readMemory(studio.memory).map((f) => f.fact),
    },
    slots: slots.map((s) => ({ index: s.index, jour: dayLabel(s.date), date: s.date, heure: s.time, type: s.story ? "story" : "publication" })),
    publications_recentes: (recent ?? []).map((p) => ({ format: p.kind, titre: p.title, statut: p.status })),
    bilan: report ? { lecons: report.lessons, idees: report.ideas } : null,
    banque_de_plans: (bank ?? []).map((b) => ({ media_id: b.id, contenu: seen.get(b.id as string) ?? null })),
    photos_du_site: (site ?? []).map((s) => ({ media_id: s.id, contenu: (s.regions as { notes?: string } | null)?.notes ?? null })),
    ...(options.notes ? { demande_de_la_gerante: options.notes } : {}),
  };

  const response = await anthropic().beta.messages.parse({
    model: ANALYST_MODEL,
    max_tokens: 6000,
    output_config: { effort: "medium", format: betaZodOutputFormat(weekPlanSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: WEEK_PLANNER_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  await logClaudeCost(studioId, response.usage, "week_plan", ANALYST_MODEL);
  if (response.stop_reason === "refusal" || !response.parsed_output) return { error: "Je n'ai pas réussi à préparer la semaine." };

  const items = normalizeWeekPlan(response.parsed_output, slots, known);
  if (!items.length) return { error: "Je n'ai pas réussi à préparer la semaine." };
  const intro = response.parsed_output.intro.trim();

  // A new proposal for the same week replaces the one waiting.
  await db.from("week_plans").update({ status: "replaced" }).eq("studio_id", studioId).eq("week_start", monday).eq("status", "proposed");
  const { data: row, error } = await db
    .from("week_plans")
    .insert({ studio_id: studioId, week_start: monday, intro, items })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Semaine non enregistrée." };
  return { week: { id: row.id as string, weekStart: monday, intro, items, status: "proposed" }, message: weekMessage(intro, items) };
}

/** Her yes: the publications on their days and the filming list, each mission due the day before. */
export async function acceptWeek(studioId: string, planId: string): Promise<{ posts: { id: string; title: string; date: string }[]; films: { label: string; due: string }[] } | { error: string }> {
  const db = supabaseAdmin();
  const { data: plan } = await db.from("week_plans").select("id, status, items").eq("id", planId).eq("studio_id", studioId).maybeSingle();
  if (!plan) return { error: "Semaine introuvable." };
  if (plan.status === "accepted") return { error: "Cette semaine est déjà validée : elle est dans le calendrier." };
  if (plan.status !== "proposed") return { error: "Cette proposition a été remplacée par une plus récente." };
  const { data: studio } = await db.from("studios").select("timezone").eq("id", studioId).single();
  const timezone = (studio?.timezone as string | undefined) ?? "Europe/Paris";
  const today = toIsoDate(localDateOf(new Date(), timezone));

  const posts: { id: string; title: string; date: string }[] = [];
  const films: { label: string; due: string }[] = [];
  for (const item of plan.items as PlannedItem[]) {
    if (item.date < today) continue;
    const { data: post, error } = await db
      .from("posts")
      .insert({
        studio_id: studioId,
        kind: item.format,
        title: item.title,
        agent_note: item.angle,
        scheduled_at: instantOf(item.date, item.time, timezone).toISOString(),
        status: item.media_ids.length ? "media_received" : item.film ? "content_requested" : "planned",
        media_ids: item.media_ids.length ? item.media_ids : null,
        platforms: await defaultPlatforms(studioId, item.format),
        week_plan_id: planId,
      })
      .select("id")
      .single();
    if (error || !post) {
      console.warn("week plan: post not created", error?.message);
      continue;
    }
    posts.push({ id: post.id as string, title: item.title, date: item.date });
    if (item.film) {
      const due = filmDay(item.date, today);
      await db.from("shot_requests").insert({ studio_id: studioId, post_id: post.id, label: item.film.label, hint: item.film.hint, due_date: due });
      films.push({ label: item.film.label, due });
    }
  }
  await db.from("week_plans").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", planId);
  return { posts, films };
}

/** Sends a proposal to the manager: WhatsApp with its buttons, or the app (and the week_ready template). */
export async function sendWeekProposal(studioId: string, week: StoredWeek, message: string) {
  return messageOwner(studioId, {
    text: message,
    options: WEEK_OPTIONS,
    notes: [`semaine proposée week_plan_id=${week.id}`],
    template: { name: "week_ready", params: [String(week.items.length)] },
  });
}

/** The proposal waiting for her yes, if any (shown in Simone's context and the to-do list). */
export async function pendingWeek(studioId: string): Promise<StoredWeek | null> {
  const { data } = await supabaseAdmin()
    .from("week_plans")
    .select("id, week_start, intro, items, status")
    .eq("studio_id", studioId)
    .eq("status", "proposed")
    .gte("week_start", toIsoDate(addDays(localDateOf(new Date(), "Europe/Paris"), -6)))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, weekStart: data.week_start as string, intro: data.intro as string, items: data.items as PlannedItem[], status: "proposed" };
}

/** What Simone knows of the routine at each turn: rhythm and days, the week waiting, the missions due. */
export async function routineLines(studioId: string, timezone: string, now = new Date()): Promise<string[]> {
  const db = supabaseAdmin();
  const today = toIsoDate(localDateOf(now, timezone));
  const [{ data: rhythm }, pending, { data: shots }] = await Promise.all([
    db.from("content_plans").select("posts_per_week, stories_per_week, post_days, post_time").eq("studio_id", studioId).maybeSingle(),
    pendingWeek(studioId),
    db.from("shot_requests").select("id, label, due_date, post_id").eq("studio_id", studioId).eq("done", false).order("due_date").limit(6),
  ]);
  const lines: string[] = [];
  if (rhythm) {
    const chosen = (rhythm.post_days as number[] | null)?.length ? (rhythm.post_days as number[]) : null;
    const days = postDaysOf(chosen, (rhythm.posts_per_week as number) ?? 3).map((d) => WEEK[d]).join(", ");
    lines.push(
      `Rythme : ${rhythm.posts_per_week ?? 0} publications et ${rhythm.stories_per_week ?? 0} stories par semaine ; jours ${chosen ? "choisis" : "par défaut (pas encore choisis : demande-les une fois, set_posting_days)"} : ${days} à ${validTime(rhythm.post_time as string | null)}.`,
    );
  }
  if (pending) {
    lines.push(
      `Semaine du ${dayLabel(pending.weekStart)} proposée, en attente de son oui (week_plan_id=${pending.id}) : ${pending.items.map((i) => `${dayLabel(i.date)} ${i.format} « ${i.title} »`).join(" ; ")}.`,
    );
  } else {
    const { monday } = weekToPlan(timezone, "next", now);
    const { data: next } = await db.from("week_plans").select("id").eq("studio_id", studioId).eq("week_start", monday).eq("status", "accepted").limit(1);
    if (!next?.length && weekdayIndex(localDateOf(now, timezone)) >= 4) {
      lines.push("La semaine prochaine n'est pas encore préparée : propose-la (plan_week) quand c'est le bon moment.");
    }
  }
  // What she sent lately and where it went: Simone thanks her and says it, without asking again.
  const { data: sorted } = await db
    .from("media_assets")
    .select("sorted_why, posts:sorted_post_id(title)")
    .eq("studio_id", studioId)
    .not("sorted_post_id", "is", null)
    .gte("created_at", new Date(now.getTime() - 24 * 3600_000).toISOString())
    .limit(6);
  for (const m of sorted ?? []) {
    const title = (m.posts as unknown as { title: string | null } | null)?.title;
    lines.push(`Vidéo reçue et rangée toute seule dans « ${title ?? "une publication"} » : ${(m.sorted_why as string | null) ?? ""}`);
  }
  for (const shot of shots ?? []) {
    const due = shot.due_date as string | null;
    lines.push(`À filmer${due ? (due < today ? ` (en retard, prévu ${dayLabel(due)})` : due === today ? " aujourd'hui" : ` pour ${dayLabel(due)}`) : ""} : ${shot.label as string} (shot_id=${shot.id as string}${shot.post_id ? `, post_id=${shot.post_id as string}` : ""}).`);
  }
  return lines;
}
