"use client";

import {
  buildReelProps,
  editPlanSchema,
  segmentKind,
  statusLabels,
  timeline,
  type EditPlan,
  type PostKind,
  type PostStatus,
  type ReelInputs,
} from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useMemo, useRef, useState, useTransition } from "react";
import { CheckIcon, PenIcon, PlusIcon, TrashIcon, WhatsAppIcon, XIcon } from "@/components/icons";
import { DEFAULT_Y, TextBoxes } from "@/components/montage/text-boxes";
import { Orb } from "@/components/orb";
import { ReelPlayer } from "@/components/reel-player";
import { saveEditPlan, updatePost } from "@/app/(app)/publications/[id]/actions";

// The page a WhatsApp link opens, made for a phone: watch the montage, then one
// thumb away from validating it, moving a text, or asking Fauve for a change.

type Text = EditPlan["texts"][number];
type Mode = "view" | "edit" | "done";

const styleLabels: Record<Text["style"], string> = { hook: "Accroche", band: "Bandeau", caption: "Sous-titre" };
const kindLabels: Record<PostKind, string> = { reel: "Reel", post: "Post", carousel: "Carrousel", story: "Story" };
const sceneLabels = { clip: "Vidéo", scene: "Écran", motion: "Animation" } as const;
const round = (n: number) => Math.round(n * 10) / 10;

export type ActionPost = {
  id: string;
  title: string;
  kind: PostKind;
  status: PostStatus;
  caption: string;
  hashtags: string[];
  when: string | null;
};

