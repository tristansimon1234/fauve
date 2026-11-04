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

/** The skill versions Tristan added to the library (read at most once a minute per server). */
export async function approvedSkills(): Promise<Set<string>> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.approved;
  const { data, error } = await supabaseAdmin().from("skill_reviews").select("key, version").eq("status", "approved");
  if (error) throw new Error(error.message);
  const approved = new Set((data ?? []).map((r) => `${r.key as string}@${r.version as number}`));
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
  return (skill) => (skill && (open || approved.has(skillVersionKey(skill))) ? skill : undefined);
}
