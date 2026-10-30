import "server-only";
import { JOB_STALE_MINUTES } from "@fauve/agent";
import { brakeSettings, type BrakeSettings } from "@/lib/brake-settings";
import { providerBudgets, type ProviderBudget } from "@/lib/provider-budgets";
import { teamToday } from "@/lib/reply-cap";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The admin page (/admin): only the team's studio (studios.team) opens it. What the brakes of a
// rush see today (brakes.ts), their numbers, the waitlist and the montages running or waiting.

/** The signed-in member of the team's studio, or null (anyone else: the page does not exist). */
export async function teamMember() {
  const { member } = await getStudioContext();
  if (!member) return null;
  const { data } = await supabaseAdmin().from("studios").select("team").eq("id", member.studio.id).maybeSingle();
  return data?.team ? member : null;
}

export type AdminView = {
  settings: BrakeSettings;
  providers: ProviderBudget[];
  today: { signups: number; spent: number; running: number; waiting: number };
  /** reachable: WhatsApp lets Edith write within 24 h of their last message only. */
  waitlist: { phone: string; firstName: string | null; firstText: string | null; since: string; reachable: boolean }[];
  waitlistTotal: number;
  montages: { id: string; studio: string; stage: string; since: string }[];
  signups: { studio: string; firstName: string | null; phone: string; at: string; step: string; subscription: string | null }[];
};

const name = (studio: unknown) => {
  const s = (Array.isArray(studio) ? studio[0] : studio) as { name?: string | null } | null;
  return s?.name ?? "Sans nom";
};

export async function adminView(): Promise<AdminView> {
  const db = supabaseAdmin();
  const since = await teamToday();
  const fresh = new Date(Date.now() - JOB_STALE_MINUTES * 60_000).toISOString();
  const [settings, providers, signups, spent, montages, waitlist, recent] = await Promise.all([
    brakeSettings(),
    providerBudgets(),
    db.from("members").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.rpc("free_spend_since", { since }),
    db
      .from("studio_jobs")
      .select("id, stage, started_at, studios(name)")
      .eq("kind", "montage")
      .is("finished_at", null)
      .gte("updated_at", fresh)
      .order("started_at")
      .limit(50),
    db.from("waitlist").select("phone_e164, first_name, first_text, created_at, last_message_at", { count: "exact" }).is("admitted_at", null).order("created_at").limit(100),
    db.from("members").select("first_name, phone_e164, created_at, studios(name, onboarding_step, subscription_status)").order("created_at", { ascending: false }).limit(20),
  ]);
  const jobs = montages.data ?? [];
  return {
    settings,
    providers,
    today: {
      signups: signups.count ?? 0,
      spent: Number(spent.data ?? 0),
      running: jobs.filter((j) => j.stage !== "waiting").length,
      waiting: jobs.filter((j) => j.stage === "waiting").length,
    },
    waitlist: (waitlist.data ?? []).map((w) => ({
      phone: w.phone_e164 as string,
      firstName: (w.first_name as string | null) ?? null,
      firstText: (w.first_text as string | null) ?? null,
      since: w.created_at as string,
      reachable: Date.now() - Date.parse(w.last_message_at as string) < 23 * 3600_000,
    })),
    waitlistTotal: waitlist.count ?? 0,
    montages: jobs.map((j) => ({ id: j.id as string, studio: name(j.studios), stage: j.stage as string, since: j.started_at as string })),
    signups: (recent.data ?? []).map((m) => {
      const s = (Array.isArray(m.studios) ? m.studios[0] : m.studios) as { name?: string | null; onboarding_step?: string; subscription_status?: string | null } | null;
      return {
        studio: s?.name ?? "Sans nom",
        firstName: (m.first_name as string | null) ?? null,
        phone: m.phone_e164 as string,
        at: m.created_at as string,
        step: s?.onboarding_step ?? "website",
        subscription: s?.subscription_status ?? null,
      };
    }),
  };
}
