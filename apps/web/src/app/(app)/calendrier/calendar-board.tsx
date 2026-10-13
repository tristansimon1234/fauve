"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import type { PostKind, PostStatus } from "@fauve/agent";
import { PlusIcon, WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { whatsappLink } from "@/lib/public-env";
import { addPost, movePost, setShotDone } from "./actions";
import { PostDrawer } from "./post-drawer";

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
  /** 0 = Monday … 6 = Sunday, in the studio's time zone (null: an idea without a date). */
  day: number | null;
  time: string;
};

export type BoardDay = { date: number; iso: string; today: boolean };

const LOCKED = new Set<PostStatus>(["published", "measured"]);
const DRAG_TYPE = "text/x-fauve-post";

function cardBorder(status: PostStatus) {
  if (status === "draft") return "border-[1.5px] border-coral";
  if (status === "content_requested") return "border-[1.5px] border-dashed border-coral";
  return "border border-line";
}

/**
 * The week: drag a post to another day, add an idea on a day with its +, click
 * a post to see where it stands and what is left to do (side panel).
 */
export function CalendarBoard({ posts, undated, days }: { posts: BoardPost[]; undated: BoardPost[]; days: BoardDay[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [list, setList] = useState([...posts, ...undated]);
  const [open, setOpen] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const visible = list.filter((p) => filter === "all" || filterStatuses[filter].includes(p.status));

  const move = (id: string, day: number) => {
    const before = list;
    // An idea without a date lands at 18:00, like on the server.
    setList((l) => l.map((p) => (p.id === id ? { ...p, day, time: p.time || "18:00" } : p)));
    setError(null);
    startTransition(async () => {
      const res = await movePost(id, days[day]!.iso).catch(() => ({ ok: false as const, error: "Le déplacement n’a pas été enregistré." }));
      if (!res.ok) {
        setList(before);
        setError(res.error);
      }
      router.refresh();
    });
  };

  const card = (p: BoardPost) => {
    const locked = LOCKED.has(p.status);
    return (
      <button
        key={p.id}
        type="button"
        draggable={!locked}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, p.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => setOpen(p.id)}
        className={`flex w-full flex-col gap-1.5 rounded-xl bg-white p-2.5 text-left transition-shadow hover:shadow-[0_6px_18px_rgba(28,21,48,0.08)] ${cardBorder(p.status)} ${
          locked ? "" : "cursor-grab active:cursor-grabbing"
        } ${open === p.id ? "ring-2 ring-violet" : ""}`}
      >
        <span className="text-[11px] font-extrabold tracking-[.05em] text-muted">
          {kindLabels[p.kind]}
          {p.day !== null ? ` · ${p.time}` : ""}
        </span>
        <span className="text-[13px] leading-[1.35] font-bold">{p.title}</span>
        <StatusPill status={p.status} />
      </button>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <p className="text-[13px] text-muted">Glisse une publication pour changer son jour.</p>
      </div>
      {error && (
        <p role="alert" className="self-start rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[940px] grid-cols-7 gap-2.5">
          {days.map(({ date, today }, day) => (
            <div key={day} className="group/day flex min-w-0 flex-col gap-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <span className="text-[13px] font-bold text-muted">{dayNames[day]}</span>
                <span className={`text-xl font-extrabold ${today ? "text-violet" : ""}`}>{date}</span>
                <button
                  type="button"
                  aria-label={`Ajouter une idée le ${dayNames[day]} ${date}`}
                  title="Ajouter une idée"
                  onClick={() => setAdding(day)}
                  className="ml-auto flex size-7 items-center justify-center rounded-full text-muted opacity-0 group-hover/day:opacity-100 hover:bg-violet-soft hover:text-violet focus-visible:opacity-100"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
              <div
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                  e.preventDefault();
                  setOver(day);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
                }}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData(DRAG_TYPE);
                  setOver(null);
                  if (id && list.find((p) => p.id === id)?.day !== day) move(id, day);
                }}
                className={`flex min-h-[320px] flex-col gap-2 rounded-2xl p-2 transition-colors ${
                  over === day ? "bg-violet-soft outline-2 outline-dashed outline-violet" : today ? "bg-violet-tint" : "bg-soft"
                }`}
              >
                {adding === day && (
                  <AddIdea
                    date={days[day]!.iso}
                    onClose={() => setAdding(null)}
                    onAdded={(id) => {
                      setAdding(null);
                      setOpen(id);
                      router.refresh();
                    }}
                  />
                )}
                {visible.filter((p) => p.day === day).map(card)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {visible.some((p) => p.day === null) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold">Idées sans date</h2>
          <p className="-mt-2 text-[13px] text-muted">Glisse-les sur un jour pour les programmer.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">{visible.filter((p) => p.day === null).map(card)}</div>
        </section>
      )}

      <PostDrawer
        postId={open}
        onClose={() => setOpen(null)}
        onChanged={() => router.refresh()}
        onDeleted={(id) => {
          setList((l) => l.filter((p) => p.id !== id));
          setOpen(null);
        }}
      />
    </div>
  );
}

const kindChoices: { value: PostKind; label: string }[] = [
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carrousel" },
  { value: "post", label: "Photo" },
  { value: "story", label: "Story" },
];

/** A new idea on a day: a title and a format, the rest is Fauve's job. */
function AddIdea({ date, onClose, onAdded }: { date: string; onClose: () => void; onAdded: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PostKind>("reel");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await addPost(date, kind, title).catch(() => ({ ok: false as const, error: "L’idée n’a pas été ajoutée." }));
      if (res.ok) onAdded(res.id);
      else setError(res.error);
    });
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border-[1.5px] border-violet bg-white p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ton idée…"
        maxLength={120}
        aria-label="Titre de l’idée"
        className="w-full rounded-lg border border-line px-2 py-1.5 text-[13px] outline-none focus:border-violet"
      />
      <div className="flex flex-wrap gap-1">
        {kindChoices.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${kind === k.value ? "bg-violet text-white" : "bg-soft text-muted"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[12px] font-semibold text-danger">{error}</p>}
      <div className="flex gap-1.5">
        <button type="submit" disabled={pending || !title.trim()} className="flex-1 rounded-full bg-violet py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
          {pending ? "…" : "Ajouter"}
        </button>
        <button type="button" onClick={onClose} className="rounded-full px-2 text-[12px] font-semibold text-muted hover:text-ink">
          Annuler
        </button>
      </div>
    </form>
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
