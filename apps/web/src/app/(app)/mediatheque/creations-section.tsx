"use client";

import { REEL_FPS, type ReelProps } from "@fauve/agent";
import { Thumbnail } from "@remotion/player";
import { Reel } from "@render/Reel";
import type { ReelProps as RenderReelProps } from "@render/types";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DeleteButton } from "@/components/delete-button";
import { archiveCreation } from "./actions";

// What Fauve made for the studio and keeps for later: animated scenes (Reels),
// and a way to its components for photos (their own page). Each one is drawn live by the render composition,
// so the manager sees it rather than reads a technical description.

export type Creation = { id: string; name: string; js: string; uses: number; house: boolean };

const SCENE_FRAMES = 90;

function sceneProps(js: string, name: string, brand: ReelProps["brand"]): ReelProps {
  return {
    template: "doux",
    width: 1080,
    height: 1920,
    fps: REEL_FPS,
    durationInFrames: SCENE_FRAMES,
    fadeFrames: 0,
    segments: [{ type: "motion", js, fallback: { kind: "title", title: name, background: "accent" }, texts: {}, startAt: 0, durationInFrames: SCENE_FRAMES }],
    texts: [],
    words: [],
    brand,
    endCard: null,
  };
}

/** Draws a composition still once the card scrolls into view (dozens at once would be heavy). */
function LivePreview({ props, frame }: { props: ReelProps; frame: number }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setVisible(true), { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="size-full">
      {mounted && visible ? (
        <Thumbnail
          component={Reel}
          inputProps={props as RenderReelProps}
          compositionWidth={props.width}
          compositionHeight={props.height}
          durationInFrames={props.durationInFrames}
          fps={props.fps}
          frameToDisplay={frame}
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
    </div>
  );
}

function Card({ creation, ratio, children }: { creation: Creation; ratio: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-white">
      <div className={`relative ${ratio} overflow-hidden bg-ink`}>
        {children}
        {!creation.house && (
          <div className="absolute right-2 bottom-2 z-10">
            <DeleteButton
              compact
              label="Retirer"
              action={archiveCreation.bind(null, creation.id)}
              confirmText="Retirer de ta bibliothèque ? Les publications déjà faites ne changent pas."
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{creation.name}</span>
        <span className="text-xs font-semibold text-muted">
          {creation.house ? "Proposée par Brigitte" : `Utilisée ${creation.uses} fois`}
        </span>
      </div>
    </li>
  );
}

/** The studio's animated scenes for Reels, each drawn live by the render composition. */
export function CreationsSection({ scenes, brand }: { scenes: Creation[]; brand: ReelProps["brand"] }) {
  return scenes.length ? (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
      {scenes.map((s) => (
        <Card key={s.id} creation={s} ratio="aspect-[9/16]">
          <LivePreview props={sceneProps(s.js, s.name, brand)} frame={Math.round(SCENE_FRAMES * 0.6)} />
        </Card>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted">Pas encore d’animation : la première arrivera avec ton prochain Reel animé.</p>
  );
}
