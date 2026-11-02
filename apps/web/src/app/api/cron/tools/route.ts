import { cronAuthorized } from "@/lib/cron-auth";
import { runTools } from "@/lib/tool-maker";

// Edith's own tools, once a day (pg_cron `fauve-tools`, CRON_SECRET): the uses of the tools settled, the tools on
// trial promoted or retired, then new tools made from the animations she kept, while the team's switch, the
// weekly budget and the time allow (lib/tool-maker.ts).
export const maxDuration = 800;

/** Room left for the end of the run past its last tool. */
const MARGIN_MS = 60_000;

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runTools(Date.now() + maxDuration * 1000 - MARGIN_MS);
  console.log("tools run", result);
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
