import "server-only";
import { postAudioSchema, type PostAudio } from "@fauve/agent";
import { audioInfo, InstagramError, viaFacebook, type InstagramAudio } from "@/lib/social/instagram";
import { instagramAccount } from "@/lib/social/publish";

// Instagram's music on a Reel (Instagram API with Facebook Login): what is kept on
// the post, and a temporary preview to listen to it (about 1.5 days, asked again
// when the page opens).

// Trending tracks come without a preview or artwork (searches have them): those
// are listened to on Instagram through `link`.
export type MusicTrack = PostAudio & { preview: string | null; link: string | null };

export async function toTrack(a: InstagramAudio): Promise<MusicTrack> {
  return {
    audio_id: a.audio_id,
    title: a.title ?? null,
    artist: a.display_artist ?? a.ig_username ?? null,
    duration_ms: a.duration_in_ms ?? null,
    type: a.audio_type ?? null,
    cover: a.cover_artwork_thumbnail_uri ?? a.cover_artwork_thumbnail_url ?? null,
    preview: a.download_url ?? null,
    link: a.on_platform_audio_preview_link ?? null,
  };
}

/** What the music block needs: can the studio use Instagram's music, and the Reel's track with a fresh preview. */
export async function musicFor(studioId: string, stored: unknown): Promise<{ available: boolean; track: MusicTrack | null }> {
  const ig = await instagramAccount(studioId);
  const available = Boolean(ig && viaFacebook(ig.accessToken));
  const audio = postAudioSchema.nullable().catch(null).parse(stored ?? null);
  if (!audio) return { available, track: null };
  if (!available || !ig) return { available, track: { ...audio, preview: null, link: null } };
  try {
    const fresh = await toTrack(await audioInfo(audio.audio_id, ig.userId, ig.accessToken));
    return { available, track: { ...audio, preview: fresh.preview, link: fresh.link } };
  } catch (error) {
    console.warn("music preview unavailable", error instanceof InstagramError ? error.body : error);
    return { available, track: { ...audio, preview: null, link: null } };
  }
}
