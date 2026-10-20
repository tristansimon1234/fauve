import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { stolenStyleMessage } from "@fauve/agent";
import { env } from "@/lib/env";
import { messageStudio, notifyFailure, notifyStudio } from "@/lib/render/deliver";
import { dropExample, missMessage, stealStyle } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";

// « Steal », in its own invocation: the Reel she sent to copy is taken, measured and read (a
// minute or two), then she is told what her Reel takes from it. A montage launched from the
// same message starts at once and waits for this reading (postStyle in lib/steal.ts).
// Vercel Pro with Fluid compute: up to 800 s; a reading stays well under it.
export const maxDuration = 800;

const bodySchema = z.object({
  studioId: z.uuid(),
  inspirationId: z.uuid(),
  /** A video she sent as an example: it leaves her library once read. */
  example: z.object({ id: z.uuid(), path: z.string().max(400) }).optional(),
  waId: z.string().regex(/^\d{6,16}$/).optional(),
  replyTo: z.string().max(200).optional(),
  /** Given on the Créer screen, which shows its reading: told in the chat only when her Reel is already on its way. */
  fromCreate: z.boolean().optional(),
  /** One of her Reels kept as a model: its page shows its reading, nothing is said in the chat. */
  quiet: z.boolean().optional(),
});
type Job = z.infer<typeof bodySchema>;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(job: Job) {
  const target = { studioId: job.studioId, waId: job.waId, replyTo: job.replyTo };
  try {
    const outcome = await stealStyle(job.studioId, job.inspirationId);
    if (job.quiet) return;
    if (!outcome.ok) return void (await notifyStudio(target, await missMessage(outcome.miss)));
    if (job.example) await dropExample(job.studioId, job.example).catch((error: unknown) => console.warn("steal: example not removed", error));
    // Her Reel may already be on its way (launched from the same message): it waits for this reading.
    const { count } = await supabaseAdmin().from("posts").select("id", { count: "exact", head: true }).eq("studio_id", job.studioId).eq("inspiration_id", job.inspirationId);
    const making = Boolean(count);
    if (!making && job.fromCreate) return;
    // Not yet: her files are asked for (in the app, her library under the message).
    await messageStudio(target, stolenStyleMessage(outcome.style, making), making || job.waId ? {} : { pick_media: "any" });
  } catch (error) {
    if (job.quiet) return void console.warn("steal: model not read", error);
    await notifyFailure({ ...target, postId: "" }, "Je n’ai pas réussi à regarder ce Reel cette fois. Tu veux que je réessaie ?", error);
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid job" }, { status: 400 });
  const job = parsed.data;
  after(() => run(job));
  return Response.json({ queued: "steal" }, { status: 202 });
}
