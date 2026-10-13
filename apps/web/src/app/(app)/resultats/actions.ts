"use server";

import { revalidatePath } from "next/cache";
import { analyzePerformance } from "@/lib/performance";
import { getStudioContext } from "@/lib/studio";

/** "Analyser maintenant" on the Résultats page: a fresh "ce qui marche" report (free). */
export async function refreshReport(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  try {
    const report = await analyzePerformance(member.studio.id);
    if ("error" in report) return { ok: false, error: report.error };
    revalidatePath("/resultats");
    return { ok: true };
  } catch (error) {
    console.error("report refresh failed", error);
    return { ok: false, error: "L’analyse n’a pas abouti. Réessaie dans un instant." };
  }
}
