import "server-only";
import type { MontageSkill } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Tristan validates each montage skill before a business plays it (« par quel biais je validerai les modèles ? »): the
// « Modèles » section of /admin shows each one's bench Reel, and its « Ajouter à la bibliothèque » writes its version
// approved (skill_reviews). A business plays only an approved version; the team's studio and the lab's studios play
// every skill of the library, to look at it first. A skill not played goes to the editor, as a model without its skill.

export type SkillReviewStatus = "approved" | "refused" | "revise";

const CACHE_MS = 60_000;
let cached: { at: number; approved: Set<string> } | null = null;

/** A skill's version as its review names it. */
export const skillVersionKey = (skill: Pick<MontageSkill, "key" | "version">) => `${skill.key}@${skill.version}`;

/**
 * The skills Tristan added to the library (read at most once a minute per server), by key: a validation follows the model,
 * not its version (Tristan, 10 November: « valide les modèles pour tout le monde » — 15 of the 16 he had validated on
 * 4 November had a newer version since, so no business played them): a model is played while its latest review is
 * « approved », whatever version it was given to; a later « revise » or « refused » takes it out.
 */
export async function approvedSkills(): Promise<Set<string>> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.approved;
  const { data, error } = await supabaseAdmin().from("skill_reviews").select("key, version, status, reviewed_at");
  if (error) throw new Error(error.message);
  const latest = new Map<string, { status: string; version: number; at: string }>();
  for (const r of data ?? []) {
    const key = r.key as string;
    const row = { status: r.status as string, version: Number(r.version), at: String(r.reviewed_at ?? "") };
    const known = latest.get(key);
    if (!known || row.version > known.version || (row.version === known.version && row.at > known.at)) latest.set(key, row);
  }
  const approved = new Set([...latest].flatMap(([key, r]) => (r.status === "approved" ? [key] : [])));
  cached = { at: Date.now(), approved };
  return approved;
}

/** Forgets the cache on this server (after a review). */
export const forgetApprovedSkills = () => {
  cached = null;
};

/** What a studio may play: a skill Tristan added, or any for the team's studio and the lab's. Unknown: none but the approved. */
export async function skillGate(studioId: string): Promise<<S extends Pick<MontageSkill, "key" | "version">>(skill: S | undefined) => S | undefined> {
  const [approved, studio] = await Promise.all([
    approvedSkills().catch(() => new Set<string>()),
    supabaseAdmin().from("studios").select("team, website_url").eq("id", studioId).maybeSingle(),
  ]);
  const open = Boolean(studio.data?.team) || String(studio.data?.website_url ?? "").startsWith("lab://");
  return (skill) => (skill && (open || approved.has(skill.key)) ? skill : undefined);
}
