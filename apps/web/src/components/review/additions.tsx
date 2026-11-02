"use client";

import type { PlanOverlay } from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { libraryForPicker, type LibraryItem } from "@/app/(app)/new-post-actions";
import { PlayIcon, TrashIcon } from "@/components/icons";

// What she adds on her Reel in « Modifier » without anything redone (Tristan: « si je veux ajouter qq chose à un reel je
// comprends pas pq je peux pas »): an element over a scene (a text, one of her photos, cut out when it can be), a scene,
// an end card. The engine draws them over what is there, free; the live preview shows them at once.

/** Her library, to pick one photo or video. */
export function LibrarySheet({ kind, title, onPick, onClose }: { kind: "photo" | "any"; title: string; onPick: (id: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  useEffect(() => {
    let live = true;
    libraryForPicker(kind)
      .then((list) => live && setItems(list))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [kind]);
  return (
    <div className="flex flex-col gap-2.5 rounded-[16px] border-[1.5px] border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-bold">{title}</span>
        <button type="button" onClick={onClose} className="text-[13px] font-bold text-muted">
          Annuler
        </button>
      </div>
      {items === null ? (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="aspect-square animate-pulse rounded-lg bg-soft" aria-hidden />
          ))}
        </div>
      ) : items.length ? (
        <ul className="grid max-h-[260px] grid-cols-4 gap-1.5 overflow-y-auto">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)} className="relative block aspect-square w-full overflow-hidden rounded-lg bg-soft hover:ring-2 hover:ring-violet">
                {m.video ? (
                  <>
                    <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
                    <PlayIcon size={14} className="absolute right-1 bottom-1 text-white drop-shadow" />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="size-full object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">Ta médiathèque est vide : envoie d’abord tes fichiers à Edith.</p>
      )}
    </div>
  );
}

type Box = { index: number; left: number; top: number; width: number; height: number };

