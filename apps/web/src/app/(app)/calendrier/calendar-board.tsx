"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { PostKind, PostStatus } from "@fauve/agent";
import { WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { whatsappLink } from "@/lib/public-env";
import { setShotDone } from "./actions";

const dayNames = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const kindLabels: Record<PostKind, string> = { reel: "REEL", post: "POST", carousel: "CARROUSEL", story: "STORY" };

const filters = [
  { key: "all", label: "Tout" },
  { key: "todo", label: "À faire" },
  { key: "validated", label: "Validé" },
  { key: "published", label: "Publié" },
] as const;
type FilterKey = (typeof filters)[number]["key"];

const filterStatuses: Record<Exclude<FilterKey, "all">, PostStatus[]> = {
  todo: ["planned", "content_requested", "media_received", "draft", "failed"],
  validated: ["validated", "scheduled"],
  published: ["published", "measured"],
};

export type BoardPost = {
  id: string;
  kind: PostKind;
  title: string;
  status: PostStatus;
  /** 0 = Monday … 6 = Sunday, in the studio's time zone. */
  day: number;
  time: string;
};

function cardBorder(status: PostStatus) {
  if (status === "draft") return "border-[1.5px] border-coral";
  if (status === "content_requested") return "border-[1.5px] border-dashed border-coral";
  return "border border-line";
}

export function CalendarBoard({ posts, days }: { posts: BoardPost[]; days: { date: number; today: boolean }[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const visible = posts.filter((p) => filter === "all" || filterStatuses[filter].includes(p.status));

  return (
    <div className="flex min-w-0 flex-col gap-6">
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
          {days.map(({ date, today }, day) => (
            <div key={day} className="flex min-w-0 flex-col gap-2.5">
              <div className="flex items-baseline gap-1.5 px-1">
                <span className="text-[13px] font-bold text-muted">{dayNames[day]}</span>
                <span className={`text-xl font-extrabold ${today ? "text-violet" : ""}`}>{date}</span>
              </div>
              <div className={`flex min-h-[320px] flex-col gap-2 rounded-2xl p-2 ${today ? "bg-violet-tint" : "bg-soft"}`}>
                {visible
                  .filter((p) => p.day === day)
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/publications/${p.id}`}
                      className={`flex flex-col gap-1.5 rounded-xl bg-white p-2.5 ${cardBorder(p.status)}`}
                    >
                      <span className="text-[11px] font-extrabold tracking-[.05em] text-muted">
                        {kindLabels[p.kind]} · {p.time}
                      </span>
                      <span className="text-[13px] leading-[1.35] font-bold">{p.title}</span>
                      <StatusPill status={p.status} />
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Shot = { id: string; label: string; hint: string | null; done: boolean };

export function ShotList({ shots }: { shots: Shot[] }) {
  const [optimistic, setOptimistic] = useOptimistic(shots, (list, change: { id: string; done: boolean }) =>
    list.map((s) => (s.id === change.id ? { ...s, done: change.done } : s)),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const toggle = (id: string, done: boolean) =>
    startTransition(async () => {
      setOptimistic({ id, done });
      const result = await setShotDone(id, done);
      setError(!result.ok);
    });

  return (
    <section className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-center gap-2.5">
        <Orb size={28} />
        <h2 className="text-base font-bold">À filmer</h2>
      </div>
      {optimistic.length ? (
        optimistic.map((shot) => (
          <label key={shot.id} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={shot.done}
              onChange={() => toggle(shot.id, !shot.done)}
              className="mt-0.5 size-5 shrink-0 accent-violet"
            />
            <span className="flex flex-col gap-0.5">
              <span className={`text-sm font-semibold ${shot.done ? "line-through" : ""}`}>{shot.label}</span>
              {shot.hint && <span className="text-xs text-muted">{shot.hint}</span>}
            </span>
          </label>
        ))
      ) : (
        <p className="text-sm leading-normal text-muted">
          Rien à filmer pour l’instant. Demande à Fauve sur WhatsApp des idées de tournage pour la semaine.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          La modification n’a pas été enregistrée. Réessaie dans un instant.
        </p>
      )}
      <a href={whatsappLink()} className="btn btn-primary h-11 text-sm">
        <WhatsAppIcon size={18} />
        Envoyer les vidéos à Fauve
      </a>
    </section>
  );
}
