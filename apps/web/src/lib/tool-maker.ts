import "server-only";
import {
  ACTIVE_WINDOW,
  CHAT_MODEL,
  checkMotionCode,
  CLAUDE_MODEL,
  editPlanSchema,
  isMotionSegment,
  motionDesignerPrompt,
  planTimeline,
  proofVariants,
  settledOutcome,
  TOOL_MAKER_PROMPT,
  toolMakerSchema,
  toolVerdict,
  type ToolMade,
  type ToolOutcome,
  type ToolStats,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { z } from "zod";
import { transpile } from "@/lib/agent/motion-designer";
import { anthropic, CACHE_AN_HOUR, logClaudeCost } from "@/lib/agent/run";
import { googleFont } from "@/lib/fonts";
import { smokeTestScenes, videoFramesInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TOOL_COST_PURPOSE, toolSettings, toolSpendEur } from "@/lib/toolkit";

// Step 2 of Edith's own tools (packages/agent/src/toolkit.ts): an animation the motion designer wrote over her
// footage, which she kept or published, becomes a tool. A judge looks at it as it came out in her Reel; the motion
// designer makes it generic (her words into slots, her colours and fonts into the charter's roles); it is proven on
// three charters with short and long texts by the scene check; it goes into the shared library on trial, where the
// editor reuses it like any scene; each use is settled 48 hours later (published, kept, or gone: corrected) and the
// tool is promoted or retired on that, without anyone's click. The team's switch and weekly budget hold it all.

/** The most tools made in one run (each one an Opus call, a judge and a check). */
const MAX_MADE = 2;
/** A tool is not started past this point of the run (its call, its check, a fix round). */
const MAKE_NEEDS_MS = 300_000;

/** The team's studio: the tools' making is the team's cost, never a business's. */
async function teamStudio(): Promise<string | null> {
  const { data } = await supabaseAdmin().from("studios").select("id").eq("team", true).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Monday 00:00 UTC of this week: the budget's week. */
function weekStart(): string {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day)).toISOString();
}

/** Notes the tools a plan uses (by their library scene), each use waiting to be settled. */
export async function recordToolUses(studioId: string, postId: string, editPlanId: string, templateIds: string[]): Promise<void> {
  if (!templateIds.length) return;
  try {
    const db = supabaseAdmin();
    const { data: versions } = await db.from("tool_versions").select("tool_id, version, params").in("params->>template_id", [...new Set(templateIds)]);
    if (!versions?.length) return;
    await db.from("tool_uses").insert(
      versions.map((v) => ({
        tool_id: v.tool_id as string,
        version: v.version as number,
        studio_id: studioId,
        post_id: postId,
        edit_plan_id: editPlanId,
        inputs: { template_id: (v.params as { template_id?: string }).template_id },
      })),
    );
  } catch (error) {
    console.warn("tool uses not noted", postId, error);
  }
}

/** Settles the uses old enough: published, kept (still in its Reel), or corrected (gone from it). */
export async function settleToolUses(): Promise<number> {
  const db = supabaseAdmin();
  const { data: uses } = await db.from("tool_uses").select("id, post_id, inputs, created_at").eq("outcome", "pending").order("created_at").limit(500);
  if (!uses?.length) return 0;
  const postIds = [...new Set(uses.flatMap((u) => (u.post_id ? [u.post_id as string] : [])))];
  const { data: posts } = postIds.length ? await db.from("posts").select("id, status, edit_plan_id").in("id", postIds) : { data: [] };
  const planIds = (posts ?? []).flatMap((p) => (p.edit_plan_id ? [p.edit_plan_id as string] : []));
  const { data: plans } = planIds.length ? await db.from("edit_plans").select("id, plan").in("id", planIds) : { data: [] };
  const planText = new Map((plans ?? []).map((p) => [p.id as string, JSON.stringify(p.plan)]));
  let settled = 0;
  for (const use of uses) {
    const post = (posts ?? []).find((p) => p.id === use.post_id);
    const template = (use.inputs as { template_id?: string } | null)?.template_id ?? "";
    const outcome = post
      ? settledOutcome({
          ageHours: (Date.now() - new Date(use.created_at as string).getTime()) / 3600_000,
          published: ["published", "measured"].includes(post.status as string),
          stillUsed: Boolean(template && planText.get(post.edit_plan_id as string)?.includes(template)),
        })
      : // Its Reel deleted: the tool did not stay.
        "corrected";
    if (!outcome) continue;
    await db.from("tool_uses").update({ outcome, settled_at: new Date().toISOString() }).eq("id", use.id);
    settled++;
  }
  return settled;
}

