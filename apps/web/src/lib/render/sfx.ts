import "server-only";
import { randomUUID } from "node:crypto";
import { SFX_MAX_NEW, sfxCostUsd, usdToEur, type SoundFacts } from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costMeta } from "@/lib/cost-scope";
import { withSlot } from "@/lib/work-slots";
import { measureSoundInSandbox } from "./sandbox";

// The library of sound effects, shared by every business (a « soft pop » is the same for a
// florist and a barber): each sound is made once by ElevenLabs Sound Effects, measured once in
// the workshop (its loudness, its peak, where its attack starts and where it fades: sfx.ts), and
// kept (table sound_effects, files in media/library/sfx/). Who places them and how loud they
// sit in a Reel: packages/agent/src/sfx.ts. Only the server reads or writes it.

/** A sound of the library: its measures and its file. */
export type LibrarySound = SoundFacts & { path: string };

/** ElevenLabs takes five calls at a time on its offer: the sounds share the voices' places. */
const SFX_SLOT = { kind: "elevenlabs_voice", slots: 1, perSlot: 5, leaseMs: 3 * 60_000, waitMs: 4 * 60_000 };

const FOLDER = "library/sfx";

type Row = { key: string; storage_path: string; lufs: number | null; peak: number | null; onset: number; sound_end: number; hit: number | null };

const asSound = (r: Row): LibrarySound => ({
  path: r.storage_path,
  lufs: r.lufs,
  peak: r.peak,
  onset: Number(r.onset),
  end: Number(r.sound_end),
  ...(r.hit !== null && Number.isFinite(Number(r.hit)) ? { hit: Number(r.hit) } : {}),
});

/** The library's sounds among these keys (only those already made). */
export async function soundsKnown(keys: string[]): Promise<Record<string, LibrarySound>> {
  const wanted = [...new Set(keys)].slice(0, 60);
  if (!wanted.length) return {};
  const { data } = await supabaseAdmin().from("sound_effects").select("key, storage_path, lufs, peak, onset, sound_end, hit").in("key", wanted);
  return Object.fromEntries(((data ?? []) as Row[]).map((r) => [r.key, asSound(r)]));
}

/**
 * The sounds a Reel asks for, the missing ones made and measured (SFX_MAX_NEW at most per Reel,
 * each logged in cost_events for the studio that asked). A sound that fails is left out: the
 * Reel goes without it, never without its video.
 */
export async function ensureSounds(params: { studioId: string; postId: string; cues: { key: string; sound: string; seconds?: number }[] }): Promise<Record<string, LibrarySound>> {
  const byKey = new Map(params.cues.map((c) => [c.key, c]));
  const known = await soundsKnown([...byKey.keys()]);
  const missing = [...byKey.values()].filter((c) => !known[c.key]).slice(0, SFX_MAX_NEW);
  if (missing.length && env("ELEVENLABS_API_KEY")) {
    const made = await Promise.all(
      missing.map((c) =>
        makeSound(params.studioId, params.postId, c).catch((error: unknown) => {
          console.warn("sfx: not made", c.key, error);
          return null;
        }),
      ),
    );
    for (const m of made) if (m) known[m.key] = m.sound;
  }
  const used = Object.keys(known);
  if (used.length) await supabaseAdmin().from("sound_effects").update({ last_used_at: new Date().toISOString() }).in("key", used);
  return known;
}

