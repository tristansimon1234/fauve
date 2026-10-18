import "server-only";
import { studioAccess } from "@/lib/billing/access";
import {
  accessMessage,
  CREDIT_PRICES,
  effectCredits,
  EFFORTS,
  effortSchema,
  montageCharge,
  montagePlanSchema,
  PLANS,
  planOf,
  otherEffort,
  planBrief,
  quoteEffect,
  quoteMontage,
  quoteVariant,
  type Effort,
  type MontagePlan,
  type MontageQuote,
  type MotionTemplate,
  type QuoteLine,
} from "@fauve/agent";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { finishJob, setJobStage, startJob } from "@/lib/studio-jobs";

// Credits (see packages/agent/src/credits.ts for the price list). The balance is
// the sum of the ledger, topped up once a month. A montage is quoted first, the
// manager says yes, and the real cost is charged once the video is delivered.

const QUOTE_TTL_MS = 24 * 3600_000;

export type Reason = "montage" | "correction" | "variant" | "moodboard" | "text_layer" | "image" | "adjustment";
export type VariantChange = { template?: MotionTemplate; hook?: string };

/** The studio's balance, after this month's top-up. */
export async function creditBalance(studioId: string): Promise<number> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("plan").eq("id", studioId).maybeSingle();
  const { data, error } = await db.rpc("ensure_monthly_credits", { p_studio: studioId, p_allowance: PLANS[planOf(studio?.plan)].credits });
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
  /** Level of care (null for a variant). */
  effort: Effort | null;
  /** The price at each level the balance allows, for the manager to choose. */
  efforts: Partial<Record<Effort, MontageQuote>>;
};

/** Where a launched montage is in the chain (montage_status, the quote card). */
export type QuoteStage = "design" | "effects" | "alternative" | "render" | "review" | "fix" | "delivered";

/**
 * Her Reel goes to the effects agent: the launched work is priced as one (quoteEffect: the chain's price
 * as its floor, a ceiling held while it works, the real charge once it is made), the chain's price kept
 * aside in case the chain takes it back. Returns the ceiling (the session's budget follows it); null when
 * her credits leave too small a ceiling for an effect.
 */
export async function switchQuoteToEffect(quoteId: string, correction: boolean): Promise<number | null> {
  const db = supabaseAdmin();
  const { data: q } = await db.from("credit_quotes").select("studio_id, base, max, lines, params, charged_at").eq("id", quoteId).maybeSingle();
  if (!q || q.charged_at) return null;
  const params = (q.params ?? {}) as Record<string, unknown>;
  if (params.chain) return q.max as number;
  const effect = quoteEffect({ correction, floor: q.base as number, available: await availableCredits(q.studio_id as string, quoteId) });
  if (!effect) return null;
  const { error } = await db
    .from("credit_quotes")
    .update({ base: effect.base, max: effect.max, lines: effect.lines, params: { ...params, chain: { base: q.base, max: q.max, lines: q.lines } } })
    .eq("id", quoteId)
    .is("charged_at", null);
  if (error) {
    console.warn("credit_quotes: effect price not set", error.message);
    return null;
  }
  return effect.max;
}

/** A launched quote the effects agent took (switchQuoteToEffect keeps the chain's price aside in its params). */
export const pricedAsEffect = (params: unknown): boolean => Boolean((params as { chain?: unknown } | null)?.chain);

/** The chain takes the Reel back from the effects agent: its own price again. */
export async function restoreChainQuote(quoteId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: q } = await db.from("credit_quotes").select("params, charged_at").eq("id", quoteId).maybeSingle();
  const params = (q?.params ?? {}) as { chain?: { base: number; max: number; lines: QuoteLine[] } } & Record<string, unknown>;
  if (!q || q.charged_at || !params.chain) return;
  const { chain, ...rest } = params;
  await db.from("credit_quotes").update({ base: chain.base, max: chain.max, lines: chain.lines, params: rest }).eq("id", quoteId).is("charged_at", null);
}

/**
 * What can still be spent: the balance minus the most each montage in flight
 * (launched, not yet charged, recent) may cost, so two launches cannot both
 * count on the same credits.
 */
