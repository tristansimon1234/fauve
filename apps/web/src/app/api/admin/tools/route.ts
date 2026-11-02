import { z } from "zod";
import { groupGaps, toolsDigest } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toolsWeek } from "@/lib/toolkit";

// Edith's own tools (lib/toolkit.ts), for the team, with CRON_SECRET (Authorization: Bearer …, from the database by
// call_app): POST shows the week (the gaps grouped, the tools, the switch, what making them cost, the weekly message
// as it would read); ?autonomy=on|off flips the switch of their making; ?budget=<euros> sets its weekly budget.

const query = z.object({
  autonomy: z.enum(["on", "off"]).optional(),
  budget: z.coerce.number().min(0).max(1000).optional(),
});

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const asked = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!asked.success) return Response.json({ error: "autonomy=on|off, budget=<euros>" }, { status: 400 });
  const db = supabaseAdmin();
  if (asked.data.autonomy || asked.data.budget !== undefined) {
    const { error } = await db
      .from("tool_settings")
      .update({
        ...(asked.data.autonomy ? { autonomy: asked.data.autonomy === "on" } : {}),
        ...(asked.data.budget !== undefined ? { weekly_budget_eur: asked.data.budget } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  const [week, tools] = await Promise.all([toolsWeek(), db.from("tools").select("key, kind, status, current_version, studio_id, card, created_at, retired_why").order("created_at", { ascending: false }).limit(100)]);
  return Response.json({ week: { ...week, gaps: groupGaps(week.gaps) }, tools: tools.data ?? [], message: toolsDigest(week) });
}
