import Link from "next/link";
import { ChevronDownIcon, GridIcon, HeartIcon, LayersIcon, LinkIcon, LockIcon, MenuIcon, PlayIcon, PlusIcon, ReelIcon, TagUserIcon } from "@/components/icons";
import { GridTabs } from "./grid-tabs";
import { formatCompact, formatShortDateTime } from "@/lib/format";
import type { InstagramMedia, InstagramProfile } from "@/lib/social/instagram";
import type { TikTokUser, TikTokVideo } from "@/lib/social/tiktok";
import { GridLayout, type ProfileView } from "./platform-switch";

// Her profiles as her followers see them in the apps (Tristan: « tu peux reproduire réellement
// les comptes Insta / TikTok ? »): Instagram's header, counters, bio, buttons, icon tabs and 3:4
// grid; TikTok's centred header and video grid. Simone's coming posts sit where they will land,
// marked by a small label only. Not linked yet: the same profile with her business's name and logo.

export type Tile =
  | { kind: "upcoming"; id: string; title: string; status: string; at: string | null; videoUrl: string | null; imageUrl: string | null; format: string; inGrid?: boolean }
  | { kind: "instagram"; media: InstagramMedia; views?: number }
  | { kind: "tiktok"; video: TikTokVideo };

export type TikTokGrid = { connected: boolean; handle: string | null; user: TikTokUser | null; tiles: Tile[] };

/** Who the profile is when the network does not say: her business's name, activity, site and logo. */
export type ProfileIdentity = { name: string | null; category: string | null; website: string | null; logo: string | null };

/** The apps' own type (San Francisco, Roboto): the profile reads as the real one, not as our app. */
const APP_FONT = "[font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]";

export function GridView({
  aside,
  connected,
  handle,
  info,
  identity,
  tiles,
  timezone: tz,
  tiktok = null,
}: {
  /** The page's title and button, set beside the profile. */
  aside: React.ReactNode;
  /** Her TikTok profile too, when TikTok is offered: a switch shows one or the other. */
  tiktok?: TikTokGrid | null;
  connected: boolean;
  handle: string | null;
  info: InstagramProfile | null;
  identity: ProfileIdentity;
  tiles: Tile[];
  timezone: string;
}) {
  const views: ProfileView[] = [
    {
      key: "instagram",
      hint: connected ? null : <LinkHint href="/connect" network="Instagram" />,
      profile: <InstagramView handle={handle} info={info} identity={identity} tiles={tiles} tz={tz} />,
    },
  ];
  if (tiktok) {
    views.push({
      key: "tiktok",
      hint: tiktok.connected ? null : <LinkHint href="/api/tiktok/connect" network="TikTok" />,
      profile: <TikTokView grid={tiktok} identity={identity} tz={tz} />,
    });
  }
  return (
    <GridLayout
      aside={
        <>
          {aside}
          <p className="text-[14px] leading-snug text-muted">Ton profil comme le voient tes abonnés, avec les publications prévues à l’endroit où elles vont arriver.</p>
        </>
      }
      views={views}
    />
  );
}

/** Not linked yet: one quiet line beside the profile, never a card in its place. */
function LinkHint({ href, network }: { href: string; network: string }) {
  return (
    <p className="text-[13.5px] leading-snug text-muted">
      Aperçu avec ce que Simone sait de ton commerce.{" "}
      <a href={href} className="font-bold text-violet">
        Relier {network}
      </a>{" "}
      pour voir ta vraie grille et tes chiffres.
    </p>
  );
}

