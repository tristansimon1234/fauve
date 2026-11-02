import "server-only";
import { gapLabel, ourStudio, toolsDigest, type GapSource } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tellTeamOnce } from "@/lib/reply-cap";

// Edith's own tools (packages/agent/src/toolkit.ts): what the code could not do is noted here, and the team is told
// each week what was missing and what became of the tools. Never in the way of a Reel: a note that fails is only logged.

/** The cost events of the tools' making carry this purpose prefix (agents and renders that make and prove a tool). */
export const TOOL_COST_PURPOSE = "tool_";
/** The weekly message is sent once in this many days. */
const DIGEST_EVERY_DAYS = 6;

/** Notes a request the code could not serve (the copy remade by code, the chain), or one that needed the workshop. */
export async function noteGap(gap: { studioId: string; postId?: string | null; source: GapSource; label: string; request?: string | null; detail?: string | null }): Promise<void> {
  const label = gapLabel(gap.label);
  if (!label) return;
  try {
    const { error } = await supabaseAdmin()
      .from("capability_gaps")
      .insert({
        studio_id: gap.studioId,
        post_id: gap.postId ?? null,
        source: gap.source,
        label,
        request: gap.request?.trim().slice(0, 1000) || null,
        detail: gap.detail?.trim().slice(0, 1000) || null,
      });
    if (error) console.warn("capability gap not kept", gap.source, label, error.message);
  } catch (error) {
    console.warn("capability gap not kept", gap.source, label, error);
  }
}

/** The switch and the weekly budget of the tools' making. */
export async function toolSettings(): Promise<{ autonomy: boolean; weeklyBudgetEur: number }> {
  const { data } = await supabaseAdmin().from("tool_settings").select("autonomy, weekly_budget_eur").eq("id", true).maybeSingle();
  return { autonomy: data?.autonomy !== false, weeklyBudgetEur: Number(data?.weekly_budget_eur ?? 10) };
}

/** What making and proving tools cost since `since`. */
export async function toolSpendEur(since: string): Promise<number> {
  const { data } = await supabaseAdmin().from("cost_events").select("cost_eur").gte("created_at", since).like("meta->>purpose", `${TOOL_COST_PURPOSE}%`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_eur ?? 0), 0);
}

/** The week of the tools: the gaps of real businesses (the team's and the lab's aside), the tools and what moved. */
export async function toolsWeek() {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const [gaps, tools, versions, settings, spent] = await Promise.all([
    db.from("capability_gaps").select("label, source, studios(name, team, website_url)").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    db.from("tools").select("status, created_at, retired_at"),
    db.from("tool_versions").select("version, status, created_at").gte("created_at", since),
    toolSettings(),
    toolSpendEur(since),
  ]);
  const real = (gaps.data ?? []).filter((g) => {
    const s = (Array.isArray(g.studios) ? g.studios[0] : g.studios) as { team?: boolean | null; website_url?: string | null; name?: string | null } | null;
    return !s || !ourStudio(s);
  });
  const all = tools.data ?? [];
  const fresh = (at: unknown) => typeof at === "string" && at >= since;
  return {
    gaps: real.map((g) => ({ label: g.label as string, source: g.source as GapSource })),
    tools: {
      trial: all.filter((t) => t.status === "trial").length,
      active: all.filter((t) => t.status === "active").length,
      made: all.filter((t) => fresh(t.created_at)).length,
      promoted: (versions.data ?? []).filter((v) => v.status === "active").length,
      updated: (versions.data ?? []).filter((v) => (v.version as number) > 1).length,
      retired: all.filter((t) => fresh(t.retired_at)).length,
    },
    autonomy: settings.autonomy,
    budgetEur: settings.weeklyBudgetEur,
    spentEur: spent,
  };
}

/** The team's weekly message on the tools, once in six days (sent from the morning cron). */
export async function sendToolsDigest(): Promise<void> {
  const db = supabaseAdmin();
  const { data: team } = await db.from("studios").select("id").eq("team", true).limit(1).maybeSingle();
  if (!team) return;
  const since = new Date(Date.now() - DIGEST_EVERY_DAYS * 24 * 3600_000).toISOString();
  const { count } = await db.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("studio_id", team.id).eq("payload->>kind", "tools_digest").gte("created_at", since);
  if (count) return;
  const text = toolsDigest(await toolsWeek());
  if (text) await tellTeamOnce("tools_digest", text);
}
