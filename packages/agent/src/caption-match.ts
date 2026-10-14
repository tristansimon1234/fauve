// « Je publie moi-même » : the Reel she published is recognised by its caption,
// even when she changed a few words, added emojis or hashtags.

const words = (text: string | null | undefined) =>
  (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 2);

/** Share of the post's caption words (the first 30) found in the published caption, 0 to 1. */
export function captionMatch(ours: string | null | undefined, theirs: string | null | undefined): number {
  const a = words(ours).slice(0, 30);
  if (!a.length) return 0;
  const b = new Set(words(theirs));
  return a.filter((w) => b.has(w)).length / a.length;
}
