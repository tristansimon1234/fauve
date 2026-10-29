import "server-only";
import { BUDGET_ALERT_DAYS, budgetAlert, budgetState, DEFAULT_USD_TO_EUR, PROVIDERS, providerDownAlert, type Budget, type BudgetState, type ProviderKey } from "@fauve/agent";
import { z } from "zod";
import { env } from "@/lib/env";
import { teamToday, tellTeamOnce } from "@/lib/reply-cap";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The providers' budgets (packages/agent/src/budgets.ts) for the admin page and the publish cron:
// what each one cost (cost_events, in euros, shown in dollars as they bill), the balance the team
// entered when it topped one up (app_settings « budget:<provider> »), what is left and for how many
// days, ElevenLabs' quota read live, and the team told once a day when one runs low.

const DAY = 86_400_000;
const rate = () => env("USD_TO_EUR") ?? DEFAULT_USD_TO_EUR;
const toUsd = (eur: number) => eur / rate();

const budgetSchema = z.object({ balance: z.number(), setAt: z.string(), alertDays: z.number().int().min(1).max(90).catch(BUDGET_ALERT_DAYS) });

export type ProviderBudget = {
  key: ProviderKey;
  label: string;
  role: string;
  topUp: string;
  /** Spent, in dollars. */
  today: number;
  week: number;
  month: number;
  perDay: number;
  budget: Budget | null;
  state: BudgetState;
  /** ElevenLabs only: its plan's credits this period, read live. */
  quota?: { used: number; limit: number; resetsAt: string | null; overage: boolean } | null;
  /** Its balance read live from its own API, in dollars (Treg): no balance to enter. */
  live?: number | null;
  /** Anthropic only, with ANTHROPIC_ADMIN_KEY: this month's cost as Anthropic bills it (its Cost API), in dollars. */
  billed?: number | null;
};

/** The providers whose balance is read from their own API: nothing to enter for them. */
export const LIVE_BALANCE: ProviderKey[] = ["treg"];

/** What each provider cost since `since`, in dollars. */
async function spentSince(since: string): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin().rpc("provider_spend", { since });
  if (error) throw new Error(`provider_spend: ${error.message}`);
  return new Map(((data ?? []) as { provider: string; eur: number }[]).map((r) => [r.provider, toUsd(Number(r.eur))]));
}

async function budgets(): Promise<Map<ProviderKey, Budget>> {
  const { data } = await supabaseAdmin().from("app_settings").select("key, value").like("key", "budget:%");
  const out = new Map<ProviderKey, Budget>();
  for (const row of data ?? []) {
    const parsed = budgetSchema.safeParse(row.value);
    if (parsed.success) out.set((row.key as string).slice("budget:".length) as ProviderKey, parsed.data);
  }
  return out;
}

/** ElevenLabs' credits this billing period (GET /v1/user/subscription); null without a key or on a failure. */
async function elevenLabsQuota(): Promise<ProviderBudget["quota"]> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const s = (await res.json()) as { character_count?: number; character_limit?: number; next_character_count_reset_unix?: number | null; max_credit_limit_extension?: number | string };
    if (typeof s.character_count !== "number" || typeof s.character_limit !== "number") return null;
    return {
      used: s.character_count,
      limit: s.character_limit,
      resetsAt: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString() : null,
      overage: s.max_credit_limit_extension === "unlimited" || Number(s.max_credit_limit_extension) > 0,
    };
  } catch {
    return null;
  }
}

