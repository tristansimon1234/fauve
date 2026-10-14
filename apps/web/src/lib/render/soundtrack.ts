import "server-only";
import { soundtrackKey, soundtrackWav, type ReelProps } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Simone's soundtrack for a Reel, as a link the render can fetch: synthesized
 * from the props (music, cuts, texts) and kept under a key naming all of that, so
 * the same cut is made once. null without music.
 */
export async function soundtrackFile(studioId: string, props: ReelProps): Promise<{ src: string } | null> {
  const key = soundtrackKey(props);
  const wav = key ? soundtrackWav(props) : null;
  if (!key || !wav) return null;
  const db = supabaseAdmin();
  const path = `${studioId}/soundtracks/${key}.wav`;
  const { error } = await db.storage.from("media").upload(path, wav, { contentType: "audio/wav", upsert: true });
  if (error) throw new Error(error.message);
  const { data, error: signError } = await db.storage.from("media").createSignedUrl(path, 3600);
  if (signError || !data) throw new Error(signError?.message ?? "no signed URL");
  return { src: data.signedUrl };
}
