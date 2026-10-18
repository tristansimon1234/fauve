"use client";

import { buildCarouselProps, type CarouselDesign, type CarouselPhoto, type MotionTemplate, type ReelInputs } from "@fauve/agent";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { saveCarouselTexts } from "@/app/(app)/publications/[id]/actions";
import { CarouselWords } from "./carousel-words";
import { SlidePreview } from "./slide-preview";

// A carousel Simone composed, on the publication page: the slide as it will be published
// (drawn live, the same code renders the image), the strip of every slide under it, and on
// the right the words of the slide shown, changed by hand. Its layout changes by asking Simone.

export function DesignedCarousel({
  postId,
  design,
  template,
  photos,
  brand,
  canEdit,
}: {
  postId: string;
  design: CarouselDesign;
  template: MotionTemplate;
  /** Her photos in the design's order, as the render gets them. */
  photos: CarouselPhoto[];
  brand: ReelInputs["brand"];
  canEdit: boolean;
}) {
  const [saved, setSaved] = useState(design.texts);
  const [texts, setTexts] = useState(design.texts);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const live = useMemo(() => ({ ...design, texts }), [design, texts]);
  const props = (slide: number) => buildCarouselProps(live, slide, { template, brand, photos });
  const dirty = JSON.stringify(texts) !== JSON.stringify(saved);
  const go = (i: number) => setIndex(Math.min(design.count - 1, Math.max(0, i)));
  const save = () =>
    start(async () => {
      const changed = Object.fromEntries(Object.entries(texts).filter(([k, v]) => saved[k] !== v));
      const res = await saveCarouselTexts(postId, changed).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setSaved(texts);
      setMessage({ ok: true, text: "C’est enregistré. Les images finales se mettent à jour en une minute environ." });
    });

  return (
    <>
      <div className="flex min-w-0 flex-col items-center gap-3">
        <div className="relative w-full max-w-[460px]">
          <SlidePreview props={props(index)} className="overflow-hidden rounded-[18px] shadow-[0_18px_40px_rgba(28,21,48,.18)]" />
          {design.count > 1 && (
            <>
              <button type="button" aria-label="Image précédente" disabled={index === 0} onClick={() => go(index - 1)} className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow disabled:opacity-0">
                <ArrowLeftIcon size={18} />
              </button>
              <button type="button" aria-label="Image suivante" disabled={index === design.count - 1} onClick={() => go(index + 1)} className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow disabled:opacity-0">
                <ArrowRightIcon size={18} />
              </button>
              <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white">
                {index + 1}/{design.count}
              </span>
            </>
          )}
        </div>
        <ul className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Les images du carrousel">
          {Array.from({ length: design.count }, (_, i) => (
            <li key={i} className="w-[72px] shrink-0">
              <button type="button" onClick={() => go(i)} aria-label={`Image ${i + 1}`} aria-pressed={i === index} className={`block w-full overflow-hidden rounded-[10px] ${i === index ? "ring-2 ring-violet ring-offset-2" : "opacity-80 hover:opacity-100"}`}>
                <SlidePreview props={props(i)} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-white p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-extrabold">Image {index + 1}</h2>
          <span className="truncate text-[12px] text-muted">{design.name}</span>
        </div>
        {canEdit ? (
          <>
            <CarouselWords
              design={design}
              slide={index}
              texts={texts}
              onChange={(slot, text) => {
                setTexts((t) => ({ ...t, [slot]: text }));
                setMessage(null);
              }}
            />
            <button type="button" disabled={!dirty || saving} onClick={save} className="btn btn-primary self-start disabled:opacity-40">
              <CheckIcon size={16} />
              {saving ? "Enregistrement…" : "Enregistrer les textes"}
            </button>
          </>
        ) : (
          <p className="text-[14px] text-muted">Ce carrousel est en ligne.</p>
        )}
        {message && <p className={`rounded-[12px] px-3 py-2 text-[13px] ${message.ok ? "bg-soft" : "bg-peach text-peach-ink"}`}>{message.text}</p>}
        <p className="text-[12px] leading-snug text-muted">La mise en page, l’ordre, une image de plus ou un autre style : demande-le à Simone (« Demander une modif »).</p>
      </aside>
    </>
  );
}
