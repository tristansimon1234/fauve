import "server-only";
import { env } from "@/lib/env";

// Background jobs: a POST to our own /api/jobs/* route, authenticated with
// CRON_SECRET. The route answers 202 at once and does the work in after(), so
// each step gets a full function invocation (5 min) of its own.

export async function queueJob(name: "montage", body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${env("APP_URL")}/api/jobs/${name}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("CRON_SECRET")}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`job ${name} refused: ${res.status}`);
}
