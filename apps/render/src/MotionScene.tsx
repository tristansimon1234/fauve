import React, { Component, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  interpolateColors,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Fit } from "./Fit";
import { SceneView } from "./Scene";
import type { Theme } from "./theme";
import type { ReelProps, Scene, ScenePhoto } from "./types";

// Free motion-design scene: plain JS written by the motion designer (checked and
// smoke-rendered before reaching here). It only sees this scope; any error at
// render time falls back to the fixed scene, so a video always goes out.

/** A white scissor rim around a cut-out (drop-shadows of paper colour all around), then a warm shadow. */
function scissorRim(rim: number, shadow: boolean): string {
  const d = Math.round(rim * 0.7);
  const paper = "#FBFAF7";
  return [
    ...(rim > 0 ? [[rim, 0], [-rim, 0], [0, rim], [0, -rim], [d, d], [-d, -d], [d, -d], [-d, d]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${paper})`) : []),
    ...(shadow ? [`drop-shadow(0 ${Math.round(rim * 3 + 8)}px ${Math.round(rim * 3.5 + 10)}px rgba(40,26,10,0.32))`] : []),
  ].join(" ");
}

/**
 * A photo's subject, cut out: drawn so that the subject's box has its top-left corner
 * at (x, y) and is `height` px high (its width follows the photo); a white scissor rim
 * (`rim` px) and a warm shadow by default. Nothing when the photo has no clean cut-out.
 */
function Cutout({ photo, x, y, height, rim = 10, shadow = true, style }: { photo?: ScenePhoto; x: number; y: number; height: number; rim?: number; shadow?: boolean; style?: CSSProperties }) {
  if (!photo?.cutout || !photo.subject || !(photo.subject.h > 0) || !(height > 0)) return null;
  const frameHeight = height / photo.subject.h;
  const frameWidth = frameHeight * photo.aspect;
  return (
    <Img
      src={photo.cutout}
      style={{
        position: "absolute",
        left: x - photo.subject.x * frameWidth,
        top: y - photo.subject.y * frameHeight,
        width: frameWidth,
        height: frameHeight,
        filter: scissorRim(rim, shadow) || undefined,
        ...style,
      }}
    />
  );
}

// FitText: a box whose text shrinks until it fits (see Fit.tsx), so a long text never leaves the frame.
// Cutout: a photo's subject cut out, with its scissor rim (collages, her photos in an animation).
export const SCOPE = { AbsoluteFill, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, spring, Easing, random, FitText: Fit, Cutout };

export type SceneComponent = (props: {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  brand: ReelProps["brand"] & { ink: string; cream: string };
  /** Texts for the scene's slots (a reused template gets new ones). */
  texts: Record<string, string>;
  /** Her photos the scene composes with (a collage, her cut-out in an animation), in its order; often empty. */
  photos: ScenePhoto[];
  /** For an animation over several shots: the frames where the shot changes under it, from its start. */
  cuts: number[];
}) => ReactNode;

/** The component a generated code defines (`Scene` for a motion scene, `Layer` for a text layer), or null. */
export function compileComponent<C>(js: string, name: "Scene" | "Layer" | "Element", scope: typeof SCOPE = SCOPE): C | null {
  try {
    const factory = new Function(
      "React",
      "scope",
      `"use strict";\nconst { ${Object.keys(scope).join(", ")} } = scope;\n${js}\nreturn typeof ${name} === "function" ? ${name} : null;`,
    );
    return factory(React, scope) as C | null;
  } catch {
    return null;
  }
}

export const compileScene = (js: string, scope: typeof SCOPE = SCOPE) => compileComponent<SceneComponent>(js, "Scene", scope);

export class Fallback extends Component<{ fallback: ReactNode; children: ReactNode; onError?: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MotionScene(p: {
  js: string;
  texts: Record<string, string>;
  /** The fixed scene played when the code cannot run; none for an animation over several shots (it is then left out). */
  fallback?: Scene;
  durationInFrames: number;
  props: ReelProps;
  theme: Theme;
  k: number;
  /** Played over her footage: the fixed fallback has no background either. */
  overlay?: boolean;
  /** Moved down (share of the height, up when negative) so its texts clear the faces of the footage under it. */
  shift?: number;
  photos?: ScenePhoto[];
  cuts?: number[];
}) {
  const { fps } = useVideoConfig();
  const Generated = useMemo(() => compileScene(p.js), [p.js]);
  const fixed = p.fallback ? <SceneView scene={p.fallback} durationInFrames={p.durationInFrames} props={p.props} theme={p.theme} k={p.k} overlay={p.overlay} /> : null;
  if (!Generated) return fixed;
  return (
    <Fallback fallback={fixed}>
      <AbsoluteFill style={p.shift ? { transform: `translateY(${Math.round(p.shift * p.props.height)}px)` } : undefined}>
        <Generated
          width={p.props.width}
          height={p.props.height}
          fps={fps}
          durationInFrames={p.durationInFrames}
          brand={{ ...p.props.brand, ink: "#1C1530", cream: "#FBF7F4" }}
          texts={p.texts}
          photos={p.photos ?? []}
          cuts={p.cuts ?? []}
        />
      </AbsoluteFill>
    </Fallback>
  );
}
