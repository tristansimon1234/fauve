import { z } from "zod";
import { cronAuthorized } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { levelSpeech, speak } from "@/lib/voice-over";

// Voices for Simone, by ear. POST with CRON_SECRET, from the database (call_app):
//   ?use_case=social_media|conversational|narrative_story&gender=female|male
//     the most used French voices of the ElevenLabs library for that use, with their own sample;
//   ?say=<voice id>,<voice id>…
//     the same lines read by each voice (Simone's text for a pizzeria, with its acting tags),
//     to compare them by ear: a signed link (24 h) per voice;
//   ?clone=<name>&media=<uuid>,<uuid>…
//     an instant clone of a person's voice from her voice notes (audio media of one studio,
//     a minute or two in all, her own voice and with her consent): answers the new voice id.
export const maxDuration = 120;

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

async function clone(key: string, name: string, mediaIds: string[]) {
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, studio_id, kind, storage_path, mime_type").in("id", mediaIds);
  const notes = (assets ?? []).filter((a) => a.kind === "audio");
  if (!notes.length) return Response.json({ error: "no voice note among these media" }, { status: 400 });
  if (new Set(notes.map((n) => n.studio_id)).size > 1) return Response.json({ error: "voice notes of one studio only" }, { status: 400 });
  const form = new FormData();
  form.append("name", name);
  form.append("description", "Voix de la gérante, clonée avec son accord pour ses Reels (Simone)");
  form.append("remove_background_noise", "true");
  for (const note of notes) {
    const file = await db.storage.from("media").download(note.storage_path as string);
    if (file.error || !file.data) return Response.json({ error: `download ${note.id}: ${file.error?.message}` }, { status: 500 });
    form.append("files", new Blob([await file.data.arrayBuffer()], { type: (note.mime_type as string | null) ?? "audio/ogg" }), `${note.id}.${(note.mime_type as string | null)?.includes("mpeg") ? "mp3" : "ogg"}`);
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key }, body: form });
  const text = await res.text();
  if (!res.ok) return Response.json({ error: `ElevenLabs ${res.status}: ${text.slice(0, 300)}` }, { status: 502 });
  return Response.json({ ok: true, studio: notes[0]!.studio_id, notes: notes.length, ...(JSON.parse(text) as Record<string, unknown>) });
}

/** What every voice reads to be compared: a voice-over Simone wrote, acting tags included. */
const SAMPLE =
  "[smiling] Cette pizza, on l'a commencée avant-hier. Ici, la pâte est pétrie le matin, puis elle repose quarante-huit heures. Le soir, on l'étire et elle file sur la pierre du four à bois. [laughs softly] Toi, t'as juste à attraper ta part. [warmly] Passe ce soir, on t'attend.";

async function say(voiceIds: string[]) {
  const db = supabaseAdmin();
  const samples = [];
  // 4 at a time: the plan reads 5 texts at once.
  for (let i = 0; i < voiceIds.length; i += 4) {
    samples.push(
      ...(await Promise.all(
        voiceIds.slice(i, i + 4).map(async (id) => {
          try {
            const voice = await speak(SAMPLE, id);
            // At the level of a voice in a Reel, so they are compared by ear and not by volume.
            const leveled = await levelSpeech(`sample-${id}`, voice.mp3);
            const path = `lab/voices/${id}.mp3`;
            const up = await db.storage.from("media").upload(path, leveled.mp3, { contentType: "audio/mpeg", upsert: true });
            if (up.error) throw new Error(up.error.message);
            const signed = await db.storage.from("media").createSignedUrl(path, 86_400);
            return { id, model: voice.model, seconds: voice.transcript.duration, lufs: leveled.lufs, url: signed.data?.signedUrl ?? null };
          } catch (error) {
            return { id, error: error instanceof Error ? error.message.slice(0, 300) : String(error) };
          }
        }),
      )),
    );
  }
  return Response.json({ samples });
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const key = env("ELEVENLABS_API_KEY");
  if (!key) return Response.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 400 });
  const params = new URL(request.url).searchParams;

  const listed = params.get("say");
  if (listed) {
    const ids = listed.split(",").filter((id) => /^[A-Za-z0-9]{10,40}$/.test(id)).slice(0, 8);
    if (!ids.length) return Response.json({ error: "say=<voice id>,<voice id>" }, { status: 400 });
    return say(ids);
  }

  const name = params.get("clone");
  if (name) {
    const media = z.array(z.uuid()).min(1).max(10).safeParse((params.get("media") ?? "").split(",").filter(Boolean));
    if (!media.success || !/^[\p{L}\p{N} '-]{2,40}$/u.test(name)) return Response.json({ error: "clone=<name>&media=<uuid>,<uuid>" }, { status: 400 });
    return clone(key, name, media.data);
  }

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
