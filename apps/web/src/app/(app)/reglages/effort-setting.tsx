"use client";

import { DEFAULT_EFFORT, EFFORTS, MONTAGE_CEILING, MONTAGE_FLOOR, type Effort } from "@fauve/agent";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { setMontageEffort } from "./actions";

const LEVELS: Effort[] = ["rapide", "soigne", "max"];

/** What a montage at a level may cost, as the manager reads it: from its bounds, so it cannot drift (charged on what it really takes). */
function extraCost(e: Effort): string {
  return `${MONTAGE_FLOOR.montage} à ${MONTAGE_CEILING[e]} crédits`;
}

/**
 * The default level of care of montages: three choices, saved at once.
 * Native radios (one Tab stop, the arrows move the choice); the latest choice
 * wins, and a failure goes back to the last level the server confirmed.
 */
export function EffortSetting({ initial }: { initial: Effort }) {
  const [effort, setEffort] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [pending, start] = useTransition();
  const latest = useRef(0);
  const confirmed = useRef(initial);
  const id = useId();

  // « Enregistré » shows a moment, then goes: a timer, since under reduced motion no animation ends.
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(0), 2200);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const choose = (next: Effort) => {
    if (next === effort) return;
    setEffort(next);
    setError(null);
    setSavedAt(0);
    const n = ++latest.current;
    start(async () => {
      const res = await setMontageEffort(next).catch(() => ({ ok: false as const, error: "Le réglage n’a pas été enregistré. Réessaie dans un instant." }));
      if (n !== latest.current) return; // A newer choice is on its way.
      if (res.ok) {
        confirmed.current = next;
        setSavedAt(Date.now());
      } else {
        setEffort(confirmed.current);
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* A row each on a phone (quick to scan), three columns from sm. */}
      <div role="radiogroup" aria-label="Niveau de soin par défaut" aria-busy={pending || undefined} className="grid gap-2 sm:grid-cols-3">
        {LEVELS.map((e) => {
          const on = effort === e;
          const level = EFFORTS[e];
          return (
            <label
              key={e}
              className={`flex cursor-pointer items-start gap-3 rounded-[16px] border p-3.5 transition-[border-color,background-color,scale] duration-150 ease-fauve active:scale-[0.985] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet motion-reduce:transition-none motion-reduce:active:scale-100 sm:flex-col sm:gap-2 ${
                on ? "border-violet bg-violet-soft" : "border-line bg-white hover:border-violet/40"
              }`}
            >
              <input
                type="radio"
                name={`${id}-effort`}
                value={e}
                checked={on}
                onChange={() => choose(e)}
                aria-labelledby={`${id}-${e}`}
                aria-describedby={`${id}-${e}-d`}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150 ease-fauve motion-reduce:transition-none sm:mt-0 ${
                  on ? "border-violet bg-violet text-white" : "border-line bg-white text-transparent"
                }`}
              >
                <CheckIcon
                  size={11}
                  strokeWidth={3}
                  className={`transition-transform duration-150 ease-fauve motion-reduce:transition-none ${on ? "scale-100" : "scale-50"}`}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 self-stretch">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span id={`${id}-${e}`} className={`text-[15px] font-bold ${on ? "text-violet" : ""}`}>
                    {level.label}
                  </span>
                  {e === DEFAULT_EFFORT && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-violet ring-1 ring-violet/20">Conseillé</span>
                  )}
                </span>
                {/* The time and cost line sits at the bottom, level across the three cards. */}
                <span id={`${id}-${e}-d`} className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[13px] leading-snug text-muted">{level.pitch}</span>
                  <span className="mt-auto pt-1 text-[12px] font-semibold text-muted tabular-nums">
                    {level.minutes} min · {extraCost(e)}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {/* One line, always there (nothing shifts): saving, saved, or what went wrong. */}
      <div className="flex min-h-5 items-center text-[13px] font-semibold">
        <p role="status" className="flex items-center">
          {pending && !error ? (
            <span className="text-muted">Enregistrement…</span>
          ) : savedAt ? (
            <span key={savedAt} className="fauve-flash inline-flex items-center gap-1.5 text-success">
              <CheckIcon size={14} strokeWidth={2.4} />
              Enregistré
            </span>
          ) : null}
        </p>
        {error && (
          <p role="alert" className="fauve-enter text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
