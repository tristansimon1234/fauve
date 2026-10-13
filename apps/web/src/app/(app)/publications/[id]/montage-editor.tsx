"use client";

import {
  buildReelProps,
  editPlanSchema,
  moveSegment,
  removeSegment,
  segmentKind,
  timeline,
  updateSegment,
  type EditPlan,
  type ReelInputs,
  type Segment,
} from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, FilmIcon, PenIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { DEFAULT_Y, places, TextBoxes, Y_MAX, Y_MIN } from "@/components/montage/text-boxes";
import { ReelPlayer } from "@/components/reel-player";
import { saveEditPlan } from "./actions";

// The scene editor: the montage plays live (same composition as the render),
// each scene can be edited by hand, and saving makes a new version that is
// rendered in the background. Free: no AI involved.

type Text = EditPlan["texts"][number];

const kindLabels = { clip: "Vidéo", scene: "Écran", motion: "Animation" } as const;
const styleLabels: Record<Text["style"], string> = { hook: "Accroche", band: "Bandeau", caption: "Sous-titre" };
const backgrounds = [
  { value: "accent", label: "Couleur" },
  { value: "ink", label: "Sombre" },
  { value: "cream", label: "Clair" },
] as const;

const round = (n: number) => Math.round(n * 10) / 10;

function sceneLabel(segment: Segment, clipLabels: Record<string, string>): string {
  if ("clip_id" in segment) return clipLabels[segment.clip_id] ?? "Passage de ta vidéo";
  if ("scene" in segment) return segment.scene.title;
  const first = Object.values(segment.motion.texts ?? {})[0];
  return first ?? segment.motion.brief.split(/[.!?]/)[0] ?? "Animation";
}

