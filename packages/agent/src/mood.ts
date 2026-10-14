// Brigitte's instant reaction to a message from the manager, decided by Jev
// (TypeSafe's System One decision model: typed answers among fixed options, in a
// fraction of a second) while the chat model is still writing: her face in the
// app, and an emoji on the manager's message when one fits.

/** Brigitte's faces (components/mascot.tsx), the ones a message can trigger. */
export const REACTION_MOODS = ["laugh", "happy", "surprised", "sad", "cry", "neutral"] as const;
export type ReactionMood = (typeof REACTION_MOODS)[number];

/** What each face means, as Jev reads it. */
export const MOOD_CRITERIA: Record<ReactionMood, string> = {
  laugh: "Le message est drôle : une blague, de l'humour, du second degré, une taquinerie, « mdr », « haha », 😂.",
  happy: "La gérante est contente ou enthousiaste : elle remercie, félicite, valide, partage une bonne nouvelle ou un compliment.",
  surprised: "La gérante annonce quelque chose d'inattendu ou d'impressionnant (un record, une grosse nouvelle), ou s'étonne.",
  sad: "La gérante est déçue, triste ou découragée : le résultat ne lui plaît pas, une mauvaise nouvelle, de la lassitude.",
  cry: "La gérante est énervée ou en colère : reproches, frustration forte, « c'est nul », insultes, majuscules, « !!! ».",
  neutral: "Un message neutre : une question, une information, une consigne, une demande de travail.",
};

/** Emojis Brigitte may put on the manager's message; « none » most of the time. */
export const REACTION_EMOJIS = ["none", "❤️", "😂", "🔥", "👍", "🙏", "🥰", "😮"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const EMOJI_CRITERIA: Record<ReactionEmoji, string> = {
  none: "Aucune réaction : une question, une demande, une consigne, une info, un message neutre ou fâché. C'est le cas le plus fréquent.",
  "❤️": "Un message chaleureux ou affectueux, un compliment sincère adressé à Brigitte.",
  "😂": "Une vraie blague ou un message franchement drôle.",
  "🔥": "La gérante partage un super contenu, une réussite, un chiffre impressionnant, une idée enthousiasmante.",
  "👍": "Un simple accord ou un accusé de réception : « ok », « ça marche », « parfait », « vas-y ».",
  "🙏": "Un remerciement.",
  "🥰": "Un message tendre ou attendrissant (un élève fidèle, une jolie histoire).",
  "😮": "Une nouvelle surprenante ou impressionnante.",
};

/** The two questions, asked in one request. */
export const MOOD_INSTRUCTIONS =
  "Message de la gérante d'un commerce à Brigitte, sa community manager (une IA chaleureuse et un brin malicieuse). Quelle tête fait Brigitte en le lisant ?";
export const EMOJI_INSTRUCTIONS =
  "Brigitte peut réagir par un emoji au message de la gérante, comme sur WhatsApp, mais seulement quand c'est naturel : jamais sur une question ni une demande de travail. Lequel ?";

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
  if (mood === "sad" || mood === "cry") return null;
  return (REACTION_EMOJIS as readonly string[]).includes(answer.choice) ? answer.choice : null;
}
