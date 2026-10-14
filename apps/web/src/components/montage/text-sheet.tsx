"use client";

import type { Bullet, ListItem, SavedLook, TextLook } from "@fauve/agent";
import { ListItems } from "./list-items";
import { TrashIcon, XIcon } from "@/components/icons";
import { StylePicker } from "./style-picker";

// The selected text of a montage or a carousel slide: its words, a style in one tap
// and its size, big enough for a thumb (mobile page). It is placed by dragging it.

export type SheetText = {
  text: string;
  style: "hook" | "band" | "caption";
  y?: number;
  scale?: number;
  backdrop?: boolean;
  look?: TextLook;
  items?: ListItem[];
  detail_look?: TextLook;
  bullet?: Bullet;
};

const round = (n: number) => Math.round(n * 10) / 10;

/** The selected text: its words, style, size and background, big enough for a thumb. */
export function TextSheet<T extends SheetText>({
  text,
  onChange,
  onRemove,
  onClose,
  looks,
}: {
  text: T;
  onChange: (patch: Partial<SheetText>) => void;
  onRemove: () => void;
  onClose: () => void;
  /** With the studio's colours and fonts: the look controls (fonts, colours, fill…) and its saved looks. */
  looks?: { saved: SavedLook[]; brand: { accent: string; accentInk: string; displayFont: string; bodyFont: string } };
  /** A video (entrances matter) or a photo: kept for the callers, the style tiles are the same. */
  video?: boolean;
}) {
  const scale = text.scale ?? 1;
  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-white p-3.5 text-ink">
      <div className="flex items-center gap-2">
        {text.items ? (
          <span className="min-w-0 flex-1 text-[14px] font-bold">Liste · {text.items.length} élément{text.items.length > 1 ? "s" : ""}</span>
        ) : (
        <input
          value={text.text}
          onChange={(e) => onChange({ text: e.target.value })}
          maxLength={120}
          aria-label="Texte"
          className="min-w-0 flex-1 rounded-[12px] border border-line px-3 py-2.5 text-[16px] outline-none focus:border-violet"
        />
        )}
        <button type="button" aria-label="Fermer" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
          <XIcon size={16} />
        </button>
      </div>
      {text.items && <ListItems items={text.items} bullet={text.bullet} onChange={(patch) => onChange({ ...patch, ...(patch.items ? { text: patch.items[0]?.title ?? text.text } : {}) })} />}
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
        <button type="button" aria-label="Supprimer le texte" onClick={onRemove} className="ml-auto flex size-10 items-center justify-center rounded-full text-danger">
          <TrashIcon size={17} />
        </button>
      </div>
      {looks && <StylePicker role={text.style} look={text.look} saved={looks.saved} brand={looks.brand} sample={text.text} onChange={(look) => onChange({ look })} />}
      <p className="text-[12px] text-muted">Pour le placer, fais-le glisser du doigt. Pour le reste, demande à Brigitte.</p>
    </div>
  );
}