export function MontageEditor({
  postId,
  initialPlan,
  inputs,
  clipDurations,
  clipLabels,
}: {
  postId: string;
  initialPlan: EditPlan;
  inputs: ReelInputs;
  clipDurations: Record<string, number | null>;
  clipLabels: Record<string, string>;
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

  const save = () =>
    startSaving(async () => {
      const res = await saveEditPlan(postId, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (res.ok) {
        setSaved(plan);
        setMessage({ ok: true, text: "Enregistré. La vidéo finale se met à jour (environ une minute)." });
      } else setMessage({ ok: false, text: res.error });
    });

  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="flex w-full max-w-[320px] flex-col gap-3 md:sticky md:top-6">
        <div ref={previewRef} className="relative overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(28,21,48,.18)]">
          <ReelPlayer props={props} playerRef={playerRef} />
          <TextBoxes
            container={previewRef}
            player={playerRef}
            texts={plan.texts}
            active={activeText}
            onMove={(i, place) => setText(i, place)}
            onPick={(i) => {
              setActiveText(i);
              document.getElementById(`fauve-text-${i}`)?.focus();
            }}
          />
        </div>
        <p className="text-center text-[13px] text-muted">L’aperçu change en direct. Rien n’est rendu tant que tu n’enregistres pas.</p>
      </div>

      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
        <section aria-label="Scènes" className="flex flex-col gap-2">
          <h2 className="text-[17px] font-bold">Scènes</h2>
          <ol className="flex flex-col gap-1.5">
            {plan.segments.map((s, i) => {
              const kind = segmentKind(s);
              return (
                <li key={i}>
                  <div
                    className={`flex items-center gap-2 rounded-[14px] border px-3 py-2 ${
                      i === index ? "border-violet bg-violet-soft" : "border-line bg-white hover:border-lilac"
                    }`}
                  >
                    <button type="button" onClick={() => select(i)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="w-5 shrink-0 text-center text-[12px] font-bold text-muted">{i + 1}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          kind === "motion" ? "bg-violet text-white" : kind === "scene" ? "bg-chip text-muted" : "bg-peach text-peach-ink"
                        }`}
                      >
                        {kindLabels[kind]}
                      </span>
                      <span className="truncate text-[14px]">{sceneLabel(s, clipLabels)}</span>
                      <span className="ml-auto shrink-0 text-[12px] text-muted">{round(spans[i]!.end - spans[i]!.start)} s</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Monter"
                      disabled={i === 0}
                      onClick={() => {
                        edit(moveSegment(plan, i, i - 1));
                        setSelected(i - 1);
                      }}
                      className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-white disabled:opacity-30"
                    >
                      <ArrowUpIcon size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Descendre"
                      disabled={i === plan.segments.length - 1}
                      onClick={() => {
                        edit(moveSegment(plan, i, i + 1));
                        setSelected(i + 1);
                      }}
                      className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-white disabled:opacity-30"
                    >
                      <ArrowDownIcon size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Supprimer la scène"
                      disabled={plan.segments.length <= 1}
                      onClick={() => {
                        edit(removeSegment(plan, i));
                        setSelected(Math.max(0, i - 1));
                      }}
                      className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-white hover:text-danger disabled:opacity-30"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-label="Scène sélectionnée" className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <PenIcon size={18} className="text-violet" />
            <h2 className="text-[16px] font-bold">
              Scène {index + 1} · {kindLabels[segmentKind(segment)]}
            </h2>
          </div>
          <SegmentFields segment={segment} onChange={setSegment} clipDuration={"clip_id" in segment ? clipDurations[segment.clip_id] : null} />

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold">Textes sur cette scène</h3>
              <button type="button" onClick={addText} className="inline-flex items-center gap-1 text-[13px] font-bold text-violet">
                <PlusIcon size={15} />
                Ajouter un texte
              </button>
            </div>
            {sceneTexts.length === 0 && <p className="text-[13px] text-muted">Aucun texte par-dessus cette scène.</p>}
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
                  className="h-10 rounded-[10px] border border-line bg-white px-3 text-[14px] outline-none focus:border-lilac"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(styleLabels) as Text["style"][]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setText(i, { style })}
                      className={`h-8 rounded-full px-3 text-[12px] font-semibold ${t.style === style ? "bg-violet text-white" : "bg-white text-muted"}`}
                    >
                      {styleLabels[style]}
                    </button>
                  ))}
                  <button type="button" aria-label="Supprimer ce texte" onClick={() => removeText(i)} className="ml-auto text-muted hover:text-danger">
                    <TrashIcon size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-muted">Place</span>
                  {places.map((place) => (
                    <button
                      key={place.label}
                      type="button"
                      onClick={() => setText(i, { y: place.y })}
                      className={`h-8 rounded-full px-3 text-[12px] font-semibold ${
                        Math.abs((t.y ?? DEFAULT_Y[t.style]) - place.y) < 0.04 ? "bg-violet text-white" : "bg-white text-muted"
                      }`}
                    >
                      {place.label}
                    </button>
                  ))}
                  <span className="ml-2 text-[12px] font-semibold text-muted">Taille</span>
                  <button
                    type="button"
                    aria-label="Plus petit"
                    onClick={() => setText(i, { scale: Math.max(0.6, round((t.scale ?? 1) - 0.1)) })}
                    className="h-8 w-9 rounded-full bg-white text-[12px] font-bold text-muted"
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    aria-label="Plus grand"
                    onClick={() => setText(i, { scale: Math.min(1.6, round((t.scale ?? 1) + 0.1)) })}
                    className="h-8 w-9 rounded-full bg-white text-[14px] font-bold text-muted"
                  >
                    A+
                  </button>
                  <label className="ml-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                    <input type="checkbox" checked={t.backdrop ?? false} onChange={(e) => setText(i, { backdrop: e.target.checked || undefined })} />
                    Fond derrière
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[12px] text-muted">
                  <span>Hauteur (ou attrape le texte sur l’aperçu)</span>
                  <input
                    type="range"
                    min={Y_MIN}
                    max={Y_MAX}
                    step={0.01}
                    value={t.y ?? DEFAULT_Y[t.style]}
                    onChange={(e) => setText(i, { y: Number(e.target.value) })}
                    className="accent-violet"
                  />
                </label>
                <Range
                  label="Apparaît"
                  min={span.start}
                  max={span.end}
                  from={t.from}
                  to={t.to}
                  onChange={(from, to) => {
                    setText(i, { from, to });
                    seek(from + 0.05);
                  }}
                  offset={span.start}
                />
              </div>
            ))}
          </div>

          {segmentKind(segment) === "motion" && (
            <p className="rounded-[14px] bg-violet-soft p-3 text-[13px] leading-snug text-violet">
              Pour changer l’animation elle-même (mouvement, couleurs), demande-le à Fauve : elle la refait sur devis.
            </p>
          )}
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

        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-[20px] border border-line bg-white/95 p-3 shadow-[0_8px_30px_rgba(28,21,48,0.1)] backdrop-blur">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !valid || saving}
            className="btn btn-primary h-11 disabled:opacity-50"
          >
            <CheckIcon size={18} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => edit(saved)}
            disabled={!dirty || saving}
            className="h-11 rounded-full px-4 text-[14px] font-semibold text-muted hover:bg-soft disabled:opacity-40"
          >
            Annuler mes modifications
          </button>
          {!valid && <span className="text-[13px] font-semibold text-danger">Un texte est vide ou une durée est hors limites.</span>}
          {message && (
            <span role="status" className={`text-[13px] font-semibold ${message.ok ? "text-success" : "text-danger"}`}>
              {message.text}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <FilmIcon size={14} />
            Modifications gratuites
          </span>
        </div>
      </div>
    </div>
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

/** Two sliders: start and end, in seconds from `offset` (the scene's start). */
function Range({
  label,
  min,
  max,
  from,
  to,
  offset = 0,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  from: number;
  to: number;
  offset?: number;
  onChange: (from: number, to: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-[12px] text-muted">
      <span>
        {label} de {round(from - offset)} s à {round(to - offset)} s
      </span>
      <div className="flex gap-3">
        <input
          type="range"
          aria-label="Début"
          min={min}
          max={max}
          step={0.1}
          value={from}
          onChange={(e) => onChange(Math.min(Number(e.target.value), to - 0.3), to)}
          className="flex-1 accent-violet"
        />
        <input
          type="range"
          aria-label="Fin"
          min={min}
          max={max}
          step={0.1}
          value={to}
          onChange={(e) => onChange(from, Math.max(Number(e.target.value), from + 0.3))}
          className="flex-1 accent-violet"
        />
      </div>
    </div>
  );
}

/** The fields of one scene, by kind. */
function SegmentFields({ segment, onChange, clipDuration }: { segment: Segment; onChange: (s: Segment) => void; clipDuration: number | null | undefined }) {
  if ("clip_id" in segment) {
    const length = clipDuration ?? Math.max(segment.out, 15);
    return (
      <div className="flex flex-col gap-3">
        <Range
          label="Passage de la vidéo"
          min={0}
          max={round(length)}
          from={segment.in}
          to={segment.out}
          onChange={(from, to) => onChange({ ...segment, in: round(from), out: round(to) })}
        />
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={segment.zoom === "light"} onChange={(e) => onChange({ ...segment, zoom: e.target.checked ? "light" : "none" })} />
          Léger zoom
        </label>
      </div>
    );
  }
  if ("scene" in segment) {
    const scene = segment.scene;
    const set = (patch: Partial<typeof scene>) => onChange({ ...segment, scene: { ...scene, ...patch } });
    return (
      <div className="flex flex-col gap-3">
        <Field label={scene.kind === "quote" ? "Citation" : scene.kind === "number" ? "Chiffre ou offre" : "Titre"} value={scene.title} max={60} onChange={(title) => set({ title })} />
        <Field label={scene.kind === "quote" ? "Auteur" : "Petit texte au-dessus"} value={scene.kicker ?? ""} max={40} onChange={(kicker) => set({ kicker: kicker || undefined })} />
        {scene.kind === "list" && (
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-muted">Lignes de la liste (une par ligne, 5 au plus)</span>
            <textarea
              value={(scene.items ?? []).join("\n")}
              rows={4}
              onChange={(e) => set({ items: e.target.value.split("\n").slice(0, 5).map((l) => l.slice(0, 40)) })}
              className="rounded-[10px] border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-lilac"
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-muted">Fond</span>
          {backgrounds.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => set({ background: b.value })}
              className={`h-8 rounded-full px-3 text-[12px] font-semibold ${scene.background === b.value ? "bg-violet text-white" : "bg-soft text-muted"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <Duration value={segment.duration} max={6} onChange={(duration) => onChange({ ...segment, duration })} />
      </div>
    );
  }
  const texts = segment.motion.texts ?? {};
  return (
    <div className="flex flex-col gap-3">
      {Object.keys(texts).length === 0 && <p className="text-[13px] text-muted">Cette animation n’a pas de texte modifiable.</p>}
      {Object.entries(texts).map(([slot, value]) => (
        <Field
          key={slot}
          label={`Texte « ${slot.replace(/_/g, " ")} »`}
          value={value}
          max={200}
          onChange={(text) => onChange({ ...segment, motion: { ...segment.motion, texts: { ...texts, [slot]: text } } })}
        />
      ))}
      <Duration value={segment.duration} max={8} onChange={(duration) => onChange({ ...segment, duration })} />
    </div>
  );
}

function Duration({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-muted">
      <span>Durée : {round(value)} s</span>
      <input type="range" min={1} max={max} step={0.1} value={value} onChange={(e) => onChange(round(Number(e.target.value)))} className="accent-violet" />
    </label>
  );
}
