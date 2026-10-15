import "server-only";
import { captionForTikTok, readTikTokExternal, readTikTokSettings, tiktokStateLine, type PostKind } from "@fauve/agent";
import type { TikTokPanel } from "@/components/montage/where-to-post";
import { creatorInfo, tiktokDirectPost, tiktokEnabled } from "./tiktok";
import { tiktokAccount, tiktokCanTake } from "./tiktok-account";

/** TikTok for a post's page: connected or not, her choices, and (direct posts) what TikTok offers her right now. */
export async function tiktokPanel(
  studioId: string,
  post: { kind: PostKind; platforms: string[]; caption: string | null; hashtags: string[]; tiktok: unknown; external_ids: unknown },
  canEdit: boolean,
): Promise<TikTokPanel | null> {
  if (!tiktokEnabled() || !canEdit) return null;
  const account = await tiktokAccount(studioId).catch(() => null);
  const direct = tiktokDirectPost();
  const info = direct && account && post.platforms.includes("tiktok") ? await creatorInfo(account.accessToken).catch(() => null) : null;
  const sent = readTikTokExternal(post.external_ids);
  return {
    connected: Boolean(account),
    handle: account?.handle ?? null,
    canTake: tiktokCanTake(post.kind),
    direct,
    settings: readTikTokSettings(post.tiktok),
    options: info
      ? {
          privacy: info.privacy_level_options,
          commentDisabled: info.comment_disabled,
          duetDisabled: info.duet_disabled,
          stitchDisabled: info.stitch_disabled,
          nickname: info.creator_nickname ?? null,
        }
      : null,
    state: sent ? tiktokStateLine(sent) : null,
    caption: captionForTikTok(post.caption, post.hashtags),
  };
}
