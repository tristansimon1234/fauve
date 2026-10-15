import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { EyeIcon, InstagramIcon, PlayIcon, TikTokIcon } from "@/components/icons";
import { FormatBadge } from "@/components/format-badge";
import { GridTabs } from "./grid-tabs";
import { formatCompact, formatNumber, formatShortDateTime } from "@/lib/format";
import type { InstagramMedia, InstagramProfile } from "@/lib/social/instagram";
import type { TikTokUser, TikTokVideo } from "@/lib/social/tiktok";
import { PlatformSwitch } from "./platform-switch";

// The Instagram profile preview: header, then the Publications tab (3-column
// grid of 3:4 tiles, as on Instagram) or the Reels tab (9:16), Fauve's coming
// posts first with a dashed frame and their status.

export type Tile =
  | { kind: "upcoming"; id: string; title: string; status: string; at: string | null; videoUrl: string | null; imageUrl: string | null; format: string; inGrid?: boolean }
  | { kind: "instagram"; media: InstagramMedia; views?: number }
  | { kind: "tiktok"; video: TikTokVideo };

export type TikTokGrid = { connected: boolean; handle: string | null; user: TikTokUser | null; tiles: Tile[] };

export function GridView({
  connected,
  handle,
  info,
  tiles,
  timezone: tz,
  heading = true,
  tiktok = null,
}: {
  /** Her TikTok profile too, when TikTok is offered: a switch shows one or the other. */
  tiktok?: TikTokGrid | null;
  /** The page title and intro (false inside the calendar). */
  heading?: boolean;
  connected: boolean;
  handle: string | null;
  info: InstagramProfile | null;
  tiles: Tile[];
  timezone: string;
}) {
  const reelTiles = tiles.filter((t) => (t.kind === "upcoming" ? t.format === "reel" : t.kind === "instagram" && t.media.media_product_type === "REELS"));
  const instagramView = (
    <>
      {!connected && (
        <EmptyState title="Connecte Instagram pour voir ta vraie grille" cta={null} className="mx-auto w-full max-w-[520px]">
          En attendant, voici les publications prévues par Simone.{" "}
          <a href="/connect" className="font-bold text-violet">
            Connecter Instagram
          </a>
        </EmptyState>
      )}

      <section aria-label="Aperçu du profil Instagram" className="mx-auto w-full max-w-[520px] rounded-[22px] border border-line bg-white">
        {connected && (
          <header className="flex items-center gap-5 px-5 pt-5 pb-4">
            {info?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.profile_picture_url} alt="" className="size-20 shrink-0 rounded-full border border-line object-cover" />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
                <InstagramIcon size={30} />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-2">
              <span className="truncate text-lg font-bold">{handle ? `@${handle}` : "Ton compte"}</span>
              <div className="flex gap-5 text-sm">
                <Count value={info?.media_count} label="publications" />
                <Count value={info?.followers_count} label="abonnés" />
                <Count value={info?.follows_count} label="abonnements" />
              </div>
            </div>
          </header>
        )}
        {connected && (info?.name || info?.biography) && (
          <div className="px-5 pb-4 text-sm leading-snug">
            {info.name && <p className="font-bold">{info.name}</p>}
            {info.biography && <p className="whitespace-pre-line text-ink/85">{info.biography}</p>}
          </div>
        )}

        {tiles.length ? (
          <GridTabs
            all={<TileGrid tiles={tiles.filter((t) => t.kind !== "upcoming" || t.inGrid !== false)} tz={tz} />}
            reels={
              reelTiles.length ? (
                <TileGrid tiles={reelTiles} tz={tz} tall />
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted">Pas encore de Reel : demande-en un à Simone.</p>
              )
            }
          />
        ) : (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">
            Rien à afficher pour l’instant : envoie tes vidéos à Simone pour remplir ta grille.
          </p>
        )}
      </section>
    </>
  );
  return (
    <>
      {heading ? (
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Grille</h1>
          <p className="max-w-[620px] text-[15px] text-muted">
            Ton profil Instagram comme le voient tes abonnés, avec les publications prévues par Simone à l’endroit où elles
            vont arriver.
          </p>
        </div>
      ) : (
        <p className="mx-auto max-w-[520px] text-center text-[14px] text-muted">
          Ton profil comme le voient tes abonnés, avec les publications prévues à l’endroit où elles vont arriver.
        </p>
      )}

      {tiktok ? <PlatformSwitch instagram={instagramView} tiktok={<TikTokView grid={tiktok} tz={tz} />} /> : instagramView}
    </>
  );
}