export async function availableCredits(studioId: string, exceptQuoteId?: string): Promise<number> {
  const [balance, inFlight] = await Promise.all([
    creditBalance(studioId),
    supabaseAdmin()
      .from("credit_quotes")
      .select("id, max")
      .eq("studio_id", studioId)
      .not("used_at", "is", null)
      .is("charged_at", null)
      .gt("used_at", new Date(Date.now() - 2 * 3600_000).toISOString()),
  ]);
  const held = (inFlight.data ?? []).filter((q) => q.id !== exceptQuoteId).reduce((sum, q) => sum + ((q.max as number) ?? 0), 0);
  return Math.max(0, balance - held);
}

/** Lower levels first when the chosen one is out of reach. */
const LEVELS: Effort[] = ["max", "soigne", "rapide"];

/**
 * The price of a montage at a level, fitted to the balance: fewer new scenes
 * when they do not all fit; null when even its corrections do not fit.
 */
/** Clips to analyse: the videos only (a photo is read for free). */
async function videoCount(studioId: string, mediaIds: string[]): Promise<number> {
  if (!mediaIds.length) return 0;
  const { data } = await supabaseAdmin().from("media_assets").select("id").eq("studio_id", studioId).eq("kind", "image").in("id", mediaIds);
  return mediaIds.length - (data?.length ?? 0);
}

function priceAt(input: { clips: number; correction: boolean; maxNewScenes?: number }, effort: Effort, balance: number): MontageQuote | null {
  // Fewer new scenes when they do not all fit (the library and fixed scenes do the rest).
  for (let scenes = quoteMontage({ ...input, effort }).maxNewScenes; scenes >= 0; scenes--) {
    const quote = quoteMontage({ ...input, effort, maxNewScenes: scenes });
    if (quote.max <= balance) return quote;
  }
  return null;
}

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
  /** Fauve's proposed plan: shown on the quote, its animations set the new scenes allowed. */
  plan?: MontagePlan;
  /** Level of care (a variant has none); a lower one is quoted when the balance is short. */
  effort?: Effort;
}): Promise<Quote | { error: string; balance: number; needed: number }> {
  const balance = await availableCredits(input.studioId);
  if (input.plan && input.maxNewScenes === undefined) {
    input = { ...input, maxNewScenes: input.plan.scenes.filter((s) => s.kind === "animation").length };
  }
  const work = { clips: await videoCount(input.studioId, input.mediaIds), correction: input.correction, maxNewScenes: input.maxNewScenes };
  const efforts: Partial<Record<Effort, MontageQuote>> = {};
  if (!input.variant) {
    for (const level of LEVELS) {
      const price = priceAt(work, level, balance);
      if (price) efforts[level] = price;
    }
  }
  const wanted = input.effort ?? "rapide";
  // The level asked for, or the best one below it that the balance allows.
  const effort = input.variant ? null : (LEVELS.slice(LEVELS.indexOf(wanted)).find((l) => efforts[l]) ?? null);
  const quote = input.variant ? quoteVariant() : effort ? efforts[effort]! : null;
  // Another level is offered only if it keeps the quoted level's new animations (it would silently drop them).
  for (const level of LEVELS) if (level !== effort && efforts[level] && quote && efforts[level]!.maxNewScenes < quote.maxNewScenes) delete efforts[level];
  if (!quote || balance < quote.base) {
    const needed = input.variant ? quoteVariant().base : quoteMontage({ ...work, effort: "rapide", maxNewScenes: 0 }).base;
    return { error: "solde insuffisant", balance, needed };
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
      effort,
      params: {
        media_ids: input.mediaIds,
        brief: input.brief ?? null,
        max_new_scenes: quote.maxNewScenes,
        variant: input.variant ?? null,
        plan: input.plan ?? null,
        efforts,
      },
      expires_at: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`credit_quotes: ${error.message}`);
  return { id: data.id as string, ...quote, balance, effort, efforts };
}

export type AcceptedQuote = {
  id: string;
  postId: string;
  kind: "montage" | "correction" | "variant";
  mediaIds: string[];
  brief: string | null;
  maxNewScenes: number;
  variant: VariantChange | null;
  /** Level of care; null for a variant or an older quote (one version, no review). */
  effort: Effort | null;
};

const levelPriceSchema = z.object({
  lines: z.array(z.object({ label: z.string(), credits: z.number() })),
  base: z.number().int().min(0),
  max: z.number().int().min(0),
  maxNewScenes: z.number().int().min(0),
  fixRounds: z.number().int().min(0),
});

/** The prices per level kept on a quote (older quotes have none). */
export function quoteEfforts(params: unknown): Partial<Record<Effort, MontageQuote>> {
  const raw = (params as { efforts?: Record<string, unknown> } | null)?.efforts ?? {};
  const out: Partial<Record<Effort, MontageQuote>> = {};
  for (const level of effortSchema.options) {
    const parsed = levelPriceSchema.safeParse(raw[level]);
    if (parsed.success) out[level] = parsed.data;
  }
  return out;
}

