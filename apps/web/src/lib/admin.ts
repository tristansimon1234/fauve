import "server-only";
import { HOUSE_MODELS, houseOriginalPath, JOB_STALE_MINUTES, type FeedbackKind } from "@fauve/agent";
import { MONTAGE_SKILLS } from "@fauve/agent/skills";
import type { SkillReviewStatus } from "@/lib/skill-reviews";
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
  /**
   * Each of Edith's models (docs/modeles.md): the Reel it was written on (its video, signed for an hour, and its link),
   * and when it is coded as a montage skill, Tristan's review of its version (« pending » before it) and its bench Reel on
   * free rushes; those to look at first.
   */
  skills: {
    key: string;
    /** Its skill's version; null: not coded yet (the chain makes it). */
    version: number | null;
    name: string;
    how: string;
    status: SkillReviewStatus | "pending" | "uncoded";
    note: string | null;
    reviewedAt: string | null;
    bench: { url: string; seconds: number | null; costEur: number | null; labCase: string | null; at: string } | null;
    original: { url: string | null; link: string | null };
  }[];
  /** What people said of Edith and the app, the newest first: those not done yet. */
  feedback: { id: string; studio: string; kind: FeedbackKind; words: string; at: string; status: "new" | "seen"; source: string; byEdith: boolean }[];
};

const name = (studio: unknown) => {
  const s = (Array.isArray(studio) ? studio[0] : studio) as { name?: string | null } | null;
  return s?.name ?? "Sans nom";
};

export async function adminView(): Promise<AdminView> {
  const db = supabaseAdmin();
  const since = await teamToday();
  const fresh = new Date(Date.now() - JOB_STALE_MINUTES * 60_000).toISOString();
  const [settings, providers, signups, spent, montages, waitlist, recent, feedback, skills] = await Promise.all([
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
    db
      .from("feedback")
      .select("id, kind, words, created_at, status, source, by_edith, studios(name)")
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(60),
    skillsView(),
  ]);
  const jobs = montages.data ?? [];
  return {
    settings,
    providers,
    skills,
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
    feedback: (feedback.data ?? []).map((f) => ({
      id: f.id as string,
      studio: name(f.studios),
      kind: f.kind as FeedbackKind,
      words: f.words as string,
      at: f.created_at as string,
      status: f.status as "new" | "seen",
      source: f.source as string,
      byEdith: Boolean(f.by_edith),
    })),
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

const REVIEW_ORDER: Record<AdminView["skills"][number]["status"], number> = { pending: 0, revise: 1, refused: 2, approved: 3, uncoded: 4 };

/** Each of Edith's models, with its original, its review and its bench Reel: the ones waiting for Tristan first. */
async function skillsView(): Promise<AdminView["skills"]> {
  const db = supabaseAdmin();
  const [reviews, benches, links] = await Promise.all([
    db.from("skill_reviews").select("key, version, status, note, reviewed_at"),
    db.from("skill_benches").select("key, version, path, seconds, cost_eur, lab_case, created_at"),
    db.from("house_originals").select("key, link"),
  ]);
  const at = (rows: { key: unknown; version: unknown }[] | null) => new Map((rows ?? []).map((r) => [`${r.key as string}@${r.version as number}`, r]));
  const reviewed = at(reviews.data);
  const benched = at(benches.data);
  const linkOf = new Map((links.data ?? []).map((l) => [l.key as string, (l.link as string | null) ?? null]));
  const paths = [...(benches.data ?? []).map((b) => b.path as string), ...HOUSE_MODELS.map((m) => houseOriginalPath(m.key))];
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 3600)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl && !s.error ? [[s.path, s.signedUrl] as const] : [])));
  return HOUSE_MODELS.map((model) => {
    const skill = MONTAGE_SKILLS[model.key];
    const id = skill ? `${skill.key}@${skill.version}` : "";
    const review = reviewed.get(id) as { status: SkillReviewStatus; note: string | null; reviewed_at: string } | undefined;
    const bench = benched.get(id) as { path: string; seconds: number | null; cost_eur: number | null; lab_case: string | null; created_at: string } | undefined;
    const link = bench ? url.get(bench.path) : undefined;
    return {
      key: model.key,
      version: skill?.version ?? null,
      name: model.name,
      how: skill?.how ?? model.pitch,
      status: skill ? (review?.status ?? ("pending" as const)) : ("uncoded" as const),
      note: review?.note ?? null,
      reviewedAt: review?.reviewed_at ?? null,
      bench:
        bench && link
          ? { url: link, seconds: bench.seconds === null ? null : Number(bench.seconds), costEur: bench.cost_eur === null ? null : Number(bench.cost_eur), labCase: bench.lab_case?.replace(/^lab:\/\//, "") ?? null, at: bench.created_at }
          : null,
      original: { url: url.get(houseOriginalPath(model.key)) ?? null, link: linkOf.get(model.key) ?? null },
    };
  }).sort((a, b) => REVIEW_ORDER[a.status] - REVIEW_ORDER[b.status] || a.name.localeCompare(b.name, "fr"));
}
