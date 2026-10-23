import "server-only";
import { queueJob } from "@/lib/jobs";
import { notifyFailure } from "@/lib/render/deliver";
import { finishJob, PULSE_MS } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A montage step Vercel stopped (its 800 s were up, its machine went away) falls silent: no error,
// no next step, and its work stayed « en cours » for ever while Simone offered to start it again.
// Every 5 minutes (cron of publication): a step silent for 4 pulses is sent again once, from what
// its pulse kept (studio_jobs.resume); silent again, she is told and nothing is charged.

const SILENT_MS = 4 * PULSE_MS;
const REVIVALS = 1;
const FAILED = "Je n’ai pas réussi à préparer le montage cette fois. Aucun crédit n’a été débité. Tu veux que je réessaie ?";

type Resume = { studioId: string; postId: string; quoteId?: string; waId?: string; replyTo?: string; notify?: boolean; conversationId?: string; step: string };

export async function reviveStalledMontages(): Promise<{ revived: string[]; failed: string[] }> {
  const db = supabaseAdmin();
  const now = Date.now();
  const { data } = await db
    .from("studio_jobs")
    .select("id, resume, revived, updated_at")
    .eq("kind", "montage")
    .is("finished_at", null)
    .not("resume", "is", null)
    .lt("updated_at", new Date(now - SILENT_MS).toISOString())
    .gt("updated_at", new Date(now - 6 * 3600_000).toISOString())
    .limit(5);
  const revived: string[] = [];
  const failed: string[] = [];
  for (const row of data ?? []) {
    const id = row.id as string;
    const resume = row.resume as Resume;
    const { data: quote } = await db.from("credit_quotes").select("stage, charged_at").eq("id", id).maybeSingle();
    // Replaced, delivered, charged or given up already: only the job was left open.
    if (!quote || quote.charged_at || !quote.stage || quote.stage === "superseded" || quote.stage === "delivered") {
      await finishJob(id, quote?.stage === null);
      continue;
    }
    const times = (row.revived as number | null) ?? 0;
    // Claimed by one cron only (the row moves on, or another run took it).
    const { data: claimed } = await db
      .from("studio_jobs")
      .update({ revived: times + 1, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", row.updated_at as string)
      .select("id");
    if (!claimed?.length) continue;
    if (times < REVIVALS) {
      console.warn("montage step silent, sent again", id, resume.step);
      await queueJob("montage", resume as unknown as Record<string, unknown>).catch((e: unknown) => console.error("montage revival refused", id, e));
      revived.push(id);
      continue;
    }
    console.error("montage step silent again, given up", id, resume.step);
    await db.from("credit_quotes").update({ used_at: null, stage: null }).eq("id", id).is("charged_at", null).neq("stage", "superseded");
    await finishJob(id, true);
    const target = { studioId: resume.studioId, postId: resume.postId, waId: resume.waId, replyTo: resume.replyTo, notify: resume.notify, conversationId: resume.conversationId };
    await notifyFailure(target, FAILED, "montage step silent twice").catch((e: unknown) => console.error("montage failure not told", id, e));
    failed.push(id);
  }
  return { revived, failed };
}
