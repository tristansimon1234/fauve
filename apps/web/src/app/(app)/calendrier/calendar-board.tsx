"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import type { PostKind, PostStatus } from "@fauve/agent";
import { ArrowLeftIcon, CheckIcon, LayersIcon, PlayIcon, PlusIcon, TrashIcon, WhatsAppIcon, XIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { whatsappLink } from "@/lib/public-env";
import { NewPostSheet } from "@/components/new-post-sheet";
import { deletePosts, movePost, movePosts, setShotDone, validatePosts } from "./actions";
import { PostDrawer } from "./post-drawer";

const dayNames = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const kindLabels: Record<PostKind, string> = { reel: "REEL", post: "POST", carousel: "CARROUSEL", story: "STORY" };

const filters = [
  { key: "all", label: "Tout" },
  { key: "draft", label: "À valider" },
  { key: "todo", label: "À préparer" },
  { key: "planned", label: "Programmé" },
  { key: "published", label: "Publié" },
  { key: "skipped", label: "Annulées" },
] as const;
type FilterKey = (typeof filters)[number]["key"];

const filterStatuses: Record<Exclude<FilterKey, "all">, PostStatus[]> = {
  draft: ["draft"],
  todo: ["planned", "content_requested", "media_received", "failed"],
  planned: ["validated", "scheduled"],
  published: ["published", "measured"],
  skipped: ["skipped"],
};

export type BoardPost = {
  id: string;
  kind: PostKind;
  title: string;
  status: PostStatus;
  /** 0 = Monday … 6 = Sunday, in the studio's time zone (null: an idea without a date). */
  day: number | null;
  time: string;
  cover: { url: string; video: boolean } | null;
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
 * The week: drag a post to another day, add an idea with a day's +, click a
 * post for its side panel. Several posts: tick them (or Ctrl/⌘ + click) and
 * act on all at once from the bar at the bottom, or drag them together.
 */
export function CalendarBoard({
  posts,
  undated,
  days,
  weekLabel,
  prevHref,
  nextHref,
  todayHref,
  timezone,
}: {
  posts: BoardPost[];
  undated: BoardPost[];
  days: BoardDay[];
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  /** Null on the current week. */
  todayHref: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  // Local moves show at once; whatever the server sends next (a refresh, a change made by
  // Fauve or in another tab) replaces them.
  const [list, setList] = useState(() => [...posts, ...undated]);
  const [fromServer, setFromServer] = useState({ posts, undated });
  if (fromServer.posts !== posts || fromServer.undated !== undated) {
    setFromServer({ posts, undated });
    setList([...posts, ...undated]);
  }
  const [open, setOpen] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = list.filter((p) => (filter === "all" ? p.status !== "skipped" : filterStatuses[filter].includes(p.status)));
  const skippedCount = list.filter((p) => p.status === "skipped").length;
  const selecting = selected.size > 0;
  const picked = list.filter((p) => selected.has(p.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  /** Runs a grouped action, then refreshes with what the server says. */
  const run = (action: () => Promise<{ ok: true; done: number; skipped: number } | { ok: false; error: string }>, done: (n: number) => string) =>
    startTransition(async () => {
      setMessage(null);
      const res = await action().catch(() => ({ ok: false as const, error: "Ça n’a pas marché. Réessaie." }));
      if (res.ok) {
        setMessage({ ok: true, text: done(res.done) + (res.skipped ? ` (${res.skipped} laissée${res.skipped > 1 ? "s" : ""} telle${res.skipped > 1 ? "s" : ""} quelle${res.skipped > 1 ? "s" : ""})` : "") });
        clearSelection();
      } else setMessage({ ok: false, text: res.error });
      router.refresh();
    });

  const moveOne = (id: string, day: number) => {
    const before = list;
    setList((l) => l.map((p) => (p.id === id ? { ...p, day, time: p.time || "18:00" } : p)));
    setMessage(null);
    startTransition(async () => {
      const res = await movePost(id, days[day]!.iso).catch(() => ({ ok: false as const, error: "Le déplacement n’a pas été enregistré." }));
      if (!res.ok) {
        setList(before);
        setMessage({ ok: false, text: res.error });
      }
      router.refresh();
    });
  };

  // Dropping a ticked post moves the whole selection by the same number of days.
  const drop = (id: string, day: number) => {
    const dragged = list.find((p) => p.id === id);
    if (!dragged) return;
    if (selected.has(id) && selected.size > 1 && dragged.day !== null) {
      const delta = day - dragged.day;
      if (!delta) return;
      const ids = [...selected];
      setList((l) =>
        l.flatMap((p) => {
          if (!selected.has(p.id) || p.day === null || LOCKED.has(p.status)) return [p];
          const next = p.day + delta;
          return next >= 0 && next <= 6 ? [{ ...p, day: next }] : [];
        }),
      );
      run(() => movePosts(ids, { days: delta }), (n) => `${n} publication${n > 1 ? "s" : ""} déplacée${n > 1 ? "s" : ""}`);
      return;
    }
    if (dragged.day !== day) moveOne(id, day);
  };

  const card = (p: BoardPost) => {
    const locked = LOCKED.has(p.status);
    const ticked = selected.has(p.id);
    return (
      <div
        key={p.id}
        role="button"
        tabIndex={0}
        draggable={!locked}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, p.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={(e) => {
          if (selecting || e.metaKey || e.ctrlKey || e.shiftKey) toggle(p.id);
          else setOpen(p.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen(p.id);
          if (e.key === " ") {
            e.preventDefault();
            toggle(p.id);
          }
        }}
        className={`group/card relative flex w-full flex-col overflow-hidden rounded-xl bg-white text-left transition-shadow hover:shadow-[0_6px_18px_rgba(28,21,48,0.08)] ${cardBorder(p.status)} ${
          locked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        } ${ticked ? "ring-2 ring-violet" : open === p.id ? "ring-2 ring-lilac" : ""} ${p.status === "skipped" ? "opacity-60" : ""}`}
      >
        {p.cover ? (
          <div className="relative aspect-[4/3] bg-soft">
            {p.cover.video ? (
              <video src={`${p.cover.url}#t=0.5`} muted playsInline preload="metadata" className="pointer-events-none size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
              <img src={p.cover.url} alt="" loading="lazy" className="pointer-events-none size-full object-cover" />
            )}
            <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {p.kind === "reel" || p.kind === "story" ? <PlayIcon size={10} /> : p.kind === "carousel" ? <LayersIcon size={10} /> : null}
              {kindLabels[p.kind]}
              {p.day !== null ? ` · ${p.time}` : ""}
            </span>
          </div>
        ) : (
          <span className="px-2.5 pt-2.5 text-[11px] font-extrabold tracking-[.05em] text-muted">
            {kindLabels[p.kind]}
            {p.day !== null ? ` · ${p.time}` : ""}
          </span>
        )}
        <div className="flex flex-col gap-1.5 p-2.5">
          <span className="line-clamp-2 text-[13px] leading-[1.35] font-bold">{p.title}</span>
          <StatusPill status={p.status} />
        </div>
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          aria-label={ticked ? "Désélectionner" : "Sélectionner"}
          onClick={(e) => {
            e.stopPropagation();
            toggle(p.id);
          }}
          className={`absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md border-[1.5px] transition-opacity ${
            ticked ? "border-violet bg-violet text-white opacity-100" : "border-line bg-white/95 text-transparent opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
          } ${selecting ? "opacity-100" : ""}`}
        >
          <CheckIcon size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <nav aria-label="Changer de semaine" className="flex items-center gap-1">
          <Link href={prevHref} aria-label="Semaine précédente" className="flex size-9 items-center justify-center rounded-full border border-line hover:bg-soft">
            <ArrowLeftIcon size={16} />
          </Link>
          <span className="min-w-[150px] text-center text-[15px] font-bold">{weekLabel}</span>
          <Link href={nextHref} aria-label="Semaine suivante" className="flex size-9 items-center justify-center rounded-full border border-line hover:bg-soft">
            <ArrowLeftIcon size={16} className="rotate-180" />
          </Link>
          {todayHref && (
            <Link href={todayHref} className="ml-1 rounded-full px-3 py-1.5 text-[13px] font-bold text-violet hover:bg-violet-soft">
              Aujourd’hui
            </Link>
          )}
        </nav>
        <div role="group" aria-label="Filtrer" className="flex flex-wrap gap-1.5">
          {filters
            .filter((f) => f.key !== "skipped" || skippedCount > 0)
            .map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.key)}
                  className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-lilac"}`}
                >
                  {f.label}
                  {f.key === "skipped" ? ` (${skippedCount})` : ""}
                </button>
              );
            })}
        </div>
        <button
          type="button"
          onClick={() => setSelected(new Set(visible.filter((p) => p.day !== null).map((p) => p.id)))}
          disabled={!visible.length}
          className="ml-auto text-[13px] font-semibold text-muted hover:text-ink disabled:opacity-40"
        >
          Tout sélectionner
        </button>
      </div>

      {message && (
        <p
          key={message.text}
          role="status"
          className={`fauve-enter self-start rounded-xl px-3 py-2 text-sm font-semibold ${message.ok ? "bg-violet-tint text-ink" : "bg-peach text-danger"}`}
        >
          {message.text}
        </p>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[840px] grid-cols-7 gap-2">
          {days.map(({ date, today }, day) => (
            <div key={day} className="group/day flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-1.5 px-1">
                <span className="text-[12px] font-bold text-muted">{dayNames[day]}</span>
                <span className={`flex size-7 items-center justify-center rounded-full text-[15px] font-extrabold ${today ? "bg-violet text-white" : ""}`}>{date}</span>
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
                  if (id) drop(id, day);
                }}
                className={`flex min-h-[420px] flex-col gap-2 rounded-2xl p-1.5 transition-colors ${
                  over === day ? "bg-violet-soft outline-2 outline-dashed outline-violet" : today ? "bg-violet-tint" : "bg-soft"
                }`}
              >
                {visible.filter((p) => p.day === day).map(card)}
                {(
                  <button
                    type="button"
                    onClick={() => setAdding(day)}
                    className="mt-auto flex h-9 items-center justify-center rounded-xl text-muted opacity-0 group-hover/day:opacity-100 hover:bg-white hover:text-violet"
                    aria-label={`Nouvelle publication le ${dayNames[day]} ${date}`}
                  >
                    <PlusIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {visible.some((p) => p.day === null) && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-base font-bold">Idées sans date</h2>
          <p className="-mt-1.5 text-[13px] text-muted">Glisse-les sur un jour pour les programmer.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">{visible.filter((p) => p.day === null).map(card)}</div>
        </section>
      )}

      {selecting && (
        <SelectionBar
          count={selected.size}
          drafts={picked.filter((p) => p.status === "draft").length}
          pending={pending}
          onValidate={() => run(() => validatePosts([...selected]), (n) => `${n} publication${n > 1 ? "s" : ""} validée${n > 1 ? "s" : ""}`)}
          onMove={(date) => run(() => movePosts([...selected], { date }), (n) => `${n} publication${n > 1 ? "s" : ""} déplacée${n > 1 ? "s" : ""}`)}
          onDelete={() => {
            const ids = [...selected];
            setList((l) => l.filter((p) => !selected.has(p.id)));
            run(() => deletePosts(ids), (n) => `${n} publication${n > 1 ? "s" : ""} supprimée${n > 1 ? "s" : ""}`);
          }}
          onClear={clearSelection}
        />
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
      {adding !== null && days[adding] && <NewPostSheet date={days[adding]!.iso} timezone={timezone} onClose={() => setAdding(null)} />}
    </div>
  );
}

/** The bar of grouped actions, at the bottom while posts are ticked. */
function SelectionBar({
  count,
  drafts,
  pending,
  onValidate,
  onMove,
  onDelete,
  onClear,
}: {
  count: number;
  drafts: number;
  pending: boolean;
  onValidate: () => void;
  onMove: (date: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      role="toolbar"
      aria-label="Actions groupées"
      // Rises in when a first post is checked (the keyframe animates `transform`, so it composes with -translate-x-1/2).
      className="fauve-enter fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-full bg-ink py-2 pr-2 pl-5 text-white shadow-[0_18px_40px_rgba(28,21,48,0.3)] [--fauve-y:12px] lg:bottom-6"
    >
      <span className="text-[14px] font-bold">
        {count} sélectionnée{count > 1 ? "s" : ""}
      </span>
      <span className="mx-1 h-5 w-px bg-white/20" />
      {drafts > 0 && (
        <button type="button" disabled={pending} onClick={onValidate} className="flex h-9 items-center gap-1.5 rounded-full bg-violet px-3.5 text-[13px] font-bold disabled:opacity-50">
          <CheckIcon size={15} /> Valider {drafts > 1 ? `les ${drafts}` : ""}
        </button>
      )}
      <label className="flex h-9 items-center gap-2 rounded-full bg-white/10 pr-1 pl-3.5 text-[13px] font-bold">
        Déplacer au
        <input
          type="date"
          disabled={pending}
          onChange={(e) => e.target.value && onMove(e.target.value)}
          className="h-7 rounded-full bg-white px-2 text-[13px] text-ink"
          aria-label="Nouvelle date"
        />
      </label>
      {confirming ? (
        <span className="flex items-center gap-1">
          <button type="button" disabled={pending} onClick={onDelete} className="h-9 rounded-full bg-danger px-3.5 text-[13px] font-bold">
            Supprimer {count > 1 ? `les ${count}` : ""}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-full px-3 text-[13px] font-semibold text-white/70">
            Non
          </button>
        </span>
      ) : (
        <button type="button" disabled={pending} onClick={() => setConfirming(true)} aria-label="Supprimer" className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
          <TrashIcon size={17} />
        </button>
      )}
      <button type="button" onClick={onClear} aria-label="Annuler la sélection" className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
        <XIcon size={17} />
      </button>
    </div>
  );
}


type Shot = { id: string; label: string; hint: string | null; done: boolean };

/** The shots to film, ticked off as they are done. `bare`: inside another card (no frame, no title). */
export function ShotList({ shots, bare = false }: { shots: Shot[]; bare?: boolean }) {
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
    <section className={bare ? "flex flex-col gap-3.5" : "card flex flex-col gap-3.5 p-5"}>
      {!bare && (
        <div className="flex items-center gap-2.5">
          <Orb size={28} />
          <h2 className="text-base font-bold">À filmer</h2>
        </div>
      )}
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
