"use client";

import type { PostCover } from "@fauve/agent";
import { useEffect, useRef, useState, useTransition } from "react";
import { setCover, setShareToFeed } from "@/app/(app)/publications/[id]/cover-actions";

// A Reel's cover, as it shows in the grid and on Instagram: slide through the
// video to pick a frame, or take one of the montage's photos; and whether the
// Reel also shows in the profile grid or only in the Reels tab. Saved at once.

export function CoverPicker({
  postId,
  videoUrl,
  initial,
  defaultAt,
  photos,
  initialShareToFeed = true,
}: {
  /** In the profile grid too (default), or only in the Reels tab. */
  initialShareToFeed?: boolean;
  postId: string;
  videoUrl: string;
  initial: PostCover | null;
  defaultAt: number;
  /** Photos that can stand as the cover (the montage's own first). */
  photos: { id: string; url: string }[];
}) {
  const [cover, setLocal] = useState<PostCover | null>(initial);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [inGrid, setInGrid] = useState(initialShareToFeed);
  const [, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const at = cover && "at" in cover ? cover.at : defaultAt;
  const photo = cover && "media_id" in cover ? photos.find((p) => p.id === cover.media_id) : undefined;

  // Its length, also when the video read it before the page came alive (its event then went
  // unheard and the slider stayed greyed out at the end).
  useEffect(() => {
    const el = video.current;
    if (el && el.readyState >= 1 && Number.isFinite(el.duration)) setDuration(el.duration);
  }, [videoUrl, photo]);

  // The preview follows the chosen frame.
  useEffect(() => {
    const el = video.current;
    if (el && !photo && Math.abs(el.currentTime - at) > 0.04) el.currentTime = at;
  }, [at, photo]);

  const save = (next: PostCover | null) => {
    setSaved("saving");
    start(async () => {
      const result = await setCover(postId, next);
      setSaved(result.ok ? "saved" : "error");
    });
  };

  const toggleGrid = () => {
    const next = !inGrid;
    setInGrid(next);
    setSaved("saving");
    start(async () => {
      const result = await setShareToFeed(postId, next);
      if (!result.ok) setInGrid(!next);
      setSaved(result.ok ? "saved" : "error");
    });
  };

  return (
    <section aria-label="Vignette" className="flex flex-col gap-3 rounded-[18px] border-2 border-violet-soft bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">Vignette</h2>
        <span className="text-[12px] text-muted" aria-live="polite">
          {saved === "saving" ? "Enregistrement…" : saved === "saved" ? "Enregistrée" : saved === "error" ? "Pas enregistrée, réessaie" : "L’image de couverture du Reel"}
        </span>
      </div>
      <div className="flex gap-3">
        {/* As in the grid: a 3:4 crop of the Reel. */}
        <span className="relative block aspect-[3/4] w-[112px] shrink-0 overflow-hidden rounded-[12px] bg-ink shadow-[0_6px_18px_rgba(28,21,48,.18)]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
            <img src={photo.url} alt="Vignette choisie" className="size-full object-cover" />
          ) : (
            <video
              ref={video}
              src={`${videoUrl}#t=${at}`}
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              className="size-full object-cover"
              aria-label="Image de la vidéo choisie comme vignette"
            />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Une image de la vidéo
            <input
              type="range"
              min={0}
              max={duration ? Math.max(0.1, duration - 0.05) : 1}
              step={0.05}
              // Until its length is known, at the start (not stuck at the end).
              value={duration ? Math.min(at, Math.max(0.1, duration - 0.05)) : 0}
              disabled={!duration}
              onChange={(e) => setLocal({ at: Number(e.target.value) })}
              onPointerUp={() => cover && "at" in cover && save(cover)}
              onKeyUp={() => cover && "at" in cover && save(cover)}
              className="w-full accent-violet"
            />
          </label>
          {photos.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-muted">Ou une photo</span>
              <div className="flex flex-wrap gap-1.5">
                {photos.slice(0, 8).map((p) => {
                  const on = photo?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = { media_id: p.id };
                        setLocal(next);
                        save(next);
                      }}
                      className={`size-10 overflow-hidden rounded-[8px] ${on ? "ring-2 ring-violet ring-offset-1" : "hover:ring-1 hover:ring-lilac"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
                      <img src={p.url} alt="" className="size-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {cover && (
            <button
              type="button"
              onClick={() => {
                setLocal(null);
                save(null);
              }}
              className="self-start text-[12px] font-semibold text-violet"
            >
              Laisser Edith choisir
            </button>
          )}
        </div>
      </div>
      {/* Instagram puts a Reel in the profile grid and the Reels tab; she can keep it to the Reels tab. */}
      <div role="radiogroup" aria-label="Où apparaît le Reel sur ton profil" className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-muted">Où il apparaît sur ton profil</span>
        <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-soft p-1">
          {[
            { on: true, label: "Grille + onglet Reels" },
            { on: false, label: "Onglet Reels seulement" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={inGrid === o.on}
              onClick={() => inGrid !== o.on && toggleGrid()}
              className={`rounded-[9px] px-2 py-2 text-[12px] font-bold leading-tight transition-colors ${inGrid === o.on ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
