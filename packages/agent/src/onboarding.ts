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
