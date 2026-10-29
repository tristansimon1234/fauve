import "server-only";
import { DAILY_SIGNUPS, FREE_SPEND_EUR_PER_DAY, MONTAGES_AT_ONCE } from "@fauve/agent";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The numbers of the brakes of a rush (packages/agent/src/brakes.ts), as the team set them on the
// admin page (app_settings), else the environment variable of the same name, else the default.
// Read once a minute per instance: a change applies everywhere within a minute.

export type BrakeSettings = { dailySignups: number; montagesAtOnce: number; freeSpendEurPerDay: number };

const KEYS = { dailySignups: "daily_signups", montagesAtOnce: "montages_at_once", freeSpendEurPerDay: "free_spend_eur_per_day" } as const;

export const brakeSettingsSchema = z.object({
  dailySignups: z.coerce.number().int().min(0).max(10_000),
  montagesAtOnce: z.coerce.number().int().min(1).max(50),
  freeSpendEurPerDay: z.coerce.number().min(0).max(100_000),
});

const READ_EVERY_MS = 60_000;
let read: { at: number; settings: BrakeSettings } | null = null;

const fallback = (): BrakeSettings => ({
  dailySignups: env("DAILY_SIGNUPS") ?? DAILY_SIGNUPS,
  montagesAtOnce: env("MONTAGES_AT_ONCE") ?? MONTAGES_AT_ONCE,
  freeSpendEurPerDay: env("FREE_SPEND_EUR_PER_DAY") ?? FREE_SPEND_EUR_PER_DAY,
});

export async function brakeSettings(): Promise<BrakeSettings> {
  if (read && Date.now() - read.at < READ_EVERY_MS) return read.settings;
  const settings = fallback();
  const { data, error } = await supabaseAdmin().from("app_settings").select("key, value").in("key", Object.values(KEYS));
  if (error) {
    console.warn("brake settings: not read, defaults kept", error.message);
    return read?.settings ?? settings;
  }
  for (const [name, key] of Object.entries(KEYS) as [keyof BrakeSettings, string][]) {
    const value = Number(data?.find((r) => r.key === key)?.value);
    if (Number.isFinite(value)) settings[name] = value;
  }
  read = { at: Date.now(), settings };
  return settings;
}

/** The admin page's change: kept for every instance, applied here at once. */
export async function saveBrakeSettings(settings: BrakeSettings): Promise<void> {
  const now = new Date().toISOString();
  const rows = (Object.entries(KEYS) as [keyof BrakeSettings, string][]).map(([name, key]) => ({ key, value: settings[name], updated_at: now }));
  const { error } = await supabaseAdmin().from("app_settings").upsert(rows);
  if (error) throw new Error(error.message);
  read = { at: Date.now(), settings };
}
