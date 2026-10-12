import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { ArrowLeftIcon, ChatIcon, PlusIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { addDays, localDateOf, parseIsoDate, sameDay, toIsoDate, weekdayIndex, weekLabel, weekOf } from "@/lib/dates";
import { formatTime, kindLabels, plural } from "@/lib/format";
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

  const { semaine } = await searchParams;
  const today = localDateOf(new Date(), tz);
  const week = weekOf(parseIsoDate(semaine) ?? today, tz);
  const isCurrentWeek = sameDay(week.monday, weekOf(today, tz).monday);
  const lastDay = toIsoDate(addDays(week.monday, 6));

  const [postsResult, undatedResult, shotsResult, plan] = await Promise.all([
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
  ]);

  const posts = rows(postRowSchema, postsResult, "posts");
  const undated = rows(postRowSchema, undatedResult, "posts");
  const shots = rows(shotRowSchema, shotsResult, "shot_requests");

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

  const days = week.days.map((d) => ({ date: d.day, today: sameDay(d, today) }));
  const navLink = (offset: number) => `/calendrier?semaine=${toIsoDate(addDays(week.monday, offset))}`;

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
        <div className="flex flex-wrap gap-2.5">
          <a href={whatsappLink("J’ai une idée de post : ")} className="btn btn-secondary">
            <PlusIcon size={18} />
            Ajouter une idée
          </a>
          <a href={whatsappLink()} className="btn btn-primary">
            <ChatIcon size={18} />
            Demander à Fauve
          </a>
        </div>
      </div>

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
          <CalendarBoard key={toIsoDate(week.monday)} posts={boardPosts} days={days} />
          {posts.length === 0 && (
            <p className="rounded-2xl bg-soft px-5 py-4 text-sm leading-relaxed text-muted">
              Aucune publication cette semaine. Dis à Fauve sur WhatsApp ce que tu veux publier : elle prépare le
              calendrier avec toi.
            </p>
          )}
          {undated.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-bold">Idées sans date</h2>
              <ul className="card divide-y divide-line">
                {undated.map((p) => (
                  <li key={p.id}>
                    <Link href={`/publications/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold">{p.title}</span>
                        <span className="text-xs text-muted">{kindLabels[p.kind]}</span>
                      </span>
                      <StatusPill status={p.status} className="self-center" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
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
