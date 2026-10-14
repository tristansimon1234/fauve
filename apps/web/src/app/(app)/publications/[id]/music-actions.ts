"use server";

import { postAudioSchema, type PostAudio } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toTrack, type MusicTrack } from "@/lib/music";
import { audioInfo, InstagramError, searchAudio, viaFacebook } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";
import { getStudioContext } from "@/lib/studio";

export type { MusicTrack };
export type MusicSearch = { status: "ok"; tracks: MusicTrack[] } | { status: "needs_facebook" } | { status: "error"; message: string };

async function account() {
  const { member } = await getStudioContext();
  if (!member) return null;
  const ig = await instagramAccount(member.studio.id);
  return { studioId: member.studio.id, ig };
}

/** Instagram's music authorised for Reels: trending without a query. */
export async function searchMusic(query: string, type: "music" | "original_sound" = "music"): Promise<MusicSearch> {
  const ctx = await account();
  if (!ctx) return { status: "error", message: "Session expirée, recharge la page." };
  if (!ctx.ig || !viaFacebook(ctx.ig.accessToken)) return { status: "needs_facebook" };
  try {
    const found = await searchAudio(ctx.ig.userId, ctx.ig.accessToken, type, query.trim().slice(0, 80) || undefined);
    return { status: "ok", tracks: await Promise.all(found.slice(0, 12).map(toTrack)) };
  } catch (error) {
    console.error("music search failed", error instanceof InstagramError ? error.body : error);
    return { status: "error", message: "Instagram n’a pas répondu, réessaie dans un instant." };
  }
}

/** Puts a track on a Reel (null removes it); it is attached when Instagram publishes it. */
export async function setMusic(postId: string, audioId: string | null): Promise<{ ok: boolean; track?: MusicTrack | null }> {
  if (!z.uuid().safeParse(postId).success || (audioId !== null && !/^\d+$/.test(audioId))) return { ok: false };
  const { db, member } = await getStudioContext();
  if (!member) return { ok: false };
  let audio: PostAudio | null = null;
  let track: MusicTrack | null = null;
  if (audioId) {
    const ig = await instagramAccount(member.studio.id);
    if (!ig || !viaFacebook(ig.accessToken)) return { ok: false };
    try {
      track = await toTrack(await audioInfo(audioId, ig.userId, ig.accessToken));
    } catch (error) {
      console.error("music info failed", error instanceof InstagramError ? error.body : error);
      return { ok: false };
    }
    // The preview link expires: only the track itself is kept on the post.
    audio = postAudioSchema.parse({ audio_id: track.audio_id, title: track.title, artist: track.artist, duration_ms: track.duration_ms, type: track.type, cover: track.cover });
  }
  const { data, error } = await db
    .from("posts")
    .update({ audio })
    .eq("id", postId)
    .eq("studio_id", member.studio.id)
    .not("status", "in", "(published,measured)")
    .select("id");
  if (error || !data.length) return { ok: false };
  revalidatePath(`/publications/${postId}`);
  return { ok: true, track };
}
