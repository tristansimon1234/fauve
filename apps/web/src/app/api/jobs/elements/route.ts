import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { CREDIT_PRICES, kitDesignOutputSchema, layerSlotSchema } from "@fauve/agent";
import { elementsRound, placedOn, type KitDraft } from "@/lib/agent/element-designer";
import { chargeCredits } from "@/lib/credits";
import { loadElement, markElementsUsed, placeElements, refreshElementOnPosts, saveKit, updateElement } from "@/lib/elements";
import { env } from "@/lib/env";
import { queueJob } from "@/lib/jobs";
import { notifyFailure, notifyStudio, renderSlidesAndDeliver } from "@/lib/render/deliver";
import { finishJob, jobAlive, setJobStage, setJobTemplate } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Components, one step per invocation (each gets its own time budget):
//   design: one round of the component designer (a kit from an inspiration, or a
//           change to one component), chained until it passes or MAX_ROUNDS;
//           then the components are kept in the bank (or the new version saved);
//   render: when they go on a post, its photos are rendered and the link sent.
// Credits are charged once the work is delivered.
export const maxDuration = 300;

const bodySchema = z.object({
  step: z.enum(["design", "render"]),
  mode: z.enum(["create", "edit"]),
  studioId: z.uuid(),
  elementId: z.uuid().optional(),
  postId: z.uuid().optional(),
  request: z.string().min(1).max(4000),
  exampleMediaId: z.uuid().optional(),
  examplePath: z.string().max(400).optional(),
  photos: z.array(z.number().int().min(1).max(10)).max(10).optional(),
  round: z.number().int().min(0).max(5).default(0),
  draft: kitDesignOutputSchema.optional(),
  feedback: z.string().max(4000).optional(),
  /** What was made, for the charge and the message. */
  name: z.string().max(80).optional(),
  firstId: z.uuid().optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  /** From the chat (a message tells her when it is ready) or from the app (the progress pill does). */
  origin: z.enum(["chat", "app"]).default("chat"),
  jobId: z.uuid().optional(),
});
type Job = z.infer<typeof bodySchema>;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const price = (job: Job) => (job.mode === "edit" ? CREDIT_PRICES.elementEdit : CREDIT_PRICES.textLayer);
const charge = (job: Job, name: string, ref: Record<string, unknown>) =>
  chargeCredits(job.studioId, price(job), "text_layer", job.mode === "edit" ? `Composant modifié « ${name} »` : `Composants « ${name} »`, ref);

/** The inspiration, kept with the components (the chat's files are deleted after a few days). */
async function keepExample(job: Job, kitName: string): Promise<string | null> {
  if (job.examplePath?.startsWith(`${job.studioId}/`)) return job.examplePath;
  if (!job.exampleMediaId) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("media_assets").select("storage_path").eq("id", job.exampleMediaId).eq("studio_id", job.studioId).maybeSingle();
  if (!data) return null;
  const from = data.storage_path as string;
  const to = `${job.studioId}/elements/${Date.now()}-${kitName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "kit"}.${from.split(".").pop() ?? "jpg"}`;
  const { error } = await db.storage.from("media").copy(from, to);
  return error ? null : to;
}