/**
 * Starts the quoted work. The quote must come from an earlier turn (the manager
 * has seen the price and answered), be unused and unexpired, and still be affordable.
 */
export async function acceptQuote(
  studioId: string,
  quoteId: string,
  turnStartedAt: Date,
  /**
   * immediate: a small montage started in the same turn as its quote (no yes needed);
   * effort: the level the manager picked on the card or in her answer, at its quoted price.
   */
  { immediate = false, effort }: { immediate?: boolean; effort?: Effort } = {},
): Promise<AcceptedQuote | { error: string }> {
  // Nothing starts without a subscription (past her first publication) or credits.
  const access = await studioAccess(studioId);
  if (!access.create) return { error: accessMessage(access.reason) };
  const db = supabaseAdmin();
  const { data: q } = await db
    .from("credit_quotes")
    .select("id, post_id, kind, base, max, lines, effort, params, expires_at, used_at, created_at")
    .eq("id", quoteId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!q) return { error: "Montage introuvable : relance-le avec montage." };
  if (q.used_at) return { error: "Ce montage est déjà lancé." };
  if (new Date(q.expires_at as string).getTime() < Date.now()) return { error: "Cette proposition a expiré : relance avec montage." };
  if (!immediate && new Date(q.created_at as string).getTime() >= turnStartedAt.getTime()) {
    return { error: "Montre d'abord le plan et le coût à la gérante, et attends son accord avant de lancer." };
  }
  // Another level than quoted: its own price, kept on the quote when it was made.
  const current = effortSchema.nullable().catch(null).parse(q.effort);
  const level = effort && effort !== current && q.kind !== "variant" ? quoteEfforts(q.params)[effort] : undefined;
  if (effort && effort !== current && q.kind !== "variant" && !level) {
    return { error: `Le niveau ${EFFORTS[effort].label} n'est pas possible avec le solde : garde le niveau prévu.` };
  }
  const params = (q.params ?? {}) as { media_ids?: string[]; brief?: string | null; max_new_scenes?: number; variant?: VariantChange | null; plan?: unknown };
  const available = await availableCredits(studioId, quoteId);
  const chosen = level ? effort! : current;
  // The level's price again, against what can be spent now (other montages may have run since the quote):
  // its corrections must fit, and fewer new scenes are allowed when they no longer all fit.
  const price =
    q.kind === "variant" || !chosen
      ? { base: q.base as number, max: q.max as number, lines: q.lines as QuoteLine[], maxNewScenes: params.max_new_scenes ?? 0 }
      : priceAt(
          { clips: await videoCount(studioId, params.media_ids ?? []), correction: q.kind === "correction", maxNewScenes: level ? level.maxNewScenes : (params.max_new_scenes ?? 0) },
          chosen,
          available,
        );
  if (!price || available < price.base) {
    return { error: "Pas assez de crédits pour ce montage : dis-le simplement, sans rien lancer." };
  }
  const repriced = q.kind !== "variant" && chosen && (level || price.max !== q.max);
  const claimed = await db
    .from("credit_quotes")
    .update({
      used_at: new Date().toISOString(),
      ...(repriced ? { effort: chosen, base: price.base, max: price.max, lines: price.lines, params: { ...params, max_new_scenes: price.maxNewScenes } } : {}),
    })
    .eq("id", quoteId)
    .is("used_at", null)
    .select("id");
  if (!claimed.data?.length) return { error: "Ce montage est déjà lancé." };
  // The plan the manager said yes to goes to the editor with the brief.
  const plan = montagePlanSchema.safeParse(params.plan);
  const brief = [params.brief, plan.success ? planBrief(plan.data) : null].filter(Boolean).join("\n\n") || null;
  return {
    id: q.id as string,
    postId: q.post_id as string,
    kind: q.kind as AcceptedQuote["kind"],
    mediaIds: params.media_ids ?? [],
    brief,
    maxNewScenes: price.maxNewScenes,
    variant: params.variant ?? null,
    effort: q.kind === "variant" ? null : level ? effort! : current,
  };
}

