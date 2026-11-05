import "server-only";
import {
  candidateKey,
  candidateReading,
  claudeCostUsd,
  houseModel,
  ourStudio,
  proposedReel,
  readScoutJudge,
  reelEmbed,
  reelLink,
  SCOUT_JUDGE_PROMPT,
  SCOUT_MODEL,
  scoutAllows,
  scoutCatalogue,
  scoutJudgeInput,
  scoutJudgeSchema,
  statusOfVerdict,
  stolenStyleSchema,
  usdToEur,
  type CandidatePlatform,
  type CandidateSource,
  type CandidateStatus,
  type CandidateVerdict,
  type CopyNearest,
  type ScoutJudgement,
  type StolenStyle,
  type TokenUsage,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { withScoutCost } from "@/lib/cost-scope";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { readReel, type StealMissReason } from "@/lib/steal";
import { timeLeft } from "@/lib/step-clock";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The Reels that may become one of Edith's models (packages/agent/src/model-scout.ts; docs/modeles.md, « Modèles
// repérés »). A Reel a business sends to copy is judged on the reading made for her copy, after everything she sees
// (the end of /api/jobs/steal): nothing is told to her, a failure is only logged. A link Tristan proposes on /admin is
// read the same way (readReel, the reading of stealStyle) in its own job (/api/jobs/scout), then judged the same. The
// scout's costs are the team's, never a business's (cost_events.meta.scout = the Reel's key). Its judgement also says
// which model plays the Reel she copies, when one does its form (copyNearest, packages/agent/src/copy-model.ts).

/** The judgements of the Reels businesses send (capped each day, SCOUT_DAILY_EUR), and those of Tristan's links. */
const STEAL_PURPOSE = "scout_steal";
const ADMIN_PURPOSE = "scout_admin";
/** A link of Tristan's whose reading has not ended after this long has died: it can be read again. */
const STALE_MS = 15 * 60_000;

const one = <T>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

/** The team's studio: the scout is the team's work, and its cost the team's. */
async function teamStudio(): Promise<string | null> {
  const { data } = await supabaseAdmin().from("studios").select("id").eq("team", true).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

const sumEur = (rows: { cost_eur: unknown }[] | null) => (rows ?? []).reduce((sum, row) => sum + Number(row.cost_eur ?? 0), 0);

/** What judging the Reels businesses sent cost today (UTC): Tristan's links never stop theirs. */
async function judgedTodayEur(): Promise<number> {
  const since = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { data } = await supabaseAdmin().from("cost_events").select("cost_eur").gte("created_at", since).eq("meta->>purpose", STEAL_PURPOSE);
  return sumEur(data);
}

/** What reading and judging one Reel cost the team (its key on each cost). */
async function spentOn(key: string): Promise<number> {
  const { data } = await supabaseAdmin().from("cost_events").select("cost_eur").eq("meta->>scout", key);
  return Math.round(sumEur(data) * 10_000) / 10_000;
}

/** Logs a judgement for the team's studio (none without one), tagged with the Reel's key; its cost in euros. */
async function logJudgement(key: string, usage: TokenUsage, purpose: string): Promise<number> {
  const usd = claudeCostUsd(SCOUT_MODEL, usage);
  const eur = usdToEur(usd, env("USD_TO_EUR"));
  const { error } = await supabaseAdmin()
    .from("cost_events")
    .insert({ studio_id: await teamStudio(), kind: "llm", provider: "anthropic", units: usage.input_tokens + usage.output_tokens, cost_eur: eur, meta: { model: SCOUT_MODEL, purpose, usage, cost_usd: usd, scout: key } });
  if (error) console.error("cost_events insert failed", error.message);
  return eur;
}

/**
 * Judges a Reel on its reading (SCOUT_JUDGE_PROMPT, Sonnet at low effort): its verdict and cost, or null (never thrown).
 * Its cost is the team's (logJudgement), or, through `log`, a montage's that needs its nearest model now (copyNearest).
 */
async function judge(
  key: string,
  reading: StolenStyle,
  platform: CandidatePlatform,
  from: CandidateSource,
  log: (usage: TokenUsage) => Promise<number> = (usage) => logJudgement(key, usage, from === "steal" ? STEAL_PURPOSE : ADMIN_PURPOSE),
): Promise<(ScoutJudgement & { costEur: number }) | null> {
  try {
    const response = await anthropic().beta.messages.parse(
      {
        model: SCOUT_MODEL,
        max_tokens: 3000,
        output_config: { effort: "low", format: outputFormat(scoutJudgeSchema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: SCOUT_JUDGE_PROMPT },
          { type: "text", text: `Edith's models: ${scoutCatalogue()}` },
        ],
        messages: [{ role: "user", content: scoutJudgeInput({ reading, platform, from }) }],
      },
      { timeout: 90_000 },
    );
    const costEur = await log(response.usage);
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    return { ...readScoutJudge(response.parsed_output), costEur };
  } catch (error) {
    console.warn("scout: not judged", key, error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  }
}

/** A judgement as the candidate's columns. */
const judgedColumns = (j: ScoutJudgement) => ({
  verdict: j.verdict,
  nearest: j.nearest,
  closeness: j.closeness,
  name: j.name || null,
  novelty: j.novelty || null,
  trades: j.trades,
  needs: j.needs || null,
  score: j.score,
  why: j.why || null,
});

/** The key of the model of Edith's a Reel is the original of, the one it was written from (house_originals); null for none. */
async function originalOf(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("house_originals").select("key, link").not("link", "is", null);
  return ((data ?? []).find((o) => candidateKey(o.link as string) === key)?.key as string | undefined) ?? null;
}

/** Whether a Reel is the original one of Edith's models was written from. */
const isOriginal = async (key: string): Promise<boolean> => (await originalOf(key)) !== null;

/** One more request on a Reel already judged (count_model_candidate: two at once both count); false when none is kept. */
async function countRequest(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("count_model_candidate", { candidate_key: key });
  if (error) console.warn("scout: request not counted", key, error.message);
  return data === true;
}

/**
 * After a Reel a business sent to copy is read and everything she sees is done (/api/jobs/steal): her request counted
 * once on the Reel's candidate, and the Reel judged when nobody judged it before. Only a Reel sent by its link (a video
 * she sends may be her own footage) and read, from a real business (the team's and the lab's are tests). Best effort:
 * never thrown, never told to her.
 */
export async function scoutSteal(studioId: string, inspirationId: string): Promise<void> {
  try {
    const db = supabaseAdmin();
    const { data: row } = await db
      .from("inspirations")
      .select("source, url, style, scouted_at, studios(team, website_url)")
      .eq("id", inspirationId)
      .eq("studio_id", studioId)
      .maybeSingle();
    if (!row || row.source !== "link" || typeof row.url !== "string" || row.scouted_at) return;
    const studio = one(row.studios as { team?: boolean | null; website_url?: string | null } | null);
    if (!studio || ourStudio(studio)) return;
    const style = stolenStyleSchema.safeParse(row.style);
    const link = reelLink(row.url);
    const key = candidateKey(row.url);
    if (!style.success || !link || !key) return;
    // Counted once, marked on her request itself (a link sent again, a second run): the candidate never knows who.
    const { data: marked } = await db.from("inspirations").update({ scouted_at: new Date().toISOString() }).eq("id", inspirationId).is("scouted_at", null).select("id");
    if (!marked?.length || (await isOriginal(key))) return;
    // Judged before (another request, or Tristan's link): one more request, nothing paid.
    if (await countRequest(key)) return;
    if (!scoutAllows(await judgedTodayEur())) return void console.info("scout: today's judgements spent, not judged", key);
    const judged = await judge(key, style.data, link.platform, "steal");
    if (!judged) return;
    const { data: added, error } = await db
      .from("model_candidates")
      .upsert(
        { key, link: link.url, platform: link.platform, source: "steal", requests: 1, reading: candidateReading(style.data), ...judgedColumns(judged), cost_eur: judged.costEur, status: statusOfVerdict(judged.verdict) },
        { onConflict: "key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    // Judged at the same moment for another request: counted on that one.
    if (!added?.length) await countRequest(key);
    console.info("scout: judged", key, judged.verdict, judged.score);
  } catch (error) {
    console.warn("scout: a Reel to copy not judged", inspirationId, error instanceof Error ? error.message.slice(0, 300) : error);
  }
}

/** A Reel she sent judged for her montage alone (copyNearest): her studio's cost, counted for that montage. */
const COPY_PURPOSE = "copy_model";
/**
 * A Reel is judged during its montage only with this much left in the step (its limit is 800 s): the judgement (90 s at
 * most, twice at worst), then the skill, or the chain when its filler says no, as the step's other long calls.
 */
const COPY_JUDGE_NEEDS_MS = 420_000;

/** The judgement a Reel's candidate keeps: its nearest model and how close; none while it is read, or unreadable. */
async function judgedCandidate(key: string): Promise<CopyNearest | null> {
  const { data } = await supabaseAdmin().from("model_candidates").select("verdict, nearest, closeness").eq("key", key).maybeSingle();
  const nearest = houseModel(data?.nearest as string | null | undefined);
  if (!data?.verdict || data.verdict === "unreadable" || !nearest || data.closeness === null) return null;
  return { key: nearest.key, closeness: Number(data.closeness) };
}

/**
 * The nearest of Edith's models for a Reel she sent by its link to copy, when its montage is designed (copy-model.ts;
 * docs/recopie.md, « Un Reel recopié joué par un modèle d'Edith »): the model it is the original of (closeness 10, no
 * call), else the scout's judgement kept on its candidate, else, for a real business's Reel not judged yet, the
 * scout's judgement made now (scoutSteal: counted once, the team's cost, its candidate kept), else a judgement for this
 * montage alone (the team's or the lab's studio, today's judgements spent, one being judged for another request): the
 * same judge, its cost her studio's (counted for the montage, purpose copy_model), no candidate made nor counted. Judged
 * only with the time for it in the step (COPY_JUDGE_NEEDS_MS). Null for anything else (a video she sent may be her own
 * footage) or a failure: the montage goes on as before. Never thrown.
 */
export async function copyNearest(studioId: string, inspirationId: string): Promise<(CopyNearest & { by: "original" | "scout" | "montage" }) | null> {
  try {
    const { data: row } = await supabaseAdmin()
      .from("inspirations")
      .select("source, url, style, studios(team, website_url)")
      .eq("id", inspirationId)
      .eq("studio_id", studioId)
      .maybeSingle();
    if (!row || row.source !== "link" || typeof row.url !== "string") return null;
    const style = stolenStyleSchema.safeParse(row.style);
    const link = reelLink(row.url);
    const key = candidateKey(row.url);
    if (!style.success || !link || !key) return null;
    const original = houseModel(await originalOf(key));
    if (original) return { key: original.key, closeness: 10, by: "original" };
    const kept = await judgedCandidate(key);
    if (kept) return { ...kept, by: "scout" };
    if (timeLeft() < COPY_JUDGE_NEEDS_MS) {
      console.log("copy: no time left in the step to judge its nearest model, the chain makes it", inspirationId, Math.round(timeLeft() / 1000));
      return null;
    }
    const studio = one(row.studios as { team?: boolean | null; website_url?: string | null } | null);
    if (studio && !ourStudio(studio)) {
      await scoutSteal(studioId, inspirationId);
      const judged = await judgedCandidate(key);
      if (judged) return { ...judged, by: "scout" };
    }
    const judged = await judge(key, style.data, link.platform, "steal", async (usage) => {
      await logClaudeCost(studioId, usage, COPY_PURPOSE, SCOUT_MODEL, { reel: key });
      return usdToEur(claudeCostUsd(SCOUT_MODEL, usage), env("USD_TO_EUR"));
    });
    return judged?.nearest && judged.closeness !== null ? { key: judged.nearest, closeness: judged.closeness, by: "montage" } : null;
  } catch (error) {
    console.warn("copy: nearest model not found", inspirationId, error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  }
}

/**
 * A link Tristan proposes on /admin (his « veille »): a candidate at once, read like a Reel sent to copy and judged in its
 * own job. One already kept is the same (dropped, it comes back for him to look at; unread, it is read again).
 */
export async function proposeReel(text: string): Promise<{ id: string } | { error: string }> {
  const reel = proposedReel(text);
  if (!reel) return { error: "not an Instagram Reel or a TikTok" };
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const { data: known } = await db.from("model_candidates").select("id, status, verdict").eq("key", reel.key).maybeSingle();
  if (known) {
    const id = known.id as string;
    if (known.status === "dropped") await db.from("model_candidates").update({ status: "new", reviewed_at: null, updated_at: now }).eq("id", id);
    if (known.verdict === "unreadable") await reviewModelCandidate(id, "reread");
    return { id };
  }
  const { data, error } = await db.from("model_candidates").insert({ key: reel.key, link: reel.link, platform: reel.platform, source: "admin" }).select("id").single();
  if (error || !data) return { error: error?.message ?? "not kept" };
  await startReading(data.id as string);
  return { id: data.id as string };
}

/** Why a Reel could not be read, for Tristan. */
const MISS_WORDS: Record<StealMissReason, string> = {
  unreachable: "Le lien ne s’ouvre pas (Reel privé ou supprimé, ou le réseau refuse) : essaie un autre lien.",
  too_long: "Trop long pour être lu.",
  not_video: "Ce lien ne mène pas à une vidéo.",
  unreadable: "La lecture de la vidéo a échoué : relance-la.",
  not_found: "Introuvable.",
};

/** Reads and judges a link Tristan proposed (/api/jobs/scout): it stays in his list whatever the verdict. */
export async function readAndJudge(candidateId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: row } = await db.from("model_candidates").select("id, key, link, platform, source, reading, verdict").eq("id", candidateId).maybeSingle();
  if (!row || row.verdict) return;
  const key = row.key as string;
  const update = async (fields: Record<string, unknown>) => {
    const { error } = await db.from("model_candidates").update({ ...fields, cost_eur: await spentOn(key), updated_at: new Date().toISOString() }).eq("id", candidateId);
    if (error) console.warn("scout: candidate not updated", candidateId, error.message);
  };
  const kept = stolenStyleSchema.safeParse(row.reading);
  let reading: StolenStyle | null = kept.success ? kept.data : null;
  if (!reading) {
    const team = await teamStudio();
    if (!team) return void (await update({ verdict: "unreadable", why: "Pas de studio de l’équipe pour le lire." }));
    const outcome = await withScoutCost(key, () => readReel(team, { link: row.link as string }, null));
    if ("miss" in outcome) return void (await update({ verdict: "unreadable", why: MISS_WORDS[outcome.miss] }));
    reading = outcome.style;
    await update({ reading: candidateReading(reading) });
  }
  const judged = await judge(key, reading, row.platform as CandidatePlatform, row.source as CandidateSource);
  if (!judged) return void (await update({ why: "Le jugement n’a pas abouti : relance-le." }));
  await update(judgedColumns(judged));
}

export type CandidateAction = "keep" | "drop" | "restore" | "drafted" | "reread";

/**
 * Tristan's word on a candidate: kept (« En faire un modèle »: its fiche and its model are written from the list),
 * dropped with his note, put back, written (the model's key, and the Reel recorded as its original), or read again.
 */
export async function reviewModelCandidate(id: string, action: CandidateAction, input: { note?: string; modelKey?: string } = {}): Promise<void> {
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const set = async (fields: Record<string, unknown>) => {
    const { error } = await db.from("model_candidates").update({ ...fields, updated_at: now }).eq("id", id);
    if (error) throw new Error(error.message);
  };
  if (action === "keep") return set({ status: "kept", reviewed_at: now, ...(input.note ? { note: input.note } : {}) });
  if (action === "drop") return set({ status: "dropped", reviewed_at: now, ...(input.note ? { note: input.note } : {}) });
  if (action === "restore") return set({ status: "new", reviewed_at: null });
  if (action === "reread") {
    await set({ verdict: null, why: null });
    await startReading(id);
    return;
  }
  const model = houseModel(input.modelKey?.trim().toLowerCase());
  if (!model) return;
  await set({ status: "drafted", model_key: model.key, reviewed_at: now });
  // Its Reel becomes the model's original on the « Modèles » section, unless it has one already.
  const [{ data: candidate }, { data: original }] = await Promise.all([
    db.from("model_candidates").select("link").eq("id", id).maybeSingle(),
    db.from("house_originals").select("link").eq("key", model.key).maybeSingle(),
  ]);
  if (candidate?.link && !original?.link) await db.from("house_originals").upsert({ key: model.key, link: candidate.link as string, updated_at: now });
}

/** Its reading and judgement started in their own job; a job that cannot start is only logged (« Relancer » on /admin). */
async function startReading(candidateId: string): Promise<void> {
  await queueJob("scout", { candidateId }).catch((error: unknown) => console.warn("scout: reading not started", candidateId, error));
}

/** A candidate as /admin shows it. */
export type ScoutCard = {
  id: string;
  link: string;
  platform: CandidatePlatform;
  /** The network's player for it (nothing kept), null for a short link. */
  embed: string | null;
  source: CandidateSource;
  /** How often businesses sent it to copy (never who). */
  requests: number;
  verdict: CandidateVerdict | null;
  name: string | null;
  novelty: string | null;
  nearest: { key: string; name: string; closeness: number | null } | null;
  trades: string[];
  needs: string | null;
  score: number | null;
  why: string | null;
  status: CandidateStatus;
  note: string | null;
  model: { key: string; name: string } | null;
  costEur: number;
  at: string;
  /** Tristan's link still being read, or one whose reading died (to read again). */
  reading: "running" | "stale" | null;
};

export type ScoutView = { cards: ScoutCard[]; judged: number; monthEur: number; missing: boolean };

/** Each candidate, the latest first, and what judging and reading them cost in 30 days; empty (missing) before its table exists. */
export async function scoutView(): Promise<ScoutView> {
  try {
    const db = supabaseAdmin();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [rows, spent] = await Promise.all([
      db
        .from("model_candidates")
        .select("id, key, link, platform, source, requests, verdict, nearest, closeness, name, novelty, trades, needs, score, why, cost_eur, status, note, model_key, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200),
      db.from("cost_events").select("cost_eur, meta->>purpose").gte("created_at", since).not("meta->>scout", "is", null),
    ]);
    if (rows.error) return { cards: [], judged: 0, monthEur: 0, missing: true };
    const judged = (spent.data ?? []).filter((r) => (r as { purpose?: string }).purpose?.startsWith("scout_")).length;
    const cards = (rows.data ?? []).map((r): ScoutCard => {
      const nearest = houseModel(r.nearest as string | null);
      const model = houseModel(r.model_key as string | null);
      const verdict = (r.verdict as CandidateVerdict | null) ?? null;
      return {
        id: r.id as string,
        link: r.link as string,
        platform: r.platform as CandidatePlatform,
        embed: reelEmbed(r.key as string),
        source: r.source as CandidateSource,
        requests: Number(r.requests ?? 0),
        verdict,
        name: (r.name as string | null) ?? null,
        novelty: (r.novelty as string | null) ?? null,
        nearest: nearest ? { key: nearest.key, name: nearest.name, closeness: r.closeness === null ? null : Number(r.closeness) } : null,
        trades: (r.trades as string[] | null) ?? [],
        needs: (r.needs as string | null) ?? null,
        score: r.score === null ? null : Number(r.score),
        why: (r.why as string | null) ?? null,
        status: r.status as CandidateStatus,
        note: (r.note as string | null) ?? null,
        model: model ? { key: model.key, name: model.name } : null,
        costEur: Number(r.cost_eur ?? 0),
        at: r.created_at as string,
        reading: verdict ? null : Date.now() - Date.parse(r.updated_at as string) > STALE_MS ? "stale" : "running",
      };
    });
    return { cards, judged, monthEur: Math.round(sumEur(spent.data) * 100) / 100, missing: false };
  } catch (error) {
    console.warn("scout: view not read", error);
    return { cards: [], judged: 0, monthEur: 0, missing: true };
  }
}
