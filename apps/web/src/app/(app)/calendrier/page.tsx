import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { ArrowLeftIcon, ChatIcon } from "@/components/icons";
import { addDays, localDateOf, parseIsoDate, sameDay, toIsoDate, weekdayIndex, weekLabel, weekOf } from "@/lib/dates";
import { formatShortDateTime, formatTime, kindLabels, plural } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import {
  getContentPlan,
  getStudioContext,
  POST_COLUMNS,
  postRowSchema,
  rows,
  SHOT_COLUMNS,
  shotRowSchema,
  type PostRow,
} from "@/lib/studio";
import { loadGrid } from "@/lib/grid";
import { GridView } from "../grille/grid-view";
import { CalendarBoard, ShotList, type BoardPost } from "./calendar-board";

export const metadata: Metadata = { title: "Calendrier" };

// Posts that count towards the chosen rhythm once they are validated or beyond.
const DONE = new Set(["validated", "scheduled", "published", "measured"]);

export default function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <Suspense fallback={<PageLoading title="Calendrier" />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendrier">["searchParams"] }) {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;

  const { semaine, vue } = await searchParams;
  const gridView = vue === "grille";
  const today = localDateOf(new Date(), tz);
  const week = weekOf(parseIsoDate(semaine) ?? today, tz);
  const isCurrentWeek = sameDay(week.monday, weekOf(today, tz).monday);
  const lastDay = toIsoDate(addDays(week.monday, 6));

  const [postsResult, undatedResult, shotsResult, plan, draftsResult, grid] = await Promise.all([
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .gte("scheduled_at", week.start.toISOString())
      .lt("scheduled_at", week.end.toISOString())
      .order("scheduled_at", { ascending: true }),
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .is("scheduled_at", null)
      .not("status", "in", "(skipped,published,measured)")
      .order("created_at", { ascending: true })
      .limit(20),
    // Everything still to film, plus what was ticked off for this week.
    db
      .from("shot_requests")
      .select(SHOT_COLUMNS)
      .eq("studio_id", studioId)
      .or(`done.eq.false,and(due_date.gte.${toIsoDate(week.monday)},due_date.lte.${lastDay})`)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(30),
    getContentPlan(db, studioId),
    // Drafts waiting for her, whatever their week.
    db.from("posts").select(POST_COLUMNS).eq("studio_id", studioId).eq("status", "draft").order("scheduled_at", { ascending: true, nullsFirst: false }).limit(20),
    gridView ? loadGrid(db, studioId) : Promise.resolve(null),
  ]);

  const posts = rows(postRowSchema, postsResult, "posts");
  const undated = rows(postRowSchema, undatedResult, "posts");
  const shots = rows(shotRowSchema, shotsResult, "shot_requests");
  const drafts = rows(postRowSchema, draftsResult, "posts");

  const undatedPosts: BoardPost[] = undated.map((p) => ({ id: p.id, kind: p.kind, title: p.title, status: p.status, day: null, time: "" }));
  const boardPosts: BoardPost[] = posts.flatMap((p) =>
    p.scheduled_at
      ? [
          {
            id: p.id,
            kind: p.kind,
            title: p.title,
            status: p.status,
            day: weekdayIndex(localDateOf(new Date(p.scheduled_at), tz)),
            time: formatTime(p.scheduled_at, tz),
          },
        ]
      : [],
  );
  const counted = posts.filter((p) => p.status !== "skipped");
  const feedPosts = counted.filter((p) => p.kind !== "story");
  const stories = counted.filter((p) => p.kind === "story");
  const done = (list: PostRow[]) => list.filter((p) => DONE.has(p.status)).length;

  const days = week.days.map((d) => ({ date: d.day, iso: toIsoDate(d), today: sameDay(d, today) }));
  const navLink = (offset: number) => `/calendrier?semaine=${toIsoDate(addDays(week.monday, offset))}`;
  const viewLink = (grille: boolean) =>
    `/calendrier?${new URLSearchParams({ ...(typeof semaine === "string" ? { semaine } : {}), ...(grille ? { vue: "grille" } : {}) })}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Calendrier</h1>
          <p className="text-[15px] text-muted">
            {weekLabel(week)}
            {plan
              ? ` · ${plural(plan.posts_per_week, "post", "posts")} et ${plural(plan.stories_per_week, "story", "stories")} prévus par semaine`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="tablist" aria-label="Vue" className="flex rounded-full bg-soft p-1">
            {[
              { label: "Semaine", on: !gridView, href: viewLink(false) },
              { label: "Grille", on: gridView, href: viewLink(true) },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                role="tab"
                aria-selected={tab.on}
                className={`rounded-full px-4 py-2 text-sm font-bold ${tab.on ? "bg-white text-ink shadow-[0_2px_8px_rgba(28,21,48,0.08)]" : "text-muted hover:text-ink"}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <a href={whatsappLink()} className="btn btn-primary">
            <ChatIcon size={18} />
            Demander à Fauve
          </a>
        </div>
      </div>

      {grid ? (
        <GridView heading={false} connected={grid.connected} handle={grid.handle} info={grid.info} tiles={grid.tiles} timezone={tz} />
      ) : (
        <>
          <nav aria-label="Changer de semaine" className="flex flex-wrap items-center gap-2">
            <Link href={navLink(-7)} className="btn btn-secondary h-10 px-4 text-sm">
              <ArrowLeftIcon size={16} />
              Semaine précédente
            </Link>
            {!isCurrentWeek && (
              <Link href="/calendrier" className="btn btn-secondary h-10 px-4 text-sm">
                Cette semaine
              </Link>
            )}
            <Link href={navLink(7)} className="btn btn-secondary h-10 px-4 text-sm">
              Semaine suivante
              <ArrowLeftIcon size={16} className="rotate-180" />
            </Link>
          </nav>

          <div className="flex flex-wrap items-start gap-6">
            <div className="flex min-w-0 flex-[3_1_700px] flex-col gap-6">
              <CalendarBoard key={toIsoDate(week.monday)} posts={boardPosts} undated={undatedPosts} days={days} />
              {posts.length === 0 && (
                <p className="rounded-2xl bg-soft px-5 py-4 text-sm leading-relaxed text-muted">
                  Aucune publication cette semaine. Ajoute une idée avec le + d’un jour, ou dis à Fauve ce que tu veux publier :
                  elle prépare le calendrier avec toi.
                </p>
              )}
            </div>

            <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
              {drafts.length > 0 && (
                <section className="card flex flex-col gap-2 p-5">
                  <h2 className="text-base font-bold">À valider</h2>
                  <ul className="flex flex-col">
                    {drafts.map((p) => (
                      <li key={p.id}>
                        <Link href={`/publications/${p.id}`} className="-mx-2 flex flex-col rounded-xl px-2 py-2 hover:bg-soft">
                          <span className="truncate text-sm font-bold">{p.title}</span>
                          <span className="text-xs text-muted">
                            {kindLabels[p.kind]} · {p.scheduled_at ? formatShortDateTime(p.scheduled_at, tz) : "date à définir"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <ShotList shots={shots.map(({ id, label, hint, done }) => ({ id, label, hint, done }))} />
              <section className="card flex flex-col gap-3 bg-soft p-5">
                <h2 className="text-base font-bold">Rythme choisi</h2>
                {plan ? (
                  <>
                    <Progress label="Posts" value={done(feedPosts)} total={plan.posts_per_week} color="bg-violet" />
                    <Progress label="Stories" value={done(stories)} total={plan.stories_per_week} color="bg-coral" />
                    <p className="text-[13px] leading-normal text-muted">
                      Une publication compte dès que tu l’as validée.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-normal text-muted">
                    Pas encore de rythme choisi. Dis à Fauve sur WhatsApp combien de posts et de stories tu veux par
                    semaine.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function Progress({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex justify-between text-sm font-semibold">
        <span>{label}</span>
        <span>
          {value} / {total}
        </span>
      </span>
      <span
        className="block h-2 overflow-hidden rounded bg-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemax={total}
      >
        <span className={`block h-2 ${color}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
