import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { EyeIcon, InstagramIcon, PlayIcon } from "@/components/icons";
import { FormatBadge } from "@/components/format-badge";
import { formatCompact, formatNumber, formatShortDateTime } from "@/lib/format";
import type { InstagramMedia, InstagramProfile } from "@/lib/social/instagram";

// The Instagram profile preview: header and 3-column grid (3:4 tiles, as on
// Instagram), Fauve's coming posts first with a dashed frame and their status.

export type Tile =
  | { kind: "upcoming"; id: string; title: string; status: string; at: string | null; videoUrl: string | null; imageUrl: string | null; format: string }
  | { kind: "instagram"; media: InstagramMedia; views?: number };

export function GridView({
  connected,
  handle,
  info,
  tiles,
  timezone: tz,
  heading = true,
}: {
  /** The page title and intro (false inside the calendar). */
  heading?: boolean;
  connected: boolean;
  handle: string | null;
  info: InstagramProfile | null;
  tiles: Tile[];
  timezone: string;
}) {
  return (
    <>
      {heading ? (
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Grille</h1>
          <p className="max-w-[620px] text-[15px] text-muted">
            Ton profil Instagram comme le voient tes abonnés, avec les publications prévues par Brigitte à l’endroit où elles
            vont arriver.
          </p>
        </div>
      ) : (
        <p className="mx-auto max-w-[520px] text-center text-[14px] text-muted">
          Ton profil comme le voient tes abonnés, avec les publications prévues à l’endroit où elles vont arriver.
        </p>
      )}

      {!connected && (
        <EmptyState title="Connecte Instagram pour voir ta vraie grille" cta={null} className="mx-auto w-full max-w-[520px]">
          En attendant, voici les publications prévues par Brigitte.{" "}
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
          <ul className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-b-[22px] border-t border-line">
            {tiles.map((tile) => (
              <li key={tile.kind === "upcoming" ? `p-${tile.id}` : `ig-${tile.media.id}`} className="relative aspect-[3/4] bg-soft">
                {tile.kind === "upcoming" ? <UpcomingTile tile={tile} tz={tz} /> : <InstagramTile media={tile.media} views={tile.views} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">
            Rien à afficher pour l’instant : envoie tes vidéos à Brigitte pour remplir ta grille.
          </p>
        )}
      </section>
    </>
  );
}

function Count({ value, label }: { value?: number; label: string }) {
  return (
    <span>
      <span className="font-bold">{value === undefined ? "—" : formatNumber(value)}</span> {label}
    </span>
  );
}

const statusLabels: Record<string, string> = { draft: "Brouillon", validated: "Validé", scheduled: "Prévu" };

function UpcomingTile({ tile, tz }: { tile: Extract<Tile, { kind: "upcoming" }>; tz: string }) {
  return (
    <Link href={`/publications/${tile.id}`} className="group absolute inset-0 block outline-offset-[-3px]">
      {tile.videoUrl ? (
        <video src={`${tile.videoUrl}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
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