export function ActionView({
  post,
  editor,
  videoUrl,
  photoUrl,
  changeHref,
  backHref,
}: {
  post: ActionPost;
  editor: { plan: EditPlan; inputs: ReelInputs } | null;
  videoUrl: string | null;
  photoUrl: string | null;
  changeHref: string;
  backHref: string;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [status, setStatus] = useState(post.status);
  const [saved, setSaved] = useState(editor?.plan ?? null);
  const [plan, setPlan] = useState(editor?.plan ?? null);
  const [caption, setCaption] = useState(post.caption);
  const [savedCaption, setSavedCaption] = useState(post.caption);
  const [editingCaption, setEditingCaption] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [scene, setScene] = useState(0);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const playerRef = useRef<PlayerRef>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const props = useMemo(() => (plan && editor ? buildReelProps(plan, editor.inputs) : null), [plan, editor]);
  const spans = useMemo(() => (plan ? timeline(plan) : []), [plan]);
  const dirty = plan !== null && JSON.stringify(plan) !== JSON.stringify(saved);
  const valid = plan === null || editPlanSchema.safeParse(plan).success;
  const canValidate = status === "draft";
  const editable = editor !== null && status !== "published" && status !== "measured";

  const seek = (seconds: number) => props && playerRef.current?.seekTo(Math.round(seconds * props.fps));
  const setText = (i: number, patch: Partial<Text>) => {
    if (!plan) return;
    setPlan({ ...plan, texts: plan.texts.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
    setToast(null);
  };
  const pick = (i: number) => {
    setActive(i);
    playerRef.current?.pause();
  };
  const pickScene = (i: number) => {
    setScene(i);
    setActive(null);
    const span = spans[i];
    if (span) seek(Math.min(span.start + 1, (span.start + span.end) / 2));
    playerRef.current?.pause();
  };
  const addText = () => {
    if (!plan) return;
    const span = spans[Math.min(scene, spans.length - 1)] ?? { start: 0, end: plan.duration };
    const text: Text = { text: "Ton texte", from: round(span.start), to: round(Math.min(span.end, span.start + 2.5)), style: "band" };
    setPlan({ ...plan, texts: [...plan.texts, text] });
    setActive(plan.texts.length);
    seek(text.from + 0.3);
  };
  const removeText = (i: number) => {
    if (!plan) return;
    setPlan({ ...plan, texts: plan.texts.filter((_, j) => j !== i) });
    setActive(null);
  };

  const cancelEdit = () => {
    setPlan(saved);
    setActive(null);
    setMode("view");
  };
  const saveEdit = () =>
    start(async () => {
      if (!plan) return;
      const res = await saveEditPlan(post.id, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (!res.ok) return setToast({ ok: false, text: res.error });
      setSaved(plan);
      setActive(null);
      setMode("view");
      setToast({ ok: true, text: "C’est enregistré. La vidéo finale se met à jour en une minute environ." });
    });

  const submit = (intent: "validate" | "save") =>
    start(async () => {
      const form = new FormData();
      form.set("intent", intent);
      form.set("caption", caption);
      const res = await updatePost(post.id, { status: "idle" }, form).catch(() => ({
        status: "error" as const,
        message: "Ça n’a pas marché. Réessaie dans un instant.",
      }));
      if (res.status === "error") return setToast({ ok: false, text: res.message });
      if (res.status !== "ok") return;
      setSavedCaption(caption);
      setEditingCaption(false);
      if (intent === "validate") {
        setStatus("validated");
        setDone(res.message);
        setMode("done");
      } else setToast({ ok: true, text: res.message });
    });

  if (mode === "done") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-violet text-white shadow-[0_0_0_10px_rgba(91,63,217,0.25)]">
          <CheckIcon size={30} />
        </span>
        <h1 className="font-serif text-[34px] italic leading-tight">C’est validé</h1>
        <p className="max-w-[320px] text-[16px] leading-relaxed text-white/75">{done}</p>
        <a href={backHref} className="mt-2 flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-ink">
          <WhatsAppIcon size={18} /> Retour à WhatsApp
        </a>
        <button type="button" onClick={() => setMode("view")} className="text-[14px] font-semibold text-white/60 underline-offset-4 hover:underline">
          Revoir la publication
        </button>
      </main>
    );
  }

  const editing = mode === "edit" && plan !== null;
  const activeText = editing && active !== null ? plan.texts[active] : undefined;
  const sceneIndex = Math.min(scene, Math.max(0, spans.length - 1));
  const span = spans[sceneIndex];
  const sceneTexts = editing && span ? plan.texts.map((t, i) => ({ t, i })).filter(({ t }) => t.from >= span.start && t.from < span.end) : [];
  // The preview leaves room for the controls under it, so everything fits one screen.
  const mediaWidth = editing ? "min(100%, max(190px, calc((100dvh - 440px) * 9 / 16)))" : "min(100%, calc((100dvh - 340px) * 9 / 16))";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+132px)]">
      <header className="flex items-center gap-3">
        <Orb size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{post.title}</p>
          <p className="truncate text-[12px] text-white/60">
            {kindLabels[post.kind]}
            {post.when ? ` · ${post.when}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/80">{statusLabels[status].label}</span>
      </header>

      {editing && (
        <p className="mt-3 text-center text-[13px] text-white/70">
          {activeText ? "Glisse le texte avec le doigt, ou change-le en bas." : "Touche un texte pour le modifier, glisse-le pour le déplacer."}
        </p>
      )}

      <div className="mt-3 flex justify-center">
        <div ref={previewRef} className="relative overflow-hidden rounded-[22px] bg-black" style={{ width: mediaWidth }}>
          {props ? (
            <>
              {/* Opens a second in: at frame 0 the texts have not come in yet. */}
              <ReelPlayer props={props} playerRef={playerRef} initialFrame={Math.min(props.fps, props.durationInFrames - 1)} />
              {editing && (
                <TextBoxes
                  container={previewRef}
                  player={playerRef}
                  texts={plan.texts}
                  active={active}
                  onMove={(i, place) => setText(i, place)}
                  onPick={pick}
                />
              )}
            </>
          ) : videoUrl ? (
            <video src={videoUrl} controls playsInline loop className="aspect-[9/16] w-full object-cover" />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
            <img src={photoUrl} alt="" className="w-full" />
          ) : (
            <div className="flex aspect-[9/16] w-full items-center justify-center p-6 text-center text-[14px] text-white/60">
              Fauve prépare encore cette publication.
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <section aria-label="Modifier" className="mt-4 flex flex-col gap-3">
          {plan.segments.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {plan.segments.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickScene(i)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                    i === sceneIndex ? "bg-white text-ink" : "bg-white/10 text-white/80"
                  }`}
                >
                  {i + 1}. {sceneLabels[segmentKind(s)]}
                </button>
              ))}
            </div>
          )}

          {activeText && active !== null ? (
            <TextSheet
              key={active}
              text={activeText}
              onChange={(patch) => setText(active, patch)}
              onRemove={() => removeText(active)}
              onClose={() => setActive(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {sceneTexts.map(({ t, i }) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    pick(i);
                    seek(t.from + 0.3);
                  }}
                  className="flex max-w-full items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[13px]"
                >
                  <PenIcon size={13} className="shrink-0 text-white/60" />
                  <span className="truncate">{t.text}</span>
                </button>
              ))}
              <button type="button" onClick={addText} className="flex items-center gap-1.5 rounded-full border border-dashed border-white/30 px-3 py-1.5 text-[13px] text-white/80">
                <PlusIcon size={13} /> Ajouter un texte
              </button>
            </div>
          )}
        </section>
      ) : (
        <section aria-label="Légende" className="mt-4">
          {editingCaption ? (
            <textarea
              autoFocus
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              maxLength={2200}
              className="w-full rounded-[16px] bg-white p-3.5 text-[15px] leading-relaxed text-ink outline-none focus:ring-2 focus:ring-violet"
            />
          ) : (
            <button
              type="button"
              disabled={!editable && !canValidate}
              onClick={() => setEditingCaption(true)}
              className="w-full rounded-[16px] bg-white/[0.07] p-3.5 text-left text-[14px] leading-relaxed text-white/85"
            >
              <span className="line-clamp-3 whitespace-pre-line">{caption || "Pas encore de légende."}</span>
              {post.hashtags.length > 0 && <span className="mt-1.5 block truncate text-violet-soft/80">{post.hashtags.map((h) => `#${h}`).join(" ")}</span>}
              {(editable || canValidate) && (
                <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-white/50">
                  <PenIcon size={12} /> Modifier la légende
                </span>
              )}
            </button>
          )}
        </section>
      )}

      {toast && (
        <p role="status" className={`mt-3 rounded-[14px] px-3.5 py-2.5 text-[14px] ${toast.ok ? "bg-white/10 text-white" : "bg-peach text-peach-ink"}`}>
          {toast.text}
        </p>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {editing ? (
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} className="flex-1 rounded-full border border-white/25 py-3.5 text-[15px] font-bold">
                Annuler
              </button>
              <button
                type="button"
                disabled={!dirty || !valid || pending}
                onClick={saveEdit}
                className="flex-[2] rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-40"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {editable && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("edit");
                      pickScene(0);
                      setToast(null);
                      setEditingCaption(false);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/25 py-3.5 text-[15px] font-bold"
                  >
                    <PenIcon size={16} /> Modifier
                  </button>
                )}
                {canValidate ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit("validate")}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-50"
                  >
                    <CheckIcon size={18} /> {pending ? "Validation…" : "Valider"}
                  </button>
                ) : caption !== savedCaption ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit("save")}
                    className="flex-[2] rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-50"
                  >
                    Enregistrer la légende
                  </button>
                ) : (
                  <p className="flex flex-[2] items-center justify-center rounded-full bg-white/10 px-3 py-3.5 text-center text-[14px] font-semibold text-white/80">
                    {status === "validated" || status === "scheduled" ? "Déjà validée" : statusLabels[status].label}
                  </p>
                )}
              </div>
              <a href={changeHref} className="flex items-center justify-center gap-1.5 py-1 text-[13px] font-semibold text-white/65">
                <WhatsAppIcon size={14} /> Demander un changement à Fauve
              </a>
            </>
          )}
        </div>
      </nav>
    </main>
  );
}

