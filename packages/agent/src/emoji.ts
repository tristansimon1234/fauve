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

/** A message that laughs (😂, « haha », « mdr »…): Brigitte laughs with it in the app. */
export function isFunny(text: string | null | undefined): boolean {
  return /😂|🤣|😆|😹|😝|😜|\b(?:a?ha(?:ha)+h?|hihi+|mdr+|ptdr+|lol+|xd)\b/iu.test(text ?? "");
}

/**
 * The manager is upset: Brigitte looks sad when she is disappointed (« c'est nul »,
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

/** A compliment or a sweet word for Brigitte herself: she blushes in the app. */
export function isSweet(text: string | null | undefined): boolean {
  return /😘|🥰|😍|\b(?:t['’]es (?:géniale|top|la meilleure|un amour|trop forte|parfaite)|tu es (?:géniale|la meilleure|un amour|parfaite|top|trop forte)|je t['’]adore|je t['’]aime|qu['’]est-ce que je ferais sans toi)\b/iu.test(text ?? "");
}
