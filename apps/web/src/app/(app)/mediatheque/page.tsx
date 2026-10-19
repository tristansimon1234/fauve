import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import { z } from "zod";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState, NoStudio } from "@/components/empty-state";
import { FolderIcon, MicIcon } from "@/components/icons";
import Link from "next/link";
import { formatDuration, formatShortDateTime } from "@/lib/format";
import { getStudioContext, rows, signMediaUrls, type Db } from "@/lib/studio";
import { deleteMedia } from "./actions";
import { AmbianceMaker } from "./ambiance-maker";
import { SettingsTabs } from "@/components/settings-tabs";

export const metadata: Metadata = { title: "Médiathèque" };

const LIMIT = 60;

const assetSchema = z.object({
  id: z.uuid(),
  storage_path: z.string(),
  kind: z.enum(["video", "image", "audio", "document"]),
  source: z.enum(["whatsapp", "web_upload", "render", "library", "website", "ai"]),
  ai: z.object({ mode: z.enum(["improve", "ambiance"]) }).nullable().catch(null),
  duration: z.coerce.number().nullable(),
  created_at: z.string(),
  analysis_status: z.string().nullable(),
});
type Asset = z.infer<typeof assetSchema>;

const analysisSchema = z.object({
  summary: z.string(),
  lighting: z.string().optional(),
  issues: z.array(z.string()).catch([]),
});
type Analysis = z.infer<typeof analysisSchema>;

const sourceLabels: Record<Asset["source"], string> = {
  whatsapp: "Reçue sur WhatsApp",
  web_upload: "Déposée sur le site",
  render: "Montage de Simone",
  library: "Bibliothèque",
  website: "Prise sur ton site",
  ai: "Image de Simone (IA)",
};

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
  const tz = member.studio.timezone;

  const assets = rows(
    assetSchema,
    await db
      .from("media_assets")
      .select("id, storage_path, kind, source, duration, created_at, analysis_status, ai")
      .eq("studio_id", studioId)
      // Simone's own montages (an effect's video) are not her photos and videos.
      .neq("source", "render")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    "media_assets",
  );

  const [urls, analyses] = await Promise.all([
    signMediaUrls(
      db,
      studioId,
      assets.filter((a) => a.kind === "video" || a.kind === "image").map((a) => a.storage_path),
    ),
    loadAnalyses(
      db,
      assets.filter((a) => a.kind === "video").map((a) => a.id),
    ),
  ]);

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
          tant que document. Elles apparaîtront ici, avec ce que Simone y a vu. Pense à avoir l’accord des personnes filmées.
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
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {assets.map((asset) => (
              <li key={asset.id}>
                <AssetCard
                  asset={asset}
                  url={urls.get(asset.storage_path)}
                  analysis={analyses.get(asset.id)}
                  tz={tz}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

async function loadAnalyses(db: Db, ids: string[]): Promise<Map<string, Analysis>> {
  const byMedia = new Map<string, Analysis>();
  if (!ids.length) return byMedia;
  const { data, error } = await db
    .from("clip_analyses")
    .select("media_id, analysis, created_at")
    .in("media_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`clip_analyses: ${error.message}`);
  for (const row of data ?? []) {
    const parsed = analysisSchema.safeParse(row.analysis);
    if (parsed.success && !byMedia.has(row.media_id)) byMedia.set(row.media_id, parsed.data);
  }
  return byMedia;
}

function AssetCard({
  asset,
  url,
  analysis,
  tz,
}: {
  asset: Asset;
  url: string | undefined;
  analysis: Analysis | undefined;
  tz: string;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[18px] border border-line bg-white">
      <div className="relative flex aspect-[4/5] items-center justify-center bg-soft text-muted">
        {url && asset.kind === "video" ? (
          <video
            src={`${url}#t=0.1`}
            controls
            playsInline
            preload="metadata"
            className="size-full bg-ink object-contain"
          />
        ) : url && asset.kind === "image" ? (
          // Signed Storage URLs expire, so they skip the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" className="size-full object-cover" />
        ) : asset.kind === "audio" ? (
          <MicIcon size={32} />
        ) : (
          <FolderIcon size={32} />
        )}
        <div className="absolute top-2 left-2 z-10">
          <DeleteButton
            compact
            action={deleteMedia.bind(null, asset.id)}
            confirmText={asset.kind === "video" ? "Supprimer cette vidéo ? Elle sera retirée des publications qui l’utilisent." : "Supprimer ce fichier ? Il sera retiré des publications qui l’utilisent."}
          />
        </div>
        {asset.duration !== null && asset.duration > 0 && (
          <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-ink/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {formatDuration(asset.duration)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <span className="text-xs font-semibold text-muted">
          {asset.ai?.mode === "improve" ? "Améliorée par Simone (IA)" : sourceLabels[asset.source]} · {formatShortDateTime(asset.created_at, tz)}
        </span>
        {analysis ? (
          <>
            <p className="text-[13px] leading-snug">{analysis.summary}</p>
            {analysis.lighting === "poor" && (
              <span className="self-start rounded-full bg-peach px-2 py-1 text-[11px] font-bold text-peach-ink">
                Lumière faible
              </span>
            )}
            {analysis.issues.length > 0 && (
              <p className="text-xs leading-snug text-muted">À noter : {analysis.issues.slice(0, 2).join(" · ")}</p>
            )}
          </>
        ) : asset.kind === "video" && asset.analysis_status === "running" ? (
          <p className="text-[13px] text-muted">Simone regarde cette vidéo…</p>
        ) : asset.kind === "video" && asset.analysis_status === "failed" ? (
          <p className="text-[13px] text-muted">Simone n’a pas pu analyser cette vidéo.</p>
        ) : null}
        {!url && (asset.kind === "video" || asset.kind === "image") && (
          <p className="text-xs text-muted">Aperçu indisponible pour le moment.</p>
        )}
      </div>
    </article>
  );
}
