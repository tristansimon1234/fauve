"use client";

import {
  buildReelProps,
  editPlanSchema,
  insertSegment,
  moveSegment,
  removeSegment,
  segmentKind,
  timeline,
  updateSegment,
  type EditPlan,
  type ReelInputs,
  type SavedLook,
  type Segment,
} from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, FilmIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ListItems } from "@/components/montage/list-items";
import { StylePicker } from "@/components/montage/style-picker";
import { clipFaceBlur, photoRetouch } from "@/components/montage/retouch-actions";
import { RetouchSwitches } from "@/components/montage/retouch-switches";
import { TextBoxes } from "@/components/montage/text-boxes";
import { AskFauveButton, useFauveDrawer } from "@/components/fauve-drawer";
import { ReelPlayer } from "@/components/reel-player";
import { saveEditPlan } from "./actions";

// The scene editor: the montage plays live (same composition as the render),
// each scene can be edited by hand, and saving makes a new version that is
// rendered in the background. Free: no AI involved.

type Text = EditPlan["texts"][number];

const kindLabels = { clip: "Vidéo", scene: "Texte", motion: "Animation" } as const;
const round = (n: number) => Math.round(n * 10) / 10;

function sceneLabel(segment: Segment, clipLabels: Record<string, string>): string {
  if ("clip_id" in segment) return clipLabels[segment.clip_id] ?? "Passage de ta vidéo";
  if ("scene" in segment) return segment.scene.title;
  const first = Object.values(segment.motion.texts ?? {})[0];
  return first ?? segment.motion.brief.split(/[.!?]/)[0] ?? "Animation";
}

