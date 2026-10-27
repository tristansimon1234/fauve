"use client";

import { useState, useTransition } from "react";
import { refreshReport } from "./actions";

export function RefreshReportButton({ label = "Analyser maintenant" }: { label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await refreshReport().catch(() => ({ ok: false as const, error: "L’analyse n’a pas abouti." }));
            if (!res.ok) setError(res.error);
          })
        }
        className="btn btn-secondary h-10 text-sm disabled:opacity-60"
      >
        {pending ? "Edith analyse tes posts…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
