// The providers' budgets (Tristan : « un moyen de gérer mes budgets des providers facilement pour
// éviter la panne »): most of them are prepaid (Anthropic, Google AI Studio, Treg) and stop answering when their balance is gone, and Edith with them. Every cost
// is already logged by provider (cost_events), so the team enters a balance when it tops one up (on
// the admin page), and what was spent since says what is left and how many days it lasts at the
// pace of the last 7 days; low, the team is told once a day.

export type ProviderKey = "anthropic" | "google" | "elevenlabs" | "vercel_sandbox" | "treg";

/** The providers Edith pays (cost_events.provider), what they do for her, and where to top them up. */
export const PROVIDERS: { key: ProviderKey; label: string; role: string; topUp: string }[] = [
  { key: "anthropic", label: "Anthropic (Claude)", role: "Edith, le monteur, les animations : sans lui, plus rien ne répond", topUp: "https://console.anthropic.com/settings/billing" },
  { key: "google", label: "Google (Gemini)", role: "La lecture des vidéos et des photos", topUp: "https://aistudio.google.com/usage" },
  { key: "elevenlabs", label: "ElevenLabs", role: "La musique, les voix off, la lecture des vocaux", topUp: "https://elevenlabs.io/app/subscription" },
  { key: "vercel_sandbox", label: "Vercel (rendus)", role: "Les ateliers qui fabriquent les vidéos", topUp: "https://vercel.com/dashboard/usage" },
  { key: "treg", label: "Treg", role: "Les Reels Instagram à recopier, les tendances", topUp: "https://treg.to" },
];

/** Days of spending left below which the team is told, by default. */
export const BUDGET_ALERT_DAYS = 7;

export type Budget = { balance: number; setAt: string; alertDays: number };

export type BudgetState = {
  /** What is left of the balance entered, in its dollars (null: no balance entered). */
  remaining: number | null;
  /** How many days it lasts at the pace of the last 7 days (null: nothing spent, or no balance). */
  daysLeft: number | null;
  low: boolean;
};

/** What is left of a balance: spent since it was entered (dollars), at the pace of the last days. */
export function budgetState(budget: Budget | null, spentSince: number, perDay: number): BudgetState {
  if (!budget) return { remaining: null, daysLeft: null, low: false };
  const remaining = budget.balance - spentSince;
  const daysLeft = perDay > 0 ? Math.max(0, remaining) / perDay : null;
  return { remaining, daysLeft, low: remaining <= 0 || (daysLeft !== null && daysLeft < budget.alertDays) };
}

const money = (usd: number) => `${Math.max(0, usd).toFixed(2).replace(".", ",")} $`;

/** The team's message when a provider runs low. */
export function budgetAlert(provider: { label: string; role: string; topUp: string }, state: BudgetState): string {
  const left = state.remaining !== null && state.remaining <= 0 ? "son solde est sans doute épuisé" : `il reste environ ${money(state.remaining ?? 0)}${state.daysLeft !== null ? `, soit ${Math.floor(state.daysLeft)} jours au rythme actuel` : ""}`;
  return `${provider.label} : ${left}. ${provider.role}. Recharge ici : ${provider.topUp} (puis mets le nouveau solde sur la page Admin).`;
}

/** The team's message when a provider refuses Edith's calls for its balance or its spending limit. */
export function providerDownAlert(provider: { label: string; role: string; topUp: string }): string {
  return `${provider.label} refuse les appels : solde épuisé ou plafond de dépense atteint. ${provider.role}. Recharge ou relève le plafond ici : ${provider.topUp}`;
}

/** A refusal of the Claude API for money (its credit balance, or the spending limit of the account), from its status and body. */
export function anthropicOutOfMoney(status: number, body: string): boolean {
  if (status !== 400 && status !== 402 && status !== 403) return false;
  return /credit balance is too low|usage limits?|spend(ing)? limit|billing/i.test(body);
}
