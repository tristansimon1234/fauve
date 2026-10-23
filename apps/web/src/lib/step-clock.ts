import { AsyncLocalStorage } from "node:async_hooks";

// The time a background step has left before Vercel stops it (800 s): a step cut short delivers
// nothing and leaves its work « en cours » for ever (a montage's design died at 800 s, its third
// motion designer call started with four minutes left). Long calls ask before they start.

const clock = new AsyncLocalStorage<{ deadline: number }>();

/** Runs `work` with `ms` to spend (its long calls read timeLeft()). */
export function withStepDeadline<T>(ms: number, work: () => T): T {
  return clock.run({ deadline: Date.now() + ms }, work);
}

/** Milliseconds left in the running step (Infinity outside one). */
export function timeLeft(): number {
  const deadline = clock.getStore()?.deadline;
  return deadline === undefined ? Infinity : deadline - Date.now();
}
