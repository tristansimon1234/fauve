"use client";

import { buildCarouselProps, slotBoxes, slotTextLimit, type CarouselDesign, type CarouselPhoto, type MotionTemplate, type ReelInputs, type SpotBox, type TextRun } from "@fauve/agent";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import { CarouselWords } from "./carousel-words";
import { SlidePreview } from "./slide-preview";

// A carousel Edith composed, edited like Instagram: the slide large, as it will be published
// (drawn live by the code that renders the image), swiped from one to the next; a tap on a text
// of the slide opens it to type, and the slide redraws with each letter. Where a text sits is read
// from what the browser drew (slotBoxes): Edith's code never says. A text the slide does not show
// as typed (drawn in pieces it cannot recognise) stays reachable in the list under the slide.

/** Room around a text's letters. */
const PAD = 6;
/** The least height a text takes under a finger (px): a small surtitle stays easy to touch. */
const MIN_TOUCH = 32;

let meter: CanvasRenderingContext2D | null | undefined;
/**
 * Where the letters of a run sit in the box the browser gives each of its lines, as shares of that
 * box: a display serif's box is far taller than its letters, and its frame would cross the text above.
 */
function inkShares(text: string, style: CSSStyleDeclaration): { top: number; bottom: number } {
  meter ??= document.createElement("canvas").getContext("2d");
  if (!meter) return { top: 0, bottom: 1 };
  meter.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const shown = style.textTransform === "uppercase" ? text.toUpperCase() : style.textTransform === "lowercase" ? text.toLowerCase() : text;
  const m = meter.measureText(shown);
  const box = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
  if (!(box > 0) || !(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent > 0)) return { top: 0, bottom: 1 };
  return {
    top: Math.min(1, Math.max(0, (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent) / box)),
    bottom: Math.min(1, Math.max(0, (m.fontBoundingBoxAscent + m.actualBoundingBoxDescent) / box)),
  };
}

/** The pieces of text the slide shows (their letters), in px of its canvas. */
function drawnRuns(canvas: HTMLElement): TextRun[] {
  const root = canvas.querySelector("[data-fauve-carousel]");
  if (!root) return [];
  const origin = canvas.getBoundingClientRect();
  const runs: TextRun[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    const parent = node.parentElement;
    if (!text.trim() || !parent) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || style.display === "none") continue;
    range.selectNodeContents(node);
    const ink = inkShares(text, style);
    let box: SpotBox | null = null;
    for (const r of Array.from(range.getClientRects())) {
      // What a strip lays on the slides beside this one is not on it.
      const left = Math.max(0, r.left - origin.left);
      const right = Math.min(origin.width, r.right - origin.left);
      const top = Math.max(0, r.top + ink.top * r.height - origin.top);
      const bottom = Math.min(origin.height, r.top + ink.bottom * r.height - origin.top);
      if (right - left < 1 || bottom - top < 1) continue;
      box = box ? { left: Math.min(box.left, left), top: Math.min(box.top, top), right: Math.max(box.right, right), bottom: Math.max(box.bottom, bottom) } : { left, top, right, bottom };
    }
    if (box) runs.push({ text, ...box });
  }
  return runs;
}

type Drawn = { spots: Record<string, SpotBox>; width: number; height: number };

const area = (b: SpotBox) => (b.right - b.left) * (b.bottom - b.top);
/** Where a text is touched: its letters with some room, at least MIN_TOUCH high. */
function touchFrame(b: SpotBox) {
  const height = Math.max(b.bottom - b.top + 2 * PAD, MIN_TOUCH);
  return { left: b.left - PAD, top: (b.top + b.bottom) / 2 - height / 2, width: b.right - b.left + 2 * PAD, height };
}

/** Where each text of the slide is, read again whenever the slide redraws (fonts, fitted boxes, a letter typed). */
function useSpots(canvas: RefObject<HTMLDivElement | null>, texts: Record<string, string>, slots: string[]): Drawn {
  const [drawn, setDrawn] = useState<Drawn>({ spots: {}, width: 0, height: 0 });
  const key = JSON.stringify([texts, slots]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let frame = 0;
    let last = "";
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { width, height } = el.getBoundingClientRect();
        const next = { spots: slotBoxes(drawnRuns(el), texts, slots), width, height };
        const seen = JSON.stringify(next);
        if (seen === last) return;
        last = seen;
        setDrawn(next);
      });
    };
    measure();
    const redrawn = new MutationObserver(measure);
    redrawn.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    document.fonts.addEventListener("loadingdone", measure);
    const late = window.setTimeout(measure, 800);
    return () => {
      cancelAnimationFrame(frame);
      redrawn.disconnect();
      resized.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
      window.clearTimeout(late);
    };
    // texts and slots are read through their key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, key]);
  return drawn;
}

