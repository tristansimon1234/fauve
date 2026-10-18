import React, { Component, createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Freeze,
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
import { PaperCutout, type RimSpec } from "./PaperCutout";
import { SceneView } from "./Scene";
import type { Theme } from "./theme";
import { footageTrack, type TrackFn, type TrackPiece } from "./track";
import type { ComposeShot, ReelProps, Scene, ScenePhoto } from "./types";

// Free motion-design scene: plain JS written by the motion designer (checked and
// smoke-rendered before reaching here). It only sees this scope; any error at
// render time falls back to the fixed scene, so a video always goes out.

/** A white scissor rim around a cut-out (shadows of paper colour all around), then a warm shadow. */
export const scissorRim = (rim: number, shadow: boolean): RimSpec => ({
  rim: Math.max(0, rim),
  diag: Math.round(Math.max(0, rim) * 0.7),
  ...(shadow ? { shadow: { y: Math.round(Math.max(0, rim) * 3 + 8), blur: Math.round(Math.max(0, rim) * 3.5 + 10), color: "rgba(40,26,10,0.32)" } } : {}),
});

/**
 * A photo's subject, cut out: drawn so that the subject's box has its top-left corner
 * at (x, y) and is `height` px high (its width follows the photo); a white scissor rim
 * (`rim` px) and a warm shadow by default, drawn once (PaperCutout). Nothing when the
 * photo has no clean cut-out.
 */
function Cutout({ photo, x, y, height, rim = 10, shadow = true, style }: { photo?: ScenePhoto; x: number; y: number; height: number; rim?: number; shadow?: boolean; style?: CSSProperties }) {
  if (!photo?.cutout || !photo.subject || !(photo.subject.h > 0) || !(height > 0)) return null;
  const frameHeight = height / photo.subject.h;
  const frameWidth = frameHeight * photo.aspect;
  return (
    <PaperCutout
      src={photo.cutout}
      width={frameWidth}
      height={frameHeight}
      spec={scissorRim(rim, shadow)}
      style={{ left: x - photo.subject.x * frameWidth, top: y - photo.subject.y * frameHeight, ...style }}
    />
  );
}

/** How a collage's composition draws her shots: the shots it lays, and the Reel's own way to draw one in a box (its retouch and light). */
export type FootageSource = {
  shots: ComposeShot[];
  draw: (shot: ComposeShot, size: { width: number; height: number }) => ReactNode;
};

/** Given by the Reel to a collage's composition only; none in the scene check (a grey card stands in for each shot). */
export const FootageContext = createContext<FootageSource | null>(null);

const px = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/**
 * One of her shots where a composition puts it (`style`: its box, px): as filmed and
 * retouched, framed on its subject in the box; a video plays in time while its shot is on
 * and holds its nearest image before and after it.
 */
function Footage({ shot, style }: { shot: number; style?: CSSProperties }) {
  const source = useContext(FootageContext);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const box: CSSProperties = { position: "absolute", overflow: "hidden", ...style };
  const info = source?.shots[shot];
  if (!source || !info) return <div style={{ background: "linear-gradient(160deg, #9a9490, #5f5a57)", ...box }} />;
  const media = source.draw(info, { width: px(style?.width) ?? width, height: px(style?.height) ?? height });
  const local = frame - info.from;
  return (
    <div style={box}>
      {local >= 0 && local < info.durationInFrames ? (
        <Sequence from={info.from} durationInFrames={info.durationInFrames} layout="none">
          {media}
        </Sequence>
      ) : (
        <Freeze frame={Math.max(0, Math.min(info.durationInFrames - 1, local))}>{media}</Freeze>
      )}
    </div>
  );
}

// FitText: a box whose text shrinks until it fits (see Fit.tsx), so a long text never leaves the frame.
// Cutout: a photo's subject cut out, with its scissor rim (collages, her photos in an animation).
// Footage: one of her shots, where a collage's composition lays it.
export const SCOPE = { AbsoluteFill, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, spring, Easing, random, FitText: Fit, Cutout, Footage };

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
  /** For a collage's composition: the shots it lays (Footage), in the order of the montage. */
  shots: ComposeShot[];
  /** What is seen in the footage at one of its frames (hands, faces, bodies, in px of the frame); in a composition, in the box a shot was laid in. */
  track: TrackFn;
}) => ReactNode;

/** The component a generated code defines (`Scene` for a motion scene, `Layer` for a text layer, `Carousel` for a whole carousel…), or null. */
export function compileComponent<C>(js: string, name: "Scene" | "Layer" | "Element" | "Carousel", scope: Record<string, unknown> = SCOPE): C | null {
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
  /** A collage's composition: the shots it lays and how the Reel draws them. */
  footage?: FootageSource;
  /** What plays when the code cannot run, other than a fixed scene (a collage's prints). */
  fallbackNode?: ReactNode;
  /** What moves in the footage under it, piece by piece (a composition's shots carry their own). */
  track?: TrackPiece[];
}) {
  const { fps } = useVideoConfig();
  const Generated = useMemo(() => compileScene(p.js), [p.js]);
  // Where things are in the footage at a frame of the scene, as this Reel draws it (its moves; the scene's own shift taken back).
  const track = useMemo(
    () => footageTrack(p.track, p.theme, { width: p.props.width, height: p.props.height }, { shiftY: (p.shift ?? 0) * p.props.height, shots: p.footage?.shots }),
    [p.track, p.theme, p.props.width, p.props.height, p.shift, p.footage?.shots],
  );
  const fixed = p.fallback ? <SceneView scene={p.fallback} durationInFrames={p.durationInFrames} props={p.props} theme={p.theme} k={p.k} overlay={p.overlay} /> : (p.fallbackNode ?? null);
  if (!Generated) return fixed;
  const scene = (
    <Generated
      width={p.props.width}
      height={p.props.height}
      fps={fps}
      durationInFrames={p.durationInFrames}
      brand={{ ...p.props.brand, ink: "#1C1530", cream: "#FBF7F4" }}
      texts={p.texts}
      photos={p.photos ?? []}
      cuts={p.cuts ?? []}
      shots={p.footage?.shots ?? []}
      track={track}
    />
  );
  return (
    <Fallback fallback={fixed}>
      <AbsoluteFill style={p.shift ? { transform: `translateY(${Math.round(p.shift * p.props.height)}px)` } : undefined}>
        {p.footage ? <FootageContext.Provider value={p.footage}>{scene}</FootageContext.Provider> : scene}
      </AbsoluteFill>
    </Fallback>
  );
}
