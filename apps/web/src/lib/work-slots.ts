import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { timeLeft } from "@/lib/step-clock";

// Places on the machines and providers that only take a few jobs at a time (work_slots): the render
// sandboxes (Chrome in 8 GB), the cut-out model (6.5 GB of its 16 GB), the tracker, ElevenLabs (2
// musics, 5 voices at once), a studio's credits. A job takes a place before it starts and frees it
// after; the place a function that died held frees itself when its lease ends. Ten montages at once
// used to start forty Chrome tabs in one sandbox: now they queue, each a minute or two.

export type SlotSpec = {
  kind: string;
  /** How many machines (each its own index) and how many jobs each takes at once. */
  slots: number;
  perSlot: number;
  /** The longest the job may hold its place (a function killed mid-job frees it then). */
  leaseMs: number;
  /** The longest a job waits for a place before it runs anyway, on the least busy machine (never longer than its step has left). */
  waitMs: number;
};

const POLL_MS = 3_000;

const waits = new AsyncLocalStorage<{ ms: number }>();

/**
 * Counts, from here on in this call, the time its jobs wait for a place: a render's cost is the time
 * it worked, never the time it queued (`.ms` to subtract).
 */
export function meterWaits(): { ms: number } {
  const box = { ms: 0 };
  waits.enterWith(box);
  return box;
}

/** Kept for the end of a step when a job waits: it still has to do its work. */
const STEP_MARGIN_MS = 4 * 60_000;

/**
 * Runs `work` once a place is free, with the index of its machine. If the places stay full beyond
 * `waitMs` (or what its step has left), it runs anyway on the least busy one: a slow job is better
 * than none. If the database cannot be asked, it runs as before (on machine 0).
 */
export async function withSlot<T>(spec: SlotSpec, work: (slot: number) => Promise<T>): Promise<T> {
  const db = supabaseAdmin();
  const holder = randomUUID();
  const until = Date.now() + Math.max(0, Math.min(spec.waitMs, timeLeft() - STEP_MARGIN_MS));
  const take = async (force: boolean) => {
    const { data, error } = await db.rpc("take_work_slot", {
      p_kind: spec.kind,
      p_slots: spec.slots,
      p_per_slot: spec.perSlot,
      p_holder: holder,
      p_seconds: Math.ceil(spec.leaseMs / 1000),
      p_force: force,
    });
    if (error) throw new Error(error.message);
    return data as number | null;
  };
  let slot: number | null;
  const waitStarted = Date.now();
  try {
    slot = await take(false);
    while (slot === null && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      slot = await take(false);
    }
    if (slot === null) {
      console.warn("work slot: all places busy, running anyway", spec.kind);
      slot = await take(true);
    }
  } catch (error) {
    console.warn("work slot not taken, running without one", spec.kind, error instanceof Error ? error.message : error);
    return work(0);
  }
  const box = waits.getStore();
  if (box) box.ms += Date.now() - waitStarted;
  try {
    return await work(slot ?? 0);
  } finally {
    await db.rpc("release_work_slot", { p_kind: spec.kind, p_holder: holder }).then(
      ({ error }) => error && console.warn("work slot not released", spec.kind, error.message),
      () => {},
    );
  }
}