export function CarouselStudio({
  design,
  texts,
  onChange,
  template,
  brand,
  photos,
  slide,
  onSlide,
  canEdit,
  dark = false,
  className = "",
}: {
  design: CarouselDesign;
  /** Her words, as she types them (the design's until saved). */
  texts: Record<string, string>;
  onChange: (slot: string, text: string) => void;
  template: MotionTemplate;
  brand: ReelInputs["brand"];
  /** Her photos in the design's order, as the render gets them. */
  photos: CarouselPhoto[];
  /** The slide shown, from 0. */
  slide: number;
  onSlide: (slide: number) => void;
  canEdit: boolean;
  dark?: boolean;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const spotButtons = useRef(new Map<string, HTMLButtonElement>());
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // The text being typed: its words before, and its box when it opened (an emptied text draws nothing).
  const [editing, setEditing] = useState<{ slot: string; before: string; box: SpotBox } | null>(null);
  const [listed, setListed] = useState(false);

  const live = useMemo(() => ({ ...design, texts }), [design, texts]);
  const props = useMemo(() => buildCarouselProps(live, slide, { template, brand, photos }), [live, slide, template, brand, photos]);
  // The slide's own texts and those on every slide, as the slide draws them (French typography set).
  const here = useMemo(() => design.slots.filter((s) => s.slide === slide + 1 || s.slide === 0), [design.slots, slide]);
  const stage = useSpots(
    canvas,
    props.carousel?.texts ?? {},
    here.map((s) => s.name),
  );
  const spots = stage.spots;
  const editedBox = editing ? (spots[editing.slot] ?? editing.box) : null;
  const editedSlot = editing ? design.slots.find((s) => s.name === editing.slot) : undefined;
  const unreachable = here.filter((s) => (texts[s.name] ?? "").trim() && !spots[s.name]).length;
  // A small text near a big one stays on top, to be touched.
  const layer = new Map(
    Object.entries(spots)
      .sort(([, a], [, b]) => area(b) - area(a))
      .map(([name], i) => [name, i + 1]),
  );

  const go = (i: number) => {
    setEditing(null);
    onSlide(Math.min(design.count - 1, Math.max(0, i)));
  };
  const open = (slot: string, box: SpotBox) => setEditing({ slot, before: texts[slot] ?? "", box });
  /** Closes the card, keeping her words or putting back those before; from the keyboard, back on the text. */
  const close = (keep: boolean, back: boolean) => {
    if (!editing) return;
    const { slot, before } = editing;
    if (!keep) onChange(slot, before);
    setEditing(null);
    if (back) requestAnimationFrame(() => spotButtons.current.get(slot)?.focus({ preventScroll: true }));
  };

  // ← → turn the slides, unless she is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.key === "ArrowLeft" && slide > 0) onSlide(slide - 1);
      if (e.key === "ArrowRight" && slide < design.count - 1) onSlide(slide + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, slide, design.count, onSlide]);

  // A tap anywhere else on the page keeps her words and closes the card.
  useEffect(() => {
    if (!editing) return;
    const away = (e: PointerEvent) => {
      if (!stageRef.current?.contains(e.target as Node)) setEditing(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [editing]);

  // The field fits its text as she types.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [editing, texts]);

  // The card sits under the text when it is in the top of the slide, above it otherwise.
  const card =
    editedBox && stage.width
      ? (() => {
          const width = Math.min(stage.width - 16, 380);
          const left = Math.min(Math.max(8, (editedBox.left + editedBox.right) / 2 - width / 2), stage.width - width - 8);
          const below = (editedBox.top + editedBox.bottom) / 2 < stage.height * 0.55;
          return below ? { width, left, top: editedBox.bottom + PAD + 8 } : { width, left, bottom: stage.height - editedBox.top + PAD + 8 };
        })()
      : null;

  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      <div ref={stageRef} className="group relative w-full">
        <div ref={canvas} className="overflow-hidden rounded-[18px] shadow-[0_18px_40px_rgba(28,21,48,.18)]">
          <SlidePreview props={props} />
        </div>

        {/* Her texts, to touch; a swipe turns the slide. */}
        <div
          className="absolute inset-0 isolate touch-pan-y overflow-hidden rounded-[18px]"
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onPointerMove={(e) => {
            const s = swipe.current;
            if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) s.moved = true;
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            if (!s || editing) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(slide + (dx < 0 ? 1 : -1));
          }}
          onClick={(e) => {
            if (!editing) return;
            // While she types, another text of the slide opens in its place; anywhere else keeps her words.
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            const hit = here
              .filter((h) => h.name !== editing.slot && spots[h.name])
              .sort((a, b) => (layer.get(b.name) ?? 0) - (layer.get(a.name) ?? 0))
              .find((h) => {
                const f = touchFrame(spots[h.name]!);
                return x >= f.left && x <= f.left + f.width && y >= f.top && y <= f.top + f.height;
              });
            if (hit) open(hit.name, spots[hit.name]!);
            else close(true, false);
          }}
        >
          {canEdit &&
            here.map((s) => {
              const box = spots[s.name];
              if (!box) return null;
              return (
                <button
                  key={`${slide}-${s.name}`}
                  ref={(el) => {
                    if (el) spotButtons.current.set(s.name, el);
                    else spotButtons.current.delete(s.name);
                  }}
                  type="button"
                  aria-label={`Changer « ${texts[s.name] ?? ""} »`}
                  title="Changer ce texte"
                  tabIndex={editing ? -1 : 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (swipe.current?.moved || editing) return;
                    open(s.name, box);
                  }}
                  className={`fauve-spot-hint absolute cursor-text rounded-[8px] outline-none hover:shadow-[0_0_0_2px_#fff,0_0_0_4px_#5b3fd9] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#5b3fd9] ${editing ? "invisible" : ""}`}
                  style={{ ...touchFrame(box), zIndex: layer.get(s.name) }}
                />
              );
            })}
          {editedBox && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-[8px] shadow-[0_0_0_2px_#fff,0_0_0_4px_#5b3fd9,0_0_0_200vmax_rgba(15,10,30,.55)] transition-[left,top,width,height] duration-100"
              style={{ left: editedBox.left - PAD, top: editedBox.top - PAD, width: editedBox.right - editedBox.left + 2 * PAD, height: editedBox.bottom - editedBox.top + 2 * PAD }}
            />
          )}
        </div>

        {editing && card && (
          <div
            key={editing.slot}
            role="dialog"
            aria-label={editedSlot?.role ?? "Changer le texte"}
            className="absolute z-20 rounded-[14px] bg-white p-2.5 text-ink shadow-[0_14px_36px_rgba(0,0,0,.35)]"
            style={card}
          >
            <span className="mb-1.5 block truncate px-1 text-[12px] font-semibold text-muted">{editedSlot?.role ?? "Texte"}</span>
            <textarea
              ref={field}
              autoFocus
              rows={1}
              value={texts[editing.slot] ?? ""}
              maxLength={editedSlot ? slotTextLimit(editedSlot) : 400}
              onChange={(e) => onChange(editing.slot, e.target.value)}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close(false, true);
                } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (!e.shiftKey && !editedSlot?.multiline))) {
                  e.preventDefault();
                  close(true, true);
                }
              }}
              className="block w-full resize-none rounded-[10px] bg-soft px-3 py-2 text-[16px] leading-snug outline-none focus:ring-2 focus:ring-violet"
            />
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <button type="button" onClick={(e) => close(false, e.detail === 0)} className="h-8 rounded-full px-3 text-[13px] font-semibold text-muted hover:text-ink">
                Annuler
              </button>
              <button type="button" onClick={(e) => close(true, e.detail === 0)} className="btn btn-primary h-8 px-3.5 text-[13px]">
                <CheckIcon size={14} />
                OK
              </button>
            </div>
          </div>
        )}

        {design.count > 1 && !editing && (
          <>
            {/* With a mouse; a finger swipes, and an arrow would hide a text to touch. */}
            {slide > 0 && (
              <button
                type="button"
                aria-label="Image précédente"
                onClick={() => go(slide - 1)}
                className="absolute top-1/2 left-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-fine:flex"
              >
                <ArrowLeftIcon size={18} />
              </button>
            )}
            {slide < design.count - 1 && (
              <button
                type="button"
                aria-label="Image suivante"
                onClick={() => go(slide + 1)}
                className="absolute top-1/2 right-2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-fine:flex"
              >
                <ArrowRightIcon size={18} />
              </button>
            )}
            {/* Shown when the slide changes, then gone: it would hide the corner of the image. */}
            <span key={slide} className="fauve-counter pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white">
              {slide + 1}/{design.count}
            </span>
          </>
        )}
      </div>

      {design.count > 1 && (
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Les images du carrousel">
          {Array.from({ length: design.count }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === slide}
              aria-label={`Image ${i + 1}`}
              onClick={() => go(i)}
              className={`size-2 rounded-full transition-colors ${i === slide ? "bg-violet" : dark ? "bg-white/30" : "bg-lilac"}`}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex w-full flex-col items-center gap-2">
          <p className={`text-center text-[13px] ${dark ? "text-white/70" : "text-muted"}`}>
            {editing ? "Tape ton texte : l’image se met à jour en direct." : "Touche un texte sur l’image pour le changer."}
            {!editing && (
              <>
                {" "}
                <button type="button" onClick={() => setListed((v) => !v)} className={`font-semibold underline-offset-4 hover:underline ${dark ? "text-white" : "text-violet"}`}>
                  {listed ? "Masquer la liste" : unreachable ? `Voir les textes en liste (${unreachable} à changer là)` : "Voir les textes en liste"}
                </button>
              </>
            )}
          </p>
          {listed && !editing && (
            <div className="w-full">
              <CarouselWords design={design} slide={slide} texts={texts} onChange={onChange} dark={dark} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
