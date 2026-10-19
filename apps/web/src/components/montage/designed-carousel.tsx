"use client";

import { type CarouselDesign, type CarouselPhoto, type MotionTemplate, type ReelInputs, buildCarouselProps } from "@fauve/agent";
import { useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { saveCarouselTexts } from "@/app/(app)/publications/[id]/actions";
import { CarouselStudio } from "./carousel-studio";
import { IMAGE_IDEAS, PhotoAsk } from "./photo-ask";
import { SlidePreview } from "./slide-preview";

// A carousel Simone composed, on the publication page: the slide as it will be published, edited
// like Instagram (a tap on a text of the image to change it, the slide redrawn as she types), the
// strip of every slide under it, and on the right what she asks Simone for this image (its layout,
// a photo, a bigger title) and her changes to save.

export function DesignedCarousel({
  postId,
  postTitle,
  design,
  template,
  photos,
  brand,
  canEdit,
}: {
  postId: string;
  postTitle: string;
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
  const changed = Object.keys(texts).filter((k) => saved[k] !== texts[k]).length;
  const save = () =>
    start(async () => {
      const update = Object.fromEntries(Object.entries(texts).filter(([k, v]) => saved[k] !== v));
      const res = await saveCarouselTexts(postId, update).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setSaved(texts);
      setMessage({ ok: true, text: "C’est enregistré. Les images finales se mettent à jour en une minute environ." });
    });

  return (
    <>
      <div className="flex min-w-0 flex-col items-center gap-4">
        <CarouselStudio
          design={design}
          texts={texts}
          onChange={(slot, text) => {
            setTexts((t) => ({ ...t, [slot]: text }));
            setMessage(null);
          }}
          template={template}
          brand={brand}
          photos={photos}
          slide={index}
          onSlide={setIndex}
          canEdit={canEdit}
          className="w-full max-w-[460px]"
        />
        {design.count > 1 && (
          <ul className="flex max-w-full gap-2 overflow-x-auto p-1" aria-label="Toutes les images">
            {Array.from({ length: design.count }, (_, i) => (
              <li key={i} className="w-[64px] shrink-0">
                <button type="button" onClick={() => setIndex(i)} aria-label={`Image ${i + 1}`} aria-pressed={i === index} className={`block w-full overflow-hidden rounded-[10px] ${i === index ? "ring-2 ring-violet ring-offset-2" : "opacity-75 hover:opacity-100"}`}>
                  <SlidePreview props={buildCarouselProps({ ...design, texts }, i, { template, brand, photos })} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-white p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-extrabold">
            Image {index + 1} sur {design.count}
          </h2>
          {design.outline[index] && <p className="text-[13px] leading-snug text-muted">{design.outline[index]}</p>}
        </div>
        {!canEdit ? (
          <p className="text-[14px] text-muted">Ce carrousel est en ligne.</p>
        ) : changed > 0 ? (
          <div className="flex flex-col gap-3 rounded-[16px] bg-soft p-3">
            <p className="text-[14px] font-semibold">{changed > 1 ? `${changed} textes changés` : "1 texte changé"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={save} className="btn btn-primary disabled:opacity-40">
                <CheckIcon size={16} />
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setTexts(saved);
                  setMessage(null);
                }}
                className="btn btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <PhotoAsk
            key={index}
            postId={postId}
            postTitle={postTitle}
            photo={index + 1}
            total={design.count}
            noun="Image"
            heading="Que veux-tu changer sur cette image ?"
            ideas={IMAGE_IDEAS}
            placeholder="Ex. le titre plus gros, ou une photo de la vitrine"
          />
        )}
        {message && <p className={`rounded-[12px] px-3 py-2 text-[13px] ${message.ok ? "bg-soft" : "bg-peach text-peach-ink"}`}>{message.text}</p>}
      </aside>
    </>
  );
}
