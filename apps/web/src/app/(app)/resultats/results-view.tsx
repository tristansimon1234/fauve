"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { demoAudience, demoResults, demoSuggestions, demoTopPosts } from "@/lib/demo";

const periods = [
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
] as const;

// First KPI (bookings from Instagram) is the product's headline number.
const kpiStyles = ["bg-violet text-white", "bg-peach text-ink", "bg-soft text-ink", "bg-soft text-ink"];
const dayLetters = ["L", "M", "M", "J", "V", "S", "D"];
const dayNames = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function ResultsView() {
  const [period, setPeriod] = useState<"7" | "30">("30");
  const data = demoResults[period];

  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Résultats</h1>
          <p className="text-[15px] text-muted">Instagram et TikTok · données d’exemple</p>
        </div>
        <div role="group" aria-label="Période" className="flex gap-1.5 rounded-full bg-soft p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={`h-10 rounded-full px-4.5 text-sm font-bold ${period === p.key ? "bg-ink text-white" : "text-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {data.kpis.map(([label, value, delta], i) => (
          <div key={label} className={`flex flex-col gap-2 rounded-[20px] p-5 ${kpiStyles[i]}`}>
            <span className="text-sm font-semibold opacity-85">{label}</span>
            <span className="text-4xl font-extrabold tracking-[-0.02em]">{value}</span>
            <span className="text-[13px] font-semibold opacity-85">{delta}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-[22px] bg-soft p-6">
          <div className="flex items-center gap-2.5">
            <Orb size={32} />
            <h2 className="text-lg font-bold">Le bilan de Fauve</h2>
          </div>
          <p className="text-[15px] leading-[1.65]">{data.bilan}</p>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold tracking-[.06em] text-muted">LA SEMAINE PROCHAINE, JE PROPOSE</span>
            {demoSuggestions.map((s) => (
              <span key={s} className="flex gap-2.5 text-sm font-semibold">
                <CheckIcon size={18} className="shrink-0 text-violet" />
                {s}
              </span>
            ))}
          </div>
          <Link href="/calendrier" className="btn btn-primary self-start">
            Appliquer au calendrier
          </Link>
        </section>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
          <section className="flex flex-col gap-3.5 rounded-[22px] border border-line p-5.5">
            <h2 className="text-base font-bold">Ce qui a le mieux marché</h2>
            {demoTopPosts.map((t) => (
              <div key={t.title} className="flex items-center gap-3.5">
                <span className="h-16 w-12 shrink-0 rounded-[10px]" style={{ background: t.thumb }} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-bold">{t.title}</span>
                  <span className="text-[13px] text-muted">{t.meta}</span>
                </span>
                <span className="text-[13px] font-bold whitespace-nowrap text-violet">{t.stat}</span>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4 rounded-[22px] border border-line p-5.5">
            <h2 className="text-base font-bold">Quand ta communauté regarde</h2>
            <div className="grid h-[150px] grid-cols-7 items-end gap-2.5">
              {demoAudience.map((v, i) => (
                <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                  <span
                    className={`w-full rounded-lg ${v > 75 ? "bg-violet" : "bg-lilac"}`}
                    style={{ height: `${v}%` }}
                    role="img"
                    aria-label={`${dayNames[i]} : ${v} %`}
                  />
                  <span className="text-xs font-bold text-muted" aria-hidden="true">
                    {dayLetters[i]}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted">
              Le jeudi et le dimanche soir sortent du lot : Fauve programme en priorité ces créneaux.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
