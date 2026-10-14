"use client";

import type { ElementBox, SlideElement } from "@fauve/agent";
import { useEffect, useRef, useState } from "react";
import { InlineEdit, type FrameBox } from "./inline-edit";
import { slotBoxes } from "./measure";

// The components on the preview, handled like in a design tool: click one to
// select it, drag it to move it, pull its corner to resize it, click one of its
// texts (once selected) to write it in place. Its code is Fauve's: only its
// place and its words change here.

type Measured = { boxes: (FrameBox | null)[]; slots: Record<string, FrameBox> };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function ElementHandles({
  container,
  elements,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  elements: SlideElement[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onChange: (index: number, patch: Partial<Pick<SlideElement, "box" | "texts">>) => void;
  onRemove: (index: number) => void;
}) {
  const [measured, setMeasured] = useState<Measured>({ boxes: [], slots: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ index: number; mode: "move" | "size"; px: number; py: number; start: ElementBox; moved: boolean; wasSelected: boolean } | null>(null);
  const latest = useRef({ elements, selected });
  useEffect(() => {
    latest.current = { elements, selected };
  }, [elements, selected]);

  // Where each component (and the selected one's texts) is drawn, a few times a second.
  useEffect(() => {
    let last = "";
    const measure = () => {
      const root = container.current;
      if (!root) return;
      const base = root.getBoundingClientRect();
      const { elements: list, selected: sel } = latest.current;
      const boxes = list.map((_, i) => {
        const el = root.querySelector(`[data-fauve-element="${i}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: (r.left - base.left) / base.width, top: (r.top - base.top) / base.height, width: r.width / base.width, height: r.height / base.height };
      });
      const drawn = sel !== null ? root.querySelector(`[data-fauve-element="${sel}"]`) : null;
      const current = sel !== null ? list[sel] : undefined;
      const slots = drawn && current ? slotBoxes(drawn, base, current.slots, current.texts) : {};
      const next = { boxes, slots };
      const key = JSON.stringify(next, (_, v) => (typeof v === "number" ? Math.round(v * 1000) : v));
      if (key !== last) {
        last = key;
        setMeasured(next);
      }
    };
    const timer = setInterval(measure, 200);
    measure();
    return () => clearInterval(timer);
  }, [container]);

  // Delete removes the selected component (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]") || selected === null) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onRemove(selected);
      } else if (e.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onRemove, onSelect]);

  const start = (e: React.PointerEvent, index: number, mode: "move" | "size") => {
    const element = elements[index];
    if (!element) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { index, mode, px: e.clientX, py: e.clientY, start: element.box, moved: false, wasSelected: selected === index };
    if (selected !== index) onSelect(index);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = container.current?.getBoundingClientRect();
    if (!d || !rect) return;
    if (!d.moved && Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      setEditing(null);
    }
    const dx = (e.clientX - d.px) / rect.width;
    const dy = (e.clientY - d.py) / rect.height;
    if (d.mode === "move") onChange(d.index, { box: { ...d.start, x: r3(clamp(d.start.x + dx, -0.2, 0.98)), y: r3(clamp(d.start.y + dy, -0.2, 0.98)) } });
    else onChange(d.index, { box: { ...d.start, w: r3(clamp(d.start.w + dx, 0.08, 1.1)) } });
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    // A click on a text of the component already selected writes it in place.
    if (!d || d.moved || !d.wasSelected) return;
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const hit = Object.entries(measured.slots).find(([, b]) => px >= b.left && px <= b.left + b.width && py >= b.top && py <= b.top + b.height);
    if (hit) setEditing(hit[0]);
  };

  const pct = (b: FrameBox) => ({ left: `${b.left * 100}%`, top: `${b.top * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` });
  const current = selected !== null ? elements[selected] : undefined;
  const editingSlot = editing && current ? current.slots.find((s) => s.name === editing) : null;

  return (
    <>
      {/* A click on the photo itself drops the selection. */}
      {selected !== null && !editing && <div data-fauve-overlay="" className="absolute inset-0 z-10" onPointerDown={() => onSelect(null)} />}
      {measured.boxes.map((box, i) => {
        if (!box || (editing && i === selected)) return null;
        const on = i === selected;
        return (
          <div
            key={i}
            data-fauve-overlay=""
            role="button"
            tabIndex={-1}
            aria-label={`${elements[i]?.name ?? "Composant"} : sélectionner, glisser pour déplacer`}
            onPointerDown={(e) => start(e, i, "move")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className={`absolute z-20 touch-none rounded-[8px] border-2 ${
              on ? (dragging ? "cursor-grabbing border-white" : "cursor-grab border-white shadow-[0_0_0_1px_rgba(91,63,217,.8)]") : "cursor-pointer border-transparent hover:border-dashed hover:border-white/70"
            }`}
            style={pct(box)}
          >
            {on &&
              Object.entries(measured.slots).map(([name, b]) => (
                <span
                  key={name}
                  className="pointer-events-none absolute rounded-[4px] ring-1 ring-white/50"
                  style={pct({ left: (b.left - box.left) / box.width, top: (b.top - box.top) / box.height, width: b.width / box.width, height: b.height / box.height })}
                />
              ))}
            {on && (
              <span
                aria-label="Agrandir ou réduire"
                onPointerDown={(e) => start(e, i, "size")}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                className="absolute -right-2.5 -bottom-2.5 size-5 cursor-ew-resize rounded-full border-2 border-violet bg-white shadow"
              />
            )}
          </div>
        );
      })}
      {editing && current && editingSlot && measured.slots[editing] && (
        <InlineEdit
          box={measured.slots[editing]}
          value={current.texts[editing] ?? ""}
          multiline={editingSlot.multiline}
          maxLength={editingSlot.max_chars}
          onChange={(text) => onChange(selected!, { texts: { ...current.texts, [editing]: text.slice(0, editingSlot.max_chars) } })}
          onDone={() => setEditing(null)}
        />
      )}
    </>
  );
}
