"use client";

import { ELEMENT_ROLE_LABELS, MAX_ELEMENTS, placeElement, type ElementSource, type ReelProps, type SlideElement } from "@fauve/agent";
import Link from "next/link";
import { useState } from "react";
import { PlusIcon, XIcon } from "@/components/icons";
import { ElementThumb } from "./element-thumb";

// The components of one photo, in the side panel: those on it (the selected one
// opens: its words, size, tilt, link to its page in the bank) and the studio's
// bank to add more, one by one or a whole kit where it sat on its inspiration.

export type BankElementView = ElementSource & { kitId: string | null; kitName: string | null };

type Kit = { id: string; name: string; elements: BankElementView[] };

export function kitsOf(bank: BankElementView[]): Kit[] {
  const kits = new Map<string, Kit>();
  for (const e of bank) {
    const id = e.kitId ?? e.id;
    const kit = kits.get(id) ?? { id, name: e.kitName ?? e.name, elements: [] };
    kit.elements.push(e);
    kits.set(id, kit);
  }
  return [...kits.values()];
}

export function ElementsPanel({
  bank,
  placed,
  selected,
  brand,
  onSelect,
  onChange,
  onKitAll,
}: {
  bank: BankElementView[];
  placed: SlideElement[];
  selected: number | null;
  brand: ReelProps["brand"];
  onSelect: (index: number | null) => void;
  onChange: (elements: SlideElement[]) => void;
  /** Lays a kit on every photo of the carousel (shown when there are several). */
  onKitAll?: (kit: BankElementView[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const kits = kitsOf(bank);
  const full = placed.length >= MAX_ELEMENTS;
  const current = selected !== null ? placed[selected] : undefined;

  const add = (list: BankElementView[]) => {
    const next = [...placed, ...list.map((e) => placeElement(e))].slice(0, MAX_ELEMENTS);
    onChange(next);
    onSelect(next.length - 1);
    setAdding(false);
  };
  const patch = (i: number, p: Partial<SlideElement>) => onChange(placed.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const remove = (i: number) => {
    onChange(placed.filter((_, j) => j !== i));
    onSelect(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold">Éléments</h3>
        {bank.length > 0 && !full && (
          <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className="inline-flex items-center gap-1 text-[13px] font-bold text-violet">
            {adding ? <XIcon size={14} /> : <PlusIcon size={15} />}
            {adding ? "Fermer" : "Ajouter"}
          </button>
        )}
      </div>

      {bank.length === 0 && (
        <p className="rounded-[12px] bg-soft px-3 py-2.5 text-[13px] leading-snug text-muted">
          Ta banque de composants est vide. Envoie à Simone une inspiration (la capture d’un post qui te plaît) : elle en sortira tes titres, étiquettes, listes… réutilisables sur toutes tes photos.
        </p>
      )}

      {placed.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {placed.map((e, i) => {
            const on = i === selected;
            return (
              <li key={`${i}-${e.element_id ?? e.name}`} className={`rounded-[14px] border ${on ? "border-violet bg-violet-tint/40" : "border-line"}`}>
                <div className="flex items-center gap-1 pr-1.5">
                  <button type="button" onClick={() => onSelect(on ? null : i)} aria-expanded={on} className="flex min-w-0 flex-1 flex-col px-3 py-2 text-left">
                    <span className="truncate text-[13px] font-bold">{e.name}</span>
                    <span className="text-[11px] font-semibold text-muted">{ELEMENT_ROLE_LABELS[e.role]}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer ${e.name}`}
                    onClick={() => remove(i)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-danger"
                  >
                    <XIcon size={13} />
                  </button>
                </div>
                {on && current && (
                  <div className="flex flex-col gap-3 border-t border-line px-3 pt-2.5 pb-3">
                    {current.slots.map((slot) => {
                      const value = current.texts[slot.name] ?? "";
                      const set = (text: string) => patch(i, { texts: { ...current.texts, [slot.name]: text.slice(0, slot.max_chars) } });
                      const field = "w-full rounded-[10px] border border-line bg-white px-2.5 py-2 text-[14px] outline-none focus:border-violet";
                      return (
                        <label key={slot.name} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-muted first-letter:uppercase">
                            {slot.role}
                            {slot.multiline ? " · une ligne par élément" : ""}
                          </span>
                          {slot.multiline ? (
                            <textarea value={value} rows={Math.min(7, Math.max(2, value.split("\n").length + 1))} onChange={(ev) => set(ev.target.value)} className={field} />
                          ) : (
                            <input value={value} onChange={(ev) => set(ev.target.value)} maxLength={slot.max_chars} className={field} />
                          )}
                        </label>
                      );
                    })}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-muted">Taille</span>
                      {[
                        { label: "A−", d: -0.06 },
                        { label: "A+", d: 0.06 },
                      ].map(({ label, d }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => patch(i, { box: { ...current.box, w: Math.round(Math.min(1.1, Math.max(0.08, current.box.w + d)) * 1000) / 1000 } })}
                          className="h-8 rounded-full bg-soft px-3 text-[13px] font-bold hover:bg-violet-soft hover:text-violet"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-muted">Inclinaison</span>
                      <input
                        type="range"
                        min={-20}
                        max={20}
                        step={1}
                        value={current.box.rotate ?? 0}
                        onChange={(ev) => patch(i, { box: { ...current.box, rotate: Number(ev.target.value) || undefined } })}
                        className="min-w-0 flex-1 accent-violet"
                      />
                      <span className="w-9 text-right text-[12px] tabular-nums text-muted">{current.box.rotate ?? 0}°</span>
                    </label>
                    {current.element_id && (
                      <Link href={`/composants/${current.element_id}`} className="self-start text-[13px] font-bold text-violet hover:underline">
                        Modifier ce composant dans ta banque
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {bank.length > 0 && (adding || (placed.length === 0 && !full)) && (
        <div className="flex flex-col gap-3">
          {placed.length === 0 && !adding && <p className="text-[13px] text-muted">Pose un composant de ta banque, ou tout un kit d’un coup.</p>}
          {kits.slice(0, 8).map((kit) => (
            <div key={kit.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-muted">{kit.name}</span>
                {kit.elements.length > 1 && (
                  <button type="button" onClick={() => add(kit.elements)} className="text-[12px] font-bold text-violet hover:underline">
                    Poser tout le kit
                  </button>
                )}
                {onKitAll && (
                  <button type="button" onClick={() => onKitAll(kit.elements)} className="text-[12px] font-bold text-violet hover:underline">
                    Sur toutes les photos
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {kit.elements.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => add([e])}
                    title={e.name}
                    aria-label={`Ajouter ${e.name}`}
                    className="overflow-hidden rounded-[10px] ring-violet transition-shadow hover:ring-2"
                  >
                    <ElementThumb element={{ js: e.js, texts: e.sample, fonts: e.fonts, base: e.base }} brand={brand} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Link href="/composants" className="self-start text-[12px] font-bold text-muted hover:text-violet">
            Voir toute ma banque
          </Link>
        </div>
      )}
    </div>
  );
}
