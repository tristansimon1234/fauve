import type { Metadata } from "next";
import Link from "next/link";
import { ChatIcon, PlusIcon } from "@/components/icons";
import { demoPosts, demoShots, demoStudio, demoWeek } from "@/lib/demo";
import { CalendarBoard, ShotList } from "./calendar-board";

export const metadata: Metadata = { title: "Calendrier" };

export default function CalendarPage() {
  const posts = demoPosts.filter((p) => p.kind !== "story");
  const stories = demoPosts.filter((p) => p.kind === "story");
  const done = (list: typeof demoPosts) =>
    list.filter((p) => ["validated", "scheduled", "published", "measured"].includes(p.status)).length;

  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Calendrier</h1>
          <p className="text-[15px] text-muted">
            {demoWeek.label} · {demoStudio.postsPerWeek} posts et {demoStudio.storiesPerWeek} stories prévus
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/fauve" className="btn btn-secondary">
            <PlusIcon size={18} />
            Ajouter une idée
          </Link>
          <Link href="/fauve" className="btn btn-primary">
            <ChatIcon size={18} />
            Demander à Fauve
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <CalendarBoard posts={demoPosts} firstDay={demoWeek.firstDay} />

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <ShotList shots={demoShots} />
          <section className="card flex flex-col gap-3 bg-soft p-5">
            <h2 className="text-base font-bold">Rythme choisi</h2>
            <Progress label="Posts" value={done(posts)} total={demoStudio.postsPerWeek} color="bg-violet" />
            <Progress label="Stories" value={done(stories)} total={demoStudio.storiesPerWeek} color="bg-coral" />
            <p className="text-[13px] leading-normal text-muted">
              Fauve te relance la veille de chaque publication s’il manque un contenu.
            </p>
          </section>
        </aside>
      </div>
    </main>
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