/** WhatsApp buttons under a quote: yes, the other level worth offering, not now. None once it is launched (a small montage starts at once). */
export async function quoteButtons(studioId: string, quoteId: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from("credit_quotes").select("effort, params, used_at").eq("id", quoteId).eq("studio_id", studioId).maybeSingle();
  if (data?.used_at) return [];
  const effort = effortSchema.nullable().catch(null).parse(data?.effort ?? null);
  const other = effort ? otherEffort(effort, Object.keys(quoteEfforts(data?.params)) as Effort[]) : null;
  return ["Oui, lance", ...(other ? [`Version ${EFFORTS[other].label}`] : []), "Pas maintenant"];
}

/** Records where a launched montage is (montage_status and the quote card read it). */
export async function setQuoteStage(quoteId: string | undefined, stage: QuoteStage): Promise<void> {
  if (!quoteId) return;
  const { data, error } = await supabaseAdmin()
    .from("credit_quotes")
    .update({ stage, stage_at: new Date().toISOString() })
    .eq("id", quoteId)
    .select("studio_id, post_id")
    .maybeSingle();
  if (error) console.warn("credit_quotes: stage not recorded", error.message);
  // The progress the app shows (the job has the quote's id).
  if (stage === "delivered") await finishJob(quoteId);
  else if (stage === "design" && data) await startJob({ id: quoteId, studioId: data.studio_id as string, postId: (data.post_id as string | null) ?? null, kind: "montage", stage }).catch(() => {});
  else await setJobStage(quoteId, stage);
}

/**
 * What really happened, for the charge: work priced for a montage that did not happen (the review, when
 * the critic could not watch; the second take), and an effect's real cost in euros (null: not read).
 */
type ChargeFacts = { skipReview?: boolean; skipAlternative?: boolean; effectEur?: number | null };

/** The credits a delivered montage costs: its real new scenes and corrections, an effect its real cost, never above what was priced. */
function chargeOf(q: { base: unknown; max: unknown; lines: unknown; params: unknown }, newScenes: number, fixRounds: number, facts: ChargeFacts): number {
  if (pricedAsEffect(q.params)) return effectCredits({ agentEur: facts.effectEur ?? null, floor: q.base as number, ceiling: q.max as number });
  const skipped = (facts.skipReview ? CREDIT_PRICES.review : 0) + (facts.skipAlternative ? CREDIT_PRICES.alternative : 0);
  return Math.max(0, montageCharge({ base: q.base as number, max: q.max as number, lines: q.lines as QuoteLine[] }, newScenes, fixRounds) - skipped);
}

/** What delivering a montage will cost, and what will be left, before it is charged (said in the delivery message). */
export async function montageCost(quoteId: string, newScenes: number, fixRounds = 0, facts: ChargeFacts = {}): Promise<{ credits: number; left: number } | null> {
  const { data: q } = await supabaseAdmin().from("credit_quotes").select("studio_id, base, max, lines, params, charged_at").eq("id", quoteId).maybeSingle();
  if (!q || q.charged_at) return null;
  const credits = chargeOf(q, newScenes, fixRounds, facts);
  return { credits, left: Math.max(0, (await creditBalance(q.studio_id as string)) - credits) };
}

/** Charges a delivered montage: its real new scenes and corrections, an effect its real cost, never above what was priced. Once per montage. */
export async function chargeQuote(quoteId: string, newScenes: number, title: string, fixRounds = 0, facts: ChargeFacts = {}): Promise<void> {
  const db = supabaseAdmin();
  const claimed = await db
    .from("credit_quotes")
    .update({ charged_at: new Date().toISOString() })
    .eq("id", quoteId)
    .is("charged_at", null)
    .select("studio_id, post_id, kind, base, max, lines, effort, params")
    .maybeSingle();
  const q = claimed.data;
  if (!q) return;
  const credits = chargeOf(q, newScenes, fixRounds, facts);
  const kind = q.kind as AcceptedQuote["kind"];
  const level = effortSchema.nullable().catch(null).parse(q.effort);
  const label = pricedAsEffect(q.params)
    ? kind === "correction"
      ? "Correction de l’effet"
      : "Effet image par image"
    : `${{ montage: "Montage", correction: "Correction", variant: "Variante" }[kind]}${level && level !== "rapide" ? ` ${EFFORTS[level].label}` : ""}`;
  await chargeCredits(q.studio_id as string, credits, kind, `${label} « ${title} »`, {
    quote_id: quoteId,
    post_id: q.post_id,
    new_scenes: newScenes,
    fix_rounds: fixRounds,
    ...(facts.effectEur !== undefined ? { effect_eur: facts.effectEur } : {}),
  });
}
