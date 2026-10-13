import { type NextRequest } from "next/server";
import { z } from "zod";
import { creditBalance } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidTestKey } from "@/lib/test-studio";

// Admin helper for credits, protected by FAUVE_TEST_KEY:
//   ?cle=…&studio=<id>               balance and last movements
//   ?cle=…&studio=<id>&add=50        adds (or with a negative number removes) credits

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
  const studio = z.uuid().safeParse(params.get("studio"));
  if (!studio.success) return Response.json({ error: "studio=<uuid> attendu" }, { status: 400 });

  const add = params.get("add");
  if (add !== null) {
    const delta = z.coerce.number().int().min(-1000).max(1000).safeParse(add);
    if (!delta.success || delta.data === 0) return Response.json({ error: "add=<entier non nul>" }, { status: 400 });
    const { error } = await supabaseAdmin()
      .from("credit_ledger")
      .insert({ studio_id: studio.data, delta: delta.data, reason: "adjustment", label: delta.data > 0 ? "Crédits offerts" : "Ajustement" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const balance = await creditBalance(studio.data);
  const { data } = await supabaseAdmin()
    .from("credit_ledger")
    .select("delta, reason, label, created_at")
    .eq("studio_id", studio.data)
    .order("created_at", { ascending: false })
    .limit(20);
  return Response.json({ balance, history: data ?? [] });
}
