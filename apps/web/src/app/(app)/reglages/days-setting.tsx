"use client";

import { WEEK } from "@fauve/agent";
import { useState, useTransition } from "react";
import { setPostingDays } from "./actions";

const TIMES = ["08:00", "12:00", "12:30", "17:00", "18:00", "19:00", "20:00"];

/** Her posting days and hour, saved at once: Simone proposes each week on them. */
export function DaysSetting({ initial, time: initialTime }: { initial: number[]; time: string }) {
  const [days, setDays] = useState(initial);
  const [time, setTime] = useState(initialTime);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (nextDays: number[], nextTime: string) => {
    setDays(nextDays);
    setTime(nextTime);
    setError(null);
    if (!nextDays.length) return setError("Choisis au moins un jour.");
    start(async () => {
      const res = await setPostingDays(nextDays, nextTime).catch(() => ({ ok: false as const, error: "Le réglage n’a pas été enregistré." }));
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jours de publication">
        {WEEK.map((name, d) => {
          const on = days.includes(d);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() => save(on ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b), time)}
              className={`h-9 min-w-11 rounded-full border-[1.5px] px-3 text-[13px] font-bold capitalize ${on ? "border-violet bg-violet text-white" : "border-line bg-white text-muted hover:border-lilac"}`}
            >
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        À
        <select value={time} disabled={pending} onChange={(e) => save(days, e.target.value)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">
          {[...new Set([...TIMES, time])].sort().map((t) => (
            <option key={t} value={t}>
              {t.replace(":", " h ").replace(" h 00", " h")}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-[13px] font-semibold text-peach-ink">{error}</p>}
    </div>
  );
}
