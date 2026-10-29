import { isSubscribed } from "./access.ts";

// The brakes for a rush (Tristan : « si je buzz jsuis foutu »): a burst of new numbers, of montages,
// or of spending by studios that pay nothing must slow down, never fall over. Past the day's new
// numbers, the next ones wait their turn (waitlist); montages run a few at a time, the others in a
// queue that says when theirs comes (one machine renders them all); and past a day's spending by
// studios not subscribed, nothing costly starts for them until tomorrow. Each number can be
// changed without a release (DAILY_SIGNUPS, MONTAGES_AT_ONCE, FREE_SPEND_EUR_PER_DAY).

/** New numbers let in a day (local midnight to midnight); the next ones go on the waitlist. */
export const DAILY_SIGNUPS = 100;
/** Montages running at once, every studio together: the render machine takes about this many. */
export const MONTAGES_AT_ONCE = 6;
/** What studios not subscribed may cost in a day, in euros, before nothing costly starts for them. */
export const FREE_SPEND_EUR_PER_DAY = 100;
/** A montage, launch to delivery, on average (measured October 2026: 4 to 13 min). */
export const MONTAGE_MINUTES = 9;
/** The waitlist is let in during the day only (local hours): never a message at night. */
export const WAITLIST_HOURS = { from: 8, to: 21 } as const;

/** The team's studio or a lab studio: ours, never braked. */
export function ourStudio(studio: { team?: boolean | null; website_url?: string | null }): boolean {
  return Boolean(studio.team) || (typeof studio.website_url === "string" && studio.website_url.startsWith("lab://"));
}

/** A studio the spending brake applies to: not ours, and not subscribed (its real status, billing on or off). */
export function freeStudio(studio: { team?: boolean | null; website_url?: string | null; subscription_status?: string | null }): boolean {
  return !ourStudio(studio) && !isSubscribed(studio.subscription_status);
}

/**
 * When a montage waiting in the queue should be ready, in minutes, rounded up to 5: its place
 * (1 = next), a slot freed every MONTAGE_MINUTES / slots on average, then its own montage.
 */
export function queueMinutes(position: number, slots: number, minutes = MONTAGE_MINUTES): number {
  const wait = (Math.max(1, position) * minutes) / Math.max(1, slots);
  return Math.max(5, Math.ceil((wait + minutes) / 5) * 5);
}

/** Said to her when her montage waits its turn. */
export function queuedLine(minutes: number): string {
  return `Beaucoup de commerces me découvrent en ce moment : ton Reel attend son tour. Il sera prêt dans ${minutes} minutes environ, je te préviens dès qu’il est là.`;
}

/** The first message of a number that came on a full day. */
export const WAITLIST_REPLY =
  "Bonjour ! Moi c’est Edith, le community manager (une IA) des commerces de quartier ✨ Beaucoup de commerces me découvrent en ce moment : je t’ai gardé une place et je t’écris ici dès que c’est ton tour, sûrement demain matin. Tu n’as rien à faire d’ici là.";

/** Said once a day when she writes again while she waits. */
export const WAITLIST_AGAIN = "Toujours complet pour aujourd’hui, désolé ! Ta place est gardée : je t’écris ici dès que c’est ton tour.";

/** Her turn came: the onboarding starts with her answer. */
export const WAITLIST_WELCOME =
  "C’est ton tour ! Merci d’avoir patienté 🙏 Moi c’est Edith, ton community manager (une IA). On commence : envoie-moi le lien de ton site, ou dis-moi le nom de ton commerce.";

/** What the app says when a costly thing is refused by the day's spending brake. */
export const BUSY_TEXT = "Beaucoup de commerces me découvrent aujourd’hui : je ne peux rien lancer de nouveau pour toi avant demain matin. Tout ce que tu m’as envoyé est gardé.";

/** The team, the first time in a day the waitlist starts. */
export function waitlistAlert(cap: number): string {
  return `${cap} nouveaux numéros sont entrés aujourd’hui : les suivants sont en liste d’attente. Edith les fait entrer dès qu’il y a de la place, ${cap} par jour, de ${WAITLIST_HOURS.from} h à ${WAITLIST_HOURS.to} h (DAILY_SIGNUPS pour changer ce nombre).`;
}

/** The team, the first time in a day the spending brake stops new work. */
export function spendBrakeAlert(spent: number, cap: number): string {
  return `Les commerces pas encore abonnés ont coûté ${Math.round(spent)} € aujourd’hui (plafond ${cap} €) : plus de nouvelle lecture de vidéo ni de création pour eux jusqu’à demain. Les abonnés ne sont pas touchés (FREE_SPEND_EUR_PER_DAY pour changer ce plafond).`;
}
