import "server-only";
import {
  CREDIT_PRICES,
  EFFORTS,
  effortSchema,
  montageCharge,
  montagePlanSchema,
  MONTHLY_CREDITS,
  otherEffort,
  planBrief,
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

export type Reason = "montage" | "correction" | "variant" | "moodboard" | "text_layer" | "adjustment";
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
  /** Level of care (null for a variant). */
  effort: Effort | null;
  /** The price at each level the balance allows, for the manager to choose. */
  efforts: Partial<Record<Effort, MontageQuote>>;
};

/** Where a launched montage is in the chain (montage_status, the quote card). */
export type QuoteStage = "design" | "alternative" | "render" | "review" | "fix" | "delivered";

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
  let quote = quoteMontage({ ...input, effort });
  const sure = quote.base + quote.fixRounds * CREDIT_PRICES.fixRound;
  if (balance < sure) return null;
  if (balance < quote.max) {
    const affordable = Math.floor((balance - sure) / CREDIT_PRICES.newScene);
    quote = quoteMontage({ ...input, effort, maxNewScenes: Math.min(quote.maxNewScenes, affordable) });
  }
  return quote;
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
  const db = supabaseAdmin();
  const { data: q } = await db
    .from("credit_quotes")
    .select("id, post_id, kind, base, max, lines, effort, params, expires_at, used_at, created_at")
    .eq("id", quoteId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!q) return { error: "Devis introuvable : refais un devis avec quote_montage." };
  if (q.used_at) return { error: "Ce devis a déjà été utilisé : refais un devis pour un nouveau montage." };
  if (new Date(q.expires_at as string).getTime() < Date.now()) return { error: "Ce devis a expiré : refais un devis." };
  if (!immediate && new Date(q.created_at as string).getTime() >= turnStartedAt.getTime()) {
    return { error: "Montre d'abord le plan et le coût à la gérante, et attends son accord avant de lancer." };
  }
  // Another level than quoted: its own price, kept on the quote when it was made.
  const current = effortSchema.nullable().catch(null).parse(q.effort);
  const level = effort && effort !== current && q.kind !== "variant" ? quoteEfforts(q.params)[effort] : undefined;
  if (effort && effort !== current && q.kind !== "variant" && !level) {
    return { error: `Le niveau ${EFFORTS[effort].label} n'est pas possible pour ce devis (solde insuffisant) : garde le niveau du devis ou refais un devis.` };
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
    return { error: "Solde de crédits insuffisant pour ce devis : propose un niveau plus simple ou refais un devis." };
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
  if (!claimed.data?.length) return { error: "Ce devis a déjà été utilisé." };
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

/** The latest unused quote made before this turn (the one the manager has seen), if any. */
export async function lastPresentedQuote(studioId: string, turnStartedAt: Date): Promise<{ id: string; title: string } | null> {
  const { data } = await supabaseAdmin()
    .from("credit_quotes")
    .select("id, posts(title)")
    .eq("studio_id", studioId)
    .is("used_at", null)
    .lt("created_at", turnStartedAt.toISOString())
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const post = data.posts as { title?: string | null } | { title?: string | null }[] | null;
  const title = (Array.isArray(post) ? post[0]?.title : post?.title) ?? "publication";
  return { id: data.id as string, title };
}

/**
 * Charges a delivered montage: its real new scenes and corrections, never above the quote. Once per quote.
 * skipReview: the quote priced Fauve watching the video but the critic could not (it is not charged).
 */
export async function chargeQuote(
  quoteId: string,
  newScenes: number,
  title: string,
  fixRounds = 0,
  /** Work the quote priced that did not happen: the review, the second take. */
  { skipReview = false, skipAlternative = false } = {},
): Promise<void> {
  const db = supabaseAdmin();
  const claimed = await db
    .from("credit_quotes")
    .update({ charged_at: new Date().toISOString() })
    .eq("id", quoteId)
    .is("charged_at", null)
    .select("studio_id, post_id, kind, base, max, effort")
    .maybeSingle();
  const q = claimed.data;
  if (!q) return;
  const skipped = (skipReview ? CREDIT_PRICES.review : 0) + (skipAlternative ? CREDIT_PRICES.alternative : 0);
  const credits = Math.max(0, montageCharge({ base: q.base as number, max: q.max as number }, newScenes, fixRounds) - skipped);
  const kind = q.kind as AcceptedQuote["kind"];
  const level = effortSchema.nullable().catch(null).parse(q.effort);
  const label = `${{ montage: "Montage", correction: "Correction", variant: "Variante" }[kind]}${level && level !== "rapide" ? ` ${EFFORTS[level].label}` : ""}`;
  await chargeCredits(q.studio_id as string, credits, kind, `${label} « ${title} »`, {
    quote_id: quoteId,
    post_id: q.post_id,
    new_scenes: newScenes,
    fix_rounds: fixRounds,
  });
}
