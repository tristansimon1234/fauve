"use client";

import type { Bullet, ListItem } from "@fauve/agent";
import { PlusIcon, TrashIcon } from "@/components/icons";

// The items of a list text (checklist, planning, steps, prices): a title and an
// optional line below each, and the mark before them.

const bullets = [
  { value: null, label: "Aucune" },
  { value: "check", label: "Cochée" },
  { value: "box", label: "Case" },
  { value: "dot", label: "•" },
  { value: "dash", label: "–" },
  { value: "number", label: "1." },
  { value: "arrow", label: "→" },
] as const;

export function ListItems({
  items,
  bullet,
  onChange,
}: {
  items: ListItem[];
  bullet: Bullet | undefined;
  onChange: (patch: { items?: ListItem[]; bullet?: Bullet }) => void;
}) {
  const set = (i: number, patch: Partial<ListItem>) => onChange({ items: items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
  const input = "min-w-0 rounded-[10px] border border-line bg-white px-2.5 py-2 text-[14px] outline-none focus:border-violet";
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <span className="w-5 shrink-0 pt-2 text-center text-[12px] font-bold text-muted">{i + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <input value={item.title} maxLength={80} aria-label={`Élément ${i + 1}`} onChange={(e) => set(i, { title: e.target.value })} className={`${input} font-semibold`} />
            <input
              value={item.detail ?? ""}
              maxLength={160}
              placeholder="Détail (facultatif)"
              aria-label={`Détail de l’élément ${i + 1}`}
              onChange={(e) => set(i, { detail: e.target.value || undefined })}
              className={`${input} text-[13px]`}
            />
          </div>
          <button
            type="button"
            aria-label={`Supprimer l’élément ${i + 1}`}
            disabled={items.length <= 1}
            onClick={() => onChange({ items: items.filter((_, j) => j !== i) })}
            className="flex size-9 shrink-0 items-center justify-center self-center text-muted hover:text-danger disabled:opacity-30"
          >
            <TrashIcon size={15} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        {items.length < 8 && (
          <button type="button" onClick={() => onChange({ items: [...items, { title: "Nouvel élément" }] })} className="inline-flex items-center gap-1 text-[13px] font-bold text-violet">
            <PlusIcon size={14} />
            Ajouter
          </button>
        )}
        <span className="ml-auto text-[12px] font-semibold text-muted">Puce</span>
        {bullets.map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.value ?? "Aucune puce"}
            onClick={() => onChange({ bullet: b.value ? { kind: b.value, color: bullet?.color ?? "#ffffff" } : undefined })}
            className={`h-8 min-w-8 rounded-full px-2 text-[13px] font-bold ${(bullet?.kind ?? null) === b.value ? "bg-violet text-white" : "bg-soft text-muted"}`}
          >
            {b.label}
          </button>
        ))}
        {bullet && (
          <input
            type="color"
            aria-label="Couleur des puces"
            value={/^#/.test(bullet.color) ? bullet.color : "#ffffff"}
            onChange={(e) => onChange({ bullet: { ...bullet, color: e.target.value } })}
            className="h-8 w-10 cursor-pointer rounded-[8px] border border-line bg-white"
          />
        )}
      </div>
    </div>
  );
}