/** Promotes or retires the tools on their settled uses (a retired tool leaves the library). */
export async function judgeTools(): Promise<{ promoted: number; retired: number }> {
  const db = supabaseAdmin();
  const { data: tools } = await db.from("tools").select("id, status, current_version").in("status", ["trial", "active"]);
  let promoted = 0;
  let retired = 0;
  for (const tool of tools ?? []) {
    const status = tool.status as "trial" | "active";
    const { data: uses } = await db
      .from("tool_uses")
      .select("outcome")
      .eq("tool_id", tool.id)
      .eq("version", tool.current_version)
      .neq("outcome", "pending")
      .order("settled_at", { ascending: false })
      .limit(status === "active" ? ACTIVE_WINDOW : 100);
    const stats: ToolStats = { kept: 0, published: 0, corrected: 0, failed: 0 };
    for (const u of uses ?? []) stats[u.outcome as ToolOutcome]++;
    const verdict = toolVerdict(status, stats);
    if (verdict === "stay") continue;
    const now = new Date().toISOString();
    if (verdict === "promote") {
      await db.from("tools").update({ status: "active", updated_at: now }).eq("id", tool.id);
      await db.from("tool_versions").update({ status: "active" }).eq("tool_id", tool.id).eq("version", tool.current_version);
      promoted++;
    } else {
      const why = `retiré sur ses usages : ${stats.kept + stats.published} gardés ou publiés, ${stats.corrected} corrigés, ${stats.failed} ratés`;
      await db.from("tools").update({ status: "retired", retired_at: now, retired_why: why, updated_at: now }).eq("id", tool.id);
      const { data: version } = await db.from("tool_versions").update({ status: "retired" }).eq("tool_id", tool.id).eq("version", tool.current_version).select("params").maybeSingle();
      const template = (version?.params as { template_id?: string } | null)?.template_id;
      if (template) await db.from("motion_templates").update({ archived_at: now }).eq("id", template);
      retired++;
    }
  }
  return { promoted, retired };
}

const judgeSchema = z.object({ ok: z.boolean(), why: z.string() });
const JUDGE_PROMPT = `You look at an animation as it came out over a business's video in an Instagram Reel (a few images of it, with their instant). Say whether a good content creator would post it as it is: native, readable on a phone at a glance, an idea and not a layout, well made. ok false when it looks cheap or like an ad (cards or boxes with drop shadows carrying the words, badges, promo stars, generic icons or emojis floating, a template feel), when its words are hard to read, or when it is clumsy. why: one sentence, in English.`;

/** A judge looks at the animation as it came out in her Reel: a cheap one never becomes a tool. Null when it cannot be seen. */
async function judgeAsRendered(team: string, editPlanId: string, plan: z.infer<typeof editPlanSchema>, templateId: string): Promise<{ ok: boolean; why: string } | null> {
  const db = supabaseAdmin();
  const index = plan.segments.findIndex((s) => isMotionSegment(s) && s.motion.template_id === templateId);
  if (index < 0) return null;
  const span = planTimeline(plan).segments[index];
  const { data: render } = await db.from("renders").select("id, storage_path").eq("edit_plan_id", editPlanId).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!span || !render?.storage_path) return null;
  const signed = (await db.storage.from("media").createSignedUrl(render.storage_path as string, 600)).data?.signedUrl;
  if (!signed) return null;
  const times = [0.3, 0.55, 0.85].map((share) => Math.round((span.start + span.length * share) * 100) / 100);
  const frames = await videoFramesInSandbox(`tool-judge-${render.id as string}`, signed, times);
  if (!frames.length) return null;
  const response = await anthropic().beta.messages.parse({
    model: CHAT_MODEL,
    max_tokens: 1500,
    output_config: { effort: "low", format: outputFormat(judgeSchema) },
    system: JUDGE_PROMPT,
    messages: [
      {
        role: "user",
        content: frames.flatMap((f) => [
          { type: "text" as const, text: `${f.t.toFixed(1)} s` },
          { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.jpeg.toString("base64") } },
        ]),
      },
    ],
  });
  await logClaudeCost(team, response.usage, `${TOOL_COST_PURPOSE}judge`, CHAT_MODEL);
  return response.parsed_output ? readAnswer(judgeSchema, response.parsed_output) : null;
}

