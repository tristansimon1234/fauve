import { after } from "next/server";
import { z } from "zod";
import { cronAuthorized } from "@/lib/cron-auth";
import { readAndJudge } from "@/lib/model-scout";

// A link Tristan proposes in « Modèles repérés » on /admin (lib/model-scout.ts), in its own invocation: read like a Reel
// a business sends to copy (a minute or two), then judged against Edith's models. Vercel Pro with Fluid compute: up to
// 800 s; a reading stays well under it.
export const maxDuration = 800;

const bodySchema = z.object({ candidateId: z.uuid() });

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid job" }, { status: 400 });
  const { candidateId } = parsed.data;
  after(() => readAndJudge(candidateId).catch((error: unknown) => console.error("scout: link not read", candidateId, error)));
  return Response.json({ queued: "scout" }, { status: 202 });
}
