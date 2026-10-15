import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** True when the request carries CRON_SECRET (pg_cron through call_app). */
export function cronAuthorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
