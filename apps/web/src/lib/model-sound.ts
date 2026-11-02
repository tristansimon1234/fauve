import "server-only";
import { readPostMusic } from "@/lib/render/music";
import { SENT_TO_COPY } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Keeping the sound of the Reel she copies (Tristan: « il m'a pas demandé si je voulais garder le son d'origine ? »):
// its music cannot be taken into the video (its rights are Instagram's), so the Reel comes out without music, on the
// model's own cuts, and she adds its sound herself when she posts it, with « Utiliser l'audio » on the model in
// Instagram. She posts it herself (publish_by_hand): the reminder sends her the video and its caption. On a Business
// account, Instagram offers fewer sounds: she is told, and « mets ta musique » brings Edith's back.

/** An Instagram link: only its sound can be used in Instagram on her Reel. */
const INSTAGRAM = /^https?:\/\/(www\.)?instagram\.com\//i;

/** The sound she can keep: the Instagram Reel this post copies (its link), and whether her account is a Business one (null: not known). */
export async function modelSound(studioId: string, postId: string): Promise<{ link: string; business: boolean | null } | null> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("inspiration_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  if (!post?.inspiration_id) return null;
  const [inspiration, account] = await Promise.all([
    db.from("inspirations").select("source, url").eq("id", post.inspiration_id as string).eq("studio_id", studioId).maybeSingle(),
    db.from("social_accounts").select("account_type").eq("studio_id", studioId).eq("platform", "instagram").maybeSingle(),
  ]);
  const link = inspiration.data?.url as string | null | undefined;
  if (!link || !INSTAGRAM.test(link) || !SENT_TO_COPY.includes(inspiration.data?.source as string)) return null;
  const type = account.data?.account_type as string | null | undefined;
  return { link, business: type ? type === "BUSINESS" : null };
}

/**
 * Keeps the model's sound on this Reel (no music of Edith's, she posts it herself), or gives Edith's music back (and
 * her own publishing, when it was set for the sound). Null when the post copies no Instagram Reel.
 */
export async function keepModelSound(studioId: string, postId: string, keep: boolean): Promise<{ link: string; business: boolean | null } | null> {
  const sound = await modelSound(studioId, postId);
  if (keep && !sound) return null;
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("music, publish_by_hand").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  const music = readPostMusic(post?.music);
  const update = keep
    ? { music: { ...music, mode: "model" as const, hand: !post?.publish_by_hand || Boolean(music.hand) }, publish_by_hand: true }
    : { music: { ...music, mode: "on" as const, hand: undefined }, ...(music.hand ? { publish_by_hand: false } : {}) };
  const { error } = await db.from("posts").update(update).eq("id", postId).eq("studio_id", studioId).not("status", "in", "(published,measured)");
  if (error) throw new Error(error.message);
  return sound;
}

/** What the delivery tells her of a Reel without music for the model's sound: how to add it, and the Business caveat. */
export function modelSoundLine(sound: { link: string; business: boolean | null }): string {
  return [
    `Elle est sans musique, sur les coupes du Reel que tu m'as envoyé, pour que tu mettes son son : dans Instagram, ouvre ce Reel (${sound.link}), touche le nom du son en bas, « Utiliser l'audio », puis choisis cette vidéo (télécharge-la depuis sa page).`,
    sound.business
      ? "Ton compte est un compte Entreprise : Instagram n'y propose pas tous les sons. Si « Utiliser l'audio » n'apparaît pas, dis-moi « mets ta musique »."
      : "Si « Utiliser l'audio » n'apparaît pas (certains sons ne sont pas proposés aux comptes Entreprise), dis-moi « mets ta musique ».",
  ].join(" ");
}
