"use server";

import { CREDIT_PRICES, trendChange, trendQueryOf } from "@fauve/agent";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { chargeCredits, creditBalance } from "@/lib/credits";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { monthIn, refreshTrends } from "@/lib/trends";

/**
 * « Changer » on the page Tendances: the words searched for her trade (empty: back to her activity).
 * Each new set of words is a whole new search: TREND_FREE_CHANGES a month for free, then a credit each.
 */
export async function setTrendQuery(words: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun commerce." };
  const clean = words.replace(/\s+/g, " ").trim().slice(0, 60);
  if (clean && clean.length < 3) return { ok: false, error: "Écris au moins un mot, comme « salon de coiffure »." };
  const studioId = member.studio.id;
  const db = supabaseAdmin();
  const { data: before } = await db.from("studios").select("trend_query, business_type, trend_query_month, trend_query_changes").eq("id", studioId).maybeSingle();
  const business = before?.business_type as string | null;
  const current = trendQueryOf(before?.trend_query as string | null, business);
  const query = trendQueryOf(clean || null, business);
  const month = monthIn(member.studio.timezone);
  const change = trendChange({
    current,
    next: query,
    month,
    counted: { month: (before?.trend_query_month as string | null) ?? null, changes: Number(before?.trend_query_changes ?? 0) },
  });
  if (change.paid && (await creditBalance(studioId)) < CREDIT_PRICES.trends) {
    return { ok: false, error: "Tu as déjà changé tes mots 3 fois ce mois-ci, et il ne te reste plus de crédit pour une nouvelle recherche." };
  }
  const { error } = await db
    .from("studios")
    .update({ trend_query: clean || null, ...(change.counts ? { trend_query_month: month, trend_query_changes: change.changes } : {}) })
    .eq("id", studioId);
  if (error) return { ok: false, error: "Ça n’est pas passé. Réessaie dans un instant." };
  if (change.paid) await chargeCredits(studioId, CREDIT_PRICES.trends, "trends", `Tendances « ${query} »`, { query });
  // New words are searched now; the page shows them as soon as they arrive.
  if (query) after(() => refreshTrends(query).catch((e: unknown) => console.error("trends: refresh failed", query, e)));
  revalidatePath("/tendances");
  return { ok: true };
}
