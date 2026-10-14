"use client";

import { useState, useTransition } from "react";

// Two switches, for a photo or a clip: « Embellir » (light, colour, horizon,
// framing) and « Flouter les visages ». Fauve looks at the file the first time.

function Switch({ label, on, busy, disabled, onToggle, dark }: { label: string; on: boolean; busy: boolean; disabled?: boolean; onToggle: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy || disabled}
      onClick={onToggle}
      className={`fauve-press inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold disabled:opacity-50 ${
        on ? "bg-violet text-white" : dark ? "bg-white/10 text-white/85" : "bg-soft text-ink"
      }`}
    >
      <span className={`relative h-4 w-7 rounded-full ${on ? "bg-white/40" : dark ? "bg-white/25" : "bg-line"}`}>
        <span
          className={`absolute top-0.5 left-0.5 size-3 rounded-full bg-white transition-transform duration-200 ease-fauve motion-reduce:transition-none ${on ? "translate-x-3" : ""}`}
        />
      </span>
      {busy ? "Simone regarde…" : label}
    </button>
  );
}

export function RetouchSwitches({
  light,
  faces,
  onChange,
  showLight = true,
  dark = false,
}: {
  light: boolean;
  faces: boolean;
  /** Asks the server for the new edit; returns a note or an error to show. */
  onChange: (next: { light: boolean; faces: boolean }) => Promise<{ ok: boolean; message?: string }>;
  showLight?: boolean;
  dark?: boolean;
}) {
  const [busy, setBusy] = useState<"light" | "faces" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const toggle = (which: "light" | "faces") =>
    start(async () => {
      setBusy(which);
      setMessage(null);
      const res = await onChange({ light: which === "light" ? !light : light, faces: which === "faces" ? !faces : faces });
      if (res.message) setMessage({ ok: res.ok, text: res.message });
      setBusy(null);
    });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {showLight && <Switch label="Embellir" on={light} busy={busy === "light"} disabled={busy !== null} onToggle={() => toggle("light")} dark={dark} />}
        <Switch label="Flouter les visages" on={faces} busy={busy === "faces"} disabled={busy !== null} onToggle={() => toggle("faces")} dark={dark} />
      </div>
      {message && <p className={`text-[12px] ${message.ok ? (dark ? "text-white/60" : "text-muted") : "font-semibold text-danger"}`}>{message.text}</p>}
    </div>
  );
}
