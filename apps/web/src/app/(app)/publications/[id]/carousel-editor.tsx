"use client";

import {
  AMBIANCES,
  buildSlideProps,
  MAX_ELEMENTS,
  placeElement,
  SLIDE_Y,
  type ReelInputs,
  type SavedLook,
  type SlidesPlan,
  type SlideText,
} from "@fauve/agent";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ImageIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ElementHandles } from "@/components/montage/element-handles";
import { ElementsPanel, type BankElementView } from "@/components/montage/elements-panel";
import { LayerFields } from "@/components/montage/layer-fields";
import { LayerHandles } from "@/components/montage/layer-handles";
import { PhotoAsk } from "@/components/montage/photo-ask";
import { PhotoImprove } from "@/components/montage/photo-improve";
import { LayoutPicker, layoutOn, type Layout } from "@/components/montage/layout-picker";
import { ListItems } from "@/components/montage/list-items";
import { StylePicker } from "@/components/montage/style-picker";
import { photoRetouch } from "@/components/montage/retouch-actions";
import { RetouchSwitches } from "@/components/montage/retouch-switches";
import { SlidePreview } from "@/components/montage/slide-preview";
import { TextBoxes } from "@/components/montage/text-boxes";
import { saveSlidesPlan } from "./actions";

// The carousel (or photo post) editor of the publication page, laid out like the
// montage editor: the photo as it will be published on a dark stage with its
// texts grabbable, the strip of photos under it, and on the right the selected
// photo: its texts with quick colours, size and place, retouch, logo, and what
// applies to the whole carousel.

/** On photos only the texts change: each ambiance named by its texts. */
const templates = (["doux", "dynamique", "chic"] as const).map((value) => ({ value, label: AMBIANCES[value].photo }));
const logoPlaces = [
  { value: null, label: "Aucun" },
  { value: "top", label: "En haut" },
  { value: "bottom", label: "En bas" },
] as const;

/** A layout's colour: the studio's first, then a few that go with most photos. */
const LAYER_ACCENTS = [null, "#1C1530", "#7A1F2B", "#F2694E", "#C9A227", "#E58FA8", "#7FA88B", "#5B7FD9"] as const;

const round = (n: number) => Math.round(n * 10) / 10;

