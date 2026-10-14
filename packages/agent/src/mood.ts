// Brigitte's instant reaction to a message from the manager, decided by Jev
// (TypeSafe's System One decision model: typed answers among fixed options, in a
// fraction of a second) while the chat model is still writing: her face in the
// app, and an emoji on the manager's message when one fits.

/** Brigitte's faces (components/mascot.tsx), the ones a message can trigger. */
export const REACTION_MOODS = ["laugh", "happy", "shy", "surprised", "sad", "angry", "cry", "neutral"] as const;
export type ReactionMood = (typeof REACTION_MOODS)[number];

/** What each face means, as Jev reads it (in English; the messages themselves are in French). */
export const MOOD_CRITERIA: Record<ReactionMood, string> = {
  laugh:
    "The message is funny or playful and Brigitte would laugh: a joke, a pun, irony or self-mockery, teasing Brigitte, an absurd or comic situation, or laughter markers such as « mdr », « ptdr », « haha », « lol », « 😂 », « 🤣 ». Also when the manager laughs at a joke Brigitte just made. Not for polite friendliness alone, and never when the joke is bitter or sarcastic about Brigitte's work.",
  happy:
    "The manager is pleased, grateful or enthusiastic: she thanks Brigitte, approves a draft (« super », « parfait », « j'adore », « top », « génial »), shares good news about her business (a full class, a good month, a new client), or answers warmly with positive emojis (🙌, ✨, 👏). The default face for a friendly, positive message that is not funny and not a personal compliment to Brigitte.",
  shy:
    "The manager pays Brigitte a personal compliment or a sweet word aimed at her, not at the work: « tu es géniale », « t'es la meilleure », « je t'adore », « qu'est-ce que je ferais sans toi », « tu es un amour », a kiss or hearts sent to her (😘, 🥰, 😍, ❤️). Brigitte blushes with a shy smile. Not for a plain « merci » or for approving a draft (that is happy).",
  surprised:
    "The manager shares something unexpected, impressive or out of the ordinary: a record, a big number, a sudden change of plans, an unusual request, or she is amazed herself (« waouh », « sérieux ? », « incroyable », « 😮 », « 😱 »). Also a surprising question that Brigitte would not expect. Not for a routine piece of information.",
  sad:
    "The manager is disappointed, sad, tired or discouraged, without being angry: the result does not please her (« bof », « pas fan », « ça ne me ressemble pas », « dommage »), bad news (an empty class, a cancellation, a bad week), lack of time or energy (« je suis épuisée », « je n'ai rien filmé »), or doubts about her business. Gentle and low, not aggressive.",
  angry:
    "The manager is annoyed or angry, usually about the result, a bug or a delay: reproaches (« c'est nul », « n'importe quoi », « ça ne marche pas », « encore raté », « j'en ai marre », « ça m'énerve »), shouting in capital letters, several exclamation marks (« !!! »), angry emojis (😡, 🤬, 😤, 💢), or the same complaint repeated. Brigitte frowns, a little vexed, but stays on her side and wants to fix it.",
  cry:
    "The manager is deeply hurt or desperate, or harsh and hurtful to Brigitte herself: insults or cruel words aimed at her (« t'es nulle », « tu sers à rien », « t'es inutile »), despair (« je vais fermer », « je n'en peux plus », « tout s'écroule »), crying emojis (😭) or a big personal blow. Stronger than sad and than angry: Brigitte is in tears.",
  neutral:
    "A plain, matter-of-fact message with no particular emotion: a question, an instruction, a piece of information (a date, a link, a website, a number of posts per week), a request for work (« fais-moi un Reel », « change le texte »), or a short answer to Brigitte's question. The most common case; choose it whenever no other face clearly fits.",
};

/** Emojis Brigitte may put on the manager's message; « none » most of the time. */
export const REACTION_EMOJIS = ["none", "❤️", "😂", "🔥", "👍", "🙏", "🥰", "😮"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const EMOJI_CRITERIA: Record<ReactionEmoji, string> = {
  none:
    "No reaction. The most frequent answer by far: a question, a request for work, an instruction, an information (link, date, number), a long message, a neutral or upset message, or anything Brigitte will answer in words anyway. When in doubt, choose none.",
  "❤️": "A warm, affectionate or heartfelt message: a sincere compliment to Brigitte (« tu es géniale », « merci pour tout »), a love note about her own business or clients, or a message full of hearts.",
  "😂": "A real joke or a clearly funny message, that would make a friend laugh out loud. Not for a light « haha » in an otherwise serious message.",
  "🔥": "The manager shares something great: a strong photo or video, a big success, an impressive number (bookings, views, followers), an exciting new idea or launch.",
  "👍": "A short agreement or acknowledgement that needs nothing more than a nod: « ok », « ça marche », « vas-y », « d'accord », « parfait », « c'est noté ». Only when the message is just that.",
  "🙏": "A thank-you that stands on its own: « merci », « merci beaucoup », « merci Brigitte ».",
  "🥰": "A tender or touching message: a sweet story about a client or a student, a kind word about her team, something that moves her.",
  "😮": "Surprising or impressive news that leaves Brigitte amazed: an unexpected event, a record, a big change.",
};

/** The two questions, asked in one request. */
export const MOOD_INSTRUCTIONS =
  "A message (in French) from the manager of a local business (a Pilates or yoga studio, a hair salon, a restaurant, a shop…) to Brigitte, her AI community manager: warm, frank, with an expert eye and a touch of mischief. The previous message from Brigitte is given for context (a « haha » may answer her joke, a « bof » may judge her work). Which face does Brigitte make as she reads the manager's message? Judge the manager's emotion in this message only.";
export const EMOJI_INSTRUCTIONS =
  "Brigitte may react to the manager's message with one emoji, as on WhatsApp, but only when it feels natural, like a friend would: rarely, never on a question, a request for work or an upset message, since she answers those in words. Which emoji, if any?";

/** Below this confidence the answer is a guess: no emoji, a neutral face. */
export const MIN_CONFIDENCE = 0.55;

export type MoodAnswer = { choice: string; confidence: number };

/** Brigitte's face from Jev's answer: neutral when unsure or unknown. */
export function moodOf(answer: MoodAnswer | null | undefined): ReactionMood {
  if (!answer || answer.confidence < MIN_CONFIDENCE) return "neutral";
  return (REACTION_MOODS as readonly string[]).includes(answer.choice) ? (answer.choice as ReactionMood) : "neutral";
}

/** The emoji to put on her message, or null (unsure, « none », or the manager is upset). */
export function emojiOf(answer: MoodAnswer | null | undefined, mood: ReactionMood): string | null {
  if (!answer || answer.confidence < MIN_CONFIDENCE || answer.choice === "none") return null;
  if (mood === "sad" || mood === "cry" || mood === "angry") return null;
  return (REACTION_EMOJIS as readonly string[]).includes(answer.choice) ? answer.choice : null;
}
