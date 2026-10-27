// Where each text of a composed carousel sits on its slide, so that a tap on the image edits it.
// The slide is drawn by Edith's code, which never says where it put a text: the editor reads
// the lines the browser drew (their words and boxes) and finds the slot each belongs to by its
// words. A line, a word set apart for its colour, a text in capitals all belong to the slot whose
// words hold them; a short word several slots could hold joins the one drawn nearest to it.

/** A line or a piece of text the browser drew, in px of the preview. */
export type TextRun = { text: string; left: number; top: number; right: number; bottom: number };
export type SpotBox = { left: number; top: number; right: number; bottom: number };

/** Words as they compare: whatever their case, their kind of space or apostrophe, single spaces. */
export function plainWords(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[­​-‍⁠﻿]/g, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const union = (a: SpotBox, b: SpotBox): SpotBox => ({
  left: Math.min(a.left, b.left),
  top: Math.min(a.top, b.top),
  right: Math.max(a.right, b.right),
  bottom: Math.max(a.bottom, b.bottom),
});

/** The gap between two boxes (0 when they touch or overlap). */
function gap(a: SpotBox, b: SpotBox): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy);
}

/**
 * The box of each slot on a slide, from the runs the browser drew there. `slots` are the ones the
 * slide can show (its own and those on every slide); a slot whose words were not found has no box.
 */
export function slotBoxes(runs: TextRun[], texts: Record<string, string>, slots: string[]): Record<string, SpotBox> {
  const wanted = slots.map((name) => ({ name, words: plainWords(texts[name] ?? "") })).filter((s) => s.words);
  const boxes: Record<string, SpotBox> = {};
  const grow = (name: string, run: SpotBox) => {
    boxes[name] = boxes[name] ? union(boxes[name]!, run) : { left: run.left, top: run.top, right: run.right, bottom: run.bottom };
  };
  const unsure: { run: TextRun; names: string[] }[] = [];
  for (const run of runs) {
    const words = plainWords(run.text);
    if (!/[\p{L}\p{N}]/u.test(words)) continue;
    const holders = wanted.filter((s) => s.words.includes(words));
    if (!holders.length) {
      // A line that draws a slot with a little more (its number, a dash): the longest slot it holds.
      const held = wanted.filter((s) => words.includes(s.words)).sort((a, b) => b.words.length - a.words.length)[0];
      if (held && held.words.length >= words.length / 2) grow(held.name, run);
      continue;
    }
    const exact = holders.filter((s) => s.words === words);
    const sure = exact.length === 1 ? exact[0] : holders.length === 1 ? holders[0] : undefined;
    if (sure) grow(sure.name, run);
    else unsure.push({ run, names: holders.map((h) => h.name) });
  }
  for (const { run, names } of unsure) {
    const placed = names.filter((name) => boxes[name]).sort((a, b) => gap(boxes[a]!, run) - gap(boxes[b]!, run));
    const nearest = placed[0];
    if (nearest && gap(boxes[nearest]!, run) <= 1.5 * (run.bottom - run.top)) grow(nearest, run);
  }
  return boxes;
}
