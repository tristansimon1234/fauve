import { isSubscribed } from "./access.ts";

// How much Simone answers a studio in a day. Any number that writes to her gets a studio and the
// onboarding at once, and nothing limited her replies: each turn costs the chat model (about
// €0.08) and, since October 2026, each WhatsApp reply beyond the number's free 1,000 a month. A
// studio not subscribed yet gets enough for its onboarding, a subscriber enough for a busy day
// (only a loop or a spammer reaches it); beyond, Simone says once that it picks up tomorrow. The
// team's own studio (and a lab studio) has no cap.

/** Simone's turns a day: a studio not subscribed yet (enough for the onboarding), a subscriber (only to stop a loop). */
export const DAILY_TURNS = { open: 30, subscribed: 200 } as const;

/** New numbers in a day beyond which the team is told: a launch, or spam. */
export const NEW_NUMBERS_ALERT = 20;

/** The most turns Simone takes in a day for this studio (null: no cap). */
export function dailyTurnCap(studio: { team: boolean; subscription: string | null | undefined }): number | null {
  if (studio.team) return null;
  return isSubscribed(studio.subscription) ? DAILY_TURNS.subscribed : DAILY_TURNS.open;
}

/** Said once, when the day's turns are used up. */
export const DAILY_CAP_REPLY = "On a beaucoup échangé aujourd’hui : je fais une pause et je reprends demain. Tout ce que tu m’as envoyé est bien gardé.";

/** The team's message when more numbers than usual started with Simone today. */
export function newNumbersAlert(count: number): string {
  return `${count} nouveaux numéros ont écrit à Simone aujourd’hui (plus de ${NEW_NUMBERS_ALERT}). Si ce n’est pas un lancement, c’est peut-être du spam : chaque numéro reste limité à ${DAILY_TURNS.open} réponses par jour tant qu’il n’est pas abonné.`;
}
