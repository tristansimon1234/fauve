"use client";

import { useEffect, useRef, useState } from "react";

// Writing a text right where it is on the preview: a small field laid over the
// text, live (every key redraws the slide), Enter to finish, Escape to undo.

export type FrameBox = { left: number; top: number; width: number; height: number };

export function InlineEdit({
  box,
  value,
  multiline = false,
  maxLength = 400,
  onChange,
  onDone,
}: {
  /** Where the text is, as shares of the preview. */
  box: FrameBox;
  value: string;
  multiline?: boolean;
  maxLength?: number;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [initial] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  // Grows with the text.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const width = Math.max(box.width, 0.6);
  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, 0.02), 0.98 - width);
  return (
    <div data-fauve-overlay="" className="absolute z-30" style={{ left: `${left * 100}%`, top: `${box.top * 100}%`, width: `${width * 100}%` }}>
      <textarea
        ref={ref}
        value={value}
        maxLength={maxLength}
        rows={1}
        aria-label="Texte"
        onChange={(e) => onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
        onBlur={onDone}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onChange(initial);
            onDone();
          } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onDone();
          }
        }}
        className="block w-full resize-none overflow-hidden rounded-[10px] border-0 bg-white/95 px-3 py-2 text-[15px] leading-snug text-ink shadow-[0_8px_28px_rgba(0,0,0,.35)] outline-none ring-2 ring-violet"
      />
      <span className="mt-1 block text-center text-[11px] font-semibold text-white drop-shadow">
        {multiline ? "Une ligne par élément · ⌘ Entrée pour finir" : "Entrée pour finir · Échap pour annuler"}
      </span>
    </div>
  );
}
