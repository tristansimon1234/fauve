// One reply per turn, even when the model writes across several tool steps:
// it sometimes says something, calls a tool (buttons, a quote), then says it
// again in other words. A paragraph that a later one repeats goes, the later
// (often more complete) one stays.

const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1),
  );

/** Share of the shorter paragraph's words found in the other one. */
function overlap(a: Set<string>, b: Set<string>): number {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  if (small.size < 3) return 0;
  let shared = 0;
  for (const w of small) if (big.has(w)) shared++;
  return shared / small.size;
}

/** A paragraph this close to another says the same thing. */
const SAME = 0.8;

/** The steps' texts as one reply, without the paragraphs said twice (the last wording kept, in its place). */
export function mergeReplySteps(steps: string[]): string {
  const kept: { text: string; words: Set<string> }[] = [];
  for (const step of steps) {
    for (const text of step.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
      const own = words(text);
      for (let i = kept.length - 1; i >= 0; i--) {
        if (kept[i]!.text === text || overlap(kept[i]!.words, own) >= SAME) kept.splice(i, 1);
      }
      kept.push({ text, words: own });
    }
  }
  return kept.map((p) => p.text).join("\n\n");
}
