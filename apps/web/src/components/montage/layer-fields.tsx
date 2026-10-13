"use client";

import type { TextLayer } from "@fauve/agent";

// The texts of a designed text layer: one field per slot (several lines for a
// list), nothing else. The layout itself is Fauve's: ask her to change it.

export function LayerFields({
  layer,
  onChange,
  onRemove,
  dark = false,
}: {
  layer: TextLayer;
  onChange: (texts: Record<string, string>) => void;
  onRemove: () => void;
  dark?: boolean;
}) {
  const field = `w-full rounded-[12px] border px-3 py-2.5 text-[15px] outline-none ${dark ? "border-white/15 bg-white/5 text-white focus:border-white/50" : "border-line bg-white focus:border-violet"}`;
  const muted = dark ? "text-white/60" : "text-muted";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${muted}`}>Mise en page « {layer.name} »</span>
        <button type="button" onClick={onRemove} className={`text-[13px] font-semibold ${muted} hover:underline`}>
          Retirer
        </button>
      </div>
      {layer.slots.map((slot) => {
        const value = layer.texts[slot.name] ?? "";
        const set = (text: string) => onChange({ ...layer.texts, [slot.name]: text.slice(0, slot.max_chars) });
        return (
          <label key={slot.name} className="flex flex-col gap-1">
            <span className={`text-[12px] font-semibold first-letter:uppercase ${muted}`}>
              {slot.role}
              {slot.multiline ? " · une ligne par élément" : ""}
            </span>
            {slot.multiline ? (
              <textarea value={value} rows={Math.min(8, Math.max(3, value.split("\n").length + 1))} onChange={(e) => set(e.target.value)} className={field} />
            ) : (
              <input value={value} onChange={(e) => set(e.target.value)} className={field} />
            )}
          </label>
        );
      })}
    </div>
  );
}
