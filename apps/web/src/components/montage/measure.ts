import type { FrameBox } from "./inline-edit";

// Finding texts on the live preview (it is real DOM): where a slot's words are
// drawn, as shares of the preview. Shared by the layout and component handles.

export const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/** What a slot shows first: its first line, before a « | » detail. */
export const firstWords = (value: string) => norm((value.split("\n").find((l) => l.trim()) ?? "").split("|")[0] ?? "");

export function union(rects: DOMRect[], base: DOMRect): FrameBox | null {
  const real = rects.filter((r) => r.width > 1 && r.height > 1);
  if (!real.length) return null;
  const left = Math.min(...real.map((r) => r.left));
  const top = Math.min(...real.map((r) => r.top));
  const right = Math.max(...real.map((r) => r.right));
  const bottom = Math.max(...real.map((r) => r.bottom));
  return { left: (left - base.left) / base.width, top: (top - base.top) / base.height, width: (right - left) / base.width, height: (bottom - top) / base.height };
}

/** The deepest elements whose text is (or starts with) these words. */
export function elementsFor(root: Element, words: string): Element[] {
  if (!words) return [];
  const all = [...root.querySelectorAll("*")].filter((el) => !el.closest("[data-fauve-overlay]"));
  for (const match of [(t: string) => t === words, (t: string) => t.startsWith(words)]) {
    const hits = all.filter((el) => match(norm(el.textContent ?? "")));
    const deepest = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
    if (deepest.length) return deepest;
  }
  return [];
}

/** Where each slot's text is drawn inside `drawn`. */
export function slotBoxes(drawn: Element, base: DOMRect, slots: { name: string; multiline: boolean }[], texts: Record<string, string>): Record<string, FrameBox> {
  const boxes: Record<string, FrameBox> = {};
  for (const slot of slots) {
    const value = texts[slot.name] ?? "";
    const lines = slot.multiline ? value.split("\n").filter((l) => l.trim()) : [value];
    const els = lines.flatMap((line) => elementsFor(drawn, firstWords(line)));
    const box = union(
      els.map((el) => el.getBoundingClientRect()),
      base,
    );
    if (box) boxes[slot.name] = box;
  }
  return boxes;
}
