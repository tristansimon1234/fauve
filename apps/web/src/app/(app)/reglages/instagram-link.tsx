"use client";

import { useState, useTransition } from "react";
import { getInstagramLinkCode } from "./actions";

/** Shows a one-time code the manager sends to Fauve's Instagram account to link it to her studio. */
export function InstagramLinkCode({ fauveHandle }: { fauveHandle: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2.5">
      {code ? (
        <p className="text-sm leading-normal">
          Envoie ce code en message à{" "}
          <a href={`https://ig.me/m/${fauveHandle}`} target="_blank" rel="noreferrer" className="font-bold text-violet">
            @{fauveHandle}
          </a>{" "}
          sur Instagram (valable 1 heure) :
          <span className="mt-2 block text-[28px] font-extrabold tracking-[0.2em] tabular-nums">{code}</span>
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await getInstagramLinkCode().catch(() => ({ ok: false as const, error: "Réessaie dans un instant." }));
              if (res.ok) setCode(res.code);
              else setError(res.error);
            })
          }
          className="btn btn-secondary self-start disabled:opacity-60"
        >
          {pending ? "Un instant…" : "Obtenir mon code"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