/** One sound made by ElevenLabs, measured, kept (the first one kept wins when two Reels ask for it at once). */
async function makeSound(studioId: string, postId: string, cue: { key: string; sound: string; seconds?: number }): Promise<{ key: string; sound: LibrarySound }> {
  const seconds = Number(cue.key.split("@")[1]) || 1;
  const mp3 = await withSlot(SFX_SLOT, () => generate(cue.sound, seconds));
  const db = supabaseAdmin();
  const usd = sfxCostUsd(seconds);
  await db.from("cost_events").insert({
    studio_id: studioId,
    kind: "sfx",
    provider: "elevenlabs",
    units: 1,
    cost_eur: usdToEur(usd, env("USD_TO_EUR")),
    meta: costMeta({ post_id: postId, key: cue.key, seconds, model: env("ELEVENLABS_SFX_MODEL"), cost_usd: usd }),
  });
  const facts = await measureSoundInSandbox(`sfx-${randomUUID().slice(0, 8)}`, mp3);
  const path = `${FOLDER}/${randomUUID()}.mp3`;
  const { error: upload } = await db.storage.from("media").upload(path, mp3, { contentType: "audio/mpeg", upsert: false });
  if (upload) throw new Error(upload.message);
  const row = { key: cue.key, sound: cue.sound.slice(0, 60), seconds, storage_path: path, model: env("ELEVENLABS_SFX_MODEL"), lufs: facts.lufs, peak: facts.peak, onset: facts.onset, sound_end: facts.end, hit: facts.hit };
  const { error } = await db.from("sound_effects").insert(row);
  if (error) {
    // Made at the same time for another Reel: that one is kept, this file goes.
    await db.storage.from("media").remove([path]).catch(() => {});
    const again = await soundsKnown([cue.key]);
    if (!again[cue.key]) throw new Error(error.message);
    return { key: cue.key, sound: again[cue.key]! };
  }
  console.info("sfx: made", cue.key, facts);
  return { key: cue.key, sound: { path, ...facts } };
}

/** The sound as ElevenLabs makes it: one clean effect, no music nor voice; a busy answer (429) or a hiccup is tried again. */
async function generate(sound: string, seconds: number): Promise<Uint8Array> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  let failure = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text: `${sound}. One short, clean sound effect, nothing else: no music, no voice, no long tail.`,
        duration_seconds: seconds,
        prompt_influence: 0.5,
        model_id: env("ELEVENLABS_SFX_MODEL"),
      }),
    });
    if (res.ok) {
      const mp3 = new Uint8Array(await res.arrayBuffer());
      if (mp3.length > 1000) return mp3;
      failure = "empty sound";
    } else {
      failure = `${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`;
      if (res.status !== 429 && res.status < 500) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw new Error(`sound effect not made: ${failure}`);
}

/** The library's sounds with a link to play them (the live preview), for an hour. */
export async function playableSounds(sounds: Record<string, LibrarySound>): Promise<Record<string, SoundFacts & { src: string }>> {
  const entries = Object.entries(sounds);
  if (!entries.length) return {};
  const { data } = await supabaseAdmin()
    .storage.from("media")
    .createSignedUrls(
      entries.map(([, s]) => s.path),
      3600,
    );
  const links = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return Object.fromEntries(
    entries.flatMap(([key, s]) => {
      const src = links.get(s.path);
      return src ? [[key, { lufs: s.lufs, peak: s.peak, onset: s.onset, end: s.end, ...(s.hit !== undefined ? { hit: s.hit } : {}), src }]] : [];
    }),
  );
}

/** The files of the sounds placed on a Reel, for the mix (a sound whose file is gone is left out). */
export async function soundFiles<P extends { key: string }>(placed: P[], sounds: Record<string, LibrarySound>): Promise<(P & { mp3: Uint8Array })[]> {
  const db = supabaseAdmin();
  const files = await Promise.all(
    placed.map(async (p) => {
      const path = sounds[p.key]?.path;
      const file = path ? await db.storage.from("media").download(path).catch(() => null) : null;
      return file?.data ? [{ ...p, mp3: new Uint8Array(await file.data.arrayBuffer()) }] : [];
    }),
  );
  return files.flat();
}

/** The sounds already made, the most recently used first: given to their writers, who reuse a name when one fits. */
export async function readySounds(limit = 30): Promise<string[]> {
  const { data } = await supabaseAdmin().from("sound_effects").select("key").order("last_used_at", { ascending: false, nullsFirst: false }).limit(limit);
  return (data ?? []).map((r) => {
    const [words, seconds] = String(r.key).split("@");
    return `${words} (${seconds} s)`;
  });
}
