"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { workNow, type WorkItem } from "@/app/(app)/work-actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CheckIcon, XIcon } from "./icons";
import { Orb } from "./orb";

// « Fauve travaille »: a small pill at the top of every page while a montage or
// a text layer is being made, live (Realtime on studio_jobs), with its steps
// and the time elapsed; « Prêt » with a link when it is done.

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

export function WorkPill({ studioId }: { studioId: string }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      workNow()
        .then((w) => w && setItems(w.items))
        .catch(() => {});
    }, 300);
  }, []);

  useEffect(() => {
    load();
    const db = supabaseBrowser();
    const channel = db
      .channel(`work-${studioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_jobs", filter: `studio_id=eq.${studioId}` }, load)
      .subscribe();
    // The elapsed time, and finished work fading out after a while.
    const tick = setInterval(() => setNow(Date.now()), 20_000);
    return () => {
      clearInterval(tick);
      clearTimeout(timer.current);
      void db.removeChannel(channel);
    };
  }, [studioId, load]);

  const visible = items.filter((i) => !dismissed.has(i.id) && (!i.finishedAt || now - new Date(i.finishedAt).getTime() < 3 * 60_000));
  const running = visible.filter((i) => !i.finishedAt);
  if (!visible.length) return null;
  const first = running[0] ?? visible[0]!;
  const label = running.length
    ? `${first.steps[first.step] ?? "En cours"}${running.length > 1 ? ` · +${running.length - 1}` : ""}`
    : first.failed
      ? "N’a pas abouti"
      : "Prêt";

  return (
    <div className="fixed bottom-[88px] left-1/2 z-40 -translate-x-1/2 sm:top-4 sm:right-6 sm:bottom-auto sm:left-auto sm:translate-x-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fauve-enter flex items-center gap-2 rounded-full whitespace-nowrap border border-line bg-white/95 py-1.5 pr-3.5 pl-1.5 text-[13px] font-semibold shadow-[0_8px_24px_rgba(28,21,48,0.14)] backdrop-blur"
      >
        {running.length ? (
          <Orb size={24} />
        ) : (
          <span className={`flex size-6 items-center justify-center rounded-full text-white ${first.failed ? "bg-muted" : "bg-violet"}`}>
            {first.failed ? <XIcon size={13} /> : <CheckIcon size={13} />}
          </span>
        )}
        <span>{running.length ? "Brigitte travaille" : first.kindLabel}</span>
        <span className="text-muted">· {label}</span>
      </button>
      {open && (
        <div className="fauve-pop absolute right-0 flex w-[min(340px,calc(100vw-32px))] flex-col gap-3 rounded-[18px] border border-line bg-white p-3.5 shadow-[0_16px_40px_rgba(28,21,48,0.18)] max-sm:bottom-full max-sm:left-1/2 max-sm:mb-2 max-sm:-translate-x-1/2 max-sm:[--fauve-origin:bottom_center] sm:top-full sm:mt-2 sm:[--fauve-origin:top_right]">
          {visible.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[12px] font-semibold text-muted">{item.kindLabel}</span>
                  <span className="truncate text-[14px] font-bold">{item.title ?? (item.kind === "elements" ? "Tes nouveaux composants" : "Ta publication")}</span>
                </div>
                <button
                  type="button"
                  aria-label="Masquer"
                  onClick={() => setDismissed((d) => new Set(d).add(item.id))}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft"
                >
                  <XIcon size={13} />
                </button>
              </div>
              {item.finishedAt ? (
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-semibold ${item.failed ? "text-danger" : "text-violet"}`}>
                    {item.failed ? "N’a pas abouti : aucun crédit débité" : "C’est prêt"}
                  </span>
                  {!item.failed && (item.postId || item.templateId) && (
                    <Link href={item.postId ? `/publications/${item.postId}` : `/composants/${item.templateId}`} onClick={() => setOpen(false)} className="btn btn-primary h-8 px-3 text-[13px]">
                      Voir
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <ol className="flex gap-1" aria-label="Étapes">
                    {item.steps.map((s, i) => (
                      <li key={s} className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className={`h-1.5 rounded-full ${i < item.step ? "bg-violet" : i === item.step ? "fauve-pulse bg-violet/60" : "bg-line"}`} />
                        <span className={`truncate text-[11px] ${i === item.step ? "font-bold text-ink" : "text-muted"}`}>{s}</span>
                      </li>
                    ))}
                  </ol>
                  <span className="text-[12px] text-muted">
                    Depuis {minutesSince(item.startedAt, now) || "moins d’une"} min · {item.kind === "montage" ? "4 à 15 min en tout" : "2 à 4 min en tout"} · {item.postId ? "le lien arrive tout seul" : "ils arrivent dans ta banque"}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
