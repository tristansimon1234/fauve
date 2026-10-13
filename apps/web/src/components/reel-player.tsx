"use client";

import { Player, type PlayerRef } from "@remotion/player";
import type { ReelProps } from "@fauve/agent";
import { Reel } from "@render/Reel";
import type { ReelProps as RenderReelProps } from "@render/types";
import { useSyncExternalStore, type Ref } from "react";

/**
 * The montage played live in the browser: the same Remotion composition as the
 * render worker, so what the manager sees while editing is what will be rendered.
 */
export function ReelPlayer({
  props,
  playerRef,
  className,
  initialFrame,
}: {
  props: ReelProps;
  playerRef?: Ref<PlayerRef>;
  className?: string;
  initialFrame?: number;
}) {
  // Browser only: the player reads the clock while rendering, which a prerender must not do.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) {
    return <div className={`rounded-[18px] bg-ink ${className ?? ""}`} style={{ width: "100%", aspectRatio: `${props.width} / ${props.height}` }} />;
  }
  return (
    <Player
      ref={playerRef}
      component={Reel}
      // Same shape on both sides (apps/render mirrors packages/agent's type).
      inputProps={props as RenderReelProps}
      durationInFrames={Math.max(1, props.durationInFrames)}
      fps={props.fps}
      compositionWidth={props.width}
      compositionHeight={props.height}
      initialFrame={initialFrame}
      controls
      loop
      acknowledgeRemotionLicense
      className={className}
      style={{ width: "100%", aspectRatio: `${props.width} / ${props.height}` }}
    />
  );
}
