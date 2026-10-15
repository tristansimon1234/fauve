import React, { Component, useMemo, type ReactNode } from "react";
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
import type { ReelProps, Scene } from "./types";

// Free motion-design scene: plain JS written by the motion designer (checked and
// smoke-rendered before reaching here). It only sees this scope; any error at
// render time falls back to the fixed scene, so a video always goes out.

// FitText: a box whose text shrinks until it fits (see Fit.tsx), so a long text never leaves the frame.
export const SCOPE = { AbsoluteFill, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, spring, Easing, random, FitText: Fit };

export type SceneComponent = (props: {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  brand: ReelProps["brand"] & { ink: string; cream: string };
  /** Texts for the scene's slots (a reused template gets new ones). */
  texts: Record<string, string>;
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
  fallback: Scene;
  durationInFrames: number;
  props: ReelProps;
  theme: Theme;
  k: number;
  /** Played over her footage: the fixed fallback has no background either. */
  overlay?: boolean;
}) {
  const { fps } = useVideoConfig();
  const Generated = useMemo(() => compileScene(p.js), [p.js]);
  const fixed = <SceneView scene={p.fallback} durationInFrames={p.durationInFrames} props={p.props} theme={p.theme} k={p.k} overlay={p.overlay} />;
  if (!Generated) return fixed;
  return (
    <Fallback fallback={fixed}>
      <AbsoluteFill>
        <Generated
          width={p.props.width}
          height={p.props.height}
          fps={fps}
          durationInFrames={p.durationInFrames}
          brand={{ ...p.props.brand, ink: "#1C1530", cream: "#FBF7F4" }}
          texts={p.texts}
        />
      </AbsoluteFill>
    </Fallback>
  );
}
