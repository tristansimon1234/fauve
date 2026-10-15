// Captions as they go out. Instagram caps hashtags at 5 per post or Reel (since
// December 2025, caption and first comment together): the ones written in the
// caption count first, then the post's own, the rest are dropped. And the marks
// that make a caption read as written by an AI are taken out: invisible
// characters, non-breaking spaces, long dashes. (Ideas from the MIT
// instagram-agent-skill humanizer, adapted to French.)

export const MAX_HASHTAGS = 5;

// Zero-width spaces and joiners, word joiner, soft hyphen, byte-order mark,
// invisible operators, Unicode tag characters.
const INVISIBLE = /[​-‍⁠­﻿⁡-⁤\u{E0000}-\u{E007F}]/gu;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

/** Takes out the marks of machine writing, keeps the words, the emojis and French typography (« », ’, …). */
export function cleanCaption(text: string): string {
  return (
    text
      .replace(INVISIBLE, "")
      // Non-breaking and narrow spaces become plain spaces (French « » and ; ! ? keep their space).
      .replace(/[   ]/g, " ")
      // A range keeps a plain hyphen: 10–12 h → 10-12 h.
      .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
      // A long dash mid-sentence becomes a comma; at the start of a line, nothing.
      .replace(/^[ \t]*[—–][ \t]*/gm, "")
      .replace(/[ \t]*[—–][ \t]*/g, ", ")
      .replace(/,\s*([,.!?;:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+$/gm, "")
      .trim()
  );
}

/** At most `MAX_HASHTAGS` hashtags in a caption: the first ones written stay, the later ones are removed. */
function capInlineHashtags(text: string): { text: string; count: number; seen: Set<string> } {
  let count = 0;
  const seen = new Set<string>();
  const capped = text.replace(HASHTAG, (tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key) || count >= MAX_HASHTAGS) return "";
    seen.add(key);
    count++;
    return tag;
  });
  return { text: capped.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/gm, "").trim(), count, seen };
}

/** The caption to publish: cleaned, then its hashtags and the post's own, 5 at most in all. */
export function captionForInstagram(caption: string | null | undefined, hashtags: readonly string[] | null | undefined = []): string {
  const inline = capInlineHashtags(cleanCaption(caption ?? ""));
  const room = MAX_HASHTAGS - inline.count;
  const extra: string[] = [];
  for (const raw of hashtags ?? []) {
    if (extra.length >= room) break;
    const tag = `#${raw.replace(/^#+/, "").trim()}`;
    if (tag.length < 2 || inline.seen.has(tag.toLowerCase()) || extra.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
    extra.push(tag);
  }
  return [inline.text, extra.join(" ")].filter(Boolean).join("\n\n");
}

/** TikTok's caption limit (hashtags included; no cap on their number). */
export const TIKTOK_CAPTION_MAX = 2200;

/** The caption for TikTok: cleaned, then the post's hashtags not already written, cut at TikTok's limit. */
export function captionForTikTok(caption: string | null | undefined, hashtags: readonly string[] | null | undefined = []): string {
  const text = cleanCaption(caption ?? "");
  const seen = new Set((text.match(HASHTAG) ?? []).map((t) => t.toLowerCase()));
  const extra: string[] = [];
  for (const raw of hashtags ?? []) {
    const tag = `#${raw.replace(/^#+/, "").trim()}`;
    if (tag.length < 2 || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    extra.push(tag);
  }
  const full = [text, extra.join(" ")].filter(Boolean).join("\n\n");
  return full.length <= TIKTOK_CAPTION_MAX ? full : `${full.slice(0, TIKTOK_CAPTION_MAX - 1).trimEnd()}…`;
}
