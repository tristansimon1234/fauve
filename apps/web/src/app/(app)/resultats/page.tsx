import { PageSuspense } from "@/components/page-suspense";
import { bestMoments, byFormat, followerSeries, periodTotals, platformSchema, postKindSchema, suggestedMoment, weeklyGrowth, type PostStat } from "@fauve/agent";
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
import { FollowersChart, FormatTable, Ranking, WeeklyBars } from "./growth";
import { FollowersLine } from "./followers-line";

export const metadata: Metadata = { title: "Résultats" };

const periods = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
] as const;
const WEEKS = 12;

const nullableInt = z.number().nullable().catch(null);
const dailySchema = z.object({
  platform: platformSchema,
  day: z.string(),
  followers: nullableInt,
  new_followers: nullableInt,
  unfollows: nullableInt,
  views: nullableInt,
  reach: nullableInt,
  profile_views: nullableInt,
  link_taps: nullableInt,
  interactions: nullableInt,
});
const audienceSchema = z.record(z.string(), z.array(z.object({ key: z.string(), value: z.number() }))).catch({});

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

  const [metricsResult, bookingsResult, reportResult, dailyResult, audienceResult] = await Promise.all([
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
    db
      .from("account_daily")
      .select("platform, day, followers, new_followers, unfollows, views, reach, profile_views, link_taps, interactions")
      .eq("studio_id", studioId)
      .gte("day", daysBefore(new Date(), WEEKS * 7 + 7).toISOString().slice(0, 10))
      .order("day"),
    db.from("account_audience").select("data").eq("studio_id", studioId).eq("platform", "instagram").order("captured_on", { ascending: false }).limit(1).maybeSingle(),
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

  // The account itself, day by day (lib/social/account-stats.ts).
  const daily = rows(dailySchema, dailyResult, "account_daily");
  const igDaily = daily.filter((d) => d.platform === "instagram");
  const ttDaily = daily.filter((d) => d.platform === "tiktok");
  const from = since.slice(0, 10);
  const ig = periodTotals(igDaily, from);
  const tt = ttDaily.length ? periodTotals(ttDaily, from) : null;
  const weeks = weeklyGrowth(igDaily, WEEKS);
  // The total, day by day over the period (Instagram worked back from its daily gains and losses).
  const igLine = followerSeries(igDaily, period.days);
  const ttLine = followerSeries(ttDaily, period.days);
  const ttWeeks = ttDaily.length ? weeklyGrowth(ttDaily, WEEKS) : null;
  const audience = audienceSchema.parse((audienceResult.data as { data?: unknown } | null)?.data ?? {});
  const tz = member.studio.timezone;

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

  if (!snapshots.length && !bookings && !report && !daily.length) {
    return (
      <>
        {header}
        <EmptyState title="Tes résultats arrivent après tes premières publications" className="max-w-[760px]">
          Dès que tes posts seront en ligne sur Instagram ou TikTok, tu verras ici ce qu’ils ont donné : les réservations
          venues des réseaux d’abord, puis les clics sur ton lien, les visites de ton profil et le bilan d’Edith. Tu peux déjà demander à
          Edith d’analyser tes posts Instagram existants.
        </EmptyState>
        <RefreshReportButton label="Analyser mes posts Instagram" />
      </>
    );
  }

  const totals = sum(snapshots);
  const byPost = new Map<string, Metric[]>();
  for (const m of snapshots) byPost.set(m.post_id, [...(byPost.get(m.post_id) ?? []), m]);
  // Ranked by what brings clients (profile visits, saves, shares), not by views.
  const interest = (t: Totals) => (t.profile_visits ?? 0) + (t.saves ?? 0) + (t.shares ?? 0);
  const ranked = [...byPost.entries()]
    .map(([postId, list]) => ({ postId, totals: sum(list) }))
    .sort((a, b) => interest(b.totals) - interest(a.totals) || (b.totals.views ?? b.totals.reach ?? 0) - (a.totals.views ?? a.totals.reach ?? 0))
    .slice(0, 3);

  const titles = new Map<string, { title: string; kind: z.infer<typeof postKindSchema>; published_at: string | null }>();
  if (byPost.size) {
    const posts = rows(
      z.object({ id: z.uuid(), title: z.string(), kind: postKindSchema, published_at: z.string().nullable() }),
      await db
        .from("posts")
        .select("id, title, kind, published_at")
        .eq("studio_id", studioId)
        .in("id", [...byPost.keys()]),
      "posts",
    );
    for (const p of posts) titles.set(p.id, p);
  }
  // Each post's numbers (Instagram first), for the formats and the best moments.
  const postStats: PostStat[] = [...byPost.entries()].flatMap(([postId, list]) => {
    const post = titles.get(postId);
    const m = list.find((x) => x.platform === "instagram") ?? list[0]!;
    return post ? [{ kind: post.kind, publishedAt: post.published_at, views: m.views, reach: m.reach, likes: m.likes, comments: m.comments, saves: m.saves, shares: m.shares, profileVisits: m.profile_visits }] : [];
  });
  const formats = byFormat(postStats);
  const moments = bestMoments(postStats, tz);
  const moment = suggestedMoment(moments);
  const momentUnit = moments.by === "visits" ? "visites" : "vues";

  const show = (value: number | null) => (value === null ? "—" : formatNumber(value));
  const signed = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(n))}`);
  const gained = ig.newFollowers ?? ig.net;
  // Clients first: bookings, then the steps towards one (link taps, profile visits), then followers. Views come last, in the weekly bars.
  const profileVisits = ig.profileViews ?? totals.profile_visits;
  const kpis: [string, string, string][] = [
    ["Réservations venues des réseaux", formatNumber(bookings), "via tes liens de réservation suivis"],
    ["Clics sur ton lien", show(ig.linkTaps), ig.linkTaps !== null ? "depuis ton profil : ta réservation, ton site" : "dès que ton lien est dans ta bio"],
    ["Visites du profil", show(profileVisits), ig.views !== null ? `pour ${formatNumber(ig.views)} vues sur ton compte` : "le premier pas vers une réservation"],
    [
      "Nouveaux abonnés",
      gained === null ? "—" : `${ig.newFollowers === null ? signed(gained) : `+${formatNumber(gained)}`}`,
      ig.newFollowers !== null && ig.unfollows !== null
        ? `${formatNumber(ig.unfollows)} désabonnements · solde ${signed(ig.net)}${ig.followers !== null ? ` · ${formatNumber(ig.followers)} au total` : ""}`
        : ig.followers !== null
          ? `${formatNumber(ig.followers)} abonnés Instagram au total`
          : "Instagram, relevé chaque jour",
    ],
  ];
  // The first KPI (bookings from social media) is the product's headline number.
  const kpiStyles = ["bg-violet text-white", "bg-peach text-ink", "bg-soft text-ink", "bg-soft text-ink"];
  const hasWeeks = weeks.some((w) => w.days > 0);

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

      <section className="flex flex-col gap-4 rounded-[22px] border border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Tes abonnés, semaine par semaine</h2>
          {ig.followers !== null && <span className="text-[13px] font-semibold text-muted">{formatNumber(ig.followers)} abonnés sur Instagram</span>}
        </div>
        {(igLine.length > 1 || ttLine.length > 1) && (
          <div className="flex flex-wrap gap-6">
            <FollowersLine label="Instagram" points={igLine} timeZone={tz} />
            <FollowersLine label="TikTok" points={ttLine} timeZone={tz} />
          </div>
        )}
        {hasWeeks ? (
          <>
            <span className="text-xs font-extrabold tracking-[.06em] text-muted">CHAQUE SEMAINE</span>
            <FollowersChart weeks={weeks} timeZone={tz} />
            <div className="flex flex-wrap gap-3">
              <WeeklyBars weeks={weeks} pick={(w) => w.linkTaps} label="Clics sur ton lien" timeZone={tz} />
              <WeeklyBars weeks={weeks} pick={(w) => w.profileViews} label="Visites du profil" timeZone={tz} />
              <WeeklyBars weeks={weeks} pick={(w) => w.interactions} label="Interactions" timeZone={tz} />
              <WeeklyBars weeks={weeks} pick={(w) => w.views} label="Vues" timeZone={tz} />
            </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            Edith relève les chiffres de ton compte Instagram chaque jour (nouveaux abonnés, désabonnements, vues, visites du profil, clics) et remonte jusqu’à 30 jours en arrière.
            Les premières semaines apparaissent ici dans l’heure qui suit la connexion.
          </p>
        )}
        {tt && ttWeeks && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="text-[14px] font-bold">
              TikTok{tt.followers !== null ? ` · ${formatNumber(tt.followers)} abonnés` : ""}
              {tt.net !== null ? <span className="font-semibold text-muted"> · {signed(tt.net)} sur la période</span> : null}
            </span>
            <FollowersChart weeks={ttWeeks} timeZone={tz} />
          </div>
        )}
      </section>

      {(formats.length > 0 || moments.days.length > 0) && (
        <div className="flex flex-wrap items-start gap-6">
          {formats.length > 0 && (
            <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-[22px] border border-line p-5.5">
              <h2 className="text-base font-bold">Ce que rapporte chaque format</h2>
              <FormatTable rows={formats} labels={kindLabels} />
              <p className="text-[12px] text-muted">Moyenne par publication d’Edith sur la période, le format qui donne le plus envie en premier. Intérêt : visites du profil, enregistrements et partages rapportés aux comptes touchés, les signes qu’un futur client s’intéresse à toi.</p>
            </section>
          )}
          {moments.days.length > 0 && (
            <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[22px] border border-line p-5.5">
              <h2 className="text-base font-bold">Tes meilleurs moments</h2>
              {moment && (
                <p className="rounded-[14px] bg-violet-tint px-3.5 py-2.5 text-[14px] font-semibold text-violet">
                  D’après tes posts, publie plutôt {moment}.
                </p>
              )}
              <Ranking items={moments.days.slice(0, 4)} unit={momentUnit} />
              {moments.slots.length > 1 && (
                <>
                  <span className="text-xs font-extrabold tracking-[.06em] text-muted">DANS LA JOURNÉE</span>
                  <Ranking items={moments.slots} unit={momentUnit} />
                </>
              )}
              <p className="text-[12px] text-muted">
                {moments.by === "visits" ? "Visites du profil" : "Vues"} moyennes selon le jour et l’heure de publication. Plus il y a de posts, plus c’est fiable.
              </p>
            </section>
          )}
        </div>
      )}

      {Boolean(audience.city?.length || audience.age?.length) && (
        <section className="flex flex-col gap-4 rounded-[22px] border border-line p-5.5">
          <h2 className="text-base font-bold">Qui te suit</h2>
          <div className="flex flex-wrap gap-6">
            {[
              ["Villes", audience.city],
              ["Âges", audience.age],
              ["Genre", audience.gender?.map((g) => ({ ...g, key: g.key === "F" ? "femmes" : g.key === "M" ? "hommes" : "autre" }))],
            ].map(([title, list]) => {
              const items = list as { key: string; value: number }[] | undefined;
              if (!items?.length) return null;
              const total = items.reduce((a, b) => a + b.value, 0) || 1;
              return (
                <div key={title as string} className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
                  <span className="text-xs font-extrabold tracking-[.06em] text-muted uppercase">{title as string}</span>
                  <Ranking items={items.slice(0, 5).map((i) => ({ label: i.key.split(",")[0]!, value: Math.round((i.value / total) * 100) }))} unit="%" />
                </div>
              );
            })}
          </div>
          <p className="text-[12px] text-muted">D’après Instagram (à partir de 100 abonnés). Pour un commerce de quartier, la part de ta ville est le chiffre à suivre.</p>
        </section>
      )}

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
              <p className="text-[13px] text-muted">Edith applique ces leçons à tes prochains montages. Le bilan se met à jour chaque dimanche.</p>
              <RefreshReportButton label="Refaire l’analyse" />
            </>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-muted">
                Edith compare tes derniers posts Instagram (formats, accroches, heures, chiffres) pour te dire ce qui marche,
                avec les preuves. Le bilan arrive chaque dimanche.
              </p>
              <RefreshReportButton />
            </>
          )}
        </section>

        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 rounded-[22px] border border-line p-5.5">
          <h2 className="text-base font-bold">Ce qui a le plus donné envie</h2>
          {ranked.length ? (
            ranked.map(({ postId, totals: t }) => {
              const post = titles.get(postId);
              return (
                <Link key={postId} href={`/publications/${postId}`} className="flex items-center gap-3.5 hover:text-violet">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold">{post?.title ?? "Publication"}</span>
                    <span className="text-[13px] text-muted">
                      {post ? kindLabels[post.kind] : ""}
                      {t.views !== null ? ` · ${formatNumber(t.views)} vues` : t.reach !== null ? ` · ${formatNumber(t.reach)} comptes touchés` : ""}
                    </span>
                  </span>
                  <span className="text-right text-[13px] font-bold whitespace-nowrap text-violet">
                    {[
                      t.profile_visits ? `${formatNumber(t.profile_visits)} visites du profil` : null,
                      t.saves ? `${formatNumber(t.saves)} enreg.` : null,
                      t.shares ? `${formatNumber(t.shares)} partages` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-muted">Pas encore de statistiques sur cette période.</p>
          )}
          {ranked.length > 0 && <p className="text-[12px] text-muted">Classées par visites du profil, enregistrements et partages : ce qui fait venir des clients, plus que les vues.</p>}
        </section>
      </div>
      <p className="text-[13px] text-muted">Chiffres du compte : relevés chaque jour. Pour chaque publication : le dernier relevé des {period.days} derniers jours.</p>
    </>
  );
}
