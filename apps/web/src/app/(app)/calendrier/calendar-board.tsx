"use client";

import Link from "next/link";
import { useState } from "react";
import type { PostStatus } from "@mila/agent";
import { UploadIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import type { DemoPost } from "@/lib/demo";

const dayNames = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const kindLabels = { reel: "REEL", post: "POST", carousel: "CARROUSEL", story: "STORY" } as const;

const filters = [
  { key: "all", label: "Tout" },
  { key: "todo", label: "À faire" },
  { key: "planned", label: "Programmé" },
  { key: "published", label: "Publié" },
] as const;
type FilterKey = (typeof filters)[number]["key"];

const filterStatuses: Record<Exclude<FilterKey, "all">, PostStatus[]> = {
  todo: ["planned", "content_requested", "media_received", "draft", "failed"],
  planned: ["validated", "scheduled"],
  published: ["published", "measured"],
};

function cardBorder(status: PostStatus) {
  if (status === "draft") return "border-[1.5px] border-coral";
  if (status === "content_requested") return "border-[1.5px] border-dashed border-coral";
  return "border border-line";
}

export function CalendarBoard({ posts, firstDay }: { posts: DemoPost[]; firstDay: number }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const visible = posts.filter((p) => filter === "all" || filterStatuses[filter].includes(p.status));

  return (
    <div className="flex min-w-0 flex-[3_1_700px] flex-col gap-6">
      <div role="group" aria-label="Filtrer" className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold ${
                on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[940px] grid-cols-7 gap-2.5">
          {dayNames.map((name, day) => {
            const today = day === 0;
            return (
              <div key={name} className="flex min-w-0 flex-col gap-2.5">
                <div className="flex items-baseline gap-1.5 px-1">
                  <span className="text-[13px] font-bold text-muted">{name}</span>
                  <span className={`text-xl font-extrabold ${today ? "text-violet" : ""}`}>{firstDay + day}</span>
                </div>
                <div className={`flex min-h-[420px] flex-col gap-2 rounded-2xl p-2 ${today ? "bg-violet-tint" : "bg-soft"}`}>
                  {visible
                    .filter((p) => p.day === day)
                    .map((p) => (
                      <Link
                        key={p.id}
                        href={`/publications/${p.id}`}
                        className={`flex flex-col overflow-hidden rounded-xl bg-white ${cardBorder(p.status)}`}
                      >
                        {p.thumb && <span className="block h-[84px]" style={{ background: p.thumb }} />}
                        <span className="flex flex-col gap-1.5 p-2.5">
                          <span className="text-[11px] font-extrabold tracking-[.05em] text-muted">
                            {kindLabels[p.kind]} · {p.time}
                          </span>
                          <span className="text-[13px] leading-[1.35] font-bold">{p.title}</span>
                          <StatusPill status={p.status} />
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ShotList({ shots: initial }: { shots: { label: string; hint: string; done: boolean }[] }) {
  const [shots, setShots] = useState(initial);
  return (
    <section className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-center gap-2.5">
        <Orb size={28} />
        <h2 className="text-base font-bold">À filmer cette semaine</h2>
      </div>
      {shots.map((shot, i) => (
        <label key={shot.label} className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={shot.done}
            onChange={() => setShots((s) => s.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            className="mt-0.5 size-5 shrink-0 accent-violet"
          />
          <span className="flex flex-col gap-0.5">
            <span className={`text-sm font-semibold ${shot.done ? "line-through" : ""}`}>{shot.label}</span>
            <span className="text-xs text-muted">{shot.hint}</span>
          </span>
        </label>
      ))}
      <Link href="/mediatheque" className="btn btn-primary h-11 text-sm">
        <UploadIcon size={18} />
        Déposer les vidéos
      </Link>
    </section>
  );
}
