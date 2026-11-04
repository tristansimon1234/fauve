import "server-only";
import { randomUUID } from "node:crypto";
import { beatGrid, reelLink, tempoOf, usdToEur } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { env } from "@/lib/env";
import { readPostMusic, type PostMusic } from "@/lib/render/music";
import { sandboxCostEur, stealReelInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { instagramVideo } from "@/lib/treg";

// Her Reel cut on a sound she gives by a link (Tristan: « comment faire pour que Edith puisse caler un son sur une idée
// du user, « je veux caler sur la musique de Bad Bunny » ? »): the song cannot be in the video (its rights are
// Instagram's), so the Reel comes out silent (music mode model, she posts it herself), its cuts on the beats of that
// sound, and she adds it with « Utiliser l'audio » on the Reel of the link, which plays it from the same start. Its
// tempo and its first beat are measured on the link, as a Reel she copies is (no Gemini: its sound only).

/** The sound she follows on this Reel, set from the link of an Instagram Reel that uses it (its measure comes with the montage). */
export async function followSound(
  studioId: string,
  postId: string,
  link: string,
): Promise<{ ok: true; link: string } | { ok: false; why: "not_instagram" | "voice" | "missing" }> {
  const found = reelLink(link);
  if (!found || found.platform !== "instagram") return { ok: false, why: "not_instagram" };
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("music, publish_by_hand, voice_media_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return { ok: false, why: "missing" };
  // A song added in Instagram plays instead of the video's own sound: her voice would be lost.
  if (post.voice_media_id) return { ok: false, why: "voice" };
  const music = readPostMusic(post.music);
  const sound = music.sound?.link === found.url ? music.sound : { link: found.url };
  const next: PostMusic = { ...music, mode: "model", hand: !post.publish_by_hand || Boolean(music.hand), sound };
  const { error } = await db.from("posts").update({ music: next, publish_by_hand: true }).eq("id", postId).eq("studio_id", studioId).not("status", "in", "(published,measured)");
  if (error) throw new Error(error.message);
  return { ok: true, link: found.url };
}

/** Its tempo and its first beat (s), read on its link in the render sandbox (else its video through Treg). */
export async function measureSound(studioId: string, link: string): Promise<{ bpm: number | null; offset: number | null; miss?: string }> {
  const db = supabaseAdmin();
  const started = Date.now();
  let reel = await stealReelInSandbox(`sound-${randomUUID()}`, { link });
  // Instagram often refuses a server: its video through Treg, read as a file.
  if ("miss" in reel && reel.miss === "unreachable") {
    const fetched = await instagramVideo(link).catch(() => null);
    if (fetched) {
      await db
        .from("cost_events")
        .insert({ studio_id: studioId, kind: "steal", provider: "treg", units: 1, cost_eur: usdToEur(fetched.costUsd, env("USD_TO_EUR")), meta: costMeta({ purpose: "sound", found: Boolean(fetched.video), cost_usd: fetched.costUsd }) });
    }
    if (fetched?.video) reel = await stealReelInSandbox(`sound-${randomUUID()}`, { file: fetched.video });
  }
  const seconds = "miss" in reel ? (Date.now() - started) / 1000 : reel.seconds;
  await db
    .from("cost_events")
    .insert({ studio_id: studioId, kind: "steal", provider: "vercel_sandbox", units: Math.round(seconds), cost_eur: sandboxCostEur(seconds), meta: costMeta({ purpose: "sound", ...("miss" in reel ? { miss: reel.miss } : {}) }) });
  if ("miss" in reel) return { bpm: null, offset: null, miss: reel.miss };
  const tempo = tempoOf(reel.levels);
  const grid = tempo ? beatGrid(reel.levels, 60 / tempo) : null;
  const bpm = grid ? 60 / grid.period : tempo;
  return {
    bpm: bpm && bpm >= 30 && bpm <= 300 ? Math.round(bpm * 100) / 100 : null,
    offset: grid ? Math.round(Math.min(4, Math.max(0, grid.offset)) * 1000) / 1000 : null,
  };
}

/**
 * The sound this Reel follows, measured (once, kept on the post): its tempo and first beat, or null when it follows
 * none, has no steady beat or could not be read (the Reel is then cut at its own tempo, still silent for her sound).
 */
export async function followedSound(studioId: string, postId: string, music: unknown): Promise<{ bpm: number; offset: number; link: string } | null> {
  const read = readPostMusic(music);
  const sound = read.sound;
  if (read.mode !== "model" || !sound) return null;
  if (sound.bpm === undefined && !sound.miss) {
    const measured = await measureSound(studioId, sound.link).catch((error: unknown) => {
      console.warn("sound-follow: not measured", error);
      return { bpm: null, offset: null, miss: "failed" };
    });
    const kept = { ...sound, bpm: measured.bpm, offset: measured.offset, ...(measured.miss ? { miss: measured.miss } : {}) };
    await supabaseAdmin().from("posts").update({ music: { ...read, sound: kept } }).eq("id", postId).eq("studio_id", studioId);
    return kept.bpm ? { bpm: kept.bpm, offset: kept.offset ?? 0, link: sound.link } : null;
  }
  return sound.bpm ? { bpm: sound.bpm, offset: sound.offset ?? 0, link: sound.link } : null;
}
