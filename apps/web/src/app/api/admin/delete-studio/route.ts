import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { deleteStudio } from "@/lib/delete-studio";
import { env } from "@/lib/env";

// Deletes a studio completely (files, data, its members' login accounts):
// POST ?studio=<uuid> with CRON_SECRET (Authorization: Bearer …). Irreversible.

export const maxDuration = 120;

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const studio = z.uuid().safeParse(new URL(request.url).searchParams.get("studio"));
  if (!studio.success) return Response.json({ error: "studio=<uuid> attendu" }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await deleteStudio(studio.data)) });
  } catch (error) {
    console.error("delete studio failed", studio.data, error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
