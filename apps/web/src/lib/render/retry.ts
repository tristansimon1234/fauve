// When a reading of her media that failed (a cut-out, an object followed, a depth, a relief, a sky…) is asked again.

/** A failure that says something of the shot (no object found, no sky): asked again six hours later. */
export const RETRY_MS = 6 * 3600_000;

/** A failure that says nothing of the shot (no card or machine came in time): asked again two minutes later. */
export const PASSING_RETRY_MS = 2 * 60_000;

/**
 * The errors of a card, a machine or a step that did not come in time (lib/render/gpu.ts): the next Reel asks again.
 * On November 5 at 9:24, « no A10G nor L40S card free after 90 s » had kept the lamps of « La pièce qui se rallume »
 * from being looked for again for six hours.
 */
const PASSING = /card free after|no machine started|did not answer|was not ready after|came after the deadline|no time left/i;

/** Whether a failed reading may be asked again now. */
export function retryDue(failed: { failed_at: string; error?: string | null }): boolean {
  const age = Date.now() - Date.parse(failed.failed_at);
  return age > (PASSING.test(failed.error ?? "") ? PASSING_RETRY_MS : RETRY_MS);
}
