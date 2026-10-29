import { after } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { forgetOldTrends, refreshTrends, tradesToSearch } from "@/lib/trends";

// Each Monday morning (pg_cron fauve-trends): every trade of the real studios is searched again on
// TikTok and Instagram (lib/trends.ts), about $0.03 a trade (both lists, the hashtag counts and the read of their captions), so the page Tendances shows this week's.
export const maxDuration = 800;

/** Trades searched per run (each takes 5 to 15 s); the rest wait for their page or the next run. */
const MAX_TRADES = 40;

async function run() {
  await forgetOldTrends().catch((error: unknown) => console.error("trends: cleanup failed", error));
  const trades = (await tradesToSearch()).slice(0, MAX_TRADES);
  for (const { query, lang } of trades) {
    const found = await refreshTrends(query, lang).catch((error: unknown) => (console.error("trends: failed", query, lang, error), null));
    console.log("trends", query, lang, found);
  }
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  after(run);
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