/** Treg's prepaid balance (GET /orgs/{org}/balance, integer micro-dollars in balance_micro); its org from TREG_ORG_ID, else the first of GET /orgs. */
async function tregBalance(): Promise<number | null> {
  const token = env("TREG_API_KEY");
  if (!token) return null;
  const headers = { "X-Treg-Token": token };
  try {
    let org = env("TREG_ORG_ID");
    if (!org) {
      const res = await fetch("https://treg.to/orgs", { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const body = (await res.json()) as unknown;
      const list = (Array.isArray(body) ? body : ((body as { orgs?: unknown[]; data?: unknown[] }).orgs ?? (body as { data?: unknown[] }).data ?? [])) as { id?: string; org_id?: string }[];
      org = list[0]?.id ?? list[0]?.org_id;
    }
    if (!org) return null;
    const res = await fetch(`https://treg.to/orgs/${encodeURIComponent(org)}/balance`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { balance_micro?: number; balance?: { balance_micro?: number } };
    const micro = body.balance_micro ?? body.balance?.balance_micro;
    return typeof micro === "number" ? micro / 1_000_000 : null;
  } catch {
    return null;
  }
}

/** This month's Claude cost as Anthropic bills it (Admin API, cost_report, amounts in cents), with ANTHROPIC_ADMIN_KEY; null without. */
async function anthropicBilled(since: string): Promise<number | null> {
  const key = env("ANTHROPIC_ADMIN_KEY");
  if (!key) return null;
  try {
    let cents = 0;
    let page: string | undefined;
    for (let i = 0; i < 5; i++) {
      const query = new URLSearchParams({ starting_at: since, limit: "31", ...(page ? { page } : {}) });
      const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${query}`, {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { results?: { amount?: string }[] }[]; has_more?: boolean; next_page?: string };
      for (const bucket of body.data ?? []) for (const r of bucket.results ?? []) cents += Number(r.amount ?? 0) || 0;
      if (!body.has_more || !body.next_page) break;
      page = body.next_page;
    }
    return cents / 100;
  } catch {
    return null;
  }
}

/** Every provider's spending and budget, for the admin page and the cron. */
export async function providerBudgets(): Promise<ProviderBudget[]> {
  const now = Date.now();
  const kept = await budgets();
  const month = new Date(await teamToday());
  month.setUTCDate(1);
  const [today, week, thisMonth, quota, treg, billed, ...since] = await Promise.all([
    spentSince(await teamToday()),
    spentSince(new Date(now - 7 * DAY).toISOString()),
    spentSince(month.toISOString()),
    elevenLabsQuota(),
    tregBalance(),
    anthropicBilled(month.toISOString()),
    ...PROVIDERS.map((p) => (kept.get(p.key) ? spentSince(kept.get(p.key)!.setAt) : Promise.resolve(new Map<string, number>()))),
  ]);
  const lives: Partial<Record<ProviderKey, number | null>> = { treg };
  return PROVIDERS.map((p, i) => {
    const perDay = (week.get(p.key) ?? 0) / 7;
    const live = LIVE_BALANCE.includes(p.key) ? (lives[p.key] ?? null) : undefined;
    // A balance read live counts from now (nothing spent since); else the one the team entered.
    const budget = typeof live === "number" ? { balance: live, setAt: new Date(now).toISOString(), alertDays: kept.get(p.key)?.alertDays ?? BUDGET_ALERT_DAYS } : (kept.get(p.key) ?? null);
    return {
      ...p,
      today: today.get(p.key) ?? 0,
      week: week.get(p.key) ?? 0,
      month: thisMonth.get(p.key) ?? 0,
      perDay,
      budget,
      state: budgetState(budget, typeof live === "number" ? 0 : (since[i]!.get(p.key) ?? 0), perDay),
      ...(p.key === "elevenlabs" ? { quota } : {}),
      ...(live !== undefined ? { live } : {}),
      ...(p.key === "anthropic" ? { billed } : {}),
    };
  });
}

/** The admin page: the balance it shows now (in dollars), and how many days ahead to be told. */
export async function saveBudget(provider: ProviderKey, balance: number, alertDays: number): Promise<void> {
  const value: Budget = { balance, setAt: new Date().toISOString(), alertDays };
  const { error } = await supabaseAdmin().from("app_settings").upsert({ key: `budget:${provider}`, value, updated_at: value.setAt });
  if (error) throw new Error(error.message);
}

export async function forgetBudget(provider: ProviderKey): Promise<void> {
  await supabaseAdmin().from("app_settings").delete().eq("key", `budget:${provider}`);
}

/** The publish cron: a provider running low (its balance, or ElevenLabs' quota past 85 %), the team told once a day. */
export async function checkBudgets(): Promise<string[]> {
  const low: string[] = [];
  for (const p of await providerBudgets()) {
    if (p.state.low) {
      low.push(p.key);
      await tellTeamOnce(`budget_${p.key}`, budgetAlert(p, p.state));
    } else if (p.quota && !p.quota.overage && p.quota.limit > 0 && p.quota.used / p.quota.limit > 0.85) {
      low.push(p.key);
      await tellTeamOnce(
        `budget_${p.key}`,
        `${p.label} : ${Math.round((p.quota.used / p.quota.limit) * 100)} % des crédits du mois utilisés. ${p.role}. Passe à l’offre au-dessus ou autorise le dépassement ici : ${p.topUp}`,
      );
    }
  }
  return low;
}

/** A provider refused a call for money (its balance or its spending limit): the team told at once, once a day. */
export async function providerDown(key: ProviderKey): Promise<void> {
  const provider = PROVIDERS.find((p) => p.key === key);
  if (!provider) return;
  console.error("provider out of money", key);
  await tellTeamOnce(`provider_down_${key}`, providerDownAlert(provider)).catch((e: unknown) => console.warn("provider alert failed", key, e));
}
