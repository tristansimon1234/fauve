import { PageSuspense } from "@/components/page-suspense";
import { platformSchema, postKindSchema } from "@fauve/agent";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { EmptyState, NoStudio } from "@/components/empty-state";
import { CheckIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { daysBefore } from "@/lib/dates";
import { formatNumber, formatShortDate, kindLabels } from "@/lib/format";
import { getStudioContext, rows } from "@/lib/studio";
import { RefreshReportButton } from "./refresh-button";

export const metadata: Metadata = { title: "Résultats" };

const periods = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
] as const;

const count = z.number().int().nullable();
const metricSchema = z.object({
  post_id: z.uuid(),
  platform: platformSchema,
  captured_at: z.string(),
  views: count,
  reach: count,
  likes: count,
  saves: count,
  shares: count,
  comments: count,
  profile_visits: count,
});
type Metric = z.infer<typeof metricSchema>;
type Totals = Record<"views" | "reach" | "likes" | "saves" | "shares" | "comments" | "profile_visits", number | null>;
const FIELDS = ["views", "reach", "likes", "saves", "shares", "comments", "profile_visits"] as const;

const reportSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  summary: z.string(),
  // Written by lib/performance.ts: lessons with their evidence, and ideas for the week.
  suggestions: z
    .object({
      lessons: z.array(z.object({ lesson: z.string(), evidence: z.string() })).catch([]),
      ideas: z.array(z.string()).catch([]),
      posts: z.number().optional(),
    })
    .catch({ lessons: [], ideas: [] }),
});

export default function ResultsPage({ searchParams }: PageProps<"/resultats">) {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <PageSuspense title="Résultats">
        <Results searchParams={searchParams} />
      </PageSuspense>
    </main>
  );
}

function sum(list: Metric[]): Totals {
  const totals = Object.fromEntries(FIELDS.map((f) => [f, null])) as Totals;
  for (const m of list) {
    for (const f of FIELDS) {
      const value = m[f];
      if (value !== null) totals[f] = (totals[f] ?? 0) + value;
    }
  }
  return totals;
}

