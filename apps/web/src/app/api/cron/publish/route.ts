import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { reviveStalledMontages } from "@/lib/montage-watchdog";
import { runPublishWorker } from "@/lib/social/publish";

// Called every 5 minutes by pg_cron (Supabase) with the shared CRON_SECRET.
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  // Montages whose step stopped without a word: sent again, or she is told.
  const montages = await reviveStalledMontages().catch((e: unknown) => ({ error: String(e) }));
  return Response.json({ ...(await runPublishWorker()), montages });
}

export const GET = handle;
export const POST = handle;
