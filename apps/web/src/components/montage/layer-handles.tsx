"use client";

import type { TextLayer } from "@fauve/agent";
import { useEffect, useRef, useState } from "react";
import { InlineEdit, type FrameBox } from "./inline-edit";

// A text layout on the preview, handled like any design tool: click a text to
// write it in place, drag the layout to move it, pull the corner to resize it.
// The layout is the designer's code, so nothing in it is changed: its words go
// to its slots, the move and the size to `layer.place` (applied when drawn).

type Place = NonNullable<TextLayer["place"]>;
const NO_PLACE: Place = { x: 0, y: 0, scale: 1 };

const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/** What a slot shows first: its first line, before a « | » detail. */
const firstWords = (value: string) => norm((value.split("\n").find((l) => l.trim()) ?? "").split("|")[0] ?? "");

type Measured = { frame: FrameBox | null; slots: Record<string, FrameBox> };

function union(rects: DOMRect[], base: DOMRect): FrameBox | null {
  const real = rects.filter((r) => r.width > 1 && r.height > 1);
  if (!real.length) return null;
  const left = Math.min(...real.map((r) => r.left));
  const top = Math.min(...real.map((r) => r.top));
  const right = Math.max(...real.map((r) => r.right));
  const bottom = Math.max(...real.map((r) => r.bottom));
  return { left: (left - base.left) / base.width, top: (top - base.top) / base.height, width: (right - left) / base.width, height: (bottom - top) / base.height };
}

/** The deepest elements whose text is (or starts with) these words. */
function elementsFor(root: Element, words: string): Element[] {
  if (!words) return [];
  const all = [...root.querySelectorAll("*")].filter((el) => !el.closest("[data-fauve-overlay]"));
  for (const match of [(t: string) => t === words, (t: string) => t.startsWith(words)]) {
    const hits = all.filter((el) => match(norm(el.textContent ?? "")));
    const deepest = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
    if (deepest.length) return deepest;
  }
  return [];
}

export function LayerHandles({
  container,
  layer,
  onChange,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  layer: TextLayer;
  onChange: (layer: TextLayer) => void;
}) {
  const [measured, setMeasured] = useState<Measured>({ frame: null, slots: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ mode: "move" | "size"; slot: string | null; px: number; py: number; start: Place; moved: boolean; cx: number; cy: number; d0: number } | null>(null);
  const latest = useRef(layer);
  useEffect(() => {
    latest.current = layer;
  }, [layer]);

  // Where the layout and each of its texts are, a few times a second (fonts load, texts change).
  useEffect(() => {
    let last = "";
    const measure = () => {
      const root = container.current;
      const drawn = root?.querySelector("[data-fauve-layer]");
      if (!root || !drawn) return;
      const base = root.getBoundingClientRect();
      const slots: Record<string, FrameBox> = {};
      for (const slot of latest.current.slots) {
        const value = latest.current.texts[slot.name] ?? "";
        const lines = slot.multiline ? value.split("\n").filter((l) => l.trim()) : [value];
        const els = lines.flatMap((line) => elementsFor(drawn, firstWords(line)));
        const box = union(els.map((el) => el.getBoundingClientRect()), base);
        if (box) slots[slot.name] = box;
      }
      // The layout's own shapes (cards, bands, badges) and its texts.
      const shapes = [...drawn.querySelectorAll<HTMLElement>("*")].filter((el) => {
        const style = getComputedStyle(el);
        return (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") || style.backgroundImage !== "none" || el.childElementCount === 0;
      });
      const frame = union(
        shapes.map((el) => el.getBoundingClientRect()).filter((r) => r.width < base.width * 0.98 || r.height < base.height * 0.98),
        base,
      );
      const next = { frame, slots };
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

  const place = layer.place ?? NO_PLACE;
  const setPlace = (next: Place) => onChange({ ...latest.current, place: next.x === 0 && next.y === 0 && next.scale === 1 ? undefined : next });
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const start = (e: React.PointerEvent, mode: "move" | "size", slot: string | null) => {
    const rect = container.current?.getBoundingClientRect();
    const frame = measured.frame;
    if (!rect || !frame) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cx = rect.left + (frame.left + frame.width / 2) * rect.width;
    const cy = rect.top + (frame.top + frame.height / 2) * rect.height;
    drag.current = { mode, slot, px: e.clientX, py: e.clientY, start: place, moved: false, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 };
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
    const r = (n: number) => Math.round(n * 1000) / 1000;
    if (d.mode === "move") {
      setPlace({ ...d.start, x: r(clamp(d.start.x + (e.clientX - d.px) / rect.width, -0.45, 0.45)), y: r(clamp(d.start.y + (e.clientY - d.py) / rect.height, -0.45, 0.45)) });
    } else {
      setPlace({ ...d.start, scale: r(clamp((d.start.scale * Math.hypot(e.clientX - d.cx, e.clientY - d.cy)) / d.d0, 0.5, 1.5)) });
    }
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    // A click (no move) on a text writes it in place.
    if (d && !d.moved && d.slot) setEditing(d.slot);
  };

  const frame = measured.frame;
  const editingSlot = editing ? layer.slots.find((s) => s.name === editing) : null;
  const pct = (b: FrameBox) => ({ left: `${b.left * 100}%`, top: `${b.top * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` });
  return (
    <>
      {frame && !editing && (
        <div
          data-fauve-overlay=""
          role="button"
          tabIndex={-1}
          aria-label="Déplacer la mise en page"
          onPointerDown={(e) => start(e, "move", null)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className={`group absolute z-20 touch-none rounded-[10px] border-2 ${dragging ? "cursor-grabbing border-white" : "cursor-grab border-dashed border-white/50 hover:border-white"}`}
          style={pct(frame)}
        >
          {layer.slots.map((slot) => {
            const box = measured.slots[slot.name];
            if (!box) return null;
            // Relative to the layout's frame.
            const inner = { left: (box.left - frame.left) / frame.width, top: (box.top - frame.top) / frame.height, width: box.width / frame.width, height: box.height / frame.height };
            return (
              <span
                key={slot.name}
                title={`Modifier : ${slot.role}`}
                onPointerDown={(e) => start(e, "move", slot.name)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                className="absolute cursor-text rounded-[6px] hover:bg-white/15 hover:ring-2 hover:ring-white/80"
                style={pct(inner)}
              />
            );
          })}
          <span
            aria-label="Agrandir ou réduire"
            onPointerDown={(e) => start(e, "size", null)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute -right-2.5 -bottom-2.5 size-5 cursor-nwse-resize rounded-full border-2 border-violet bg-white shadow"
          />
        </div>
      )}
      {editing && editingSlot && measured.slots[editing] && (
        <InlineEdit
          box={measured.slots[editing]}
          value={layer.texts[editing] ?? ""}
          multiline={editingSlot.multiline}
          maxLength={editingSlot.max_chars}
          onChange={(text) => onChange({ ...latest.current, texts: { ...latest.current.texts, [editing]: text.slice(0, editingSlot.max_chars) } })}
          onDone={() => setEditing(null)}
        />
      )}
    </>
  );
}
