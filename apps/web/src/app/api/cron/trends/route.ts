import { after } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { refreshTrendSounds } from "@/lib/trend-sounds";

// Each Monday morning (pg_cron fauve-trends): the trending sounds, the same for everyone (lib/trend-sounds.ts, about
// $0.06 when 30 songs are new). The trend videos of each trade it searched before were removed (Tristan: « supprimer
// la recherche des vidéos tendances […] qui sert à rien et qui est gadget »).
export const maxDuration = 300;

async function run() {
  const sounds = await refreshTrendSounds({ force: true }).catch((error: unknown) => (console.error("sounds: refresh failed", error), null));
  console.log("sounds", sounds);
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  after(run);
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