function InstagramView({ handle, info, identity, tiles, tz }: { handle: string | null; info: InstagramProfile | null; identity: ProfileIdentity; tiles: Tile[]; tz: string }) {
  const name = info?.name || identity.name || "Ton commerce";
  const username = handle ?? usernameOf(identity.name);
  const reelTiles = tiles.filter((t) => (t.kind === "upcoming" ? t.format === "reel" : t.kind === "instagram" && t.media.media_product_type === "REELS"));
  return (
    <>
      <section aria-label="Aperçu du profil Instagram" className={`mx-auto w-full max-w-[430px] overflow-hidden rounded-[28px] border border-line bg-white text-[#000] ${APP_FONT}`}>
        {/* The top bar: her username, then « create » and the menu. */}
        <div className="flex h-12 items-center justify-between px-4">
          <span className="flex min-w-0 items-center gap-1 text-[18px] font-bold">
            <span className="truncate">{username}</span>
            <ChevronDownIcon size={16} strokeWidth={2.4} />
          </span>
          <span aria-hidden="true" className="flex items-center gap-5">
            <span className="flex size-6 items-center justify-center rounded-[7px] border-[1.8px] border-current">
              <PlusIcon size={14} strokeWidth={2.4} />
            </span>
            <MenuIcon size={24} strokeWidth={2} />
          </span>
        </div>

        {/* Picture, name and counters, as the app lays them out. */}
        <div className="flex items-center gap-6 px-4 pt-1">
          <Avatar src={info?.profile_picture_url ?? identity.logo} name={name} size={86} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-[14px] font-semibold">{name}</span>
            <div className="grid grid-cols-3">
              <Stat value={info?.media_count} label="publications" />
              <Stat value={info?.followers_count} label="followers" />
              <Stat value={info?.follows_count} label="suivi(e)s" />
            </div>
          </div>
        </div>

        <Bio category={identity.category} text={info?.biography ?? null} website={identity.website} />

        <div aria-hidden="true" className="flex gap-1.5 px-4 pt-3 pb-4">
          <span className="flex h-8 flex-1 items-center justify-center rounded-[8px] bg-[#efefef] text-[13.5px] font-semibold">Modifier le profil</span>
          <span className="flex h-8 flex-1 items-center justify-center rounded-[8px] bg-[#efefef] text-[13.5px] font-semibold">Partager le profil</span>
        </div>

        {tiles.length ? (
          <GridTabs
            all={<TileGrid tiles={tiles.filter((t) => t.kind !== "upcoming" || t.inGrid !== false)} tz={tz} />}
            reels={reelTiles.length ? <TileGrid tiles={reelTiles} tz={tz} tall /> : <Empty>Pas encore de Reel : demande-en un à Simone.</Empty>}
            extra={<TagUserIcon size={24} />}
          />
        ) : (
          <Empty>Rien à afficher pour l’instant : envoie tes vidéos à Simone pour remplir ta grille.</Empty>
        )}
      </section>
    </>
  );
}

/** Her TikTok profile: name on top, the centred picture, @, counters, buttons, then her videos. */
function TikTokView({ grid, identity, tz }: { grid: TikTokGrid; identity: ProfileIdentity; tz: string }) {
  const user = grid.user;
  const name = user?.display_name || identity.name || "Ton commerce";
  const username = grid.handle ?? usernameOf(identity.name);
  return (
    <>
      <section aria-label="Aperçu du profil TikTok" className={`mx-auto w-full max-w-[430px] overflow-hidden rounded-[28px] border border-line bg-white text-[#161823] ${APP_FONT}`}>
        <div className="relative flex h-12 items-center justify-center px-4">
          <span className="flex min-w-0 items-center gap-1 text-[17px] font-bold">
            <span className="truncate">{name}</span>
            <ChevronDownIcon size={15} strokeWidth={2.4} />
          </span>
          <MenuIcon aria-hidden="true" size={24} strokeWidth={2} className="absolute right-4" />
        </div>
        <div className="flex flex-col items-center gap-2.5 px-4 pt-2">
          <Avatar src={user?.avatar_url ?? identity.logo} name={name} size={96} />
          <span className="text-[16px] font-semibold">@{username}</span>
          <div className="flex items-start justify-center gap-7 pt-1">
            <Stacked value={user?.following_count} label="Abonnements" />
            <Stacked value={user?.follower_count} label="Followers" />
            <Stacked value={user?.likes_count} label="J’aime" />
          </div>
          <div aria-hidden="true" className="flex w-full max-w-[300px] gap-1.5 pt-2">
            <span className="flex h-10 flex-1 items-center justify-center rounded-[6px] bg-[#f1f1f2] text-[15px] font-semibold">Modifier le profil</span>
            <span className="flex h-10 flex-1 items-center justify-center rounded-[6px] bg-[#f1f1f2] text-[15px] font-semibold">Partager le profil</span>
          </div>
          {(user?.bio_description || identity.category) && (
            <p className="max-w-[320px] pb-1 text-center text-[14px] leading-snug whitespace-pre-line">{user?.bio_description || identity.category}</p>
          )}
        </div>
        {/* Its tabs, the videos first: the private and liked ones are not hers to show. */}
        <div aria-hidden="true" className="mt-3 grid grid-cols-3 border-b border-[#e3e3e4]">
          <span className="flex justify-center py-2.5 shadow-[inset_0_-2px_0_#161823]">
            <GridIcon size={22} />
          </span>
          <span className="flex justify-center py-2.5 text-[#8a8b91]">
            <LockIcon size={22} />
          </span>
          <span className="flex justify-center py-2.5 text-[#8a8b91]">
            <HeartIcon size={22} />
          </span>
        </div>
        {grid.tiles.length ? <TileGrid tiles={grid.tiles} tz={tz} views /> : <Empty>Pas encore de vidéo : coche TikTok dans « Où publier » sur un Reel.</Empty>}
      </section>
    </>
  );
}

