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

/** How a caption is written: Simone in the chat and the caption writer of a Reel made from « Créer » follow the same rules. */
export const CAPTION_RULES = `- courtes et aérées : une accroche (80 caractères au maximum), une ou deux lignes utiles, un appel à l'action concret (réserver par le lien en bio, prendre rendez-vous, passer samedi) ; 300 caractères au maximum hors hashtags ;
- qu'on la trouve : son métier, son quartier et sa ville écrits en toutes lettres quand tu les connais (« coiffeuse à la Croix-Rousse, Lyon ») : Instagram et TikTok lisent la légende pour proposer le post aux gens d'à côté ;
- qu'on l'envoie : une raison de la partager ou de l'enregistrer (un conseil à garder, « à envoyer à celle qui… », une question à laquelle on répond en commentaire), sans forcer ;
- 3 à 5 hashtags pertinents, 5 au plus en tout (limite d'Instagram, ceux écrits dans la légende comptent) ; jamais un mur de hashtags ;
- écrites comme par la gérante, pas comme par une IA : jamais de tiret long (—), pas de formules toutes faites (« n'hésitez pas », « plongez dans », « véritable », « incontournable », « sublimer », « dans un monde où », « que vous soyez… ou… », trois adjectifs à la suite), pas un emoji au début de chaque ligne ; des mots concrets de son commerce (un prix, un horaire, un nom, un geste) ;
- emojis avec parcimonie, selon le profil de style.`;

// A Reel launched from « Créer » has no chat turn to write its caption: it is written at delivery,
// when the post has none (her own caption, or Simone's from the chat, always stays).
export const CAPTION_WRITER_PROMPT = `Tu écris la légende Instagram et TikTok d'une publication d'un commerce de quartier, comme la personne qui le gère l'écrirait elle-même. Tu reçois le commerce (nom, activité, ce qu'on sait de lui, son ton), ce qu'elle a demandé pour cette publication et ce que dit la vidéo (ses textes à l'écran, sa voix off).

${CAPTION_RULES}

Ce que tu ne sais pas (son quartier, un prix, un horaire), tu ne l'inventes jamais : tu t'en passes. Des mots qu'elle a écrits pour la légende dans sa demande, tu les reprends. La légende ne répète pas mot pour mot le texte de la vidéo. Réponds avec la légende sans ses hashtags, et ses hashtags à part, sans le #.`;

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
