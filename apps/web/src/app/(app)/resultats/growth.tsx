import type { Week } from "@fauve/agent";
import { formatCompact, formatNumber, formatShortDate } from "@/lib/format";

// The deeper half of Résultats: the account week by week (new followers and
// unfollows, views, profile visits), what each format brings, the best moments
// to post, and who follows. Plain HTML and CSS bars: no chart library.

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(n))}`;

/** New followers per week (violet, above) and unfollows (coral, below), with the net. */
export function FollowersChart({ weeks, timeZone }: { weeks: Week[]; timeZone: string }) {
  const max = Math.max(1, ...weeks.map((w) => w.newFollowers ?? Math.max(0, w.net ?? 0)));
  const maxDown = Math.max(1, ...weeks.map((w) => w.unfollows ?? Math.max(0, -(w.net ?? 0))));
  const hasDown = weeks.some((w) => (w.unfollows ?? 0) > 0 || (w.net ?? 0) < 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Nouveaux abonnés par semaine">
        {weeks.map((w) => {
          const up = w.newFollowers ?? Math.max(0, w.net ?? 0);
          const down = w.unfollows ?? Math.max(0, -(w.net ?? 0));
          const empty = w.days === 0;
          return (
            <div key={w.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className={`text-[11px] font-bold tabular-nums ${empty ? "text-muted/50" : (w.net ?? 0) < 0 ? "text-coral-ink" : "text-violet"}`}>
                {empty || w.net === null ? "·" : signed(w.net)}
              </span>
              <div className="flex h-[120px] w-full items-end">
                <div
                  className={`w-full rounded-t-[6px] ${empty ? "bg-track/60" : "bg-violet"}`}
                  style={{ height: `${empty ? 4 : Math.max(3, (up / max) * 100)}%` }}
                  title={`${formatNumber(up)} nouveaux abonnés`}
                />
              </div>
              {hasDown && (
                <div className="flex h-[36px] w-full items-start border-t border-line">
                  <div className="w-full rounded-b-[6px] bg-coral/70" style={{ height: `${down ? Math.max(6, (down / maxDown) * 100) : 0}%` }} title={`${formatNumber(down)} désabonnements`} />
                </div>
              )}
              <span className="text-[10px] font-semibold whitespace-nowrap text-muted">{formatShortDate(`${w.start}T12:00:00Z`, timeZone)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-violet" /> nouveaux abonnés
        </span>
        {hasDown && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-coral/70" /> désabonnements
          </span>
        )}
        <span>le chiffre au-dessus : le solde de la semaine</span>
      </div>
    </div>
  );
}

/** A small weekly bar series (views, profile visits, link taps). */
export function WeeklyBars({ weeks, pick, label, timeZone }: { weeks: Week[]; pick: (w: Week) => number | null; label: string; timeZone: string }) {
  const values = weeks.map(pick);
  if (values.every((v) => v === null)) return null;
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const last = values.findLast((v) => v !== null) ?? null;
  return (
    <div className="flex min-w-0 flex-1 basis-[220px] flex-col gap-2 rounded-[18px] border border-line p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold">{label}</span>
        {last !== null && <span className="text-[12px] font-semibold text-muted">{formatCompact(last)} cette semaine</span>}
      </div>
      <div className="flex h-[56px] items-end gap-1" role="img" aria-label={`${label} par semaine`}>
        {weeks.map((w, i) => (
          <div
            key={w.start}
            className={`flex-1 rounded-t-[4px] ${values[i] === null ? "bg-track/60" : i === weeks.length - 1 ? "bg-violet" : "bg-lilac"}`}
            style={{ height: `${values[i] === null ? 4 : Math.max(4, ((values[i] ?? 0) / max) * 100)}%` }}
            title={`Semaine du ${formatShortDate(`${w.start}T12:00:00Z`, timeZone)} : ${values[i] === null ? "pas de données" : formatNumber(values[i]!)}`}
          />
        ))}
      </div>
    </div>
  );
}

export type FormatRow = { kind: string; posts: number; views: number | null; reach: number | null; saves: number | null; shares: number | null; engagement: number | null };

export function FormatTable({ rows, labels }: { rows: FormatRow[]; labels: Record<string, string> }) {
  const percent = (v: number | null) => (v === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v * 100)} %`);
  const show = (v: number | null) => (v === null ? "—" : formatNumber(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead className="text-[11px] font-extrabold tracking-[.05em] text-muted uppercase">
          <tr>
            <th className="py-2 pr-3 font-extrabold">Format</th>
            <th className="py-2 pr-3 text-right font-extrabold">Vues / post</th>
            <th className="py-2 pr-3 text-right font-extrabold">Comptes touchés</th>
            <th className="py-2 pr-3 text-right font-extrabold">Enregistrements</th>
            <th className="py-2 text-right font-extrabold">Engagement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind} className="border-t border-line">
              <td className="py-2.5 pr-3 font-bold">
                {labels[r.kind] ?? r.kind} <span className="font-semibold text-muted">· {r.posts}</span>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{show(r.views)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{show(r.reach)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{show(r.saves)}</td>
              <td className="py-2.5 text-right font-bold tabular-nums">{percent(r.engagement)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Ranking({ items, unit }: { items: { label: string; posts?: number; average?: number; value?: number }[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.average ?? i.value ?? 0));
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i, n) => {
        const value = i.average ?? i.value ?? 0;
        return (
          <li key={i.label} className="flex items-center gap-3">
            <span className="w-[92px] shrink-0 truncate text-[13px] font-bold capitalize">{i.label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-track/60">
              <span className={`block h-full rounded-full ${n === 0 ? "bg-violet" : "bg-lilac"}`} style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </span>
            <span className="w-[86px] shrink-0 text-right text-[12px] font-semibold text-muted tabular-nums">
              {unit === "%" ? `${formatNumber(value)} %` : `${formatCompact(value)} ${unit}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