/** Her picture, or her logo, or her initial on the brand's gradient. */
function Avatar({ src, name, size }: { src: string | null | undefined; name: string; size: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- her picture or logo, any host
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full border border-[#dbdbdb] bg-white object-cover" />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-coral font-bold text-white"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Instagram's bio: its category in grey, the text, then its link. */
function Bio({ category, text, website }: { category: string | null; text: string | null; website: string | null }) {
  if (!category && !text && !website) return null;
  return (
    <div className="flex flex-col gap-0.5 px-4 pt-2.5 text-[14px] leading-snug">
      {category && <span className="text-[#737373] first-letter:uppercase">{category}</span>}
      {text && <p className="whitespace-pre-line">{text}</p>}
      {website && (
        <a href={website} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-semibold text-[#00376b]">
          <LinkIcon size={14} strokeWidth={2.2} className="shrink-0" />
          <span className="truncate">{website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
        </a>
      )}
    </div>
  );
}

/** A username to show before the network gives hers: her business's name, as a handle would write it. */
function usernameOf(name: string | null): string {
  const handle = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return handle || "ton.commerce";
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-[13.5px] text-[#737373]">{children}</p>;
}

/** The tiles, 3:4 as in the profile grid, or 9:16 in the Reels tab; views where the app shows them. */
function TileGrid({ tiles, tz, tall = false, views = tall }: { tiles: Tile[]; tz: string; tall?: boolean; views?: boolean }) {
  return (
    <ul className="grid grid-cols-3 gap-px bg-white">
      {tiles.map((tile) => (
        <li key={tile.kind === "upcoming" ? `p-${tile.id}` : tile.kind === "instagram" ? `ig-${tile.media.id}` : `tt-${tile.video.id}`} className={`relative bg-[#efefef] ${tall ? "aspect-[9/16]" : "aspect-[3/4]"}`}>
          {tile.kind === "upcoming" ? (
            <UpcomingTile tile={tile} tz={tz} />
          ) : tile.kind === "instagram" ? (
            <InstagramTile media={tile.media} views={views ? tile.views : undefined} />
          ) : (
            <TikTokTile video={tile.video} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[15px] font-semibold">{value === undefined ? "–" : formatCompact(value)}</span>
      <span className="text-[13px]">{label}</span>
    </span>
  );
}

function Stacked({ value, label }: { value?: number; label: string }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className="text-[17px] font-bold">{value === undefined ? "–" : formatCompact(value)}</span>
      <span className="text-[13px] text-[#8a8b91]">{label}</span>
    </span>
  );
}

/** The app's own corner glyph: a Reel or a carousel, white, no label. */
function Glyph({ format }: { format: string | null }) {
  if (format !== "reel" && format !== "carousel") return null;
  const Icon = format === "reel" ? ReelIcon : LayersIcon;
  return <Icon aria-hidden="true" size={19} strokeWidth={2} className="pointer-events-none absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.45)]" />;
}

const statusLabels: Record<string, string> = { draft: "Brouillon", validated: "Validé", scheduled: "En route", tiktok_draft: "Dans tes brouillons" };

function UpcomingTile({ tile, tz }: { tile: Extract<Tile, { kind: "upcoming" }>; tz: string }) {
  return (
    <Link href={`/publications/${tile.id}`} className="group absolute inset-0 block outline-offset-[-3px]">
      {tile.videoUrl ? (
        <video src={tile.videoUrl} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : tile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
        <img src={tile.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-violet-soft p-3 text-center text-[13px] font-semibold text-violet">{tile.title}</span>
      )}
      <Glyph format={tile.format} />
      {/* Not online yet: a small label at the bottom, the only sign it is still to come. */}
      <span
        className={`absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm ${
          tile.status === "draft" || tile.status === "tiktok_draft" ? "bg-black/55" : "bg-violet/90"
        }`}
      >
        {statusLabels[tile.status] ?? tile.status}
        {tile.at ? ` · ${formatShortDateTime(tile.at, tz)}` : ""}
      </span>
    </Link>
  );
}

function InstagramTile({ media, views }: { media: InstagramMedia; views?: number }) {
  const reel = media.media_product_type === "REELS";
  const src = media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
  return (
    <a href={media.permalink} target="_blank" rel="noreferrer" className="absolute inset-0 block" aria-label={media.caption?.slice(0, 80) ?? "Publication Instagram"}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted">{media.caption?.slice(0, 60)}</span>
      )}
      <Glyph format={reel ? "reel" : media.media_type === "CAROUSEL_ALBUM" ? "carousel" : null} />
      {views !== undefined && <Views count={views} />}
    </a>
  );
}

/** Views at the bottom left, as the apps show them on Reels and TikToks. */
function Views({ count }: { count: number }) {
  return (
    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/50 to-transparent px-2 pt-6 pb-1.5 text-[13px] font-semibold text-white">
      <PlayIcon size={12} />
      {formatCompact(count)}
      <span className="sr-only"> vues</span>
    </span>
  );
}

function TikTokTile({ video }: { video: TikTokVideo }) {
  return (
    <a href={video.share_url} target="_blank" rel="noreferrer" className="absolute inset-0 block" aria-label={video.title?.slice(0, 80) ?? "Vidéo TikTok"}>
      {video.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.cover_image_url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted">{video.title?.slice(0, 60)}</span>
      )}
      {video.view_count !== undefined && <Views count={video.view_count} />}
    </a>
  );
}
