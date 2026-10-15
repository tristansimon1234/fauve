"use client";

import { useRef, useState } from "react";

// The follower count, day by day: one line per network (never two scales on one
// axis), the latest count named at its end, and the day under the pointer.

const W = 600;
const H = 150;
const PAD = { top: 12, right: 12, bottom: 24, left: 52 };

const number = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${number(Math.abs(n))}`;

export function FollowersLine({ label, points, timeZone }: { label: string; points: { day: string; followers: number }[]; timeZone: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone });
  const at = (d: string) => day.format(new Date(`${d}T12:00:00Z`));
  const values = points.map((p) => p.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat account stays a flat line in the middle, not a line glued to an axis.
  const span = Math.max(max - min, Math.max(4, Math.round(max * 0.02)));
  const lo = min - (span - (max - min)) / 2;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.followers).toFixed(1)}`).join(" ");
  const first = points[0]!;
  const last = points.at(-1)!;
  const shown = hover === null ? null : points[hover]!;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const vx = ((event.clientX - box.left) / box.width) * W;
    const i = Math.round(((vx - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  return (
    <figure className="flex min-w-0 flex-1 basis-[300px] flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-bold">
          {label} · {number(last.followers)} abonnés
        </span>
        <span className="text-[12px] font-semibold text-muted">
          {signed(last.followers - first.followers)} depuis le {at(first.day)}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-none"
          role="img"
          aria-label={`${label} : ${number(first.followers)} abonnés le ${at(first.day)}, ${number(last.followers)} le ${at(last.day)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Recessive frame: two light rules at the low and high counts (their numbers are HTML, so they stay readable on a phone). */}
          {[lo + span, lo].map((v) => (
            <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={path} fill="none" className="stroke-violet" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(points.length - 1)} cy={y(last.followers)} r={4} className="fill-violet stroke-white" strokeWidth={2} />
          {shown && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted/50" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(shown.followers)} r={4.5} className="fill-violet stroke-white" strokeWidth={2} />
            </g>
          )}
          {/* A wide invisible target: the whole plot answers the pointer. */}
          <rect x={PAD.left} y={0} width={W - PAD.left - PAD.right} height={H} fill="transparent" />
        </svg>
        {[lo + span, lo].map((v) => (
          <span
            key={v}
            className="pointer-events-none absolute left-0 -translate-y-1/2 text-[11px] font-semibold text-muted tabular-nums"
            style={{ top: `${(y(v) / H) * 100}%`, width: `${((PAD.left - 6) / W) * 100}%`, textAlign: "right" }}
          >
            {number(Math.round(v))}
          </span>
        ))}
        <span className="pointer-events-none absolute bottom-0 text-[11px] font-semibold text-muted" style={{ left: `${(PAD.left / W) * 100}%` }}>
          {at(first.day)}
        </span>
        <span className="pointer-events-none absolute right-0 bottom-0 text-[11px] font-semibold text-muted" style={{ right: `${(PAD.right / W) * 100}%` }}>
          {at(last.day)}
        </span>
        {shown && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-[10px] bg-ink px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-white shadow-sm"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            {at(shown.day)} · {number(shown.followers)} abonnés
          </div>
        )}
      </div>
    </figure>
  );
}
