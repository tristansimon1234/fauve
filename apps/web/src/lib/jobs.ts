import "server-only";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Background jobs: a POST to our own /api/jobs/* route, authenticated with
// CRON_SECRET. The route answers 202 at once and does the work in after(), so
// each step gets a full function invocation (5 min) of its own.

export async function queueJob(name: "montage" | "elements", body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${env("APP_URL")}/api/jobs/${name}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("CRON_SECRET")}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 508) {
    // Vercel stops a chain of calls to itself after a few steps (loop detected): the
    // next step is sent by the database instead (pg_net), which starts a fresh chain.
    const { error } = await supabaseAdmin().rpc("queue_job", { app_url: env("APP_URL"), job: name, payload: body });
    if (error) throw new Error(`job ${name} refused: 508, then queue_job: ${error.message}`);
    return;
  }
  if (!res.ok) throw new Error(`job ${name} refused: ${res.status}`);
}
