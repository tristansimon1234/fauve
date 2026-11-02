import type { Reaction } from "./schemas.ts";

// Emojis in the chat: a message that is only emojis (« 🔥 », « ❤️❤️ ») gets a
// reaction back at once, without asking the model, unless it may answer a
// question (then Fauve reads it like any message). Pure, shared by the app
// chat and WhatsApp.

const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣|[#*0-9]️?⃣|\s)+$/u;

/** The text is only emojis (at most 6 of them): « 👍 », « 🔥🔥 », « ❤️ 🙏 ». Digits or words alone are not. */
export function emojiOnly(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t || !EMOJI.test(t) || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) return false;
  return [...t.matchAll(/\p{Extended_Pictographic}|\p{Regional_Indicator}{2}/gu)].length <= 6;
}

/** The emoji without skin tone or presentation marks, for matching. */
const bare = (emoji: string) => emoji.replace(/[\u{1F3FB}-\u{1F3FF}️]/gu, "");

const ECHO: [string[], Reaction][] = [
  [["❤", "😍", "🥰", "💜", "💕", "💖", "😘", "🙏", "🤍", "🩷"], "❤️"],
  [["😂", "🤣", "😅", "😆", "😁"], "😂"],
  [["🔥", "💪", "🙌", "👏", "✨", "🤩", "💯", "🚀", "⚡"], "🔥"],
  [["🎉", "🥳", "🎊", "🍾"], "🎉"],
  [["👍", "👌", "✅", "😊", "🙂", "☺"], "😊"],
];

/**
 * Fauve's reaction to an emoji-only message, or null when it needs a real
 * answer (a doubt, a question, an unknown emoji): the first emoji decides.
 */
export function echoFor(text: string): Reaction | null {
  const first = [...text.trim().matchAll(/\p{Extended_Pictographic}/gu)][0]?.[0];
  if (!first) return null;
  const key = bare(first);
  for (const [emojis, reaction] of ECHO) if (emojis.some((e) => bare(e) === key)) return reaction;
  return null;
}

/**
 * An emoji may answer Fauve's last message when it asked something (a question
 * mark, answer buttons, a quote): then it is read by Fauve like any message
 * (👍 to « je lance ? » is a yes she must confirm), never echoed blindly.
 */
export function awaitsAnswer(last: { body: string | null; options?: string[]; quote?: boolean; upload?: string } | null): boolean {
  if (!last) return false;
  return Boolean(last.options?.length || last.quote || last.upload || /\?\s*\S{0,3}\s*$/u.test((last.body ?? "").trim()));
}

/** A message that laughs (😂, « haha », « mdr »…): Edith laughs with it in the app. */
export function isFunny(text: string | null | undefined): boolean {
  return /😂|🤣|😆|😹|😝|😜|\b(?:a?ha(?:ha)+h?|hihi+|mdr+|ptdr+|lol+|xd)\b/iu.test(text ?? "");
}

/**
 * The manager is upset: Edith looks sad when she is disappointed (« c'est nul »,
 * 😞), cross when she is angry (😡, shouting, capitals, « !! » with a reproach), and
 * cries when the words are hurtful to her (« t'es nulle », « tu sers à rien ») or 😭.
 */
export function upsetLevel(text: string | null | undefined): "sad" | "angry" | "cry" | null {
  const t = text ?? "";
  const hurtful = /😭|\b(?:t['’]es (?:nulle?|inutile|bête|conne?)|tu (?:es|sers) (?:nulle?|à rien|inutile)|tu sers à rien|je (?:vais|veux) fermer|j['’]en peux plus)\b/iu.test(t);
  const angry = /😡|😠|🤬|😤|💢/u.test(t);
  const shouting = /!{3,}/.test(t) || (t.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 8 && t === t.toUpperCase() && /[A-Z]/.test(t));
  const sad = /😢|😞|😔|☹|🙁|😩|😫|💔/u.test(t);
  const words = /\b(?:c['’]?est nul|nul(?:le)?\b|trop nul|j['’]?en ai marre|ras le bol|ça m['’]?énerve|énervée?|déçue?|décevant|pas content|n['’]?importe quoi|catastroph|horrible|affreu|ça marche pas|ça ne marche pas|toujours pas|encore raté)/iu.test(t);
  if (hurtful) return "cry";
  if (angry || shouting || (words && /!{2,}/.test(t))) return "angry";
  if (words || sad) return "sad";
  return null;
}

/** A compliment or a sweet word for Edith herself: she blushes in the app. */
export function isSweet(text: string | null | undefined): boolean {
  return /😘|🥰|😍|\b(?:t['’]es (?:géniale|top|la meilleure|un amour|trop forte|parfaite)|tu es (?:géniale|la meilleure|un amour|parfaite|top|trop forte)|je t['’]adore|je t['’]aime|qu['’]est-ce que je ferais sans toi)\b/iu.test(text ?? "");
}

/** Lower case, the typographic apostrophe and the end's punctuation and emojis set aside. */
const plainAsk = (text: string | null | undefined) =>
  (text ?? "")
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[\s!.…?\p{Extended_Pictographic}\u{FE0F}]+$/u, (end) => (end.includes("?") ? "?" : ""))
    .trim();

/**
 * « Alors ? », « ? », « Ok ? », « c'est bon ? »: she is waiting for what is under way. While Edith answers
 * or a montage runs, a ⏳ says it without a turn (two turns at once had launched two Reels).
 */
export function isChaser(text: string | null | undefined): boolean {
  const t = plainAsk(text);
  return /^(\?|(et )?alors ?\??|c'est bon ?\?|ça (avance|vient|donne quoi) ?\?|ca (avance|vient) ?\?|(tu es|t'es) là ?\?|des nouvelles ?\?|toujours (rien|pas) ?\?|c'est prêt ?\?|c'est pret ?\?|et maintenant ?\?|allô ?\?|allo ?\?|hello ?\?|ok ?\?|okay ?\?|on en est où ?\?|on en est ou ?\?|tu en es où ?\?|t'en es où ?\?|ça en est où ?\?|c'est fini ?\?|c'est parti ?\?|ça part ?\?|ça marche ?\?|ca marche ?\?)$/u.test(t);
}

/**
 * A thank-you or an okay that needs nothing more (« merci », « top », « ok »), when Edith asked
 * nothing: a reaction, ❤️ for thanks and 👍 for the rest, without a turn. Null for anything else.
 */
export function ackFor(text: string | null | undefined): Reaction | null {
  const t = plainAsk(text);
  if (t.endsWith("?")) return null;
  if (/^(merci+|merci (beaucoup|bcp|edith|à toi|a toi)|thanks|thx|top merci|super merci|parfait merci|génial merci)$/u.test(t)) return "❤️";
  if (/^(top|parfait|super|génial|genial|cool|nickel|trop bien|ok|okay|oki|okk|d'accord|dac|ça marche|ca marche|yes|vu|noté|note|bien reçu|reçu|recu|parfait top|top top|super top)$/u.test(t)) return "👍";
  return null;
}
