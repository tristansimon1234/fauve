"use client";

import { buildSlideProps, SLIDE_Y, type ReelInputs, type SavedLook, type SlidesPlan, type SlideText } from "@fauve/agent";
import { useMemo, useRef, useState } from "react";
import { PenIcon, PlusIcon } from "@/components/icons";
import { SlidePreview } from "./slide-preview";
import { TextBoxes } from "./text-boxes";
import { TextSheet } from "./text-sheet";

// Text over the photos of a carousel or photo post, by hand: the slide as it
// will be published, its texts grabbable on it, a strip to move between photos.
// Controlled: the page keeps the plan and saves it.

const templates = [
  { value: "doux", label: "Doux" },
  { value: "dynamique", label: "Dynamique" },
  { value: "chic", label: "Chic" },
] as const;

export function SlidesEditor({
  plan,
  onChange,
  photos,
  brand,
  dark = false,
  previewWidth = "100%",
  looks,
}: {
  plan: SlidesPlan;
  onChange: (plan: SlidesPlan) => void;
  /** Signed URL of each photo, by media id (videos have none and keep no text). */
  photos: Record<string, string>;
  brand: ReelInputs["brand"];
  /** The mobile page is dark; the app is light. */
  dark?: boolean;
  previewWidth?: string;
  /** The studio's saved text looks: with them, each text can take any look. */
  looks?: SavedLook[];
}) {
  const first = Math.max(0, plan.slides.findIndex((s) => photos[s.media_id]));
  const [index, setIndex] = useState(first);
  const [active, setActive] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const slide = plan.slides[Math.min(index, plan.slides.length - 1)]!;
  const url = photos[slide.media_id];
  const props = useMemo(
    () => (url ? buildSlideProps(slide, { template: plan.template, imageUrl: url, brand }) : null),
    [slide, plan.template, url, brand],
  );

  const setTexts = (texts: SlideText[]) =>
    onChange({ ...plan, slides: plan.slides.map((s, i) => (i === index ? { ...s, texts } : s)) });
  const patchText = (t: number, patch: Partial<SlideText>) => setTexts(slide.texts.map((x, j) => (j === t ? { ...x, ...patch } : x)));
  const addText = () => {
    // The first photo opens with a hook; the others get a band.
    const text: SlideText = slide.texts.length === 0 && index === 0 ? { text: "Ton accroche", style: "hook" } : { text: "Ton texte", style: "band" };
    setTexts([...slide.texts, text]);
    setActive(slide.texts.length);
  };
  const pickSlide = (i: number) => {
    setIndex(i);
    setActive(null);
  };

  const muted = dark ? "text-white/60" : "text-muted";
  const chip = (on: boolean) =>
    on ? (dark ? "bg-white text-ink" : "bg-ink text-white") : dark ? "bg-white/10 text-white/80" : "bg-soft text-ink";
  const activeText = active !== null ? slide.texts[active] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <div ref={previewRef} className="relative overflow-hidden rounded-[18px] bg-black" style={{ width: previewWidth }}>
          {props ? (
            <>
              <SlidePreview props={props} />
              <TextBoxes
                container={previewRef}
                texts={slide.texts}
                active={active}
                yRange={[SLIDE_Y.min, SLIDE_Y.max]}
                onMove={(t, place) => patchText(t, place)}
                onPick={setActive}
              />
            </>
          ) : (
            <div className={`flex aspect-[4/5] items-center justify-center p-6 text-center text-sm ${muted}`}>
              Une vidéo du carrousel : elle reste telle quelle, sans texte par-dessus.
            </div>
          )}
        </div>
      </div>

      {plan.slides.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Photos">
          {plan.slides.map((s, i) => (
            <button
              key={s.media_id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1}`}
              onClick={() => pickSlide(i)}
              className={`relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-[10px] ${i === index ? "ring-2 ring-violet ring-offset-2" : "opacity-80"} ${dark ? "ring-offset-ink" : "ring-offset-white"}`}
            >
              {photos[s.media_id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                <img src={photos[s.media_id]} alt="" className="size-full object-cover" />
              ) : (
                <span className={`flex size-full items-center justify-center text-[10px] font-bold ${dark ? "bg-white/10" : "bg-soft"}`}>Vidéo</span>
              )}
              <span className="absolute bottom-0.5 left-0.5 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
              {s.texts.length > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-violet" aria-label="Avec texte" />}
            </button>
          ))}
        </div>
      )}

      {props &&
        (activeText && active !== null ? (
          <TextSheet
            key={`${index}-${active}`}
            text={activeText}
            onChange={(patch) => patchText(active, patch)}
            onRemove={() => {
              setTexts(slide.texts.filter((_, j) => j !== active));
              setActive(null);
            }}
            onClose={() => setActive(null)}
            looks={looks ? { saved: looks, brand: props.brand } : undefined}
            video={false}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {slide.texts.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={`flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${dark ? "border-white/20" : "border-line bg-white"}`}
              >
                <PenIcon size={13} className={`shrink-0 ${muted}`} />
                <span className="truncate">{t.text}</span>
              </button>
            ))}
            {slide.texts.length < 3 && (
              <button
                type="button"
                onClick={addText}
                className={`flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-[13px] ${dark ? "border-white/30 text-white/80" : "border-lilac text-violet"}`}
              >
                <PlusIcon size={13} /> Ajouter un texte
              </button>
            )}
          </div>
        ))}

      <div className="flex items-center gap-2">
        <span className={`text-[12px] font-bold ${muted}`}>Style</span>
        {templates.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={plan.template === t.value}
            onClick={() => onChange({ ...plan, template: t.value })}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${chip(plan.template === t.value)}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