/** The tiles, 3:4 as in the profile grid, or 9:16 in the Reels tab. */
function TileGrid({ tiles, tz, tall = false }: { tiles: Tile[]; tz: string; tall?: boolean }) {
  return (
    <ul className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-b-[22px]">
      {tiles.map((tile) => (
        <li key={tile.kind === "upcoming" ? `p-${tile.id}` : tile.kind === "instagram" ? `ig-${tile.media.id}` : `tt-${tile.video.id}`} className={`relative bg-soft ${tall ? "aspect-[9/16]" : "aspect-[3/4]"}`}>
          {tile.kind === "upcoming" ? (
            <UpcomingTile tile={tile} tz={tz} />
          ) : tile.kind === "instagram" ? (
            <InstagramTile media={tile.media} views={tile.views} />
          ) : (
            <TikTokTile video={tile.video} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Count({ value, label }: { value?: number; label: string }) {
  return (
    <span>
      <span className="font-bold">{value === undefined ? "—" : formatNumber(value)}</span> {label}
    </span>
  );
}

const statusLabels: Record<string, string> = { draft: "Brouillon", validated: "Validé", scheduled: "Prévu", tiktok_draft: "Dans tes brouillons" };

function UpcomingTile({ tile, tz }: { tile: Extract<Tile, { kind: "upcoming" }>; tz: string }) {
  return (
    <Link href={`/publications/${tile.id}`} className="group absolute inset-0 block outline-offset-[-3px]">
      {tile.videoUrl ? (
        <video src={tile.videoUrl} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : tile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
        <img src={tile.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-violet-soft p-3 text-center text-[13px] font-semibold text-violet">
          {tile.title}
        </span>
      )}
      {/* Not on Instagram yet: dashed frame and the status, like a placeholder in the grid. */}
      <span className="pointer-events-none absolute inset-0 border-2 border-dashed border-violet/70" />
      <span
        className={`absolute top-1.5 left-1.5 max-w-[calc(100%-2.5rem)] truncate rounded-full px-2 py-0.5 text-[11px] font-bold ${
          tile.status === "draft" ? "bg-peach text-peach-ink" : "bg-violet text-white"
        }`}
      >
        {statusLabels[tile.status] ?? tile.status}
        {tile.at ? ` · ${formatShortDateTime(tile.at, tz)}` : ""}
      </span>
      <FormatBadge format={tile.format} />
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
      <FormatBadge format={reel ? "reel" : media.media_type === "CAROUSEL_ALBUM" ? "carousel" : null} />
      {views !== undefined && (
        // Views at the bottom left, like the play count Instagram shows on Reels.
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-2 pt-5 pb-1.5 text-[12px] font-bold text-white">
          {reel ? <PlayIcon size={12} /> : <EyeIcon size={13} />}
          {formatCompact(views)}
          <span className="sr-only"> vues</span>
        </span>
      )}
    </a>
  );
}

/** Her TikTok profile: avatar, @, counters, then her videos (3:4, views at the bottom). */
function TikTokView({ grid, tz }: { grid: TikTokGrid; tz: string }) {
  const user = grid.user;
  return (
    <>
      {!grid.connected && (
        <EmptyState title="Connecte TikTok pour voir ton profil" cta={null} className="mx-auto w-full max-w-[520px]">
          Seules les vidéos vont sur TikTok : tes Reels prévus avec TikTok apparaissent ici.{" "}
          <a href="/api/tiktok/connect" className="font-bold text-violet">
            Connecter TikTok
          </a>
        </EmptyState>
      )}
      <section aria-label="Aperçu du profil TikTok" className="mx-auto w-full max-w-[520px] rounded-[22px] border border-line bg-white">
        {grid.connected && (
          <header className="flex flex-col items-center gap-2 px-5 pt-5 pb-4 text-center">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="size-20 rounded-full border border-line object-cover" />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-full bg-violet-soft text-violet">
                <TikTokIcon size={30} />
              </span>
            )}
            <span className="text-lg font-bold">{grid.handle ? `@${grid.handle}` : (user?.display_name ?? "Ton compte")}</span>
            <div className="flex gap-6 text-sm">
              <Stacked value={user?.following_count} label="Abonnements" />
              <Stacked value={user?.follower_count} label="Abonnés" />
              <Stacked value={user?.likes_count} label="J’aime" />
            </div>
          </header>
        )}
        {grid.tiles.length ? (
          <div className="border-t border-line">
            <TileGrid tiles={grid.tiles} tz={tz} />
          </div>
        ) : (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">
            Pas encore de vidéo : coche TikTok dans « Où publier » sur un Reel.
          </p>
        )}
      </section>
    </>
  );
}

function Stacked({ value, label }: { value?: number; label: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-bold">{value === undefined ? "—" : formatCompact(value)}</span>
      <span className="text-[12px] text-muted">{label}</span>
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
      {video.view_count !== undefined && (
        // Views at the bottom left, as TikTok shows them on a profile.
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-2 pt-5 pb-1.5 text-[12px] font-bold text-white">
          <PlayIcon size={12} />
          {formatCompact(video.view_count)}
          <span className="sr-only"> vues</span>
        </span>
      )}
    </a>
  );
}
