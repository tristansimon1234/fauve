// Getting a new business ready, in this order: its website (Fauve learns the
// business), its style (colours, fonts, logo, moodboard), its rhythm (how many
// posts a week: what Fauve plans the week with), its first publication, then
// Instagram, last, once there is something to publish. On a computer it happens in the app (cards and chat), on a phone
// on WhatsApp; the same step is kept for both.

export const ONBOARDING_STEPS = ["website", "style", "rhythm", "first_post", "connect", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The steps the manager sees (done is not one). */
export const ONBOARDING_LABELS: Record<Exclude<OnboardingStep, "done">, string> = {
  website: "Ton commerce",
  style: "Ton style",
  rhythm: "Ton rythme",
  first_post: "Première publication",
  connect: "Instagram",
};

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
  return ONBOARDING_STEPS[Math.min(ONBOARDING_STEPS.indexOf(step) + 1, ONBOARDING_STEPS.length - 1)]!;
}

/** Old values (before the website-first order) read as their new step. */
export function onboardingStepOf(value: unknown): OnboardingStep {
  if (value === "studio_name") return "website";
  if (value === "examples") return "style";
  return (ONBOARDING_STEPS as readonly unknown[]).includes(value) ? (value as OnboardingStep) : "website";
}

/**
 * Her very first message on WhatsApp, written once for everyone rather than by the model
 * (Tristan: « comment on pourrait apporter de la clarté à l'onboarding sur WhatsApp, je pense aux
 * capacités ») : who Edith is, what he does, how to talk to him, and how to start, with what
 * she has: her site or her Instagram, else her logo, photos or Reels she likes.
 */
export const WHATSAPP_WELCOME = [
  "Bonjour ! Moi c’est Edith, ton community manager IA ✨",
  [
    "🎬 Je monte tes Reels avec tes vidéos, avec une voix off si tu veux",
    "🖼️ Je compose tes carrousels avec tes photos",
    "✍️ J’écris tes légendes",
    "📲 Je publie sur Instagram et TikTok quand tu me dis oui",
  ].join("\n"),
  "Écris-moi ou envoie-moi des notes vocales, comme à quelqu’un de ton équipe.",
  "On commence ? Envoie-moi le lien de ton site ou de ton profil Instagram, je m’inspire de ton style. Pas encore de site ni d’Instagram ? Envoie-moi ton logo, des photos ou des Reels que tu aimes, et dis-moi ce que tu fais.",
].join("\n\n");

const GREETINGS = new Set(["bonjour", "bonsoir", "salut", "coucou", "hello", "hey", "hi", "yo", "re", "cc", "slt", "bjr", "allo", "hola", "edith"]);

/** A first message that only says hello (« Bonjour ! », « coucou Edith 👋 »): the welcome answers it, no turn needed. */
export function justHello(text: string | null | undefined): boolean {
  const words = (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.length <= 3 && words.every((w) => GREETINGS.has(w));
}