type Message = { role: "user" | "assistant"; content: string };

/** The motion designer makes the animation generic (the same base prompt, cached, then the tool maker's own). */
async function generalize(team: string, messages: Message[]): Promise<ToolMade | null> {
  const response = await anthropic()
    .beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 64000,
      output_config: { effort: "medium", format: outputFormat(toolMakerSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: motionDesignerPrompt({}).base, cache_control: CACHE_AN_HOUR },
        { type: "text", text: TOOL_MAKER_PROMPT },
      ],
      messages,
    })
    .finalMessage();
  await logClaudeCost(team, response.usage, `${TOOL_COST_PURPOSE}make`);
  return response.parsed_output ? readAnswer(toolMakerSchema, response.parsed_output) : null;
}

/** Its proof: the scene check on three charters, short and long texts; what failed, in words (nothing: it passed). */
async function prove(made: ToolMade, js: string, fonts: string[], seconds: number): Promise<string[]> {
  const variants = proofVariants(made.samples.filter((s) => made.slots.some((slot) => slot.name === s.slot)));
  const checks = await smokeTestScenes(
    variants.map((v, i) => ({ id: `p${i}`, js, durationInFrames: Math.round(seconds * 30), texts: v.texts, fonts, brand: v.charter })),
  );
  return variants.flatMap((v, i) => [
    ...(checks.errors[`p${i}`] ? [`${v.label} : ${checks.errors[`p${i}`]}`] : []),
    ...(checks.faces[`p${i}`] ? [`${v.label} : ${checks.faces[`p${i}`]}`] : []),
  ]);
}

/** An animation tried and not kept as a tool: never tried again (its row says why). */
async function reject(candidate: Candidate, why: string): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin()
    .from("tools")
    .insert({
      key: `refus_${candidate.template_id.replace(/-/g, "").slice(0, 12)}`,
      kind: "scene",
      card: { why },
      status: "retired",
      origin: { template_id: candidate.template_id, post_id: candidate.post_id, studio_id: candidate.studio_id, rejected: true },
      retired_why: why.slice(0, 500),
      retired_at: now,
    });
  console.log("tool not made", candidate.template_id, why);
}

type Candidate = { template_id: string; studio_id: string; post_id: string; post_status: string; edit_plan_id: string; plan_at: string };

/** A key nobody has: its own, else with a number after it. */
async function freeKey(key: string): Promise<string> {
  const base = (key.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "").slice(0, 50) || "outil").replace(/_+$/, "");
  const { data } = await supabaseAdmin().from("tools").select("key").like("key", `${base}%`);
  const taken = new Set((data ?? []).map((t) => t.key as string));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
}

