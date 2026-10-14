"use client";

import { coverSrc } from "@/lib/cover-src";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { DeleteButton } from "@/components/delete-button";
import { AskFauveButton } from "@/components/fauve-drawer";
import { CheckIcon, InstagramIcon, XIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { kindLabels } from "@/lib/format";
import { deletePost, updatePost } from "../publications/[id]/actions";
import { getPostSheet, movePost, type PostSheet } from "./actions";

/**
 * The calendar's side panel for one post: where it stands, what is left to do,
 * its date, and the next action (validate, open, ask Fauve, delete).
 */
export function PostDrawer({
  postId,
  onClose,
  onChanged,
  onDeleted,
}: {
  postId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: (id: string) => void;
}) {
  const [sheet, setSheet] = useState<PostSheet | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Load the post when the panel opens on it.
  useEffect(() => {
    if (!postId) return;
    let alive = true;
    getPostSheet(postId)
      .then((s) => {
        if (!alive) return;
        setSheet(s);
        setLoadedId(postId);
        setMessage(null);
      })
      .catch(() => alive && setLoadedId(postId));
    return () => {
      alive = false;
    };
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [postId, onClose]);

  const refresh = (id: string) =>
    getPostSheet(id)
      .then((s) => s && setSheet(s))
      .catch(() => {});

  const reschedule = (date: string, time: string) =>
    start(async () => {
      if (!sheet) return;
      const res = await movePost(sheet.id, date, time).catch(() => ({ ok: false as const, error: "Le changement n’a pas été enregistré." }));
      setMessage(res.ok ? { ok: true, text: "Date enregistrée." } : { ok: false, text: res.error });
      if (res.ok) {
        await refresh(sheet.id);
        onChanged();
      }
    });

  const validate = () =>
    start(async () => {
      if (!sheet) return;
      const form = new FormData();
      form.set("intent", "validate");
      form.set("caption", sheet.caption ?? "");
      const res = await updatePost(sheet.id, { status: "idle" }, form).catch(() => ({ status: "error" as const, message: "Ça n’a pas marché. Réessaie." }));
      if (res.status === "idle") return;
      setMessage({ ok: res.status === "ok", text: res.message });
      if (res.status === "ok") {
        await refresh(sheet.id);
        onChanged();
      }
    });

  // Closing keeps the last post in the panel while it slides out.
  const shown = postId === null ? sheet : loadedId === postId ? sheet : null;
  const loading = postId !== null && loadedId !== postId;

  return (
    <div className={`fixed inset-0 z-40 ${postId ? "" : "pointer-events-none"}`} aria-hidden={!postId}>
      <button
        type="button"
        aria-label="Fermer"
        tabIndex={postId ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-ink/20 transition-opacity duration-240 ease-fauve motion-reduce:transition-none ${postId ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Publication"
        // Slides in and out (visibility waits for the slide to end); translate-x sets `translate`.
        className={`absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-[-12px_0_40px_rgba(28,21,48,0.12)] transition-[translate,visibility] duration-240 ease-fauve motion-reduce:transition-none ${
          postId ? "translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <span className="text-[13px] font-bold text-muted">{shown ? kindLabels[shown.kind] : "Publication"}</span>
          <button type="button" aria-label="Fermer" onClick={onClose} className="flex size-9 items-center justify-center rounded-full hover:bg-soft">
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          {loading && <p className="text-sm text-muted">Chargement…</p>}
          {!loading && postId && !shown && <p className="text-sm text-muted">Cette publication n’existe plus.</p>}
          {shown && (
            <div key={shown.id} className="fauve-fade flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <StatusPill status={shown.status} className="px-2.5 text-xs" />
                <h2 className="text-[22px] leading-tight font-extrabold tracking-[-0.01em]">{shown.title}</h2>
              </div>

              {shown.cover && (
                <div className="flex justify-center rounded-[18px] bg-soft p-2">
                  {shown.cover.video ? (
                    <video src={coverSrc(shown.cover)} muted playsInline controls preload="metadata" className="max-h-[260px] rounded-[12px]" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                    <img src={shown.cover.url} alt="" className="max-h-[260px] rounded-[12px] object-contain" />
                  )}
                </div>
              )}

              <section aria-label="Ce qu’il reste à faire" className="flex flex-col gap-3">
                <p className="rounded-2xl bg-violet-tint px-4 py-3 text-[14px] leading-snug font-semibold">{shown.todo}</p>
                {shown.publishError && <p className="rounded-xl bg-peach px-3 py-2 text-[13px] text-peach-ink">{shown.publishError}</p>}
                <ol className="flex flex-col gap-2">
                  {shown.steps.map((step) => (
                    <li key={step.label} className={`flex items-center gap-2.5 text-[14px] ${step.done ? "text-ink" : "text-muted"}`}>
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${step.done ? "bg-violet text-white" : "border-[1.5px] border-line"}`}
                      >
                        {step.done && <CheckIcon size={12} />}
                      </span>
                      {step.label}
                    </li>
                  ))}
                </ol>
                {shown.shots.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-2xl border border-line p-3.5">
                    <span className="text-[13px] font-bold">À filmer</span>
                    {shown.shots.map((shot) => (
                      <span key={shot.id} className={`text-[13px] ${shot.done ? "text-muted line-through" : ""}`}>
                        {shot.label}
                        {shot.hint ? <span className="text-muted"> · {shot.hint}</span> : null}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {!shown.locked && (
                <section aria-label="Date" className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold">Quand</span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      defaultValue={shown.date ?? ""}
                      key={`d-${shown.date}`}
                      onChange={(e) => e.target.value && reschedule(e.target.value, shown.time ?? "18:00")}
                      className="h-11 flex-1 rounded-xl border border-line px-3 text-[16px] outline-none focus:border-violet sm:text-[14px]"
                    />
                    <input
                      type="time"
                      defaultValue={shown.time ?? "18:00"}
                      key={`t-${shown.time}`}
                      onBlur={(e) => shown.date && e.target.value && e.target.value !== shown.time && reschedule(shown.date, e.target.value)}
                      className="h-11 w-[110px] rounded-xl border border-line px-3 text-[16px] outline-none focus:border-violet sm:text-[14px]"
                    />
                  </div>
                </section>
              )}

              {message && (
                <p key={message.text} role="status" className={`fauve-enter text-[13px] ${message.ok ? "text-muted" : "font-semibold text-danger"}`}>
                  {message.text}
                </p>
              )}
            </div>
          )}
        </div>

        {shown && (
          <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
            {shown.status === "draft" && (
              <button type="button" disabled={pending} onClick={validate} className="btn btn-primary disabled:opacity-50">
                <CheckIcon size={18} />
                {pending ? "Validation…" : "Valider"}
              </button>
            )}
            {shown.status === "validated" && !shown.instagramConnected && (
              <a href="/connect" className="btn btn-primary">
                <InstagramIcon size={18} />
                Connecter Instagram
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href={`/publications/${shown.id}`} className="btn btn-secondary flex-1">
                {shown.locked ? "Voir" : "Ouvrir et modifier"}
              </Link>
              <AskFauveButton topic={{ postId: shown.id, title: shown.title }} className="btn btn-secondary flex-1" />
            </div>
            <div className="flex items-center justify-between gap-2">
              {shown.permalink ? (
                <a href={shown.permalink} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-violet">
                  Voir sur Instagram
                </a>
              ) : (
                <span />
              )}
              <DeleteButton
                action={deletePost.bind(null, shown.id)}
                onDone={() => onDeleted(shown.id)}
                confirmText={shown.locked ? "Supprimer cette publication de Brigitte ? Elle reste en ligne sur Instagram." : "Supprimer cette publication ?"}
                compact
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
