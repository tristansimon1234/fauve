import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import { z } from "zod";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState, NoStudio } from "@/components/empty-state";
import { FolderIcon } from "@/components/icons";
import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { getStudioContext, rows, signMediaUrls } from "@/lib/studio";
import { deleteMedia } from "./actions";
import { AmbianceMaker } from "./ambiance-maker";
import { SettingsTabs } from "@/components/settings-tabs";

export const metadata: Metadata = { title: "Médiathèque" };

const LIMIT = 60;

const assetSchema = z.object({
  id: z.uuid(),
  storage_path: z.string(),
  kind: z.enum(["video", "image"]),
  source: z.enum(["whatsapp", "web_upload", "render", "library", "website", "ai"]),
  duration: z.coerce.number().nullable(),
  created_at: z.string(),
});
type Asset = z.infer<typeof assetSchema>;

export default function LibraryPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <SettingsTabs current="/mediatheque" />
      <PageSuspense title="Médiathèque">
        <Library />
      </PageSuspense>
    </main>
  );
}

async function Library() {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;

  const assets = rows(
    assetSchema,
    await db
      .from("media_assets")
      .select("id, storage_path, kind, source, duration, created_at")
      .eq("studio_id", studioId)
      // Simone's own montages (an effect's video) are not her photos and videos.
      .neq("source", "render")
      // Nor are voices: her voice notes to Simone and Simone's voice-overs live on their Reel, not here
      // (Tristan: « plein de vocaux qui servent à rien »).
      .in("kind", ["video", "image"])
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    "media_assets",
  );

  const urls = await signMediaUrls(
    db,
    studioId,
    assets.map((a) => a.storage_path),
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Médiathèque</h1>
        <p className="text-[15px] text-muted">
          {assets.length
            ? `Tes vidéos et photos, les plus récentes d’abord${assets.length === LIMIT ? ` (les ${LIMIT} dernières)` : ""}.`
            : "Tes vidéos et photos, en pleine qualité."}
        </p>
        <p className="text-[13px] text-muted">
          Chaque fichier est gardé tant qu’une publication en a besoin, puis supprimé 24 h après sa mise en ligne (7 jours s’il ne sert à aucune publication). Tes vidéos finales restent.
        </p>
      </div>

      {assets.length === 0 ? (
        <>
          <EmptyState title="Pas encore de photo ni de vidéo" className="max-w-[760px]" cta="Envoyer mes vidéos à Simone">
          Glisse tes photos et vidéos dans la conversation avec Simone (en pleine qualité), ou envoie-les sur WhatsApp en
          tant que document. Elles apparaîtront ici. Pense à avoir l’accord des personnes filmées.
          </EmptyState>
          <AmbianceMaker />
        </>
      ) : (
        <>
          <div className="flex max-w-[860px] flex-wrap items-center gap-4 rounded-[20px] border-[1.5px] border-dashed border-lilac bg-violet-tint px-5 py-4">
            <p className="min-w-0 flex-[1_1_320px] text-sm leading-relaxed">
              <strong>Ajoute des photos et des vidéos</strong> en les glissant dans la conversation avec Simone : elles
              arrivent en pleine qualité. Sur WhatsApp, envoie-les en tant que document.
            </p>
            <Link href="/fauve" className="btn btn-primary h-11 text-sm">
              Ouvrir Simone
            </Link>
            <AmbianceMaker />
          </div>
          {/* Masonry: each photo and video at its own shape, in columns. */}
          <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
            {assets.map((asset) => (
              <li key={asset.id} className="mb-3 break-inside-avoid">
                <AssetCard asset={asset} url={urls.get(asset.storage_path)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function AssetCard({ asset, url }: { asset: Asset; url: string | undefined }) {
  return (
    <article className="relative overflow-hidden rounded-[18px] border border-line bg-soft">
      {url && asset.kind === "video" ? (
        <video
          src={`${url}#t=0.1`}
          controls
          playsInline
          preload="metadata"
          className="block h-auto w-full bg-ink"
        />
      ) : url ? (
        // Signed Storage URLs expire, so they skip the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="block h-auto w-full" />
      ) : (
        <div className="flex aspect-square items-center justify-center text-muted">
          <FolderIcon size={32} />
        </div>
      )}
      <div className="absolute top-2 left-2 z-10">
        <DeleteButton
          compact
          action={deleteMedia.bind(null, asset.id)}
          confirmText={asset.kind === "video" ? "Supprimer cette vidéo ? Elle sera retirée des publications qui l’utilisent." : "Supprimer cette photo ? Elle sera retirée des publications qui l’utilisent."}
        />
      </div>
      {asset.duration !== null && asset.duration > 0 && (
        <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-ink/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {formatDuration(asset.duration)}
        </span>
      )}
      {asset.source === "ai" && (
        <span className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-ink/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
          IA
        </span>
      )}
    </article>
  );
}