/** Makes one tool from an animation she kept: judged, made generic, proven, then put on trial. True when made. */
async function makeTool(team: string, candidate: Candidate): Promise<boolean> {
  const db = supabaseAdmin();
  const [{ data: template }, { data: planRow }] = await Promise.all([
    db.from("motion_templates").select("name, description, slots, code, js, fonts, duration_seconds").eq("id", candidate.template_id).single(),
    db.from("edit_plans").select("plan").eq("id", candidate.edit_plan_id).single(),
  ]);
  const plan = editPlanSchema.safeParse(planRow?.plan);
  if (!template?.code || !plan.success) {
    await reject(candidate, "animation ou plan illisible");
    return false;
  }
  const segment = plan.data.segments.find((s) => isMotionSegment(s) && s.motion.template_id === candidate.template_id);
  const texts = segment && isMotionSegment(segment) ? (segment.motion.texts ?? {}) : {};
  const seconds = Math.min(8, Math.max(1.5, Number(template.duration_seconds ?? (segment && isMotionSegment(segment) ? segment.duration : 3))));

  // Seen as it came out in her Reel first: a cheap one is never made generic.
  const judged = await judgeAsRendered(team, candidate.edit_plan_id, plan.data, candidate.template_id).catch((error: unknown) => {
    console.warn("tool judge failed", candidate.template_id, error);
    return null;
  });
  if (judged && !judged.ok) {
    await reject(candidate, `refusée par le juge : ${judged.why}`);
    return false;
  }

  const ask: Message = {
    role: "user",
    content: JSON.stringify({
      name: template.name,
      brief: template.description,
      slots: template.slots,
      texts_used: texts,
      duration_seconds: seconds,
      fonts: template.fonts,
      code: template.code,
    }),
  };
  const messages: Message[] = [ask];
  for (let round = 0; round < 2; round++) {
    const made = await generalize(team, messages).catch((error: unknown) => {
      console.warn("tool maker failed", candidate.template_id, error);
      return null;
    });
    if (!made) break;
    if (!made.generic) {
      await reject(candidate, `propre à son commerce : ${made.why}`);
      return false;
    }
    const problems = checkMotionCode(made.code);
    let js: string | null = null;
    if (!problems.length) {
      try {
        js = transpile(made.code);
      } catch (error) {
        problems.push(`syntaxe : ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const fonts = (await Promise.all(made.fonts.slice(0, 2).map((f) => googleFont(f).catch(() => null)))).filter((f): f is string => Boolean(f));
    const failed = js ? await prove(made, js, fonts, seconds) : problems;
    if (js && !failed.length) {
      await saveTool(candidate, made, js, fonts, seconds, judged);
      return true;
    }
    // One fix round, with what failed.
    messages.push({ role: "assistant", content: JSON.stringify(made) }, { role: "user", content: `Its test renders failed:\n${failed.slice(0, 6).join("\n")}` });
  }
  await reject(candidate, "ses essais sur trois chartes n'ont pas passé le contrôle");
  return false;
}

/** The tool on trial: a scene of the shared library (the editor reuses it like any), its row, its first version. */
async function saveTool(candidate: Candidate, made: ToolMade, js: string, fonts: string[], seconds: number, judged: { ok: boolean; why: string } | null): Promise<void> {
  const db = supabaseAdmin();
  const slots = made.slots.slice(0, 8);
  const { data: scene, error } = await db
    .from("motion_templates")
    .insert({
      studio_id: null,
      name: made.name.slice(0, 80) || "Outil animé",
      description: `${made.when} (${made.what})`.slice(0, 1000),
      slots,
      code: made.code,
      js,
      fonts,
      duration_seconds: seconds,
      role: "overlay",
      uses: 0,
    })
    .select("id")
    .single();
  if (error || !scene) throw new Error(`tool scene not saved: ${error?.message}`);
  const key = await freeKey(made.key);
  const { data: tool, error: toolError } = await db
    .from("tools")
    .insert({
      key,
      kind: "scene",
      card: { name: made.name, what: made.what, when: made.when, slots },
      status: "trial",
      current_version: 1,
      origin: { template_id: candidate.template_id, post_id: candidate.post_id, studio_id: candidate.studio_id },
    })
    .select("id")
    .single();
  if (toolError || !tool) throw new Error(`tool not saved: ${toolError?.message}`);
  await db.from("tool_versions").insert({
    tool_id: tool.id,
    version: 1,
    code: made.code,
    js,
    fonts,
    params: { template_id: scene.id, slots },
    defaults: { samples: made.samples },
    proof: { charters: 3, judge: judged },
    status: "trial",
    why: `tirée d'une animation gardée (${candidate.post_status === "published" || candidate.post_status === "measured" ? "publiée" : "gardée 48 h"})`,
  });
  console.log("tool made", key, scene.id);
}

/** One run of the tools: uses settled, tools promoted or retired, then new tools made while the switch, the budget and the time allow. */
export async function runTools(deadline: number): Promise<{ settled: number; promoted: number; retired: number; made: number; rejected: number }> {
  const settled = await settleToolUses();
  const { promoted, retired } = await judgeTools();
  let made = 0;
  let rejected = 0;
  const settings = await toolSettings();
  const team = await teamStudio();
  if (!settings.autonomy || !team) return { settled, promoted, retired, made, rejected };
  const { data: candidates } = await supabaseAdmin().rpc("tool_candidates", { max_count: 5 });
  for (const candidate of (candidates ?? []) as Candidate[]) {
    if (made >= MAX_MADE || deadline - Date.now() < MAKE_NEEDS_MS) break;
    if ((await toolSpendEur(weekStart())) >= settings.weeklyBudgetEur) {
      console.log("tools: weekly budget spent");
      break;
    }
    try {
      if (await makeTool(team, candidate)) made++;
      else rejected++;
    } catch (error) {
      console.error("tool making failed", candidate.template_id, error);
      rejected++;
    }
  }
  return { settled, promoted, retired, made, rejected };
}
