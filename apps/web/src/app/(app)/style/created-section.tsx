"use client";

import { REEL_FPS, resolveBrandLook, type ReelProps, type SavedLook } from "@fauve/agent";
import { Thumbnail } from "@remotion/player";
import { Reel } from "@render/Reel";
import type { ReelProps as RenderReelProps } from "@render/types";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DeleteButton } from "@/components/delete-button";
import { StyleTile, useFonts } from "@/components/montage/style-picker";
import type { Creation } from "@/lib/creations";
import { archiveAnimation, removeTextStyle } from "./created-actions";
import { Section } from "./ui";

// What Edith made for the studio and reuses, at the end of « Ton style »: the animations
// of its Reels, each drawn live by the render composition (she sees them rather than reads
// a technical description), and the text styles taken from her examples. Shown only when
// there is something: an empty list says nothing.

const SCENE_FRAMES = 90;

function sceneProps(js: string, name: string, brand: ReelProps["brand"], fonts: string[]): ReelProps {
  return {
    template: "doux",
    width: 1080,
    height: 1920,
    fps: REEL_FPS,
    durationInFrames: SCENE_FRAMES,
    fadeFrames: 0,
    segments: [
      { type: "motion", js, fallback: { kind: "title", title: name, background: "accent" }, texts: {}, startAt: 0, durationInFrames: SCENE_FRAMES, ...(fonts.length ? { fonts } : {}) },
    ],
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

export function CreatedSections({ scenes, looks, brand }: { scenes: Creation[]; looks: SavedLook[]; brand: ReelProps["brand"] }) {
  useFonts(looks.map((s) => resolveBrandLook(s.look, brand).font));
  return (
    <>
      {scenes.length > 0 && (
        <Section id="tes-animations" title="Tes animations" hint="Faites pour tes Reels. Edith les réutilise avec d’autres mots, sans crédit : retire celles que tu ne veux plus revoir.">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {scenes.map((s) => (
              <li key={s.id} className="flex flex-col overflow-hidden rounded-[16px] border border-line bg-white">
                <div className="relative aspect-[9/16] overflow-hidden bg-ink">
                  <LivePreview props={sceneProps(s.js, s.name, brand, s.fonts)} frame={Math.round(SCENE_FRAMES * 0.6)} />
                  <div className="absolute right-2 bottom-2 z-10">
                    <DeleteButton compact label="Retirer" action={archiveAnimation.bind(null, s.id)} confirmText="Retirer cette animation ? Les publications déjà faites ne changent pas." />
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 p-3">
                  <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{s.name}</span>
                  <span className="text-xs font-semibold text-muted">{s.uses > 1 ? `Utilisée ${s.uses} fois` : "Utilisée une fois"}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {looks.length > 0 && (
        <Section id="tes-styles-texte" title="Tes styles de texte" hint="Repris des exemples que tu as envoyés à Edith. Elle s’en sert pour écrire sur tes Reels, et tu les retrouves quand tu changes un texte.">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {looks.map((s) => (
              <li key={s.name} className="group flex flex-col gap-1.5 rounded-[16px] border border-line bg-white p-2">
                <StyleTile look={resolveBrandLook(s.look, brand)} brand={brand} words="Ton texte ici" on={false} />
                <span className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{s.name}</span>
                  <DeleteButton compact label="Retirer" action={removeTextStyle.bind(null, s.name)} confirmText="Retirer ce style ? Les textes qui l’utilisent gardent leur apparence." />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
