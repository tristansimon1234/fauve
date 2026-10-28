"use server";

import { trendQueryOf } from "@fauve/agent";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refreshTrends } from "@/lib/trends";

/** « Changer » on the page Tendances: the words searched for her trade (empty: back to her activity). */
export async function setTrendQuery(words: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun commerce." };
  const clean = words.replace(/\s+/g, " ").trim().slice(0, 60);
  if (clean && clean.length < 3) return { ok: false, error: "Écris au moins un mot, comme « salon de coiffure »." };
  const db = supabaseAdmin();
  const { error } = await db.from("studios").update({ trend_query: clean || null }).eq("id", member.studio.id);
  if (error) return { ok: false, error: "Ça n’est pas passé. Réessaie dans un instant." };
  const { data } = await db.from("studios").select("trend_query, business_type").eq("id", member.studio.id).maybeSingle();
  const query = trendQueryOf(data?.trend_query as string | null, data?.business_type as string | null);
  // New words are searched now; the page shows them as soon as they arrive.
  if (query) after(() => refreshTrends(query).catch((e: unknown) => console.error("trends: refresh failed", query, e)));
  revalidatePath("/tendances");
  return { ok: true };
}
