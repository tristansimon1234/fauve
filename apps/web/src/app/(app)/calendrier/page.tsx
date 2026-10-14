import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { NoStudio } from "@/components/empty-state";
import { ChatIcon } from "@/components/icons";
import { addDays, localDateOf, parseIsoDate, sameDay, toIsoDate, weekdayIndex, weekLabel, weekOf } from "@/lib/dates";
import { formatShortDateTime, formatTime } from "@/lib/format";
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
import { COVER_COLUMNS, postCovers, type CoverPost } from "@/lib/covers";
import { loadGrid } from "@/lib/grid";
import { GridView } from "../grille/grid-view";
import { NewPostButton } from "@/components/new-post-sheet";
import { CalendarBoard, ShotList, type BoardPost } from "./calendar-board";

export const metadata: Metadata = { title: "Calendrier" };

// Posts that count towards the chosen rhythm once they are validated or beyond.
const DONE = new Set(["validated", "scheduled", "published", "measured"]);

export default function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <PageSuspense title="Calendrier">
        <Calendar searchParams={searchParams} />
      </PageSuspense>
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
      .select(`${POST_COLUMNS}, ${COVER_COLUMNS}`)
      .eq("studio_id", studioId)
      .gte("scheduled_at", week.start.toISOString())
      .lt("scheduled_at", week.end.toISOString())
      .order("scheduled_at", { ascending: true }),
    db
      .from("posts")
      .select(`${POST_COLUMNS}, ${COVER_COLUMNS}`)
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
  // A thumbnail per post: its montage, or its first photo.
  const covers = gridView
    ? new Map()
    : await postCovers(db, studioId, [...(postsResult.data ?? []), ...(undatedResult.data ?? [])] as unknown as CoverPost[]);

  const undatedPosts: BoardPost[] = undated.map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    status: p.status,
    day: null,
    time: "",
    cover: covers.get(p.id) ?? null,
  }));
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
            cover: covers.get(p.id) ?? null,
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">Calendrier</h1>
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
          <Link href="/fauve" className="btn btn-secondary">
            <ChatIcon size={18} />
            Demander à Brigitte
          </Link>
          <NewPostButton timezone={tz} />
        </div>
      </div>

      {/* Semaine ⇄ Grille: the same place, other content: a crossfade. */}
      <ViewTransition key={grid ? "grille" : "semaine"} enter="fauve-fade-swap" exit="fauve-fade-swap" default="none">
      {grid ? (
        <GridView heading={false} connected={grid.connected} handle={grid.handle} info={grid.info} tiles={grid.tiles} timezone={tz} />
      ) : (
        <>
          {/* What needs her, at a glance: drafts to validate, shots to film, the rhythm of the week. */}
          <div className="grid gap-3 md:grid-cols-3">
            <section className="card flex flex-col gap-2 p-4">
              <h2 className="flex items-center justify-between text-[14px] font-bold">
                À valider
                <span className={`rounded-full px-2 py-0.5 text-[12px] ${drafts.length ? "bg-peach text-peach-ink" : "bg-soft text-muted"}`}>{drafts.length}</span>
              </h2>
              {drafts.length ? (
                <ul className="flex flex-col">
                  {drafts.slice(0, 3).map((p) => (
                    <li key={p.id}>
                      <Link href={`/publications/${p.id}`} className="-mx-2 flex items-baseline gap-2 rounded-lg px-2 py-1 hover:bg-soft">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.title}</span>
                        <span className="shrink-0 text-[12px] text-muted">{p.scheduled_at ? formatShortDateTime(p.scheduled_at, tz) : "sans date"}</span>
                      </Link>
                    </li>
                  ))}
                  {drafts.length > 3 && <li className="px-0 pt-0.5 text-[12px] text-muted">et {drafts.length - 3} autres</li>}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">Rien à valider pour l’instant.</p>
              )}
            </section>
            <details className="card group/shots flex flex-col p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-bold">
                À filmer
                <span className="rounded-full bg-soft px-2 py-0.5 text-[12px] text-muted">{shots.filter((s) => !s.done).length}</span>
              </summary>
              <p className="mt-2 text-[13px] text-muted group-open/shots:hidden">
                {shots.find((s) => !s.done)?.label ?? "Rien à filmer pour l’instant."}
              </p>
              <div className="mt-3 hidden group-open/shots:block">
                <ShotList bare shots={shots.map(({ id, label, hint, done }) => ({ id, label, hint, done }))} />
              </div>
            </details>
            <section className="card flex flex-col gap-2.5 p-4">
              <h2 className="text-[14px] font-bold">Rythme de la semaine</h2>
              {plan ? (
                <>
                  <Progress label="Posts" value={done(feedPosts)} total={plan.posts_per_week} color="bg-violet" />
                  <Progress label="Stories" value={done(stories)} total={plan.stories_per_week} color="bg-coral" />
                </>
              ) : (
                <p className="text-[13px] text-muted">Pas encore de rythme : dis à Brigitte combien de posts et de stories tu veux par semaine.</p>
              )}
            </section>
          </div>

          <CalendarBoard
            key={toIsoDate(week.monday)}
            posts={boardPosts}
            undated={undatedPosts}
            days={days}
            weekLabel={weekLabel(week)}
            prevHref={navLink(-7)}
            nextHref={navLink(7)}
            todayHref={isCurrentWeek ? null : "/calendrier"}
            timezone={tz}
          />
          {posts.length === 0 && (
            <p className="rounded-2xl bg-soft px-5 py-4 text-sm leading-relaxed text-muted">
              Aucune publication cette semaine. Ajoute une idée avec le + d’un jour, ou dis à Brigitte ce que tu veux publier : elle prépare
              le calendrier avec toi.
            </p>
          )}
        </>
      )}
      </ViewTransition>
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