export function MontageEditor({
  postId,
  postTitle,
  initialPlan,
  inputs,
  clipDurations,
  clipLabels,
  looks,
}: {
  postId: string;
  postTitle: string;
  initialPlan: EditPlan;
  inputs: ReelInputs;
  clipDurations: Record<string, number | null>;
  clipLabels: Record<string, string>;
  /** The studio's saved text looks. */
  looks: SavedLook[];
}) {
  const [saved, setSaved] = useState(initialPlan);
  const [plan, setPlan] = useState(initialPlan);
  const [selected, setSelected] = useState(0);
  // The text being placed: its handle shows on the preview, to drag it up or down.
  const [activeText, setActiveText] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const playerRef = useRef<PlayerRef>(null);

  const props = useMemo(() => buildReelProps(plan, inputs), [plan, inputs]);
  const spans = useMemo(() => timeline(plan), [plan]);
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);
  const valid = editPlanSchema.safeParse(plan).success;
  const index = Math.min(selected, plan.segments.length - 1);
  const segment = plan.segments[index]!;
  const span = spans[index]!;

  const seek = (seconds: number) => playerRef.current?.seekTo(Math.round(seconds * props.fps));
  const select = (i: number) => {
    setSelected(i);
    seek(Math.min(spans[i]!.start + 1, (spans[i]!.start + spans[i]!.end) / 2));
  };
  const edit = (next: EditPlan) => {
    setPlan(next);
    setMessage(null);
  };
  const setSegment = (next: Segment) => edit(updateSegment(plan, index, next));

  // Texts shown during the selected scene (they follow it when scenes move).
  const sceneTexts = plan.texts.map((t, i) => ({ t, i })).filter(({ t }) => t.from >= span.start && t.from < span.end);
  const setText = (i: number, patch: Partial<Text>) => edit({ ...plan, texts: plan.texts.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const removeText = (i: number) => {
    setActiveText(null);
    edit({ ...plan, texts: plan.texts.filter((_, j) => j !== i) });
  };
  const addText = () =>
    edit({
      ...plan,
      texts: [...plan.texts, { text: "Ton texte", from: round(span.start), to: round(Math.min(span.end, span.start + 2.5)), style: "band" }],
    });

  const saveNow = async () => {
    const res = await saveEditPlan(postId, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
    if (res.ok) {
      setSaved(plan);
      setMessage({ ok: true, text: "Enregistré. La vidéo finale se met à jour (environ une minute)." });
    } else setMessage({ ok: false, text: res.error });
    return res.ok;
  };
  const save = () => startSaving(async () => void (await saveNow()));

  const remove = (i: number) => {
    edit(removeSegment(plan, i));
    setSelected(Math.max(0, i - 1));
  };
  const move = (from: number, to: number) => {
    edit(moveSegment(plan, from, to));
    setSelected(to);
  };
  // A new scene goes right after the selected one.
  const insert = (next: Segment) => {
    edit(insertSegment(plan, index + 1, next));
    setSelected(index + 1);
  };
  const openFauve = useFauveDrawer();
  const videos = Object.keys(inputs.clipUrls).map((id) => ({ id, label: clipLabels[id] ?? "Ta vidéo", duration: clipDurations[id] ?? null }));

  // Two grid items: the stage (preview and timeline) and the inspector (the selected scene).
  return (
    <>
      <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4">
        {/* Sized to the screen's height, so the timeline stays in view under the preview. */}
        <div className="flex justify-center rounded-[24px] bg-[radial-gradient(ellipse_at_top,#2a2145_0%,#16112a_70%)] px-5 py-5">
          <div
            ref={previewRef}
            className="relative overflow-hidden rounded-[16px] shadow-[0_24px_60px_rgba(0,0,0,.45)]"
            style={{ width: "max(210px, min(100%, 340px, calc((100dvh - 360px) * 9 / 16)))" }}
          >
            <ReelPlayer props={props} playerRef={playerRef} />
            <TextBoxes
              container={previewRef}
              player={playerRef}
              texts={plan.texts}
              active={activeText}
              onMove={(i, place) => setText(i, place)}
              onEdit={(i, text) => setText(i, { text })}
              onPick={(i) => {
                setActiveText(i);
                const at = plan.texts[i];
                if (at) setSelected(segmentAtIndex(spans, at.from));
                requestAnimationFrame(() => document.getElementById(`fauve-text-${i}`)?.focus());
              }}
            />
          </div>
        </div>

        <Timeline
          header={
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? (
                <>
                  <span className="text-[12px] font-semibold text-peach-ink">Modifié · pas encore enregistré</span>
                  <button
                    type="button"
                    onClick={() => edit(saved)}
                    disabled={saving}
                    className="h-8 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-soft disabled:opacity-40"
                  >
                    Annuler
                  </button>
                  <button type="button" onClick={save} disabled={!valid || saving} className="btn btn-primary h-8 px-3.5 text-[13px] disabled:opacity-50">
                    <CheckIcon size={15} />
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-[12px] text-muted">
                  <FilmIcon size={14} />
                  {message?.ok ? message.text : "Aperçu en direct · modifications gratuites"}
                </span>
              )}
            </div>
          }
          plan={plan}
          spans={spans}
          selected={index}
          activeText={activeText}
          fps={props.fps}
          player={playerRef}
          labels={plan.segments.map((s) => sceneLabel(s, clipLabels))}
          onSelect={select}
          onMove={move}
          addButton={
            <AddScene
              videos={videos}
              canAskFauve={!dirty}
              onVideo={(v) => insert({ clip_id: v.id, in: 0, out: round(Math.min(3, v.duration ?? 3)), zoom: "none" })}
              onText={() => insert({ scene: { kind: "title", title: "Ton titre", background: "accent" }, duration: 2.5 })}
              onAnimation={() =>
                openFauve({ postId, title: postTitle, scene: index, sceneLabel: `Nouvelle animation après la scène ${index + 1}` })
              }
            />
          }
          onPickText={(i) => {
            setActiveText(i);
            const at = plan.texts[i]!;
            setSelected(segmentAtIndex(spans, at.from));
            seek(at.from + 0.05);
          }}
        />

        {(!valid || (message && !message.ok)) && (
          <p role="alert" className="rounded-xl bg-peach px-3 py-2 text-[13px] font-semibold text-danger">
            {!valid ? "Un texte est vide ou une durée est hors limites." : message?.text}
          </p>
        )}
      </div>

      <aside aria-label="Scène sélectionnée" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${kindChip(segmentKind(segment))}`}
            >
              {kindLabels[segmentKind(segment)]}
            </span>
            <h2 className="min-w-0 flex-1 truncate text-[16px] font-bold">Scène {index + 1}</h2>
            <button
              type="button"
              aria-label="Avancer la scène"
              title="Plus tôt"
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-soft disabled:opacity-30"
            >
              <ArrowUpIcon size={16} className="-rotate-90" />
            </button>
            <button
              type="button"
              aria-label="Reculer la scène"
              title="Plus tard"
              disabled={index === plan.segments.length - 1}
              onClick={() => move(index, index + 1)}
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-soft disabled:opacity-30"
            >
              <ArrowDownIcon size={16} className="-rotate-90" />
            </button>
            <button
              type="button"
              aria-label="Supprimer la scène"
              title="Supprimer la scène"
              disabled={plan.segments.length <= 1}
              onClick={() => remove(index)}
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-danger disabled:opacity-30"
            >
              <TrashIcon size={16} />
            </button>
          </div>
          <p className="-mt-2 truncate text-[13px] text-muted">{sceneLabel(segment, clipLabels)}</p>
          {/* Brigitte reads the saved montage: changes not saved yet are saved first. */}
          <AskFauveButton
            topic={{ postId, title: postTitle, scene: index, sceneLabel: `Scène ${index + 1} · ${kindLabels[segmentKind(segment)]}` }}
            label={segmentKind(segment) === "motion" ? "Demander à Brigitte de refaire l’animation" : "Demander à Brigitte pour cette scène"}
            before={dirty && valid ? saveNow : undefined}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-violet-soft px-3 py-2 text-[13px] font-bold text-violet hover:bg-violet hover:text-white disabled:opacity-60"
          />
          <SegmentFields segment={segment} onChange={setSegment} photo={"clip_id" in segment && Boolean(inputs.photoIds?.includes(segment.clip_id))} />
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold">Textes sur cette scène</h3>
              <button type="button" onClick={addText} className="inline-flex items-center gap-1 text-[13px] font-bold text-violet">
                <PlusIcon size={15} />
                Ajouter un texte
              </button>
            </div>
            {sceneTexts.length === 0 ? (
              <p className="text-[13px] text-muted">Aucun texte par-dessus cette scène.</p>
            ) : (
              <p className="-mt-1 text-[12px] text-muted">Pour le placer, fais glisser le texte sur la vidéo. Clique dessus pour changer les mots.</p>
            )}
            {sceneTexts.map(({ t, i }) => (
              <div
                key={i}
                onFocusCapture={() => setActiveText(i)}
                onPointerDownCapture={() => setActiveText(i)}
                className={`flex flex-col gap-2 rounded-[14px] p-3 ${activeText === i ? "bg-violet-tint ring-1 ring-lilac" : "bg-soft"}`}
              >
                <input
                  id={`fauve-text-${i}`}
                  value={t.text}
                  maxLength={120}
                  onChange={(e) => setText(i, { text: e.target.value })}
                  aria-label="Texte"
                  hidden={Boolean(t.items)}
                  className="h-10 rounded-[10px] border border-line bg-white px-3 text-[14px] outline-none focus:border-lilac"
                />
                {t.items && (
                  <ListItems
                    items={t.items}
                    bullet={t.bullet}
                    onChange={(patch) => setText(i, { ...patch, ...(patch.items ? { text: patch.items[0]?.title.slice(0, 120) ?? t.text } : {}) })}
                  />
                )}
                <StylePicker role={t.style} look={t.look} saved={looks} brand={props.brand} sample={t.text} onChange={(look) => setText(i, { look })} />
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-muted">Taille</span>
                  <button
                    type="button"
                    aria-label="Plus petit"
                    disabled={(t.scale ?? 1) <= 0.6}
                    onClick={() => setText(i, { scale: Math.max(0.6, round((t.scale ?? 1) - 0.1)) })}
                    className="size-9 rounded-full bg-white text-[13px] font-bold text-muted disabled:opacity-30"
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    aria-label="Plus grand"
                    disabled={(t.scale ?? 1) >= 1.6}
                    onClick={() => setText(i, { scale: Math.min(1.6, round((t.scale ?? 1) + 0.1)) })}
                    className="size-9 rounded-full bg-white text-[15px] font-bold text-muted disabled:opacity-30"
                  >
                    A+
                  </button>
                  <button type="button" aria-label="Supprimer ce texte" onClick={() => removeText(i)} className="ml-auto flex size-9 items-center justify-center rounded-full text-muted hover:text-danger">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {plan.end_card && (
          <section aria-label="Écran de fin" className="flex flex-col gap-2 rounded-[20px] border border-line bg-white p-5">
            <h2 className="text-[16px] font-bold">Écran de fin</h2>
            <Field label="Titre" value={plan.end_card.title} max={40} onChange={(title) => edit({ ...plan, end_card: { ...plan.end_card!, title } })} />
            <Field
              label="Appel à l’action"
              value={plan.end_card.subtitle ?? ""}
              max={60}
              onChange={(subtitle) => edit({ ...plan, end_card: { ...plan.end_card!, subtitle: subtitle || undefined } })}
            />
          </section>
        )}
      </aside>
    </>
  );
}

function Field({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-[10px] border border-line bg-white px-3 text-[14px] outline-none focus:border-lilac"
      />
    </label>
  );
}

/** The words of one scene (cuts, lengths and looks are Brigitte's: « Demander à Brigitte »). */
function SegmentFields({ segment, onChange, photo }: { segment: Segment; onChange: (s: Segment) => void; photo: boolean }) {
  if ("clip_id" in segment && photo) {
    // A photo of the Reel: retouched and blurred like a carousel slide.
    return (
      <RetouchSwitches
        key={segment.clip_id}
        light={Boolean(segment.photo?.adjust)}
        faces={Boolean(segment.photo?.blur?.some((b) => b.kind === "face"))}
        onChange={async (next) => {
          const res = await photoRetouch(segment.clip_id, next).catch(() => ({ ok: false as const, error: "Brigitte n’a pas pu regarder cette photo." }));
          if (!res.ok) return { ok: false, message: res.error };
          onChange({ ...segment, photo: res.value ?? undefined });
          return { ok: true, message: res.note };
        }}
      />
    );
  }
  if ("clip_id" in segment) {
    // Faces are tracked over the whole clip, so the blur follows this clip wherever it is used.
    return (
      <RetouchSwitches
        key={segment.clip_id}
        showLight={false}
        light={false}
        faces={Boolean(segment.blur?.tracks.length)}
        onChange={async (next) => {
          if (!next.faces) {
            onChange({ ...segment, blur: undefined });
            return { ok: true };
          }
          const res = await clipFaceBlur(segment.clip_id).catch(() => ({ ok: false as const, error: "Brigitte n’a pas pu regarder cette vidéo." }));
          if (!res.ok) return { ok: false, message: res.error };
          if (res.value) onChange({ ...segment, blur: res.value });
          return { ok: true, message: res.note };
        }}
      />
    );
  }
  if ("scene" in segment) {
    const scene = segment.scene;
    const set = (patch: Partial<typeof scene>) => onChange({ ...segment, scene: { ...scene, ...patch } });
    return (
      <div className="flex flex-col gap-3">
        <Field label={scene.kind === "quote" ? "Citation" : scene.kind === "number" ? "Chiffre ou offre" : "Titre"} value={scene.title} max={60} onChange={(title) => set({ title })} />
        {(scene.kicker || scene.kind === "quote") && (
          <Field label={scene.kind === "quote" ? "Auteur" : "Petit texte au-dessus"} value={scene.kicker ?? ""} max={40} onChange={(kicker) => set({ kicker: kicker || undefined })} />
        )}
        {scene.kind === "list" && (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-muted">Lignes de la liste (une par ligne)</span>
            <textarea
              value={(scene.items ?? []).join("\n")}
              rows={4}
              onChange={(e) => set({ items: e.target.value.split("\n").slice(0, 5).map((l) => l.slice(0, 40)) })}
              className="rounded-[10px] border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-lilac"
            />
          </label>
        )}
      </div>
    );
  }
  const texts = segment.motion.texts ?? {};
  if (!Object.keys(texts).length) return null;
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(texts).map(([slot, value], n) => (
        <Field
          key={slot}
          label={Object.keys(texts).length > 1 ? `Texte ${n + 1}` : "Texte de l’animation"}
          value={value}
          max={200}
          onChange={(text) => onChange({ ...segment, motion: { ...segment.motion, texts: { ...texts, [slot]: text } } })}
        />
      ))}
    </div>
  );
}

function kindChip(kind: ReturnType<typeof segmentKind>) {
  return kind === "motion" ? "bg-violet text-white" : kind === "scene" ? "bg-chip text-muted" : "bg-peach text-peach-ink";
}

/** The scene a moment falls in (the last one for the very end). */
function segmentAtIndex(spans: { start: number; end: number }[], seconds: number): number {
  const i = spans.findIndex((s) => seconds >= s.start && seconds < s.end);
  return i === -1 ? Math.max(0, spans.length - 1) : i;
}

/**
 * « + » at the end of the timeline: a passage of one of the post's videos, a
 * text screen (both added at once, free), or an animation, which Fauve creates.
 */
function AddScene({
  videos,
  canAskFauve,
  onVideo,
  onText,
  onAnimation,
}: {
  videos: { id: string; label: string; duration: number | null }[];
  canAskFauve: boolean;
  onVideo: (video: { id: string; duration: number | null }) => void;
  onText: () => void;
  onAnimation: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickVideo, setPickVideo] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const done = (fn: () => void) => () => {
    fn();
    setOpen(false);
    setPickVideo(false);
  };
  const item = "flex w-full flex-col items-start gap-0.5 rounded-[10px] px-3 py-2 text-left hover:bg-soft disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-label="Ajouter une scène"
        title="Ajouter une scène"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setPickVideo(false);
        }}
        className="flex h-full w-11 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-lilac text-violet hover:bg-violet-tint"
      >
        <PlusIcon size={18} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-20 mb-2 flex w-[260px] flex-col rounded-[16px] border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(28,21,48,0.16)]">
          {pickVideo ? (
            <>
              <button type="button" onClick={() => setPickVideo(false)} className="px-3 py-1.5 text-left text-[12px] font-bold text-violet">
                ← Quelle vidéo ?
              </button>
              <div className="flex max-h-[220px] flex-col overflow-y-auto">
                {videos.map((v) => (
                  <button key={v.id} type="button" onClick={done(() => onVideo(v))} className={item}>
                    <span className="line-clamp-2 text-[13px] font-semibold">{v.label}</span>
                    {v.duration !== null && <span className="text-[11px] text-muted">{round(v.duration)} s</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="px-3 pt-1.5 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">Après la scène choisie</span>
              <button type="button" disabled={!videos.length} onClick={() => setPickVideo(true)} className={item}>
                <span className="flex items-center gap-2 text-[14px] font-bold">
                  <span className="size-2.5 rounded-full bg-[#f6b8a3]" />
                  Vidéo
                </span>
                <span className="text-[12px] text-muted">{videos.length ? "Un passage de tes vidéos" : "Aucune vidéo sur cette publication"}</span>
              </button>
              <button type="button" disabled={!canAskFauve} onClick={done(onAnimation)} className={item}>
                <span className="flex items-center gap-2 text-[14px] font-bold">
                  <span className="size-2.5 rounded-full bg-violet" />
                  Animation
                </span>
                <span className="text-[12px] text-muted">{canAskFauve ? "Brigitte la crée selon ta demande" : "Enregistre d’abord tes modifications"}</span>
              </button>
              <button type="button" onClick={done(onText)} className={item}>
                <span className="flex items-center gap-2 text-[14px] font-bold">
                  <span className="size-2.5 rounded-full bg-[#c9bfd3]" />
                  Autre : écran de texte
                </span>
                <span className="text-[12px] text-muted">Un titre, une liste, une citation ou un chiffre</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const blockColors = { clip: "bg-[#fde3d9] text-peach-ink", scene: "bg-[#ece6ef] text-ink", motion: "bg-[#e4dcff] text-violet" } as const;

/**
 * The montage over time, like a video editor: one block per scene (its width
 * is its length; drag a block to reorder), the texts on a track below, and the
 * playhead. Click anywhere on the tracks to jump there.
 */
function Timeline({
  header,
  addButton,
  plan,
  spans,
  selected,
  activeText,
  fps,
  player,
  labels,
  onSelect,
  onMove,
  onPickText,
}: {
  header: React.ReactNode;
  addButton: React.ReactNode;
  plan: EditPlan;
  spans: { start: number; end: number }[];
  selected: number;
  activeText: number | null;
  fps: number;
  player: React.RefObject<PlayerRef | null>;
  labels: string[];
  onSelect: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onPickText: (i: number) => void;
}) {
  const total = Math.max(0.1, spans.at(-1)?.end ?? plan.duration);
  const [time, setTime] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const tracks = useRef<HTMLDivElement>(null);

  // The playhead follows the player.
  useEffect(() => {
    const timer = setInterval(() => {
      const frame = player.current?.getCurrentFrame();
      if (frame !== undefined) setTime(frame / fps);
    }, 80);
    return () => clearInterval(timer);
  }, [player, fps]);

  const seekTo = (clientX: number) => {
    const rect = tracks.current?.getBoundingClientRect();
    if (!rect) return;
    const at = Math.min(total, Math.max(0, ((clientX - rect.left) / rect.width) * total));
    player.current?.pause();
    player.current?.seekTo(Math.round(at * fps));
  };
  const pct = (seconds: number) => `${(Math.min(total, Math.max(0, seconds)) / total) * 100}%`;

  return (
    <section aria-label="Timeline" className="flex flex-col gap-2 rounded-[18px] border border-line bg-white p-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-[12px] font-semibold text-muted" title="Glisse une scène pour changer l’ordre">
          {plan.segments.length} scènes · {round(total)} s
        </span>
        {header}
      </div>
      <div ref={tracks} className="relative flex flex-col gap-1.5" onDoubleClick={(e) => seekTo(e.clientX)}>
        <div className="flex h-[64px] gap-1">
          {plan.segments.map((s, i) => {
            const kind = segmentKind(s);
            const length = spans[i]!.end - spans[i]!.start;
            return (
              <button
                key={i}
                type="button"
                draggable
                onDragStart={(e) => {
                  setDragFrom(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  setDropAt(i);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDropAt(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i);
                  setDragFrom(null);
                  setDropAt(null);
                }}
                onClick={() => onSelect(i)}
                title={labels[i]}
                style={{ flexGrow: Math.max(0.4, length), flexBasis: 0 }}
                className={`relative flex min-w-[38px] cursor-grab flex-col justify-between overflow-hidden rounded-[10px] px-2 py-1.5 text-left active:cursor-grabbing ${blockColors[kind]} ${
                  i === selected ? "ring-2 ring-violet ring-offset-1" : "opacity-90 hover:opacity-100"
                } ${dropAt === i && dragFrom !== i ? "outline-2 outline-dashed outline-violet" : ""} ${dragFrom === i ? "opacity-40" : ""}`}
              >
                {/* What the scene shows first; its kind and length below. */}
                <span className="line-clamp-2 text-[11px] leading-tight font-bold">
                  <span className="opacity-60">{i + 1}. </span>
                  {labels[i]}
                </span>
                <span className="flex items-center gap-1 truncate text-[10px] font-semibold">
                  <span className="rounded-[4px] bg-white/75 px-1 py-px text-[9px] font-bold tracking-wide uppercase">{kindLabels[kind]}</span>
                  <span className="opacity-60">{round(length)} s</span>
                </span>
              </button>
            );
          })}
          {addButton}
        </div>
        {/* Texts over the montage, at their time. */}
        <div className="relative h-7 rounded-[8px] bg-soft" onClick={(e) => e.target === e.currentTarget && seekTo(e.clientX)}>
          {plan.texts.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPickText(i)}
              title={t.text}
              style={{ left: pct(t.from), width: `calc(${pct(t.to)} - ${pct(t.from)})` }}
              className={`absolute top-1 bottom-1 truncate rounded-[6px] px-1.5 text-left text-[11px] font-semibold ${
                activeText === i ? "bg-violet text-white" : "bg-white text-ink ring-1 ring-line hover:ring-lilac"
              }`}
            >
              {t.text}
            </button>
          ))}
          {plan.texts.length === 0 && <span className="absolute inset-0 flex items-center px-2 text-[11px] text-muted">Pas de texte</span>}
        </div>
        {/* The playhead. */}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 rounded bg-coral" style={{ left: pct(time) }}>
          <span className="absolute -top-1.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-coral" />
        </div>
      </div>
      <input
        type="range"
        aria-label="Position dans la vidéo"
        min={0}
        max={total}
        step={0.05}
        value={Math.min(total, time)}
        onChange={(e) => {
          player.current?.pause();
          player.current?.seekTo(Math.round(Number(e.target.value) * fps));
        }}
        className="accent-coral"
      />
    </section>
  );
}
