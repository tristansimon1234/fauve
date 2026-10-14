import { type NextRequest } from "next/server";
import { z } from "zod";
import { CREDIT_VALUE_EUR, MONTHLY_COST_BUDGET_EUR, PLAN_PRICE_EUR, studioMonth, TARGET_MARGIN } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidTestKey } from "@/lib/test-studio";

// Admin view of the margin, protected by FAUVE_TEST_KEY:
//   ?cle=…                  this month, every studio: what it cost (chat, work, by purpose)
//   ?cle=…&month=2026-10    another month
// against its plan, the credits it used and the budget left before the margin falls under the target.

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
  const month = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .catch(new Date().toISOString().slice(0, 7))
    .parse(params.get("month") ?? undefined);
  const from = `${month}-01T00:00:00Z`;
  const to = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString();

  const db = supabaseAdmin();
  const [studios, costs, ledger] = await Promise.all([
    db.from("studios").select("id, name"),
    db.from("cost_events").select("studio_id, kind, cost_eur, meta").gte("created_at", from).lt("created_at", to).limit(50_000),
    db.from("credit_ledger").select("studio_id, delta").lt("delta", 0).gte("created_at", from).lt("created_at", to).limit(50_000),
  ]);
  if (costs.error) return Response.json({ error: costs.error.message }, { status: 500 });

  const rows = (studios.data ?? []).map((s) => {
    const own = (costs.data ?? [])
      .filter((c) => c.studio_id === s.id)
      .map((c) => ({ purpose: ((c.meta as { purpose?: string } | null)?.purpose ?? c.kind) as string, eur: Number(c.cost_eur ?? 0) }));
    const creditsUsed = -(ledger.data ?? []).filter((l) => l.studio_id === s.id).reduce((sum, l) => sum + (l.delta as number), 0);
    const result = studioMonth(own);
    return {
      studio: s.name,
      id: s.id,
      ...result,
      credits_used: creditsUsed,
      // What the work cost per credit used (it must stay under half a credit's worth).
      cost_per_credit: creditsUsed ? Math.round((result.work / creditsUsed) * 1000) / 1000 : null,
      under_target: result.margin < TARGET_MARGIN,
    };
  });
  rows.sort((a, b) => b.total - a.total);
  return Response.json({
    month,
    plan_eur: PLAN_PRICE_EUR,
    target_margin: TARGET_MARGIN,
    monthly_cost_budget_eur: MONTHLY_COST_BUDGET_EUR,
    credit_value_eur: Math.round(CREDIT_VALUE_EUR * 1000) / 1000,
    studios: rows,
  });
}
