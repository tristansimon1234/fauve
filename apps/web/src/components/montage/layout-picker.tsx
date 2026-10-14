"use client";

import { buildSlideProps, type ReelInputs, type SlidesPlan, type TextLayer } from "@fauve/agent";
import { useMemo, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { SlidePreview } from "./slide-preview";

// « Mise en page »: the text layouts of the library (Fauve's and the studio's),
// each drawn live on the selected photo with its own texts. A click puts it on
// this photo; « Sur toutes les photos » on every photo, each with its texts.

export type Layout = Omit<TextLayer, "texts" | "template_id"> & { id: string; house: boolean; sample?: Record<string, string> };
type Slide = SlidesPlan["slides"][number];

/** The photo's words, in order: a layer's texts, else its free texts (a list gives one line per item). */
function wordsOf(slide: Slide): string[] {
  if (slide.layer) return slide.layer.slots.map((s) => slide.layer!.texts[s.name] ?? "").filter(Boolean);
  return slide.texts.map((t) => (t.items?.length ? t.items.map((i) => (i.detail ? `${i.title} · ${i.detail}` : i.title)).join("\n") : t.text)).filter(Boolean);
}

/** The layout on this photo: its slots filled with the photo's words, in order (else the slot's role). */
export function layoutOn(layout: Layout, slide: Slide): TextLayer {
  const words = wordsOf(slide);
  // The photo's first text (its hook) goes to the layout's title, the others in order.
  const title = layout.slots.findIndex((slot) => /titre|title|accroche|hook/i.test(`${slot.name} ${slot.role}`));
  const order = title > 0 ? [layout.slots[title]!, ...layout.slots.filter((_, i) => i !== title)] : layout.slots;
  const texts = Object.fromEntries(
    order.map((slot, i) => {
      // No word of hers for this slot: the layout's own example text, never the slot's description.
      const word = words[i] ?? layout.sample?.[slot.name] ?? (slot.multiline ? "Premier point\nDeuxième point" : "Ton texte");
      return [slot.name, (slot.multiline ? word : word.replace(/\n/g, " ")).slice(0, slot.max_chars)];
    }),
  );
  return { template_id: layout.id, name: layout.name, js: layout.js, slots: layout.slots, fonts: layout.fonts, texts };
}

export function LayoutPicker({
  layouts,
  slide,
  template,
  imageUrl,
  brand,
  onPick,
  onPickAll,
  onClear,
  many,
  freeLabel = "Textes libres",
}: {
  layouts: Layout[];
  slide: Slide;
  template: SlidesPlan["template"];
  imageUrl: string;
  brand: ReelInputs["brand"];
  onPick: (layout: Layout) => void;
  onPickAll: (layout: Layout) => void;
  onClear: () => void;
  /** Several photos: the « on every photo » action is offered. */
  many: boolean;
  /** The first tile (no layout). */
  freeLabel?: string;
}) {
  const [all, setAll] = useState(false);
  const current = slide.layer?.template_id ?? null;
  const picked = layouts.find((l) => l.id === current) ?? null;
  // Free texts first (the photo as it is without a layout), then each layout on this photo.
  const free = useMemo(() => buildSlideProps({ ...slide, layer: undefined }, { template, imageUrl, brand }), [slide, template, imageUrl, brand]);
  const previews = useMemo(
    () => layouts.map((l) => ({ layout: l, props: buildSlideProps({ ...slide, layer: layoutOn(l, slide) }, { template, imageUrl, brand }) })),
    [layouts, slide, template, imageUrl, brand],
  );
  if (!layouts.length) return null;
  // A first row or two; the chosen one always shows.
  const FIRST = 5;
  const shown = all ? previews : previews.filter((p, i) => i < FIRST || p.layout.id === current);

  const tile = (on: boolean) =>
    `group flex min-w-0 flex-col gap-1.5 text-left outline-none ${on ? "" : "opacity-90 hover:opacity-100"}`;
  const frame = (on: boolean) =>
    `relative overflow-hidden rounded-[10px] bg-ink transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-violet ${on ? "ring-2 ring-violet ring-offset-2" : "ring-1 ring-line"}`;

  return (
    <section aria-label="Mise en page" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold">Mise en page</h3>
        {many && picked && (
          <button type="button" onClick={() => onPickAll(picked)} className="text-[13px] font-bold text-violet hover:underline">
            Sur toutes les photos
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 pt-1" role="radiogroup" aria-label="Mises en page">
        <button type="button" role="radio" aria-checked={!slide.layer} onClick={onClear} className={tile(!slide.layer)}>
          <span className={frame(!slide.layer)}>
            <SlidePreview props={free} />
            {!slide.layer && <Tick />}
          </span>
          <span className="truncate text-[11px] font-semibold">{freeLabel}</span>
        </button>
        {shown.map(({ layout, props }) => {
          const on = current === layout.id;
          return (
            <button key={layout.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(layout)} title={layout.name} className={tile(on)}>
              <span className={frame(on)}>
                <SlidePreview props={props} />
                {on && <Tick />}
              </span>
              <span className="truncate text-[11px] font-semibold">{layout.name}</span>
            </button>
          );
        })}
      </div>
      {previews.length > shown.length || all ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="self-start text-[13px] font-bold text-violet hover:underline">
          {all ? "Voir moins" : `Voir toutes les mises en page (${previews.length})`}
        </button>
      ) : null}
      <p className="text-[12px] leading-snug text-muted">
        Tes textes sont repris dans la mise en page choisie. Pour une mise en page sur mesure, envoie un exemple à Brigitte.
      </p>
    </section>
  );
}

function Tick() {
  return (
    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-violet text-white shadow">
      <CheckIcon size={12} />
    </span>
  );
}
