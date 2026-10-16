"use client";

import { SLIDE_FRAME, type ReelProps } from "@fauve/agent";
import { Thumbnail } from "@remotion/player";
import { Reel } from "@render/Reel";
import type { ReelProps as RenderReelProps } from "@render/types";
import { useSyncExternalStore } from "react";

/**
 * A carousel slide as it will be published: the Reel composition's still at
 * SLIDE_FRAME, drawn live in the browser (the same code renders the image).
 */
export function SlidePreview({ props, className, frame = SLIDE_FRAME }: { props: ReelProps; className?: string; frame?: number }) {
  // Browser only, like the montage player.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const style = { width: "100%", aspectRatio: `${props.width} / ${props.height}` };
  if (!mounted) return <div className={`bg-ink ${className ?? ""}`} style={style} />;
  return (
    <Thumbnail
      component={Reel}
      inputProps={props as RenderReelProps}
      compositionWidth={props.width}
      compositionHeight={props.height}
      durationInFrames={props.durationInFrames}
      fps={props.fps}
      frameToDisplay={frame}
      className={className}
      style={style}
    />
  );
}
