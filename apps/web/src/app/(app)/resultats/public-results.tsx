import { engagementOf, type platformSummary } from "@fauve/agent";
import Link from "next/link";
import { InstagramIcon, TikTokIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

// Résultats from her @ (no connected account): Instagram and TikTok side by side, the same numbers
// for both, then every Reel and video of her profile with its own numbers and ratios (Tristan: « où
// tu vois tes vues par réel, tes ratios ? pourquoi tu ne parles que d'Instagram et pas de TikTok ? »).

type Platform = "instagram" | "tiktok";
const NAMES: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };
const Icon = ({ platform, size = 18 }: { platform: Platform; size?: number }) =>
  platform === "instagram" ? <InstagramIcon size={size} /> : <TikTokIcon size={size} />;

const percent = (v: number | null, digits = 1) => (v === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(v * 100)} %`);
const show = (v: number | null) => (v === null ? "—" : formatNumber(v));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(n))}`;
/** Views over followers: « 2,3× » beyond them, « 60 % » short of them. */
const times = (v: number) => (v >= 1 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)}×` : percent(v, 0));

/** One platform: her followers, then what her videos of the period did, with the ratios. */
export function PlatformCard({
  platform,
  handle,
  followers,
  net,
  summary,
}: {
  platform: Platform;
  handle: string | null;
  followers: number | null;
  net: number | null;
  summary: ReturnType<typeof platformSummary>;
}) {
  if (!handle && followers === null && !summary.videos) {
    return (
      <section className="flex min-w-0 flex-col gap-2 rounded-[22px] border border-dashed border-line p-5.5">
        <span className="flex items-center gap-2 text-[15px] font-bold">
          <Icon platform={platform} /> {NAMES[platform]}
        </span>
        <p className="text-sm text-muted">Pas encore suivi.</p>
        <Link href="/reglages#reseaux" className="self-start text-sm font-bold text-violet">
          Ajouter mon @ {NAMES[platform]}
        </Link>
      </section>
    );
  }
  const stats: [string, string, string | null][] = [
    ["Vues", show(summary.views), summary.videos ? `${summary.videos} ${summary.videos > 1 ? "vidéos publiées" : "vidéo publiée"}` : "aucune vidéo sur la période"],
    ["Vues par vidéo", show(summary.perVideo), summary.reach !== null ? `${times(summary.reach)} tes abonnés` : null],
    ["Engagement", percent(summary.engagement), summary.views ? "j’aime, commentaires et enregistrements par vue" : null],
  ];
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[22px] border border-line p-5.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-bold">
          <Icon platform={platform} /> <span className="truncate">{handle ? `@${handle}` : NAMES[platform]}</span>
        </span>
        <span className="text-[12px] font-semibold text-muted">{NAMES[platform]}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-[-0.02em] tabular-nums">{show(followers)}</span>
        <span className="text-sm font-semibold text-muted">abonnés{net !== null ? ` · ${signed(net)} sur la période` : ""}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, value, detail]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-soft p-3">
            <span className="text-[12px] font-semibold text-muted">{label}</span>
            <span className="text-[20px] font-extrabold tabular-nums">{value}</span>
            {detail && <span className="text-[11.5px] leading-snug text-muted">{detail}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export type VideoRow = {
  platform: Platform;
  id: string;
  url: string | null;
  caption: string;
  publishedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  postId: string | null;
};

/** Each of her Reels and videos with its numbers and ratios, newest first; Edith's open their page. */
export function VideoTable({ videos, followers, timeZone }: { videos: VideoRow[]; followers: Record<Platform, number | null>; timeZone: string }) {
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="text-[11px] font-extrabold tracking-[.05em] text-muted uppercase">
          <tr>
            <th className="w-[44%] py-2 pr-3 font-extrabold">Vidéo</th>
            <th className="py-2 pr-3 text-right font-extrabold">Vues</th>
            <th className="py-2 pr-3 text-right font-extrabold">J’aime</th>
            <th className="py-2 pr-3 text-right font-extrabold">Comm.</th>
            <th className="py-2 pr-3 text-right font-extrabold">Engagement</th>
            <th className="py-2 text-right font-extrabold" title="Vues de la vidéo par rapport à tes abonnés">
              Vues / abonnés
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => {
            const reach = v.views !== null && followers[v.platform] ? v.views / followers[v.platform]! : null;
            return (
              <tr key={`${v.platform}:${v.id}`} className="border-t border-line align-middle">
                <td className="max-w-0 py-2.5 pr-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 text-muted" title={NAMES[v.platform]}>
                      <Icon platform={v.platform} size={16} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      {v.url ? (
                        <a href={v.url} target="_blank" rel="noreferrer" className="truncate font-bold hover:text-violet">
                          {v.caption.trim() || "Sans légende"}
                        </a>
                      ) : (
                        <span className="truncate font-bold">{v.caption.trim() || "Sans légende"}</span>
                      )}
                      <span className="text-[12px] text-muted">
                        {day.format(new Date(v.publishedAt))}
                        {v.postId ? (
                          <>
                            {" · "}
                            <Link href={`/publications/${v.postId}`} className="font-semibold text-violet">
                              faite avec Edith
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{show(v.views)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{show(v.likes)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{show(v.comments)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{percent(engagementOf(v))}</td>
                <td className="py-2.5 text-right tabular-nums">{reach === null ? "—" : times(reach)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
