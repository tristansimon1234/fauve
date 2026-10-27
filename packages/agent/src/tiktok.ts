import { z } from "zod";

// TikTok, what a post keeps. Before TikTok audits the app, a video goes to her
// TikTok drafts (she adds a sound and posts it herself); after, straight to her
// account with the choices she made on the post's page (TikTok's rules: she picks
// the privacy herself, nothing preselected; comments, duet and stitch can be
// turned off).

export const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Tout le monde",
  MUTUAL_FOLLOW_FRIENDS: "Amis",
  FOLLOWER_OF_CREATOR: "Abonnés",
  SELF_ONLY: "Moi seulement",
};

/** Her choices for a direct post. */
export const tiktokSettingsSchema = z.object({
  privacy_level: z.string().min(1).nullable().default(null),
  allow_comment: z.boolean().default(true),
  allow_duet: z.boolean().default(true),
  allow_stitch: z.boolean().default(true),
});
export type TikTokSettings = z.infer<typeof tiktokSettingsSchema>;

export const readTikTokSettings = (value: unknown): TikTokSettings => tiktokSettingsSchema.catch(tiktokSettingsSchema.parse({})).parse(value ?? {});

/** `posts.external_ids.tiktok`: where the video is on TikTok. */
export const tiktokExternalSchema = z.object({
  publish_id: z.string(),
  /** draft: in her TikTok drafts (inbox); direct: posted by Edith. */
  mode: z.enum(["draft", "direct"]),
  status: z.string(),
  sent_at: z.string(),
  post_id: z.string().nullish(),
  share_url: z.string().nullish(),
  published_at: z.string().nullish(),
  error: z.string().nullish(),
});
export type TikTokExternal = z.infer<typeof tiktokExternalSchema>;

export const readTikTokExternal = (externalIds: unknown): TikTokExternal | null =>
  tiktokExternalSchema.nullable().catch(null).parse((externalIds as { tiktok?: unknown } | null)?.tiktok ?? null);

/** TikTok statuses still moving: the publish worker asks again. */
export const TIKTOK_PENDING = ["PROCESSING_UPLOAD", "PROCESSING_DOWNLOAD", "SEND_TO_USER_INBOX"];

/** A line on where it is, for the post's page. */
export function tiktokStateLine(t: TikTokExternal): string {
  if (t.status === "FAILED") return `TikTok a refusé la vidéo${t.error ? ` (${t.error})` : ""}.`;
  if (t.status === "PUBLISH_COMPLETE" || t.post_id) return "En ligne sur TikTok.";
  if (t.mode === "draft") return "Dans tes brouillons TikTok : ouvre TikTok, ajoute un son et publie.";
  return "TikTok traite la vidéo…";
}