/** Her added elements on the preview, to drag with a finger (their centre), as her texts are. */
export function OverlayBoxes({
  container,
  player,
  overlays,
  active,
  onMove,
  onPick,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  player?: React.RefObject<PlayerRef | null>;
  overlays: PlanOverlay[];
  active: number | null;
  onMove: (index: number, place: { x: number; y: number }) => void;
  onPick: (index: number) => void;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const drag = useRef<{ index: number; px: number; py: number; x0: number; y0: number; moved: boolean } | null>(null);
  useEffect(() => {
    let frame = 0;
    let last = "";
    const measure = () => {
      const root = container.current;
      if (root) {
        const base = root.getBoundingClientRect();
        const found = [...root.querySelectorAll<HTMLElement>("[data-fauve-overlay]")].map((el): Box => {
          const r = el.getBoundingClientRect();
          return { index: Number(el.dataset.fauveOverlay), left: (r.left - base.left) / base.width, top: (r.top - base.top) / base.height, width: r.width / base.width, height: r.height / base.height };
        });
        const key = JSON.stringify(found.map((b) => [b.index, b.left.toFixed(3), b.top.toFixed(3), b.width.toFixed(3)]));
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
    if (Math.abs(clientX - d.px) + Math.abs(clientY - d.py) > 3) d.moved = true;
    if (!d.moved) return;
    const x = Math.min(0.92, Math.max(0.08, d.x0 + (clientX - d.px) / rect.width));
    const y = Math.min(0.78, Math.max(0.06, d.y0 + (clientY - d.py) / rect.height));
    onMove(d.index, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };
  return (
    <>
      {boxes.map((box) => {
        const o = overlays[box.index];
        if (!o) return null;
        return (
          <button
            key={box.index}
            type="button"
            aria-label={o.kind === "text" ? `Déplacer « ${o.text} »` : "Déplacer la photo"}
            className={`absolute z-20 cursor-grab touch-none rounded-[8px] border-2 active:cursor-grabbing ${
              active === box.index ? "border-white shadow-[0_0_0_2px_rgba(91,63,217,0.9)]" : "border-dashed border-white/70 hover:border-white"
            }`}
            style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              player?.current?.pause();
              drag.current = { index: box.index, px: e.clientX, py: e.clientY, x0: o.x, y0: o.y, moved: false };
            }}
            onPointerMove={(e) => move(e.clientX, e.clientY)}
            onPointerUp={() => {
              const d = drag.current;
              drag.current = null;
              if (d && !d.moved) onPick(d.index);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
        );
      })}
    </>
  );
}

const roundTo = (n: number) => Math.round(n * 100) / 100;

/** One element she added: its words, its size, whether its photo is cut out, how long it stays, or taken out. */
export function OverlayPanel({
  overlay,
  sceneSpan,
  duration,
  cutoutPossible,
  onChange,
  onRemove,
}: {
  overlay: PlanOverlay;
  /** The scene it sits on (when it sits on one), to keep it there or spread it over the Reel. */
  sceneSpan: { start: number; end: number } | null;
  duration: number;
  cutoutPossible: boolean;
  onChange: (patch: Partial<PlanOverlay>) => void;
  onRemove: () => void;
}) {
  const text = overlay.kind === "text";
  const step = text ? 0.01 : 0.05;
  const [min, max] = text ? [0.04, 0.16] : [0.15, 0.95];
  const whole = overlay.from <= 0.05 && overlay.to >= duration - 0.05;
  const chip = "h-10 rounded-full px-3.5 text-[13.5px] font-bold";
  return (
    <div className="flex flex-col gap-3.5">
      <h3 className="text-[17px] font-extrabold tracking-[-0.01em]">{text ? "Le texte ajouté" : "La photo ajoutée"}</h3>
      {text && (
        <input
          value={overlay.text ?? ""}
          maxLength={90}
          onChange={(e) => onChange({ text: e.target.value })}
          aria-label="Les mots"
          className="h-12 w-full rounded-[14px] border-[1.5px] border-line bg-white px-3.5 text-[16px] font-semibold outline-none focus:border-violet"
        />
      )}
      <p className="-mt-1.5 text-[12.5px] leading-snug text-muted">Pour le placer, fais-le glisser sur la vidéo.</p>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[14px] font-bold">Taille</span>
        <button type="button" aria-label="Plus petit" disabled={overlay.w <= min} onClick={() => onChange({ w: Math.max(min, roundTo(overlay.w - step)) })} className="h-10 w-12 rounded-full bg-chip text-[14px] font-extrabold disabled:opacity-35">
          A−
        </button>
        <button type="button" aria-label="Plus grand" disabled={overlay.w >= max} onClick={() => onChange({ w: Math.min(max, roundTo(overlay.w + step)) })} className="h-10 w-12 rounded-full bg-chip text-[17px] font-extrabold disabled:opacity-35">
          A+
        </button>
      </div>
      {!text && cutoutPossible && (
        <div className="flex gap-2" role="group" aria-label="Détourage">
          <button type="button" onClick={() => onChange({ cutout: undefined })} className={`${chip} ${overlay.cutout !== false ? "bg-violet text-white" : "bg-chip"}`}>
            Détourée
          </button>
          <button type="button" onClick={() => onChange({ cutout: false })} className={`${chip} ${overlay.cutout === false ? "bg-violet text-white" : "bg-chip"}`}>
            Photo entière
          </button>
        </div>
      )}
      {sceneSpan && (
        <div className="flex gap-2" role="group" aria-label="Quand">
          <button type="button" onClick={() => onChange({ from: sceneSpan.start, to: sceneSpan.end })} className={`${chip} ${!whole ? "bg-violet text-white" : "bg-chip"}`}>
            Sur cette scène
          </button>
          <button type="button" onClick={() => onChange({ from: 0, to: duration })} className={`${chip} ${whole ? "bg-violet text-white" : "bg-chip"}`}>
            Tout le Reel
          </button>
        </div>
      )}
      <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 self-start py-1 text-[13.5px] font-bold text-danger">
        <TrashIcon size={15} />
        Retirer
      </button>
    </div>
  );
}
