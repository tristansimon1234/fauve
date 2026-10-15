// No planning for her: when nothing has gone out for a while, one short
// reminder to send what she has at hand, Simone does the rest. Never more than
// one a week, none while something is about to go out, and none after two
// left unanswered (until she writes again).

/** At most one reminder in this many days. */
export const NUDGE_EVERY_DAYS = 7;
/** A publication due within this many days: no reminder. */
export const NUDGE_UPCOMING_DAYS = 2;
/** Reminders left unanswered after which she is not reminded again, until she writes. */
export const MAX_UNANSWERED_NUDGES = 2;

/** Days without a publication before a reminder, from her rhythm (posts a week): 4 for 3 a week, 6 for 2. */
export function nudgeAfterDays(postsPerWeek: number | null | undefined): number {
  const posts = Math.max(1, Math.min(7, postsPerWeek ?? 3));
  return Math.max(3, Math.ceil((7 / posts) * 1.5));
}

export function shouldNudge(input: {
  /** Days since her last publication (null: never published). */
  daysSince: number | null;
  /** Something is planned within NUDGE_UPCOMING_DAYS. */
  upcoming: boolean;
  /** Days since the last reminder (null: never). */
  daysSinceNudge: number | null;
  /** Reminders sent since her last message. */
  unanswered: number;
  postsPerWeek: number | null | undefined;
}): boolean {
  if (input.upcoming || input.unanswered >= MAX_UNANSWERED_NUDGES) return false;
  if (input.daysSinceNudge !== null && input.daysSinceNudge < NUDGE_EVERY_DAYS) return false;
  return input.daysSince === null || input.daysSince >= nudgeAfterDays(input.postsPerWeek);
}

/** The reminder, short: what she has at hand is enough. */
export function nudgeMessage(daysSince: number | null, banked: number): string {
  const since = daysSince === null ? "Ta première publication t'attend 🙂" : `Ça fait ${daysSince} jours sans publication 🙂`;
  const bank = banked ? " Sinon, je peux repartir d'une des vidéos que j'ai gardées." : "";
  return `${since} Envoie-moi les photos ou vidéos que tu as sous la main, je m'occupe du reste.${bank}`;
}
