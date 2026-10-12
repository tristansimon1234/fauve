"use client";

import Link from "next/link";
import { useState } from "react";
import { ChatIcon, CheckIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { demoStudio, type demoDraft } from "@/lib/demo";

type Draft = typeof demoDraft;
type Platform = "instagram" | "tiktok";

const platformLabels: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };

export function PostEditor({ draft }: { draft: Draft }) {
  const [tab, setTab] = useState<Platform>("instagram");
  const [platforms, setPlatforms] = useState<Record<Platform, boolean>>({ instagram: true, tiktok: true });
  const [validated, setValidated] = useState(false);
  const [caption, setCaption] = useState(draft.caption);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusPill status={validated ? "scheduled" : "draft"} className="px-2.5 text-xs" />
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">{draft.title}</h1>
          <p className="text-[15px] text-muted">{draft.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/mila" className="btn btn-secondary">
            <ChatIcon size={18} />
            Demander une modif
          </Link>
          <button type="button" onClick={() => setValidated((v) => !v)} className="btn btn-primary">
            <CheckIcon size={18} />
            {validated ? "Programmé" : "Valider et programmer"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[0_1_340px] flex-col items-center gap-3.5">
          <div role="group" aria-label="Aperçu" className="flex gap-1.5 rounded-full bg-soft p-1">
            {(Object.keys(platformLabels) as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={tab === p}
                onClick={() => setTab(p)}
                className={`h-10 rounded-full px-4 text-sm font-bold ${tab === p ? "bg-ink text-white" : "text-muted"}`}
              >
                {platformLabels[p]}
              </button>
            ))}
          </div>
          <div
            className="flex aspect-[9/16] w-full max-w-[320px] flex-col justify-between rounded-[22px] px-4.5 py-5.5 text-white shadow-[0_18px_40px_rgba(28,21,48,.18)]"
            style={{ background: "linear-gradient(160deg,#F6C9B8,#C86B5A)" }}
          >
            <span className="text-xs font-bold opacity-90">{tab === "instagram" ? "Reels" : "Pour toi"}</span>
            <span className="font-serif text-[40px] leading-[1.02] italic">
              {draft.hook.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
            <span className="flex flex-col gap-2.5">
              <span className="self-center rounded-lg bg-ink/60 px-2.5 py-1.5 text-[15px] font-bold">{draft.band}</span>
              <span className="flex items-center gap-2 text-[13px] font-bold">
                <span className="flex size-7 items-center justify-center rounded-full bg-peach text-[11px] text-peach-ink">
                  {demoStudio.initials}
                </span>
                {tab === "instagram" ? demoStudio.instagram : `@${demoStudio.tiktok}`}
              </span>
            </span>
          </div>
          <p className="text-center text-[13px] text-muted">Ajoute le son tendance dans l’appli au moment de publier.</p>
        </div>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5.5">
          <div className="flex flex-col gap-2">
            <label htmlFor="legende" className="text-[13px] font-bold">
              Légende
            </label>
            <textarea
              id="legende"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full resize-y rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3.5 text-[15px] leading-normal"
            />
            <span className="flex flex-wrap gap-1.5">
              {draft.hashtags.map((h) => (
                <span key={h} className="rounded-full bg-soft px-2.5 py-1.5 text-[13px] font-semibold">
                  #{h}
                </span>
              ))}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">Publier sur</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(platformLabels) as Platform[]).map((p) => {
                  const on = platforms[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPlatforms((s) => ({ ...s, [p]: !s[p] }))}
                      className={`h-11 rounded-xl border-[1.5px] px-3.5 text-sm font-bold ${
                        on ? "border-violet bg-violet-soft text-violet" : "border-line bg-white text-muted"
                      }`}
                    >
                      {platformLabels[p]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="heure" className="text-[13px] font-bold">
                Quand
              </label>
              <select id="heure" className="h-11 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm">
                {draft.slots.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>

          <section className="flex flex-col gap-3.5 rounded-[18px] border border-line p-4.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">Montage · {draft.duration} s</h2>
              <span className="text-[13px] text-muted">{draft.keptShots}</span>
            </div>
            <div className="flex h-14 gap-1">
              {draft.segments.map((s) => (
                <span
                  key={s.label}
                  className="flex items-end rounded-[10px] px-2 py-1.5 text-[11px] font-bold text-white"
                  style={{ flex: s.weight, background: s.bg }}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {draft.timeline.map(([time, what]) => (
                <li key={time} className="flex gap-2.5">
                  <span className="w-16 shrink-0 font-semibold text-muted">{time}</span>
                  {what}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-start gap-3 rounded-[18px] bg-soft p-4">
            <Orb size={28} className="shrink-0" />
            <p className="text-sm leading-normal">{draft.milaNote}</p>
          </div>
        </div>
      </div>
    </>
  );
}
