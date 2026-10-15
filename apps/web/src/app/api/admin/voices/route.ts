import { z } from "zod";
import { cronAuthorized } from "@/lib/cron-auth";
import { env } from "@/lib/env";

// The French voices of the ElevenLabs library, to pick Simone's voices by ear: the
// most used ones for social media or conversation (a creator talking, not an
// announcer), with their own sample. POST with CRON_SECRET, from the database
// (call_app): ?use_case=social_media|conversational|narrative_story&gender=female|male.
export const maxDuration = 30;

const voiceSchema = z.object({
  voice_id: z.string(),
  name: z.string(),
  gender: z.string().nullish(),
  age: z.string().nullish(),
  accent: z.string().nullish(),
  descriptive: z.string().nullish(),
  use_case: z.string().nullish(),
  category: z.string().nullish(),
  locale: z.string().nullish(),
  description: z.string().nullish(),
  preview_url: z.string().nullish(),
  usage_character_count_1y: z.number().nullish(),
  free_users_allowed: z.boolean().nullish(),
});

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const key = env("ELEVENLABS_API_KEY");
  if (!key) return Response.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 400 });
  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams({ page_size: "24", language: "fr", sort: "usage_character_count_1y" });
  const useCase = params.get("use_case");
  const gender = params.get("gender");
  if (useCase && /^[a-z_]{3,30}$/.test(useCase)) query.set("use_cases", useCase);
  if (gender === "female" || gender === "male") query.set("gender", gender);
  const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${query}`, { headers: { "xi-api-key": key } });
  if (!res.ok) return Response.json({ error: `ElevenLabs ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}` }, { status: 502 });
  const body = (await res.json()) as { voices?: unknown[] };
  const voices = (body.voices ?? []).flatMap((v) => {
    const parsed = voiceSchema.safeParse(v);
    if (!parsed.success) return [];
    const { description, ...rest } = parsed.data;
    return [{ ...rest, description: description?.slice(0, 160) ?? null }];
  });
  return Response.json({ voices });
}