async function done(job: Job, draft: KitDraft, js: Record<string, string>) {
  const target = { studioId: job.studioId, waId: job.waId, replyTo: job.replyTo };
  // Texts and place of each component: its first placement.
  const firstPlacement = (ref: string) => draft.slides.flatMap((s) => s.placements).find((p) => p.ref === ref);

  if (job.mode === "edit") {
    const elementId = job.elementId!;
    const before = await loadElement(job.studioId, elementId);
    if (!before) throw new Error("Composant introuvable");
    const designed = draft.elements[0]!;
    const placed = placedOn(draft, js, draft.slides[0]?.photo ?? 1)[0];
    const slots = z.array(layerSlotSchema).catch([]).parse(designed.slots);
    // Her own sample texts stay; new slots take the designer's.
    const sample = Object.fromEntries(slots.map((s) => [s.name, before.sample[s.name] || placed?.texts[s.name] || ""]).filter(([, v]) => v));
    await updateElement(job.studioId, elementId, { name: designed.name, code: designed.code, js: js[designed.ref]!, slots, fonts: designed.fonts.slice(0, 3), base: designed.base_width, sample, note: draft.notes });
    await setJobTemplate(job.jobId, elementId);
    if (job.postId) {
      await refreshElementOnPosts(job.studioId, elementId, [job.postId]);
      await queueJob("elements", { ...job, step: "render", name: designed.name, firstId: elementId, draft: undefined, feedback: undefined });
      return;
    }
    await finishJob(job.jobId);
    await charge(job, designed.name, { element_id: elementId });
    if (job.origin === "chat") await notifyStudio(target, `C’est fait : « ${designed.name} » a sa nouvelle version ✨ ${draft.notes}`, { path: `/composants/${elementId}`, label: "Regarde-le ici" });
    return;
  }

  const examplePath = await keepExample(job, draft.kit_name);
  const ids = await saveKit(job.studioId, {
    name: draft.kit_name,
    description: `${draft.notes} — ${job.request}`,
    examplePath,
    elements: draft.elements.map((e) => {
      const placement = firstPlacement(e.ref);
      const slots = z.array(layerSlotSchema).catch([]).parse(e.slots);
      const instance = placement ? placedOn({ ...draft, slides: [{ photo: 1, placements: [placement] }] }, js, 1)[0] : undefined;
      return { name: e.name, role: e.role, code: e.code, js: js[e.ref]!, slots, fonts: e.fonts.slice(0, 3), base: e.base_width, box: instance?.box ?? null, sample: instance?.texts ?? {} };
    }),
  });
  const byRef = Object.fromEntries(draft.elements.map((e, i) => [e.ref, ids[i]!]));
  await setJobTemplate(job.jobId, ids[0]!);
  if (job.postId) {
    const perPhoto = new Map(draft.slides.map((s) => [s.photo, placedOn(draft, js, s.photo, byRef)] as const).filter(([, list]) => list.length));
    await placeElements(job.studioId, job.postId, perPhoto, "replace");
    await markElementsUsed(ids);
    await queueJob("elements", { ...job, step: "render", name: draft.kit_name, firstId: ids[0], draft: undefined, feedback: undefined });
    return;
  }
  await finishJob(job.jobId);
  await charge(job, draft.kit_name, { element_ids: ids });
  if (job.origin === "chat") {
    const names = draft.elements.map((e) => `« ${e.name} »`).join(", ");
    await notifyStudio(target, `Tes composants sont prêts ✨ ${names}. Ils sont dans ta banque : je les pose sur tes photos quand tu veux, avec tes mots.`, { path: `/composants?kit=${ids[0]}`, label: "Regarde-les ici" });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid job" }, { status: 400 });
  const job = parsed.data;
  const failTarget = { studioId: job.studioId, postId: job.postId ?? "", waId: job.waId, replyTo: job.replyTo };

  after(async () => {
    // A newer request replaced this one (or it was given up): nothing more to do.
    if (job.jobId && !(await jobAlive(job.jobId))) return;
    if (job.step === "render") {
      await setJobStage(job.jobId, "render");
      const delivered = job.postId ? await renderSlidesAndDeliver({ studioId: job.studioId, postId: job.postId, waId: job.waId, replyTo: job.replyTo }) : true;
      await finishJob(job.jobId, !delivered);
      if (delivered) await charge(job, job.name ?? "", { post_id: job.postId, element_id: job.firstId });
      return;
    }
    try {
      await setJobStage(job.jobId, job.round === 0 ? "design" : "fix");
      const input = { studioId: job.studioId, mode: job.mode, elementId: job.elementId, postId: job.postId, request: job.request, exampleMediaId: job.exampleMediaId, examplePath: job.examplePath, photos: job.photos };
      const previous = job.draft && job.feedback ? { draft: job.draft, feedback: job.feedback } : undefined;
      const result = await elementsRound(input, job.round, previous, (stage) => setJobStage(job.jobId, stage));
      if (result.status === "retry") {
        await queueJob("elements", { ...job, round: job.round + 1, draft: result.draft ?? job.draft, feedback: result.feedback });
        return;
      }
      if (result.status === "failed") throw new Error(result.error);
      await done(job, result.draft, result.js);
    } catch (error) {
      console.error("elements design failed", job.mode, job.elementId ?? job.postId, error);
      await finishJob(job.jobId, true);
      if (job.origin === "chat") {
        await notifyFailure(failTarget, job.mode === "edit" ? "Je n’ai pas réussi à modifier ce composant cette fois. Aucun crédit n’a été débité. Tu veux que je réessaie autrement ?" : "Je n’ai pas réussi à créer ces composants cette fois. Aucun crédit n’a été débité. Tu veux que je réessaie ?", error);
      }
    }
  });
  return Response.json({ queued: job.step, round: job.round }, { status: 202 });
}
