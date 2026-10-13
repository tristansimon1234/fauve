import "server-only";
import { CREDIT_PRICES, montageCharge, MONTHLY_CREDITS, quoteMontage, quoteVariant, type MotionTemplate, type QuoteLine } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Credits (see packages/agent/src/credits.ts for the price list). The balance is
// the sum of the ledger, topped up once a month. A montage is quoted first, the
// manager says yes, and the real cost is charged once the video is delivered.

const QUOTE_TTL_MS = 24 * 3600_000;

export type Reason = "montage" | "correction" | "variant" | "moodboard" | "adjustment";
export type VariantChange = { template?: MotionTemplate; hook?: string };

/** The studio's balance, after this month's top-up. */
export async function creditBalance(studioId: string): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("ensure_monthly_credits", { p_studio: studioId, p_allowance: MONTHLY_CREDITS });
  if (error) throw new Error(`credits: ${error.message}`);
  return data as number;
}

export async function chargeCredits(studioId: string, credits: number, reason: Reason, label: string, ref: Record<string, unknown> = {}) {
  if (credits <= 0) return;
  const { error } = await supabaseAdmin().from("credit_ledger").insert({ studio_id: studioId, delta: -credits, reason, label, ref });
  if (error) console.error("credit charge not recorded", error.message);
}

export type Quote = {
  id: string;
  lines: QuoteLine[];
  base: number;
  max: number;
  maxNewScenes: number;
  balance: number;
};

/**
 * Quotes a montage (or a correction) for the manager. With too few credits for
 * every new scene, it allows fewer; below the base price, it cannot be done.
 */
export async function createMontageQuote(input: {
  studioId: string;
  postId: string;
  mediaIds: string[];
  brief?: string;
  correction: boolean;
  maxNewScenes?: number;
  /** A variant of the delivered montage (render only) instead of a montage. */
  variant?: VariantChange;
}): Promise<Quote | { error: string; balance: number; needed: number }> {
  const balance = await creditBalance(input.studioId);
  let quote = input.variant
    ? quoteVariant()
    : quoteMontage({ clips: input.mediaIds.length, correction: input.correction, maxNewScenes: input.maxNewScenes });
  if (balance < quote.base) return { error: "solde insuffisant", balance, needed: quote.base };
  if (balance < quote.max && !input.variant) {
    const affordable = Math.floor((balance - quote.base) / CREDIT_PRICES.newScene);
    quote = quoteMontage({ clips: input.mediaIds.length, correction: input.correction, maxNewScenes: affordable });
  }
  const { data, error } = await supabaseAdmin()
    .from("credit_quotes")
    .insert({
      studio_id: input.studioId,
      post_id: input.postId,
      kind: input.variant ? "variant" : input.correction ? "correction" : "montage",
      base: quote.base,
      max: quote.max,
      lines: quote.lines,
      params: { media_ids: input.mediaIds, brief: input.brief ?? null, max_new_scenes: quote.maxNewScenes, variant: input.variant ?? null },
      expires_at: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`credit_quotes: ${error.message}`);
  return { id: data.id as string, ...quote, balance };
}

export type AcceptedQuote = {
  id: string;
  postId: string;
  kind: "montage" | "correction" | "variant";
  mediaIds: string[];
  brief: string | null;
  maxNewScenes: number;
  variant: VariantChange | null;
};

/**
 * Starts the quoted work. The quote must come from an earlier turn (the manager
 * has seen the price and answered), be unused and unexpired, and still be affordable.
 */
export async function acceptQuote(studioId: string, quoteId: string, turnStartedAt: Date): Promise<AcceptedQuote | { error: string }> {
  const db = supabaseAdmin();
  const { data: q } = await db
    .from("credit_quotes")
    .select("id, post_id, kind, base, params, expires_at, used_at, created_at")
    .eq("id", quoteId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!q) return { error: "Devis introuvable : refais un devis avec quote_montage." };
  if (q.used_at) return { error: "Ce devis a déjà été utilisé : refais un devis pour un nouveau montage." };
  if (new Date(q.expires_at as string).getTime() < Date.now()) return { error: "Ce devis a expiré : refais un devis." };
  if (new Date(q.created_at as string).getTime() >= turnStartedAt.getTime()) {
    return { error: "Montre d'abord le plan et le coût à la gérante, et attends son accord avant de lancer." };
  }
  if ((await creditBalance(studioId)) < (q.base as number)) return { error: "Solde de crédits insuffisant pour ce devis." };
  const claimed = await db.from("credit_quotes").update({ used_at: new Date().toISOString() }).eq("id", quoteId).is("used_at", null).select("id");
  if (!claimed.data?.length) return { error: "Ce devis a déjà été utilisé." };
  const params = (q.params ?? {}) as { media_ids?: string[]; brief?: string | null; max_new_scenes?: number; variant?: VariantChange | null };
  return {
    id: q.id as string,
    postId: q.post_id as string,
    kind: q.kind as AcceptedQuote["kind"],
    mediaIds: params.media_ids ?? [],
    brief: params.brief ?? null,
    maxNewScenes: params.max_new_scenes ?? 0,
    variant: params.variant ?? null,
  };
}

/** Charges a delivered montage: its real new scenes, never above the quote. Once per quote. */
export async function chargeQuote(quoteId: string, newScenes: number, title: string): Promise<void> {
  const db = supabaseAdmin();
  const claimed = await db
    .from("credit_quotes")
    .update({ charged_at: new Date().toISOString() })
    .eq("id", quoteId)
    .is("charged_at", null)
    .select("studio_id, post_id, kind, base, max")
    .maybeSingle();
  const q = claimed.data;
  if (!q) return;
  const credits = montageCharge({ base: q.base as number, max: q.max as number }, newScenes);
  const kind = q.kind as AcceptedQuote["kind"];
  const label = { montage: "Montage", correction: "Correction", variant: "Variante" }[kind];
  await chargeCredits(q.studio_id as string, credits, kind, `${label} « ${title} »`, {
    quote_id: quoteId,
    post_id: q.post_id,
    new_scenes: newScenes,
  });
}
