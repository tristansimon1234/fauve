"use client";

import type { EditPlan } from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";

// Shared by the scene editor (publication page) and the mobile action page:
// the texts of a montage, grabbable on the live preview.

type Text = EditPlan["texts"][number];

/** Where each style sits by default (top edge, share of the height), and the safe range. */
export const DEFAULT_Y: Record<Text["style"], number> = { hook: 0.12, band: 0.37, caption: 0.63 };
export const Y_MIN = 0.05;
export const Y_MAX = 0.66;
export const X_MIN = 0.3;
export const X_MAX = 0.7;
export const places = [
  { label: "Haut", y: 0.12 },
  { label: "Milieu", y: 0.37 },
  { label: "Bas", y: 0.6 },
] as const;

type Box = { index: number; left: number; top: number; width: number; height: number };

/**
 * The texts on the preview, grabbable: drag one to place it (inside the safe
 * zone, with a pull to the centre line), tap it to edit it. Boxes come from the
 * composition itself (`data-fauve-text`), measured on every frame.
 */
export function TextBoxes({
  container,
  player,
  texts,
  active,
  onMove,
  onPick,
  yRange = [Y_MIN, Y_MAX],
}: {
  container: React.RefObject<HTMLDivElement | null>;
  /** The live player, paused while a text is dragged (none on a still slide). */
  player?: React.RefObject<PlayerRef | null>;
  texts: Pick<Text, "style" | "text" | "x" | "y">[];
  /** Where the top of a text may go (a carousel slide has no app buttons at the bottom). */
  yRange?: [number, number];
  active: number | null;
  onMove: (index: number, place: { x: number; y: number }) => void;
  onPick: (index: number) => void;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ index: number; px: number; py: number; x0: number; y0: number; moved: boolean } | null>(null);

  useEffect(() => {
    let frame = 0;
    let last = "";
    const measure = () => {
      const root = container.current;
      if (root) {
        const base = root.getBoundingClientRect();
        const found = [...root.querySelectorAll<HTMLElement>("[data-fauve-text]")].map((el): Box => {
          const r = el.getBoundingClientRect();
          return {
            index: Number(el.dataset.fauveText),
            left: (r.left - base.left) / base.width,
            top: (r.top - base.top) / base.height,
            width: r.width / base.width,
            height: r.height / base.height,
          };
        });
        const key = JSON.stringify(found.map((b) => [b.index, b.left.toFixed(3), b.top.toFixed(3), b.width.toFixed(3), b.height.toFixed(3)]));
        if (key !== last) {
          last = key;
          setBoxes(found);
        }
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [container]);

  const move = (clientX: number, clientY: number) => {
    const d = drag.current;
    const rect = container.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (clientX - d.px) / rect.width;
    const dy = (clientY - d.py) / rect.height;
    if (Math.abs(clientX - d.px) + Math.abs(clientY - d.py) > 3) d.moved = true;
    if (!d.moved) return;
    let x = Math.min(X_MAX, Math.max(X_MIN, d.x0 + dx));
    if (Math.abs(x - 0.5) < 0.025) x = 0.5;
    const y = Math.min(yRange[1], Math.max(yRange[0], d.y0 + dy));
    onMove(d.index, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };

  return (
    <>
      {dragging && (
        <>
          {/* The bottom quarter Instagram covers on a Reel, and the centre line. */}
          {yRange[1] <= Y_MAX && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/4 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.12)_0_8px,transparent_8px_16px)]" />
          )}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 border-l border-dashed border-white/60" />
        </>
      )}
      {boxes.map((box) => {
        const text = texts[box.index];
        if (!text) return null;
        return (
          <button
            key={box.index}
            type="button"
            aria-label={`Déplacer « ${text.text} »`}
            className={`absolute z-20 cursor-grab touch-none rounded-[8px] border-2 active:cursor-grabbing ${
              active === box.index ? "border-white shadow-[0_0_0_2px_rgba(91,63,217,0.9)]" : "border-dashed border-white/70 hover:border-white"
            }`}
            style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              player?.current?.pause();
              drag.current = { index: box.index, px: e.clientX, py: e.clientY, x0: text.x ?? 0.5, y0: text.y ?? DEFAULT_Y[text.style], moved: false };
              setDragging(true);
            }}
            onPointerMove={(e) => move(e.clientX, e.clientY)}
            onPointerUp={() => {
              const d = drag.current;
              drag.current = null;
              setDragging(false);
              if (d && !d.moved) onPick(d.index);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
            }}
          />
        );
      })}
    </>
  );
}

