import { z } from "zod";

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

/** How a caption is written: Edith in the chat and the caption writer of a Reel made from « Créer » follow the same rules. */
export const CAPTION_RULES = `- short and airy: a hook (80 characters at most), one or two useful lines, a concrete call to action (book through the link in bio, make an appointment, drop by on Saturday); 300 characters at most, hashtags aside;
- easy to find: her trade, her neighbourhood and her city written out in full when you know them (« coiffeuse à la Croix-Rousse, Lyon »): Instagram and TikTok read the caption to show the post to people nearby;
- worth sending: a reason to share it or save it (a tip to keep, « à envoyer à celle qui… », a question people answer in the comments), without forcing it;
- 3 to 5 relevant hashtags, 5 at most in all (Instagram's limit; those written in the caption count); never a wall of hashtags;
- written in French as the manager would write it, not as an AI would: never an em dash (—), no stock phrases (« n'hésitez pas », « plongez dans », « véritable », « incontournable », « sublimer », « dans un monde où », « que vous soyez… ou… », three adjectives in a row), not an emoji at the start of every line; concrete words of her business (a price, an opening time, a name, a gesture);
- emojis sparingly, as her style profile says.`;

// A Reel launched from « Créer » has no chat turn to write its caption: it is written at delivery,
// when the post has none (her own caption, or Edith's from the chat, always stays).
export const CAPTION_WRITER_PROMPT = `You write, in French, the Instagram and TikTok caption of a post for a neighbourhood business, as the person who runs it would write it themselves. You get the business (name, trade, what we know about it, its tone), what she asked for this post and what the video says (its on-screen texts, its voice-over).

${CAPTION_RULES}

What you don't know (her neighbourhood, a price, an opening time), you never make up: you do without it. Words she wrote for the caption in her request, you keep. The caption does not repeat the video's text word for word. Answer with the caption without its hashtags, and its hashtags apart, without the #.`;

export const captionDraftSchema = z.object({
  caption: z.string().max(700).describe("La légende, sans les hashtags"),
  hashtags: z.array(z.string().max(40)).max(MAX_HASHTAGS).describe("3 à 5 hashtags, sans le #"),
});
export type CaptionDraft = z.infer<typeof captionDraftSchema>;

/** A written caption as it is kept on the post: cleaned, no hashtags in the text beyond the cap, tags without # nor duplicates. */
export function keptCaption(draft: CaptionDraft): { caption: string; hashtags: string[] } | null {
  const caption = capInlineHashtags(cleanCaption(draft.caption)).text;
  if (!caption) return null;
  const inline = new Set((caption.match(HASHTAG) ?? []).map((t) => t.slice(1).toLowerCase()));
  const hashtags: string[] = [];
  for (const raw of draft.hashtags) {
    const tag = raw.replace(/^#+/, "").replace(/\s+/g, "").trim();
    if (!tag || inline.has(tag.toLowerCase()) || hashtags.some((h) => h.toLowerCase() === tag.toLowerCase())) continue;
    hashtags.push(tag);
  }
  return { caption, hashtags: hashtags.slice(0, Math.max(0, MAX_HASHTAGS - inline.size)) };
}
