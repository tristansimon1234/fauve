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
import { SceneView } from "./Scene";
import type { Theme } from "./theme";
import type { ReelProps, Scene } from "./types";

// Free motion-design scene: plain JS written by the motion designer (checked and
// smoke-rendered before reaching here). It only sees this scope; any error at
// render time falls back to the fixed scene, so a video always goes out.

const SCOPE = { AbsoluteFill, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, spring, Easing, random };

type SceneComponent = (props: {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  brand: ReelProps["brand"] & { ink: string; cream: string };
}) => ReactNode;

export function compileScene(js: string): SceneComponent | null {
  try {
    const factory = new Function(
      "React",
      "scope",
      `"use strict";\nconst { ${Object.keys(SCOPE).join(", ")} } = scope;\n${js}\nreturn typeof Scene === "function" ? Scene : null;`,
    );
    return factory(React, SCOPE) as SceneComponent | null;
  } catch {
    return null;
  }
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MotionScene(p: {
  js: string;
  fallback: Scene;
  durationInFrames: number;
  props: ReelProps;
  theme: Theme;
  k: number;
}) {
  const { fps } = useVideoConfig();
  const Generated = useMemo(() => compileScene(p.js), [p.js]);
  const fixed = <SceneView scene={p.fallback} durationInFrames={p.durationInFrames} props={p.props} theme={p.theme} k={p.k} />;
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
        />
      </AbsoluteFill>
    </Fallback>
  );
}
