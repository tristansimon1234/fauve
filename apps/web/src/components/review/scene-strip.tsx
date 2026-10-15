"use client";

import { segmentKind, type EditPlan } from "@fauve/agent";
import { FilmIcon, ImageIcon, TypeIcon, ZapIcon } from "@/components/icons";

// The scenes of a Reel in a row, like Instagram's editor: one small image per scene
// (a strip made with the video, `renders.scenes_path`), numbered. Under the video of
// « Ta publication » (a tap opens the editor on that scene) and in the editor itself,
// where tiles follow their scene when it moves.

export type SceneSprite = { url: string; count: number };

export function SceneStrip({
  segments,
  sprite,
  origin,
  photos,
  selected,
  playing,
  dark,
  onPick,
}: {
  segments: EditPlan["segments"];
  sprite: SceneSprite | null;
  /** For each scene, its place when the strip was made (null: no image of it). */
  origin?: (number | null)[];
  /** The photos of the Reel, so a scene without an image says what it is. */
  photos?: string[];
  selected?: number | null;
  /** The scene the video is showing now. */
  playing?: number | null;
  /** On the editor's dark stage. */
  dark?: boolean;
  onPick: (index: number) => void;
}) {
  return (
    <ol aria-label="Les scènes" className="flex max-w-full gap-1.5 overflow-x-auto px-0.5 py-1">
      {segments.map((segment, i) => {
        const at = origin ? origin[i] : i;
        const image = sprite && at !== null && at !== undefined && at < sprite.count ? sprite : null;
        const kind = segmentKind(segment);
        const photo = kind === "clip" && "clip_id" in segment && photos?.includes(segment.clip_id);
        const on = selected === i;
        return (
          <li key={i} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Scène ${i + 1}`}
              aria-current={on ? "true" : undefined}
              className={`relative flex h-[71px] w-10 items-center justify-center overflow-hidden rounded-[9px] transition-shadow lg:h-[82px] lg:w-[46px] ${
                on
                  ? dark
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#1d1630]"
                    : "ring-2 ring-violet ring-offset-2 ring-offset-white"
                  : playing === i
                    ? dark
                      ? "ring-2 ring-white/60"
                      : "ring-2 ring-lilac"
                    : dark
                      ? "opacity-75 hover:opacity-100"
                      : "hover:ring-2 hover:ring-lilac"
              } ${image ? "bg-ink" : dark ? "bg-white/12 text-white/80" : kind === "motion" ? "bg-violet-tint text-violet" : kind === "scene" ? "bg-chip text-muted" : "bg-peach text-peach-ink"}`}
              style={
                image
                  ? {
                      backgroundImage: `url(${image.url})`,
                      backgroundSize: `${image.count * 100}% 100%`,
                      backgroundPosition: `${image.count > 1 ? (at! / (image.count - 1)) * 100 : 0}% 0%`,
                    }
                  : undefined
              }
            >
              {!image && (kind === "motion" ? <ZapIcon size={16} /> : kind === "scene" ? <TypeIcon size={16} /> : photo ? <ImageIcon size={16} /> : <FilmIcon size={16} />)}
              <span className="absolute bottom-1 left-1 flex size-[17px] items-center justify-center rounded-full bg-ink/70 text-[10px] font-extrabold text-white tabular-nums">
                {i + 1}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
