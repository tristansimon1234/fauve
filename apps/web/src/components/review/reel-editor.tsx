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
  type SavedLook,
  type Segment,
} from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { saveEditPlan } from "@/app/(app)/publications/[id]/actions";
import { liveMontage } from "@/app/(app)/publications/[id]/review-actions";
import { ArrowLeftIcon, ChevronRightIcon, TrashIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { ListItems } from "@/components/montage/list-items";
import { StylePicker } from "@/components/montage/style-picker";
import { TextBoxes } from "@/components/montage/text-boxes";
import { ReelPlayer } from "@/components/reel-player";
import { openingParts, type EditorParts } from "./editor-parts";
import { SceneStrip, type SceneSprite } from "./scene-strip";

// « Modifier », the editor of « Ta publication », for someone who has never edited a
// video: the Reel plays live (the same composition as the render), its scenes in a
// row below, as in Instagram's editor. On « Ta publication » it is laid out by the page
// (`layout`): the live Reel where the video was, its scenes where they were, the settings
// in the panel beside, nothing else moves (Tristan: « bizarre d'avoir une page montage
// alors qu'on est déjà sur montage », « j'aimerais qu'on reste au même endroit »); a
// story's montage still opens it full screen. Touch a text to change its words, size and
// style, drag it to place it; touch a scene to move it earlier or later, or take it
// out. Nothing else to learn: cuts, animations and the rest are asked of Edith.
// One « Enregistrer » makes a new version, rendered in the background, free.

export type EditStart = { text?: number; scene?: number };
type Live = { plan: EditPlan; inputs: ReelInputs; looks: SavedLook[] };
type Text = EditPlan["texts"][number];
type Selection = { kind: "text" | "scene"; index: number } | null;

const KIND_LABEL = { clip: "Vidéo", scene: "Écran de texte", motion: "Animation" } as const;
const round = (n: number) => Math.round(n * 10) / 10;
const clock = (seconds: number) => `0:${String(Math.floor(seconds)).padStart(2, "0")}`;

export function ReelEditor({
  postId,
  scenes,
  start,
  live: preloaded,
  onClose,
  onAsk,
  layout,
}: {
  postId: string;
  /** The strip made with the video shown, for the scenes' images. */
  scenes: SceneSprite | null;
  start: EditStart;
  /** Already loaded (a preview); otherwise loaded when it opens. */
  live?: Live;
  /** In the page (« Ta publication »), which places the pieces where its own are; otherwise a full-screen layer. */
  layout?: (parts: EditorParts) => ReactNode;
  /** Closed: with a line to show her when something was saved. */
  onClose: (saved?: string) => void;
  /** « Demander à Edith » about one scene. */
  onAsk: (scene: number, label: string) => void;
}) {
  const [live, setLive] = useState<Live | null>(preloaded ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (live) return;
    let gone = false;
    liveMontage(postId).then(
      (r) => {
        if (gone) return;
        if (r.ok) setLive({ plan: r.plan, inputs: r.inputs, looks: r.looks });
        else setError(r.error);
      },
      () => !gone && setError("Le montage n’a pas pu s’ouvrir. Réessaie dans un instant."),
    );
    return () => {
      gone = true;
    };
  }, [live, postId]);

  // A full-screen layer: the page under it does not scroll.
  const inPage = Boolean(layout);
  useEffect(() => {
    if (inPage) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [inPage]);

  if (layout) {
    if (live) return <Editor postId={postId} live={live} scenes={scenes} start={start} onClose={onClose} onAsk={onAsk} layout={layout} />;
    return layout(openingParts(onClose, error));
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier le Reel" className="fauve-enter fixed inset-0 z-[60] flex flex-col bg-white text-ink">
      {live ? (
        <Editor postId={postId} live={live} scenes={scenes} start={start} onClose={onClose} onAsk={onAsk} />
      ) : (
        <>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2">
            <button type="button" onClick={() => onClose()} className="h-10 rounded-full px-3 text-[15px] font-bold text-muted hover:bg-soft">
              Fermer
            </button>
            <h2 className="flex-1 pr-16 text-center text-[16px] font-extrabold">Modifier</h2>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <Mascot size={64} mood={error ? "sad" : "thinking"} />
            <p role={error ? "alert" : "status"} className="text-[15px] leading-snug font-semibold text-muted">
              {error ?? "J’ouvre ton montage…"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Editor({
  postId,
  live,
  scenes,
  start,
  onClose,
  onAsk,
  layout,
}: {
  postId: string;
  live: Live;
  scenes: SceneSprite | null;
  start: EditStart;
  onClose: (saved?: string) => void;
  onAsk: (scene: number, label: string) => void;
  layout?: (parts: EditorParts) => ReactNode;
}) {
  const inPage = Boolean(layout);
  // The plan being changed, and for each scene its place in the saved plan (its image in the strip).
  const [draft, setDraft] = useState(() => ({ plan: live.plan, origin: live.plan.segments.map((_, i): number | null => i) }));
  const [changed, setChanged] = useState(false);
  const [selection, setSelection] = useState<Selection>(() => firstSelection(start, live.plan));
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const playerRef = useRef<PlayerRef>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { plan, origin } = draft;
  const props = useMemo(() => buildReelProps(plan, live.inputs), [plan, live.inputs]);
  const spans = useMemo(() => timeline(plan), [plan]);
  const valid = useMemo(() => editPlanSchema.safeParse(plan).success, [plan]);
  // A Reel cut on a voice keeps its order: the voice would no longer match the pictures.
  const voiced = Boolean(plan.voice);
  const [initialFrame] = useState(() => Math.round(momentOf(firstSelection(start, live.plan), live.plan) * props.fps));

  const edit = (next: { plan: EditPlan; origin?: (number | null)[] }) => {
    setDraft((d) => ({ plan: next.plan, origin: next.origin ?? d.origin }));
    setChanged(true);
    setMessage(null);
  };
  const seek = (seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    player.seekTo(Math.max(0, Math.round(seconds * props.fps)));
  };
  const selectText = (index: number, jump = true) => {
    setSelection({ kind: "text", index });
    const t = plan.texts[index];
    if (t && jump) seek(t.from + Math.min(0.4, (t.to - t.from) / 2));
  };
  const selectScene = (index: number) => {
    setSelection({ kind: "scene", index });
    const span = spans[index];
    if (span) seek(span.start + Math.min(0.5, (span.end - span.start) / 2));
  };

  const setText = (index: number, patch: Partial<Text>) => edit({ plan: { ...plan, texts: plan.texts.map((t, i) => (i === index ? { ...t, ...patch } : t)) } });
  const removeText = (index: number) => {
    edit({ plan: { ...plan, texts: plan.texts.filter((_, i) => i !== index) } });
    setSelection(null);
  };
  const moveScene = (from: number, to: number) => {
    if (to < 0 || to >= plan.segments.length) return;
    const order = origin.slice();
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved ?? null);
    edit({ plan: moveSegment(plan, from, to), origin: order });
    setSelection({ kind: "scene", index: to });
  };
  const removeScene = (index: number) => {
    if (plan.segments.length <= 1) return;
    edit({ plan: removeSegment(plan, index), origin: origin.filter((_, i) => i !== index) });
    setSelection({ kind: "scene", index: Math.max(0, index - 1) });
  };
  const setSegment = (index: number, segment: Segment) => edit({ plan: updateSegment(plan, index, segment) });

  const save = () =>
    startSaving(async () => {
      if (!valid) return setMessage("Un texte est vide : écris quelque chose, ou retire-le.");
      const result = await saveEditPlan(postId, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (!result.ok) return setMessage(result.error);
      onClose("C’est enregistré : la vidéo se met à jour, 3 à 8 minutes.");
    });
  const cancel = () => (changed ? setLeaving(true) : onClose());

  // Escape: leave (asking first when something changed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (changed) setLeaving(true);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changed, onClose]);

  const text = selection?.kind === "text" ? plan.texts[selection.index] : undefined;
  const sceneIndex = selection?.kind === "scene" && selection.index < plan.segments.length ? selection.index : null;
  const scene = sceneIndex !== null ? plan.segments[sceneIndex] : undefined;
  // The scene shown now, for the strip when a text is chosen.
  const textScene = text ? spans.findIndex((s) => text.from >= s.start && text.from < s.end) : -1;

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2">
      <button type="button" onClick={cancel} className="h-10 rounded-full px-3 text-[15px] font-bold text-muted hover:bg-soft">
        Annuler
      </button>
      <h2 className="flex-1 text-center text-[16px] font-extrabold">Modifier</h2>
      <button type="button" onClick={save} disabled={!changed || saving} className="btn btn-primary h-10 px-4 text-[14.5px] disabled:opacity-45">
        {saving ? "Un instant…" : "Enregistrer"}
      </button>
    </header>
  );
  const leave = leaving && (
    <div
      role="alertdialog"
      aria-label="Quitter sans enregistrer"
      className={`flex shrink-0 flex-wrap items-center gap-2 bg-peach px-4 py-2.5 text-peach-ink ${inPage ? "rounded-[16px]" : ""}`}
    >
      <p className="min-w-0 flex-1 text-[14px] font-semibold">Tes changements ne seront pas gardés.</p>
      <button type="button" onClick={() => setLeaving(false)} className="h-9 rounded-full bg-white px-3.5 text-[13.5px] font-bold text-ink">
        Rester
      </button>
      <button type="button" onClick={() => onClose()} className="h-9 rounded-full px-3 text-[13.5px] font-bold underline underline-offset-2">
        Quitter
      </button>
    </div>
  );
  const preview = (
    <div
      ref={previewRef}
      className={
        inPage
          ? "relative size-full"
          : "relative w-[min(calc(40dvh*9/16),236px)] overflow-hidden rounded-[14px] shadow-[0_18px_44px_rgba(0,0,0,.45)] lg:w-[min(calc((100dvh-250px)*9/16),340px)]"
      }
    >
      <ReelPlayer props={props} playerRef={playerRef} initialFrame={initialFrame} />
      <TextBoxes
        container={previewRef}
        player={playerRef}
        texts={plan.texts}
        active={text ? (selection?.index ?? null) : null}
        // Her hand's place: the engine leaves it where she put it from now on.
        onMove={(i, place) => setText(i, { ...place, auto_y: undefined })}
        onPick={(i) => selectText(i, false)}
        onEdit={(i, words) => setText(i, { text: words })}
      />
    </div>
  );
  const strip = (
    <SceneStrip
      segments={plan.segments}
      sprite={scenes}
      origin={origin}
      photos={live.inputs.photoIds}
      selected={sceneIndex}
      playing={text && textScene >= 0 ? textScene : null}
      dark={!inPage}
      onPick={selectScene}
    />
  );
  const settings = (
    <>
      {message && (
        <p role="alert" className="mb-3 rounded-[12px] bg-peach px-3 py-2 text-[13.5px] font-semibold text-danger">
          {message}
        </p>
      )}
      {text && selection ? (
        <TextPanel
          key={selection.index}
          text={text}
          looks={live.looks}
          brand={props.brand}
          onChange={(patch) => setText(selection.index, patch)}
          onRemove={() => removeText(selection.index)}
          onScene={textScene >= 0 ? () => selectScene(textScene) : undefined}
        />
      ) : scene && sceneIndex !== null ? (
        <ScenePanel
          key={sceneIndex}
          index={sceneIndex}
          count={plan.segments.length}
          segment={scene}
          seconds={spans[sceneIndex] ? spans[sceneIndex].end - spans[sceneIndex].start : 0}
          photo={"clip_id" in scene && Boolean(live.inputs.photoIds?.includes(scene.clip_id))}
          voiced={voiced}
          texts={plan.texts.map((t, i) => ({ t, i })).filter(({ t }) => spans[sceneIndex] && t.from >= spans[sceneIndex].start && t.from < spans[sceneIndex].end)}
          endCard={sceneIndex === plan.segments.length - 1 ? plan.end_card : undefined}
          changed={changed}
          onMove={(to) => moveScene(sceneIndex, to)}
          onRemove={() => removeScene(sceneIndex)}
          onChange={(segment) => setSegment(sceneIndex, segment)}
          onEndCard={(endCard) => edit({ plan: { ...plan, end_card: endCard } })}
          onText={(i) => selectText(i)}
          onAsk={() => onAsk(sceneIndex, `Scène ${sceneIndex + 1}`)}
        />
      ) : (
        <p className="text-[14.5px] leading-relaxed text-muted">Touche un texte sur la vidéo pour le changer, ou une scène en dessous.</p>
      )}
    </>
  );

  // In the page: « Ta publication » puts each piece where its own was (the video, its scenes, the panel beside).
  if (layout) {
    const actions = (
      <div className="flex flex-col gap-2">
        {leave}
        <div className="flex items-center gap-2">
          <button type="button" onClick={cancel} className="btn btn-secondary h-11 flex-1 text-[15px]">
            {changed ? "Annuler" : "Fermer"}
          </button>
          <button type="button" onClick={save} disabled={!changed || saving} className="btn btn-primary h-11 flex-[2] text-[15px] disabled:opacity-45">
            {saving ? "Un instant…" : "Enregistrer"}
          </button>
        </div>
      </div>
    );
    return layout({ preview, strip, settings, actions });
  }

  return (
    <>
      {header}
      {leave}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* The Reel, live, and its scenes. */}
        <section aria-label="Aperçu" className="flex shrink-0 flex-col items-center gap-2.5 bg-[radial-gradient(ellipse_at_top,#2a2145_0%,#16112a_70%)] px-4 pt-3.5 pb-2.5 lg:min-w-0 lg:flex-1 lg:justify-center lg:gap-4 lg:py-6">
          {preview}
          {strip}
        </section>

        {/* What is chosen: a text, or a scene. */}
        <aside aria-label="Réglages" className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:w-[420px] lg:flex-none lg:border-l lg:border-line lg:px-5 lg:pt-5">
          {settings}
        </aside>
      </div>
    </>
  );
}

/** What opens first: the text or the scene asked for, else the first text, else the first scene. */
function firstSelection(start: EditStart, plan: EditPlan): Selection {
  if (start.scene !== undefined && plan.segments[start.scene]) return { kind: "scene", index: start.scene };
  if (start.text !== undefined && plan.texts[start.text]) return { kind: "text", index: start.text };
  return plan.texts.length ? { kind: "text", index: 0 } : { kind: "scene", index: 0 };
}

/** Where the video starts: on that text, or in that scene. */
function momentOf(selection: Selection, plan: EditPlan): number {
  if (!selection) return 0;
  if (selection.kind === "text") {
    const t = plan.texts[selection.index];
    return t ? t.from + Math.min(0.4, (t.to - t.from) / 2) : 0;
  }
  const span = timeline(plan)[selection.index];
  return span ? span.start + Math.min(0.5, (span.end - span.start) / 2) : 0;
}

function TextPanel({
  text,
  looks,
  brand,
  onChange,
  onRemove,
  onScene,
}: {
  text: Text;
  looks: SavedLook[];
  brand: ReturnType<typeof buildReelProps>["brand"];
  onChange: (patch: Partial<Text>) => void;
  onRemove: () => void;
  onScene?: () => void;
}) {
  const scale = text.scale ?? 1;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-extrabold tracking-[-0.01em]">Le texte</h3>
        {onScene && (
          <button type="button" onClick={onScene} className="inline-flex items-center gap-0.5 text-[13px] font-bold text-violet">
            Sa scène
            <ChevronRightIcon size={14} />
          </button>
        )}
      </div>
      {text.items ? (
        <ListItems items={text.items} bullet={text.bullet} onChange={(patch) => onChange({ ...patch, ...(patch.items ? { text: patch.items[0]?.title.slice(0, 120) ?? text.text } : {}) })} />
      ) : (
        <input
          value={text.text}
          maxLength={120}
          onChange={(e) => onChange({ text: e.target.value })}
          aria-label="Les mots du texte"
          className="h-12 w-full rounded-[14px] border-[1.5px] border-line bg-white px-3.5 text-[16px] font-semibold outline-none focus:border-violet"
        />
      )}
      <p className="-mt-1.5 text-[12.5px] leading-snug text-muted">Pour le placer, fais-le glisser sur la vidéo.</p>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[14px] font-bold">Taille</span>
        <button
          type="button"
          aria-label="Plus petit"
          disabled={scale <= 0.6}
          onClick={() => onChange({ scale: Math.max(0.6, round(scale - 0.1)) })}
          className="h-10 w-12 rounded-full bg-chip text-[14px] font-extrabold disabled:opacity-35"
        >
          A−
        </button>
        <button
          type="button"
          aria-label="Plus grand"
          disabled={scale >= 1.6}
          onClick={() => onChange({ scale: Math.min(1.6, round(scale + 0.1)) })}
          className="h-10 w-12 rounded-full bg-chip text-[17px] font-extrabold disabled:opacity-35"
        >
          A+
        </button>
      </div>
      <StylePicker role={text.style} look={text.look} saved={looks} brand={brand} sample={text.text} onChange={(look) => onChange({ look })} />
      <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 self-start py-1 text-[13.5px] font-bold text-danger">
        <TrashIcon size={15} />
        Retirer ce texte
      </button>
    </div>
  );
}

function ScenePanel({
  index,
  count,
  segment,
  seconds,
  photo,
  voiced,
  texts,
  endCard,
  changed,
  onMove,
  onRemove,
  onChange,
  onEndCard,
  onText,
  onAsk,
}: {
  index: number;
  count: number;
  segment: Segment;
  seconds: number;
  photo: boolean;
  voiced: boolean;
  texts: { t: Text; i: number }[];
  endCard: EditPlan["end_card"];
  changed: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
  onChange: (segment: Segment) => void;
  onEndCard: (endCard: EditPlan["end_card"]) => void;
  onText: (index: number) => void;
  onAsk: () => void;
}) {
  const kind = segmentKind(segment);
  const button = "flex h-11 items-center justify-center gap-1 rounded-full border-[1.5px] border-line bg-white px-2 text-[13.5px] font-bold disabled:opacity-35";
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-extrabold tracking-[-0.01em]">Scène {index + 1}</h3>
        <span className="text-[13px] text-muted">
          {kind === "clip" && photo ? "Photo" : KIND_LABEL[kind]} · {round(seconds).toString().replace(".", ",")} s
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={voiced || index === 0} onClick={() => onMove(index - 1)} className={button}>
          <ArrowLeftIcon size={15} />
          Plus tôt
        </button>
        <button type="button" disabled={voiced || index === count - 1} onClick={() => onMove(index + 1)} className={button}>
          Plus tard
          <ArrowLeftIcon size={15} className="rotate-180" />
        </button>
        <button type="button" disabled={voiced || count <= 1} onClick={onRemove} className={`${button} text-danger`}>
          <TrashIcon size={15} />
          Retirer
        </button>
      </div>
      {voiced && <p className="-mt-1.5 text-[12.5px] leading-snug text-muted">Ce Reel suit une voix : pour changer l’ordre des scènes, demande à Edith.</p>}

      <SceneWords segment={segment} onChange={onChange} />

      {endCard && (
        <div className="flex flex-col gap-2 rounded-[16px] bg-soft p-3">
          <span className="text-[13px] font-bold">L’écran de fin</span>
          <Field label="Titre" value={endCard.title} max={40} onChange={(title) => onEndCard({ ...endCard, title })} />
          <Field label="L’invitation" value={endCard.subtitle ?? ""} max={60} onChange={(subtitle) => onEndCard({ ...endCard, subtitle: subtitle || undefined })} />
        </div>
      )}

      {texts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-muted">{texts.length > 1 ? "Ses textes" : "Son texte"}</span>
          {texts.map(({ t, i }) => (
            <button
              key={i}
              type="button"
              onClick={() => onText(i)}
              className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-line bg-white px-3 py-2.5 text-left hover:border-lilac"
            >
              <span className="w-9 shrink-0 text-[12px] font-bold text-muted tabular-nums">{clock(t.from)}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{t.text}</span>
              <ChevronRightIcon size={15} className="shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAsk}
        disabled={changed}
        className="h-11 rounded-full bg-violet-tint px-4 text-[14px] font-bold text-violet hover:bg-violet hover:text-white disabled:opacity-50 disabled:hover:bg-violet-tint disabled:hover:text-violet"
      >
        Demander à Edith pour cette scène
      </button>
      {changed && <p className="-mt-2 text-center text-[12px] text-muted">Enregistre d’abord tes changements.</p>}
    </div>
  );
}

/** The words of a scene that has its own (an animation, a text screen); the rest is Edith's. */
function SceneWords({ segment, onChange }: { segment: Segment; onChange: (segment: Segment) => void }) {
  if ("scene" in segment) {
    const s = segment.scene;
    const set = (patch: Partial<typeof s>) => onChange({ ...segment, scene: { ...s, ...patch } });
    return (
      <div className="flex flex-col gap-2">
        <Field label={s.kind === "quote" ? "La citation" : s.kind === "number" ? "Le chiffre ou l’offre" : "Le titre"} value={s.title} max={60} onChange={(title) => set({ title })} />
        {(s.kicker || s.kind === "quote") && (
          <Field label={s.kind === "quote" ? "L’auteur" : "Le petit texte au-dessus"} value={s.kicker ?? ""} max={40} onChange={(kicker) => set({ kicker: kicker || undefined })} />
        )}
      </div>
    );
  }
  if (!("motion" in segment)) return null;
  const texts = segment.motion.texts ?? {};
  const slots = Object.entries(texts);
  if (!slots.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {slots.map(([slot, value], n) => (
        <Field
          key={slot}
          label={slots.length > 1 ? `Texte ${n + 1} de l’animation` : "Le texte de l’animation"}
          value={value}
          max={200}
          onChange={(words) => onChange({ ...segment, motion: { ...segment.motion, texts: { ...texts, [slot]: words } } })}
        />
      ))}
    </div>
  );
}

function Field({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[12px] border-[1.5px] border-line bg-white px-3 text-[15px] font-semibold outline-none focus:border-violet"
      />
    </label>
  );
}
