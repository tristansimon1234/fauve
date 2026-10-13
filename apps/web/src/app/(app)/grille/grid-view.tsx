import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { InstagramIcon, LayersIcon, PlayIcon } from "@/components/icons";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import type { InstagramMedia, InstagramProfile } from "@/lib/social/instagram";

// The Instagram profile preview: header and 3-column grid (4:5 tiles, as on
// Instagram), Fauve's coming posts first with a dashed frame and their status.

export type Tile =
  | { kind: "upcoming"; id: string; title: string; status: string; at: string | null; videoUrl: string | null; format: string }
  | { kind: "instagram"; media: InstagramMedia };

export function GridView({
  connected,
  handle,
  info,
  tiles,
  timezone: tz,
}: {
  connected: boolean;
  handle: string | null;
  info: InstagramProfile | null;
  tiles: Tile[];
  timezone: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Grille</h1>
        <p className="max-w-[620px] text-[15px] text-muted">
          Ton profil Instagram comme le voient tes abonnés, avec les publications prévues par Fauve à l’endroit où elles
          vont arriver.
        </p>
      </div>

      {!connected && (
        <EmptyState title="Connecte Instagram pour voir ta vraie grille" cta={null} className="max-w-[760px]">
          En attendant, voici les publications prévues par Fauve.{" "}
          <a href="/connect" className="font-bold text-violet">
            Connecter Instagram
          </a>
        </EmptyState>
      )}

      <section aria-label="Aperçu du profil Instagram" className="w-full max-w-[520px] rounded-[22px] border border-line bg-white">
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
              <li key={tile.kind === "upcoming" ? `p-${tile.id}` : `ig-${tile.media.id}`} className="relative aspect-[4/5] bg-soft">
                {tile.kind === "upcoming" ? <UpcomingTile tile={tile} tz={tz} /> : <InstagramTile media={tile.media} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">
            Rien à afficher pour l’instant : envoie tes vidéos à Fauve pour remplir ta grille.
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
      {tile.format === "reel" && <PlayIcon size={16} className="absolute top-2 right-2 text-white drop-shadow" />}
    </Link>
  );
}

function InstagramTile({ media }: { media: InstagramMedia }) {
  const src = media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
  return (
    <a href={media.permalink} target="_blank" rel="noreferrer" className="absolute inset-0 block" aria-label={media.caption?.slice(0, 80) ?? "Publication Instagram"}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted">{media.caption?.slice(0, 60)}</span>
      )}
      {media.media_product_type === "REELS" && <PlayIcon size={16} className="absolute top-2 right-2 text-white drop-shadow" />}
      {media.media_type === "CAROUSEL_ALBUM" && <LayersIcon size={16} className="absolute top-2 right-2 text-white drop-shadow" />}
    </a>
  );
}