async function Results({ searchParams }: { searchParams: PageProps<"/resultats">["searchParams"] }) {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;

  const { periode } = await searchParams;
  const period = periods.find((p) => p.key === periode) ?? periods[1];
  const since = daysBefore(new Date(), period.days).toISOString();

  const [metricsResult, bookingsResult, reportResult] = await Promise.all([
    db
      .from("metrics")
      .select("post_id, platform, captured_at, views, reach, likes, saves, shares, comments, profile_visits")
      .eq("studio_id", studioId)
      .gte("captured_at", since)
      .order("captured_at", { ascending: false })
      .limit(2000),
    db
      .from("bookings_attribution")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .gte("created_at", since),
    db
      .from("weekly_reports")
      .select("period_start, period_end, summary, suggestions")
      .eq("studio_id", studioId)
      .order("period_end", { ascending: false })
      .limit(1),
  ]);
  if (bookingsResult.error) throw new Error(`bookings_attribution: ${bookingsResult.error.message}`);
  const report = rows(reportSchema, reportResult, "weekly_reports")[0] ?? null;

  // Metrics are snapshots: keep the latest one per post and platform.
  const latest = new Map<string, Metric>();
  for (const m of rows(metricSchema, metricsResult, "metrics")) {
    const key = `${m.post_id}:${m.platform}`;
    if (!latest.has(key)) latest.set(key, m);
  }
  const snapshots = [...latest.values()];
  const bookings = bookingsResult.count ?? 0;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Résultats</h1>
        <p className="text-[15px] text-muted">Instagram et TikTok · {period.days} derniers jours</p>
      </div>
      <nav aria-label="Période" className="flex gap-1.5 rounded-full bg-soft p-1">
        {periods.map((p) => (
          <Link
            key={p.key}
            href={`/resultats?periode=${p.key}`}
            aria-current={period.key === p.key ? "page" : undefined}
            className={`flex h-10 items-center rounded-full px-4.5 text-sm font-bold ${
              period.key === p.key ? "bg-ink text-white" : "text-muted"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
    </div>
  );

  if (!snapshots.length && !bookings && !report) {
    return (
      <>
        {header}
        <EmptyState title="Tes résultats arrivent après tes premières publications" className="max-w-[760px]">
          Dès que tes posts seront en ligne sur Instagram ou TikTok, tu verras ici ce qu’ils ont donné : les réservations
          venues des réseaux d’abord, puis les vues, les comptes touchés et le bilan de Simone. Tu peux déjà demander à
          Simone d’analyser tes posts Instagram existants.
        </EmptyState>
        <RefreshReportButton label="Analyser mes posts Instagram" />
      </>
    );
  }

  const totals = sum(snapshots);
  const byPost = new Map<string, Metric[]>();
  for (const m of snapshots) byPost.set(m.post_id, [...(byPost.get(m.post_id) ?? []), m]);
  const ranked = [...byPost.entries()]
    .map(([postId, list]) => ({ postId, totals: sum(list) }))
    .sort((a, b) => (b.totals.views ?? b.totals.reach ?? 0) - (a.totals.views ?? a.totals.reach ?? 0))
    .slice(0, 3);

  const titles = new Map<string, { title: string; kind: z.infer<typeof postKindSchema> }>();
  if (ranked.length) {
    const posts = rows(
      z.object({ id: z.uuid(), title: z.string(), kind: postKindSchema }),
      await db
        .from("posts")
        .select("id, title, kind")
        .eq("studio_id", studioId)
        .in(
          "id",
          ranked.map((r) => r.postId),
        ),
      "posts",
    );
    for (const p of posts) titles.set(p.id, p);
  }

  const show = (value: number | null) => (value === null ? "—" : formatNumber(value));
  const kpis: [string, string, string][] = [
    ["Réservations venues des réseaux", formatNumber(bookings), "via tes liens de réservation suivis"],
    ["Vues", show(totals.views), "Reels, posts et stories"],
    ["Comptes touchés", show(totals.reach), "personnes différentes"],
    ["Visites du profil", show(totals.profile_visits), "depuis tes publications"],
  ];
  // The first KPI (bookings from social media) is the product's headline number.
  const kpiStyles = ["bg-violet text-white", "bg-peach text-ink", "bg-soft text-ink", "bg-soft text-ink"];

  return (
    <>
      {header}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {kpis.map(([label, value, detail], i) => (
          <div key={label} className={`flex flex-col gap-2 rounded-[20px] p-5 ${kpiStyles[i]}`}>
            <span className="text-sm font-semibold opacity-85">{label}</span>
            <span className="text-4xl font-extrabold tracking-[-0.02em]">{value}</span>
            <span className="text-[13px] font-semibold opacity-85">{detail}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-[22px] bg-soft p-6">
          <div className="flex items-center gap-2.5">
            <Orb size={32} />
            <h2 className="text-lg font-bold">Ce qui marche chez toi</h2>
          </div>
          {report ? (
            <>
              <span className="text-xs font-bold text-muted">
                Tes posts du {formatShortDate(`${report.period_start}T12:00:00Z`, "UTC")} au{" "}
                {formatShortDate(`${report.period_end}T12:00:00Z`, "UTC")}
                {report.suggestions.posts ? ` · ${report.suggestions.posts} posts analysés` : ""}
              </span>
              <p className="text-[15px] leading-[1.65] whitespace-pre-line">{report.summary}</p>
              {report.suggestions.lessons.length > 0 && (
                <ol className="flex flex-col gap-3">
                  {report.suggestions.lessons.map((l, i) => (
                    <li key={l.lesson} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold">{l.lesson}</span>
                        <span className="text-[13px] text-muted">{l.evidence}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {report.suggestions.ideas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-extrabold tracking-[.06em] text-muted">CETTE SEMAINE, JE PROPOSE</span>
                  {report.suggestions.ideas.map((s) => (
                    <span key={s} className="flex gap-2.5 text-sm font-semibold">
                      <CheckIcon size={18} className="shrink-0 text-violet" />
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[13px] text-muted">Simone applique ces leçons à tes prochains montages. Le bilan se met à jour chaque dimanche.</p>
              <RefreshReportButton label="Refaire l’analyse" />
            </>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-muted">
                Simone compare tes derniers posts Instagram (formats, accroches, heures, chiffres) pour te dire ce qui marche,
                avec les preuves. Le bilan arrive chaque dimanche.
              </p>
              <RefreshReportButton />
            </>
          )}
        </section>

        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 rounded-[22px] border border-line p-5.5">
          <h2 className="text-base font-bold">Ce qui a le mieux marché</h2>
          {ranked.length ? (
            ranked.map(({ postId, totals: t }) => {
              const post = titles.get(postId);
              return (
                <Link key={postId} href={`/publications/${postId}`} className="flex items-center gap-3.5 hover:text-violet">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold">{post?.title ?? "Publication"}</span>
                    <span className="text-[13px] text-muted">
                      {post ? kindLabels[post.kind] : ""}
                      {t.saves ? ` · ${formatNumber(t.saves)} enregistrements` : ""}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold whitespace-nowrap text-violet">
                    {t.views !== null
                      ? `${formatNumber(t.views)} vues`
                      : t.reach !== null
                        ? `${formatNumber(t.reach)} comptes touchés`
                        : "—"}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-muted">Pas encore de statistiques sur cette période.</p>
          )}
        </section>
      </div>
      <p className="text-[13px] text-muted">Pour chaque publication, le dernier relevé des {period.days} derniers jours.</p>
    </>
  );
}
