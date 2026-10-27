"use client";

import { slotTextLimit, type CarouselDesign } from "@fauve/agent";

// The words of one slide of a composed carousel, field by field (its layout is Edith's:
// it changes by asking her). A text on every slide (a footer) shows under each.

export function CarouselWords({
  design,
  slide,
  texts,
  onChange,
  dark = false,
}: {
  design: Pick<CarouselDesign, "slots" | "outline">;
  /** The slide shown, from 0. */
  slide: number;
  texts: Record<string, string>;
  onChange: (slot: string, text: string) => void;
  dark?: boolean;
}) {
  const own = design.slots.filter((s) => s.slide === slide + 1);
  const everywhere = design.slots.filter((s) => s.slide === 0);
  const field = `w-full rounded-[12px] px-3 py-2.5 text-[15px] leading-snug outline-none focus:ring-2 focus:ring-violet ${
    dark ? "bg-white text-ink" : "border border-line bg-white"
  }`;
  const row = (s: CarouselDesign["slots"][number]) => {
    const value = texts[s.name] ?? "";
    const long = s.multiline || s.max_chars > 70 || value.includes("\n");
    return (
      <label key={s.name} className="flex flex-col gap-1">
        <span className={`text-[12px] font-semibold ${dark ? "text-white/60" : "text-muted"}`}>{s.role}</span>
        {long ? (
          <textarea value={value} onChange={(e) => onChange(s.name, e.target.value)} rows={Math.min(5, Math.max(2, value.split("\n").length))} maxLength={slotTextLimit(s)} className={`${field} resize-y`} />
        ) : (
          <input value={value} onChange={(e) => onChange(s.name, e.target.value)} maxLength={slotTextLimit(s)} className={field} />
        )}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      {design.outline[slide] && <p className={`text-[13px] ${dark ? "text-white/70" : "text-muted"}`}>{design.outline[slide]}</p>}
      {own.length ? own.map(row) : <p className={`text-[14px] ${dark ? "text-white/60" : "text-muted"}`}>Pas de texte sur cette image.</p>}
      {everywhere.length > 0 && (
        <div className={`flex flex-col gap-3 border-t pt-3 ${dark ? "border-white/15" : "border-line"}`}>
          <span className={`text-[12px] font-bold ${dark ? "text-white/60" : "text-muted"}`}>Sur toutes les images</span>
          {everywhere.map(row)}
        </div>
      )}
    </div>
  );
}
