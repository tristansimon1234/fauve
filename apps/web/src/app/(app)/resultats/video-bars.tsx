"use client";

import { engagementOf } from "@fauve/agent";
import { useState } from "react";
import type { VideoRow } from "./public-results";

// Her videos of the period, oldest to newest, as two small charts with the same columns (never two
// scales on one axis): the views of each, then its engagement. A colour per network, a legend when
// both are there, and the video under the pointer named in both (Tristan: « pas de graph ? »). The
// table under them gives every number.

const COLOR = { instagram: "bg-violet", tiktok: "bg-coral" } as const;
const NAME = { instagram: "Instagram", tiktok: "TikTok" } as const;
const number = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const percent = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v * 100)} %`;

/** A round top for the axis: 1, 2, 2.5 or 5 times a power of ten, at least the highest value. */
function niceTop(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= max) ?? 10;
  return step * power;
}

function Columns({
  title,
  videos,
  value,
  label,
  hover,
  onHover,
  from,
  to,
}: {
  /** The first and the last day, under the columns. */
  from: string;
  to: string;
  title: string;
  videos: VideoRow[];
  value: (v: VideoRow) => number | null;
  label: (n: number) => string;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const values = videos.map(value);
  const top = niceTop(Math.max(0, ...values.map((v) => v ?? 0)));
  return (
    <figure className="flex min-w-0 flex-1 basis-[320px] flex-col gap-2">
      <figcaption className="text-[14px] font-bold">{title}</figcaption>
      <div className="relative pl-11">
        {/* Recessive frame: the top value and zero, hairlines. */}
        {[top, 0].map((v) => (
          <span
            key={v}
            className="pointer-events-none absolute left-0 w-9 -translate-y-1/2 text-right text-[11px] font-semibold text-muted tabular-nums"
            style={{ top: v ? 0 : "160px" }}
          >
            {label(v)}
          </span>
        ))}
        <div className="relative flex h-[160px] items-end border-b border-line" onPointerLeave={() => onHover(null)}>
          <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-line" />
          {videos.map((v, i) => {
            const n = values[i];
            return (
              <button
                key={`${v.platform}:${v.id}`}
                type="button"
                aria-label={`${NAME[v.platform]}, ${v.caption.trim() || "sans légende"} : ${n === null ? "pas de chiffre" : label(n)}`}
                onPointerEnter={() => onHover(i)}
                onFocus={() => onHover(i)}
                onBlur={() => onHover(null)}
                className="flex h-full min-w-0 flex-1 items-end justify-center px-px outline-none"
              >
                {n !== null && (
                  <span
                    className={`block w-full max-w-[24px] rounded-t-[4px] ${COLOR[v.platform]} transition-opacity ${hover !== null && hover !== i ? "opacity-40" : ""}`}
                    style={{ height: `${Math.max(2, (n / top) * 100)}%` }}
                  />
                )}
              </button>
            );
          })}
          {hover !== null && values[hover] !== undefined && (
            <span
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[10px] bg-ink px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-white shadow-sm"
              // Just above its column, inside the plot (above the plot it sat on the chart's title).
              style={{ left: `${((hover + 0.5) / videos.length) * 100}%`, bottom: `calc(${Math.min(84, Math.max(2, ((values[hover] ?? 0) / top) * 100))}% + 6px)` }}
            >
              {values[hover] === null ? "—" : label(values[hover]!)}
            </span>
          )}
        </div>
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-muted">
          <span>{from}</span>
          <span>{to}</span>
        </div>
      </div>
    </figure>
  );
}

export function VideoBars({ videos, timeZone }: { videos: VideoRow[]; timeZone: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ordered = [...videos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  if (ordered.length < 2) return null;
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone });
  const platforms = [...new Set(ordered.map((v) => v.platform))];
  const shown = hover === null ? null : ordered[hover]!;
  const from = day.format(new Date(ordered[0]!.publishedAt));
  const to = day.format(new Date(ordered.at(-1)!.publishedAt));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {platforms.length > 1 ? (
          <ul className="flex gap-4 text-[12.5px] font-semibold text-muted" aria-label="Légende">
            {platforms.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-[3px] ${COLOR[p]}`} /> {NAME[p]}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[12.5px] font-semibold text-muted">{NAME[platforms[0]!]}</span>
        )}
        <span className="min-h-[18px] min-w-0 truncate text-[12.5px] font-semibold">
          {shown ? `${day.format(new Date(shown.publishedAt))} · ${shown.caption.trim() || "Sans légende"}` : <span className="text-muted">Passe sur une barre pour voir la vidéo</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-8">
        <Columns title="Vues de chaque vidéo" videos={ordered} value={(v) => v.views} label={number} hover={hover} onHover={setHover} from={from} to={to} />
        <Columns title="Engagement de chaque vidéo" videos={ordered} value={(v) => engagementOf(v)} label={percent} hover={hover} onHover={setHover} from={from} to={to} />
      </div>
    </div>
  );
}