/** The selected text: its words, style, size and background, big enough for a thumb. */
function TextSheet({
  text,
  onChange,
  onRemove,
  onClose,
}: {
  text: Text;
  onChange: (patch: Partial<Text>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const scale = text.scale ?? 1;
  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-white p-3.5 text-ink">
      <div className="flex items-center gap-2">
        <input
          value={text.text}
          onChange={(e) => onChange({ text: e.target.value })}
          maxLength={120}
          aria-label="Texte"
          className="min-w-0 flex-1 rounded-[12px] border border-line px-3 py-2.5 text-[16px] outline-none focus:border-violet"
        />
        <button type="button" aria-label="Fermer" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
          <XIcon size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(styleLabels) as Text["style"][]).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onChange({ style, y: text.y ?? DEFAULT_Y[text.style] })}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${text.style === style ? "bg-violet text-white" : "bg-violet-soft text-violet"}`}
          >
            {styleLabels[style]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Plus petit"
          disabled={scale <= 0.6}
          onClick={() => onChange({ scale: Math.max(0.6, round(scale - 0.1)) })}
          className="size-10 rounded-full border border-line text-[15px] font-bold disabled:opacity-30"
        >
          A−
        </button>
        <button
          type="button"
          aria-label="Plus grand"
          disabled={scale >= 1.6}
          onClick={() => onChange({ scale: Math.min(1.6, round(scale + 0.1)) })}
          className="size-10 rounded-full border border-line text-[18px] font-bold disabled:opacity-30"
        >
          A+
        </button>
        <button
          type="button"
          aria-pressed={text.backdrop ?? false}
          onClick={() => onChange({ backdrop: text.backdrop ? undefined : true })}
          className={`rounded-full px-3.5 py-2.5 text-[13px] font-semibold ${text.backdrop ? "bg-ink text-white" : "border border-line"}`}
        >
          Fond derrière
        </button>
        <button type="button" aria-label="Supprimer le texte" onClick={onRemove} className="ml-auto flex size-10 items-center justify-center rounded-full text-danger">
          <TrashIcon size={17} />
        </button>
      </div>
    </div>
  );
}
