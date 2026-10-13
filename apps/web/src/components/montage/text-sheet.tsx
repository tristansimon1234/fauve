"use client";

import { TrashIcon, XIcon } from "@/components/icons";
import { DEFAULT_Y } from "./text-boxes";

// The selected text of a montage or a carousel slide: its words, style, size and
// background, big enough for a thumb (mobile page) and fine on a desktop.

export type SheetText = {
  text: string;
  style: "hook" | "band" | "caption";
  y?: number;
  scale?: number;
  backdrop?: boolean;
};

const styleLabels: Record<SheetText["style"], string> = { hook: "Accroche", band: "Bandeau", caption: "Sous-titre" };
const round = (n: number) => Math.round(n * 10) / 10;

/** The selected text: its words, style, size and background, big enough for a thumb. */
export function TextSheet<T extends SheetText>({
  text,
  onChange,
  onRemove,
  onClose,
}: {
  text: T;
  onChange: (patch: Partial<SheetText>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const scale = text.scale ?? 1;
  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-white p-3.5 text-ink">
      <div className="flex items-center gap-2">
        <input
          value={text.text}
          onChange={(e) => onChange({ text: e.target.value })}
          maxLength={120}
          aria-label="Texte"
          className="min-w-0 flex-1 rounded-[12px] border border-line px-3 py-2.5 text-[16px] outline-none focus:border-violet"
        />
        <button type="button" aria-label="Fermer" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
          <XIcon size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(styleLabels) as SheetText["style"][]).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onChange({ style, y: text.y ?? DEFAULT_Y[text.style] })}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${text.style === style ? "bg-violet text-white" : "bg-violet-soft text-violet"}`}
          >
            {styleLabels[style]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Plus petit"
          disabled={scale <= 0.6}
          onClick={() => onChange({ scale: Math.max(0.6, round(scale - 0.1)) })}
          className="size-10 rounded-full border border-line text-[15px] font-bold disabled:opacity-30"
        >
          A−
        </button>
        <button
          type="button"
          aria-label="Plus grand"
          disabled={scale >= 1.6}
          onClick={() => onChange({ scale: Math.min(1.6, round(scale + 0.1)) })}
          className="size-10 rounded-full border border-line text-[18px] font-bold disabled:opacity-30"
        >
          A+
        </button>
        <button
          type="button"
          aria-pressed={text.backdrop ?? false}
          onClick={() => onChange({ backdrop: text.backdrop ? undefined : true })}
          className={`rounded-full px-3.5 py-2.5 text-[13px] font-semibold ${text.backdrop ? "bg-ink text-white" : "border border-line"}`}
        >
          Fond derrière
        </button>
        <button type="button" aria-label="Supprimer le texte" onClick={onRemove} className="ml-auto flex size-10 items-center justify-center rounded-full text-danger">
          <TrashIcon size={17} />
        </button>
      </div>
    </div>
  );
}