export function CarouselEditor({
  postId,
  postTitle,
  initialPlan,
  photos,
  brand,
  looks,
  layouts = [],
  bank = [],
}: {
  postId: string;
  postTitle: string;
  initialPlan: SlidesPlan;
  /** Signed URL of each photo, by media id (videos have none and keep no text). */
  photos: Record<string, string>;
  brand: ReelInputs["brand"];
  looks: SavedLook[];
  /** Text layouts of the library (Fauve's and the studio's), with their code. */
  layouts?: Layout[];
  /** The studio's components (its design system), with their code to draw them live. */
  bank?: BankElementView[];
}) {
  const [saved, setSaved] = useState(initialPlan);
  const [plan, setPlan] = useState(initialPlan);
  const [index, setIndex] = useState(() => Math.max(0, initialPlan.slides.findIndex((s) => photos[s.media_id])));
  const [active, setActive] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const previewRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);

  const slide = plan.slides[Math.min(index, plan.slides.length - 1)]!;
  const url = photos[slide.media_id];
  const props = useMemo(() => (url ? buildSlideProps(slide, { template: plan.template, imageUrl: url, brand }) : null), [slide, plan.template, url, brand]);
  const brandLook = props?.brand ?? { accent: brand.accent ?? "#5B3FD9", accentInk: "#FFFFFF", displayFont: "Playfair Display", bodyFont: "Plus Jakarta Sans" };

  const edit = (next: SlidesPlan) => {
    setPlan(next);
    setMessage(null);
  };
  const setSlide = (patch: Partial<(typeof plan.slides)[number]>) => edit({ ...plan, slides: plan.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const setText = (t: number, patch: Partial<SlideText>) => setSlide({ texts: slide.texts.map((x, j) => (j === t ? { ...x, ...patch } : x)) });
  const go = (i: number) => {
    if (i < 0 || i >= plan.slides.length) return;
    setIndex(i);
    setActive(null);
    setPicked(null);
  };
  const elements = slide.elements ?? [];
  // Components replace a designed layout on the photo (one look per photo).
  const setElements = (next: typeof elements) => setSlide({ elements: next.length ? next : undefined, ...(next.length ? { layer: undefined } : {}) });

  // ← → move between photos (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addText = () => {
    const text: SlideText = slide.texts.length === 0 && index === 0 ? { text: "Ton accroche", style: "hook" } : { text: "Ton texte", style: "band" };
    setSlide({ texts: [...slide.texts, text] });
    setActive(slide.texts.length);
    requestAnimationFrame(() => document.getElementById(`fauve-slide-text-${slide.texts.length}`)?.focus());
  };

  /** The selected text's look, size and background, on every text of the same kind in the carousel. */
  const applyToAll = (t: SlideText) =>
    edit({
      ...plan,
      slides: plan.slides.map((s) => ({
        ...s,
        texts: s.texts.map((x) => (x.style === t.style ? { ...x, look: t.look, scale: t.scale, backdrop: t.backdrop } : x)),
      })),
    });

  const save = () =>
    start(async () => {
      const res = await saveSlidesPlan(postId, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (res.ok) {
        setSaved(plan);
        setMessage({ ok: true, text: "Enregistré · les images finales suivent dans une minute" });
      } else setMessage({ ok: false, text: res.error });
    });

  const chip = (on: boolean) => `h-8 rounded-full px-3 text-[12px] font-semibold ${on ? "bg-violet text-white" : "bg-white text-muted hover:text-ink"}`;
  const swatch = (on: boolean) => `size-7 shrink-0 rounded-full border transition-transform hover:scale-110 motion-reduce:hover:scale-100 ${on ? "ring-2 ring-violet ring-offset-2" : "border-line"}`;

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4">
        {/* The photo as it will be published, on a dark stage; arrows and ← → to move along the carousel. */}
        <div className="relative flex items-center justify-center rounded-[24px] bg-[radial-gradient(ellipse_at_top,#2a2145_0%,#16112a_70%)] px-12 py-5">
          <button
            type="button"
            aria-label="Photo précédente"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className="absolute left-3 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25"
          >
            <ArrowUpIcon size={18} className="-rotate-90" />
          </button>
          <div
            ref={previewRef}
            className="relative overflow-hidden rounded-[16px] bg-black shadow-[0_24px_60px_rgba(0,0,0,.45)]"
            style={{ width: "max(220px, min(100%, 420px, calc((100dvh - 330px) * 4 / 5)))" }}
          >
            {props ? (
              <>
                <SlidePreview key={`${index}`} props={props} className="fauve-fade" />
                {slide.layer && <LayerHandles key={`${index}-${slide.layer.template_id ?? slide.layer.name}`} container={previewRef} layer={slide.layer} onChange={(layer) => setSlide({ layer })} />}
                {!slide.layer && (
                  <TextBoxes
                    container={previewRef}
                    texts={slide.texts}
                    active={active}
                    yRange={[SLIDE_Y.min, SLIDE_Y.max]}
                    onMove={(t, place) => setText(t, place)}
                    onEdit={(t, text) => setText(t, { text })}
                    onPick={(t) => {
                      setActive(t);
                      requestAnimationFrame(() => document.getElementById(`fauve-slide-text-${t}`)?.focus());
                    }}
                  />
                )}
                {elements.length > 0 && (
                  <ElementHandles
                    key={`elements-${index}`}
                    container={previewRef}
                    elements={elements}
                    selected={picked}
                    onSelect={setPicked}
                    onChange={(i, p) => setElements(elements.map((e, j) => (j === i ? { ...e, ...p } : e)))}
                    onRemove={(i) => {
                      setElements(elements.filter((_, j) => j !== i));
                      setPicked(null);
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center p-6 text-center text-sm text-white/60">
                Une vidéo du carrousel : elle reste telle quelle, sans texte par-dessus.
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Photo suivante"
            disabled={index === plan.slides.length - 1}
            onClick={() => go(index + 1)}
            className="absolute right-3 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25"
          >
            <ArrowDownIcon size={18} className="-rotate-90" />
          </button>
        </div>

        {/* The strip of photos, as published (with their texts): the carousel's timeline. */}
        <section aria-label="Photos du carrousel" className="flex flex-col gap-2 rounded-[18px] border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-bold">
              {plan.slides.length} photo{plan.slides.length > 1 ? "s" : ""}
            </span>
            {dirty ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-peach-ink">Modifié · pas encore enregistré</span>
                <button type="button" onClick={() => edit(saved)} disabled={saving} className="h-8 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-soft disabled:opacity-40">
                  Annuler
                </button>
                <button type="button" onClick={save} disabled={saving} className="btn btn-primary h-8 px-3.5 text-[13px] disabled:opacity-50">
                  <CheckIcon size={15} />
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px] text-muted">
                <ImageIcon size={14} />
                {message?.ok ? message.text : "Aperçu en direct · modifications gratuites"}
              </span>
            )}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="tablist" aria-label="Photos">
            {plan.slides.map((s, i) => {
              const photo = photos[s.media_id];
              const thumb = photo ? buildSlideProps(s, { template: plan.template, imageUrl: photo, brand }) : null;
              return (
                <button
                  key={s.media_id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => go(i)}
                  className={`relative w-[92px] shrink-0 overflow-hidden rounded-[12px] bg-ink transition-shadow ${i === index ? "ring-2 ring-violet ring-offset-2" : "opacity-85 hover:opacity-100"}`}
                >
                  {thumb ? (
                    <SlidePreview props={thumb} />
                  ) : (
                    <span className="flex aspect-[4/5] items-center justify-center text-[11px] font-bold text-white/70">Vidéo</span>
                  )}
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
                </button>
              );
            })}
          </div>
        </section>

        {message && !message.ok && (
          <p role="alert" className="rounded-xl bg-peach px-3 py-2 text-[13px] font-semibold text-danger">
            {message.text}
          </p>
        )}
      </div>

      <aside aria-label="Photo sélectionnée" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[16px] font-bold">
              Photo {index + 1} <span className="font-semibold text-muted">sur {plan.slides.length}</span>
            </h2>
          </div>
          {props && !dirty && <PhotoAsk key={index} postId={postId} postTitle={postTitle} photo={index + 1} total={plan.slides.length} />}

          {props && (
            <ElementsPanel
              bank={bank}
              placed={elements}
              selected={picked}
              brand={props.brand}
              onSelect={setPicked}
              onChange={setElements}
              onKitAll={
                plan.slides.filter((s) => photos[s.media_id]).length > 1
                  ? (kit) =>
                      edit({
                        ...plan,
                        slides: plan.slides.map((s) => (photos[s.media_id] ? { ...s, layer: undefined, elements: [...(s.elements ?? []), ...kit.map((e) => placeElement(e))].slice(-MAX_ELEMENTS) } : s)),
                      })
                  : undefined
              }
            />
          )}

          {props && url && layouts.length > 0 && (
            <LayoutPicker
              layouts={layouts}
              slide={slide}
              template={plan.template}
              imageUrl={url}
              brand={brand}
              many={plan.slides.filter((s) => photos[s.media_id]).length > 1}
              onPick={(layout) => setSlide({ layer: layoutOn(layout, slide) })}
              onClear={() => setSlide({ layer: undefined })}
              onPickAll={(layout) =>
                edit({ ...plan, slides: plan.slides.map((s) => (photos[s.media_id] ? { ...s, layer: s.layer?.template_id === layout.id ? s.layer : layoutOn(layout, s) } : s)) })
              }
            />
          )}

          {props && slide.layer ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-[12px] bg-violet-tint px-3 py-2 text-[12px] leading-snug text-violet">
                Clique sur un texte de la photo pour l’écrire, glisse la mise en page pour la déplacer, tire le rond du coin pour l’agrandir.
              </p>
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold text-muted">Couleur</span>
                <div className="flex flex-wrap items-center gap-2">
                  {LAYER_ACCENTS.map((c) => {
                    const on = (slide.layer!.accent ?? null) === c;
                    return (
                      <button
                        key={c ?? "studio"}
                        type="button"
                        aria-label={c ? `Couleur ${c}` : "Couleur du studio"}
                        aria-pressed={on}
                        onClick={() => setSlide({ layer: { ...slide.layer!, accent: c ?? undefined } })}
                        className={swatch(on)}
                        style={{ background: c ?? brandLook.accent }}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-muted">Taille</span>
                {[
                  { label: "A−", d: -0.1 },
                  { label: "A+", d: 0.1 },
                ].map(({ label, d }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const p = slide.layer!.place ?? { x: 0, y: 0, scale: 1 };
                      const scale = Math.round(Math.min(1.5, Math.max(0.5, p.scale + d)) * 100) / 100;
                      setSlide({ layer: { ...slide.layer!, place: { ...p, scale } } });
                    }}
                    className="h-8 rounded-full bg-soft px-3 text-[13px] font-bold hover:bg-violet-soft hover:text-violet"
                  >
                    {label}
                  </button>
                ))}
                {slide.layer.place && (
                  <button type="button" onClick={() => setSlide({ layer: { ...slide.layer!, place: undefined } })} className="text-[13px] font-semibold text-violet hover:underline">
                    Remettre en place
                  </button>
                )}
              </div>
              <LayerFields layer={slide.layer} onChange={(texts) => setSlide({ layer: { ...slide.layer!, texts } })} onRemove={() => setSlide({ layer: undefined })} />
            </div>
          ) : (
            props && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold">Textes sur cette photo</h3>
                  {slide.texts.length < 6 && (
                    <button type="button" onClick={addText} className="inline-flex items-center gap-1 text-[13px] font-bold text-violet">
                      <PlusIcon size={15} />
                      Ajouter un texte
                    </button>
                  )}
                </div>
                {slide.texts.length === 0 ? (
                  <p className="text-[13px] text-muted">Pas de texte : la photo parle d’elle-même.</p>
                ) : (
                  <p className="-mt-1 text-[12px] text-muted">Pour le placer, fais glisser le texte sur la photo. Clique dessus pour changer les mots.</p>
                )}
                {slide.texts.map((t, i) => {
                  return (
                    <div
                      key={i}
                      onFocusCapture={() => setActive(i)}
                      onPointerDownCapture={() => setActive(i)}
                      className={`flex flex-col gap-2.5 rounded-[14px] p-3 transition-colors ${active === i ? "bg-violet-tint ring-1 ring-lilac" : "bg-soft"}`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          id={`fauve-slide-text-${i}`}
                          value={t.text}
                          maxLength={120}
                          hidden={Boolean(t.items)}
                          onChange={(e) => setText(i, { text: e.target.value })}
                          aria-label="Texte"
                          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 text-[14px] outline-none focus:border-lilac"
                        />
                        {t.items && <span className="min-w-0 flex-1 text-[13px] font-bold">Liste · {t.items.length} éléments</span>}
                        <button type="button" aria-label="Supprimer ce texte" onClick={() => setSlide({ texts: slide.texts.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">
                          <TrashIcon size={16} />
                        </button>
                      </div>
                      {t.items && (
                        <ListItems
                          items={t.items}
                          bullet={t.bullet}
                          onChange={(patch) => setText(i, { ...patch, ...(patch.items ? { text: patch.items[0]?.title.slice(0, 120) ?? t.text } : {}) })}
                        />
                      )}
                      <StylePicker role={t.style} look={t.look} saved={looks} brand={brandLook} sample={t.text} onChange={(next) => setText(i, { look: next })} />
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
                      </div>
                      {plan.slides.length > 1 && (
                        <button type="button" onClick={() => applyToAll(t)} className="self-start text-[12px] font-bold text-violet hover:underline">
                          Même style sur toutes les photos
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {url && (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <h3 className="text-[14px] font-bold">La photo</h3>
              <RetouchSwitches
                key={slide.media_id}
                light={Boolean(slide.edit?.adjust)}
                faces={Boolean(slide.edit?.blur?.some((b) => b.kind === "face"))}
                onChange={async (next) => {
                  const res = await photoRetouch(slide.media_id, next).catch(() => ({ ok: false as const, error: "Simone n’a pas pu regarder cette photo." }));
                  if (!res.ok) return { ok: false, message: res.error };
                  setSlide({ edit: res.value ?? undefined });
                  return { ok: true, message: res.note };
                }}
              />
              <PhotoImprove key={`improve-${slide.media_id}`} postId={postId} mediaId={slide.media_id} url={url} disabled={dirty} />
              {brand.logoUrl && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[12px] font-semibold text-muted">Logo</span>
                  {logoPlaces.map((p) => (
                    <button key={p.label} type="button" onClick={() => setSlide({ logo: p.value ?? undefined })} className={chip((slide.logo ?? null) === p.value)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-label="Tout le carrousel" className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
          <h2 className="text-[16px] font-bold">Tout le carrousel</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] font-semibold text-muted">Textes</span>
            {templates.map((t) => (
              <button key={t.value} type="button" aria-pressed={plan.template === t.value} onClick={() => edit({ ...plan, template: t.value })} className={chip(plan.template === t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] leading-snug text-muted">Les textes en style « Simple » suivent ce choix, dans les polices et les couleurs de ta charte.</p>
        </section>
      </aside>
    </>
  );
}
