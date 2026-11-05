// How long a sandbox stays up (sandbox.ts). Vercel bills a sandbox's memory for as long as its session runs, idle or
// not (8 GB for a render sandbox, 16 for the cut-outs, by the minute): each one stayed up until its 15-minute timeout
// after a job (5 for the cut-outs), and the two spare render sandboxes 15 minutes after each warm-up. Now a session
// lives while a command runs in it and stops about IDLE_TAIL_MS after the last one; the next command resumes it from
// its snapshot. Pure, so that node --test reads it.

/**
 * The time a sandbox stays up after its last command: its sessions' timeout (a resumed session starts with it), and
 * what a sandbox where a command runs keeps ahead of it (withTimeLeft, every KEEP_ALIVE_MS).
 */
export const IDLE_TAIL_MS = 90_000;

/** How often a sandbox where a command runs is given its time again. */
export const KEEP_ALIVE_MS = 30_000;

/** The API refuses an extension under a second: a minute at least. */
const MIN_EXTENSION_MS = 60_000;

/** How much to extend a session that stops in `leftMs`, so that it keeps `leadMs` ahead (0: nothing to do). */
export function extensionMs(leftMs: number, leadMs: number = IDLE_TAIL_MS): number {
  if (leftMs >= leadMs) return 0;
  return Math.max(MIN_EXTENSION_MS, leadMs - Math.max(0, leftMs));
}

/** When the last command in a sandbox's session ended (app_settings « sandbox_busy:<name> »). */
export type LastBusy = { session: string; at: string };

/**
 * The seconds a finished session stayed up after its last command (memory paid with nothing running), or null when
 * that cannot be told: another session, one not stopped yet, or a moment outside it.
 */
export function idleTailSeconds(last: LastBusy, session: { id: string; startedAt?: number; stoppedAt?: number }): number | null {
  if (last.session !== session.id || !session.stoppedAt) return null;
  const at = Date.parse(last.at);
  if (!Number.isFinite(at) || (session.startedAt !== undefined && at < session.startedAt) || at > session.stoppedAt) return null;
  return Math.round((session.stoppedAt - at) / 1000);
}

/** The seats of machine `slot` among places taken `perSlot` a machine (take_work_slot: seat / perSlot is the machine). */
export function seatsOf(slot: number, perSlot: number): number[] {
  return Array.from({ length: perSlot }, (_, i) => perSlot * slot + i);
}
