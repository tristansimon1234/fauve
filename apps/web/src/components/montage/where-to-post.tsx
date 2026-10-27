"use client";

import { TIKTOK_PRIVACY_LABELS, type TikTokSettings } from "@fauve/agent";
import { useState, useTransition } from "react";
import { setPlatforms, setTikTokSettings } from "@/app/(app)/publications/[id]/platform-actions";
import { InstagramIcon, TikTokIcon } from "@/components/icons";

// Where a post goes: Instagram, TikTok or both. On TikTok, before the app is
// audited, the video lands in her TikTok drafts (she adds a sound and posts);
// once audited, it is posted with her choices, as TikTok asks: who can see it
// (nothing preselected), comments, duet and stitch, and the music confirmation.

export type TikTokPanel = {
  connected: boolean;
  handle: string | null;
  /** A video: TikTok takes it. Carousels and photos not yet. */
  canTake: boolean;
  direct: boolean;
  settings: TikTokSettings;
  /** Read from TikTok just now (direct posts only). */
  options: { privacy: string[]; commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean; nickname: string | null } | null;
  /** Where the video already is on TikTok, once sent. */
  state: string | null;
  caption: string;
};

type Platform = "instagram" | "tiktok";

export function WhereToPost({ postId, initial, tiktok }: { postId: string; initial: Platform[]; tiktok: TikTokPanel | null }) {
  const [platforms, setLocal] = useState<Platform[]>(initial.length ? initial : ["instagram"]);
  const [settings, setSettings] = useState<TikTokSettings>(tiktok?.settings ?? { privacy_level: null, allow_comment: true, allow_duet: true, allow_stitch: true });
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  const toggle = (p: Platform) => {
    const on = platforms.includes(p);
    const next = on ? platforms.filter((x) => x !== p) : [...platforms, p];
    if (!next.length) return; // one at least
    const before = platforms;
    setLocal(next);
    setState("saving");
    start(async () => {
      const result = await setPlatforms(postId, next);
      if (!result.ok) setLocal(before);
      setState(result.ok ? "idle" : "error");
    });
  };

  const change = (patch: Partial<TikTokSettings>) => {
    const before = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setState("saving");
    start(async () => {
      const result = await setTikTokSettings(postId, next);
      if (!result.ok) setSettings(before);
      setState(result.ok ? "idle" : "error");
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tiktok?.caption ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const tiktokOn = platforms.includes("tiktok");
  const tiktokUsable = Boolean(tiktok?.connected && tiktok.canTake);

  return (
    <section aria-label="Où publier" className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">Où publier</h2>
        <span className="text-[12px] text-muted" aria-live="polite">
          {state === "saving" ? "Enregistrement…" : state === "error" ? "Pas enregistré, réessaie" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip on={platforms.includes("instagram")} onClick={() => toggle("instagram")} icon={<InstagramIcon size={16} />} label="Instagram" />
        {tiktok && (
          <Chip
            on={tiktokOn}
            disabled={!tiktokUsable && !tiktokOn}
            onClick={() => toggle("tiktok")}
            icon={<TikTokIcon size={16} />}
            label={tiktok.handle ? `TikTok · @${tiktok.handle}` : "TikTok"}
          />
        )}
      </div>
      {tiktok && !tiktok.connected && (
        <p className="text-[12px] leading-snug text-muted">
          <a href="/api/tiktok/connect" className="font-bold text-violet">
            Connecte TikTok
          </a>{" "}
          pour que cette vidéo y parte aussi.
        </p>
      )}
      {tiktok?.connected && !tiktok.canTake && <p className="text-[12px] leading-snug text-muted">TikTok ne prend pour l’instant que les vidéos.</p>}

      {tiktok && tiktokOn && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-3">
          {tiktok.state && <p className="text-[13px] font-semibold">{tiktok.state}</p>}
          {tiktok.direct && tiktok.options ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">Qui peut voir cette vidéo sur TikTok{tiktok.options.nickname ? ` (${tiktok.options.nickname})` : ""}</span>
                <select
                  value={settings.privacy_level ?? ""}
                  onChange={(e) => change({ privacy_level: e.target.value || null })}
                  className="h-10 rounded-[12px] border border-line bg-white px-3 text-[14px]"
                >
                  <option value="">Choisir…</option>
                  {tiktok.options.privacy.map((p) => (
                    <option key={p} value={p}>
                      {TIKTOK_PRIVACY_LABELS[p] ?? p}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(
                  [
                    { key: "allow_comment", label: "Commentaires", off: tiktok.options.commentDisabled },
                    { key: "allow_duet", label: "Duo", off: tiktok.options.duetDisabled },
                    { key: "allow_stitch", label: "Collage", off: tiktok.options.stitchDisabled },
                  ] as const
                ).map((o) => (
                  <label key={o.key} className={`inline-flex items-center gap-2 text-[13px] font-semibold ${o.off ? "opacity-50" : ""}`}>
                    <input type="checkbox" disabled={o.off} checked={!o.off && settings[o.key]} onChange={(e) => change({ [o.key]: e.target.checked })} className="size-4 accent-violet" />
                    {o.label}
                  </label>
                ))}
              </div>
              <p className="text-[12px] leading-snug text-muted">
                {settings.privacy_level
                  ? "Edith la publie aussi sur TikTok. "
                  : "Sans choix ici, la vidéo ira dans tes brouillons TikTok. "}
                En publiant, tu acceptes la{" "}
                <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="font-bold text-violet">
                  confirmation d’utilisation de la musique
                </a>{" "}
                de TikTok.
              </p>
            </>
          ) : (
            <p className="text-[12px] leading-snug text-muted">
              À l’heure prévue, la vidéo arrive dans tes brouillons TikTok (une notification dans l’appli). Ajoute un son tendance, colle la légende et publie : je la retrouve ensuite pour suivre ses vues.
            </p>
          )}
          {!tiktok.direct && tiktok.caption && (
            <button type="button" onClick={copy} className="h-9 self-start rounded-full bg-soft px-4 text-[13px] font-bold">
              {copied ? "Légende copiée" : "Copier la légende TikTok"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Chip({ on, disabled, onClick, icon, label }: { on: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors disabled:opacity-50 ${
        on ? "border-violet bg-violet-soft text-violet" : "border-line text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
