import Link from "next/link";
import { dayLabel } from "@fauve/agent";
import { CalendarIcon, CheckIcon, FilmIcon } from "@/components/icons";
import { addDays, localDateOf, toIsoDate } from "@/lib/dates";
import { getStudioContext } from "@/lib/studio";
import { pendingWeek } from "@/lib/week-plan";
import { TodoCheck } from "./todo-check";

// Her to-do list, always in sight (sidebar): the week to say yes to, what to
// film and for when, the publications to validate. The material she sends is
// what makes the Reels: filming comes first.

const SHOTS = 5;
const DRAFTS = 3;

function when(date: string | null, today: string): { text: string; late: boolean } {
  if (!date) return { text: "", late: false };
  if (date < today) return { text: "en retard", late: true };
  if (date === today) return { text: "aujourd’hui", late: false };
  const [y, m, d] = today.split("-").map(Number);
  if (date === toIsoDate(addDays({ year: y!, month: m!, day: d! }, 1))) return { text: "demain", late: false };
  return { text: dayLabel(date), late: false };
}

export async function SidebarTodo() {
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const today = toIsoDate(localDateOf(new Date(), member.studio.timezone ?? "Europe/Paris"));

  const [week, { data: shots }, { data: drafts }] = await Promise.all([
    pendingWeek(studioId),
    db
      .from("shot_requests")
      .select("id, label, due_date, posts(title)")
      .eq("studio_id", studioId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(SHOTS),
    db.from("posts").select("id, title").eq("studio_id", studioId).eq("status", "draft").order("scheduled_at", { ascending: true }).limit(DRAFTS),
  ]);
  const count = (week ? 1 : 0) + (shots?.length ?? 0) + (drafts?.length ?? 0);

  return (
    <section className="flex min-h-0 flex-col gap-2" aria-label="À faire">
      <span className="flex items-center justify-between px-1.5 text-xs font-bold tracking-[.06em] text-muted">
        À FAIRE
        {count ? <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] text-violet">{count}</span> : null}
      </span>
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {week ? (
          <li>
            <Link href="/fauve" className="flex items-start gap-2.5 rounded-xl bg-violet-soft px-2.5 py-2 text-[13px] leading-snug text-violet">
              <CalendarIcon size={16} className="mt-0.5 shrink-0" />
              <span className="flex flex-col">
                <span className="font-bold">Valider ma semaine</span>
                <span className="text-[12px] opacity-80">{week.items.length} publications proposées</span>
              </span>
            </Link>
          </li>
        ) : null}
        {(shots ?? []).map((shot) => {
          const due = when(shot.due_date as string | null, today);
          const post = shot.posts as unknown as { title: string | null } | null;
          return (
            <li key={shot.id as string} className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-[13px] leading-snug hover:bg-soft">
              <TodoCheck id={shot.id as string} label={shot.label as string} />
              <Link href="/calendrier" className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <FilmIcon size={13} className="shrink-0 text-muted" />
                  <span className="truncate">{shot.label as string}</span>
                </span>
                <span className={`text-[12px] ${due.late ? "font-bold text-peach-ink" : "text-muted"}`}>
                  {[due.text, post?.title ? `pour « ${post.title} »` : ""].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          );
        })}
        {(drafts ?? []).map((post) => (
          <li key={post.id as string}>
            <Link href={`/publications/${post.id as string}`} className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-[13px] leading-snug hover:bg-soft">
              <CheckIcon size={16} className="mt-0.5 shrink-0 text-violet" />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-ink">Valider</span>
                <span className="truncate text-[12px] text-muted">« {(post.title as string | null) ?? "Publication"} »</span>
              </span>
            </Link>
          </li>
        ))}
        {count ? null : <li className="px-2.5 text-[13px] leading-snug text-muted">Rien pour l’instant. Ta semaine arrive dimanche soir.</li>}
      </ul>
    </section>
  );
}
