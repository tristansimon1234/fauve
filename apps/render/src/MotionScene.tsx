import React, { Component, createContext, useContext, useId, useMemo, type CSSProperties, type ReactNode } from "react";
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
import { makeKit } from "./Kit";
import { makeType } from "./Type";
import { makeGraphic } from "./Graphic";
import { makeEffects, SubjectBox, SubjectOutline, SubjectParts } from "./Effects";
import { objectName } from "./outline";
import { Marker } from "./Marker";
import { Captions } from "./Captions";
import { PaperCutout, type RimSpec } from "./PaperCutout";
import { SceneView } from "./Scene";
import type { Theme } from "./theme";
import { footageTrack, type TrackFn, type TrackPiece } from "./track";
import type { ComposeEnd, ComposeShot, ComposeText, ReelProps, Scene, ScenePhoto } from "./types";

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
  /** Its subject cut out at every image (matte.py), drawn exactly like the shot; nothing when it has none. */
  subject?: (shot: ComposeShot, size: { width: number; height: number }) => ReactNode;
  /** An object followed through it (by name), cut out the same way; nothing when it was not followed. */
  object?: (shot: ComposeShot, name: string, size: { width: number; height: number }) => ReactNode;
  /** Its depth at every image (depth_video.py: near white, far black), drawn exactly like the shot; nothing when it has none. */
  depth?: (shot: ComposeShot, size: { width: number; height: number }) => ReactNode;
};

/** Given by the Reel to a collage's composition only; none in the scene check (a grey card stands in for each shot). */
export const FootageContext = createContext<FootageSource | null>(null);

const px = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** When a shot plays: at its own moment, or from `at` (a frame of the composition) when it is shown early or again. */
const startOf = (info: ComposeShot, at: number | undefined) => (typeof at === "number" && Number.isFinite(at) ? Math.round(at) : info.from);

/**
 * One of her shots where a composition puts it (`style`: its box, px): as filmed and
 * retouched, framed on its subject in the box; a video plays in time while its shot is on
 * and holds its nearest image before and after it. `at`: it plays from that frame instead
 * of its own moment (a shot seen early or again, in a band or a tile, while another plays).
 */
function Footage({ shot, style, hold, at }: { shot: number; style?: CSSProperties; hold?: number; at?: number }) {
  const source = useContext(FootageContext);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const box: CSSProperties = { position: "absolute", overflow: "hidden", ...style };
  const info = source?.shots[shot];
  if (!source || !info) return <div style={{ background: "linear-gradient(160deg, #9a9490, #5f5a57)", ...box }} />;
  const media = source.draw(info, { width: px(style?.width) ?? width, height: px(style?.height) ?? height });
  const start = startOf(info, at);
  const local = frame - start;
  return (
    <div style={box}>
      {local >= 0 && local < info.durationInFrames && hold && hold > 1 ? (
        // Each image held `hold` frames: the jerky, frame-sampled slow motion of the « Nike » edit, or stop motion.
        <Freeze frame={Math.floor(local / Math.round(hold)) * Math.round(hold)}>{media}</Freeze>
      ) : local >= 0 && local < info.durationInFrames ? (
        <Sequence from={start} durationInFrames={info.durationInFrames} layout="none">
          {media}
        </Sequence>
      ) : (
        <Freeze frame={Math.max(0, Math.min(info.durationInFrames - 1, local))}>{media}</Freeze>
      )}
    </div>
  );
}

/**
 * One of her video shots' depth, read at every image before the render (depth_video.py): near white, far black, as a
 * machine sees the room, drawn exactly where and how Footage draws the shot in the same box (its framing and its camera
 * move), without the shot's light. `invert`: the far white. Laid alone it is the grey depth pass of a computer-vision
 * Reel; over its Footage (mixBlendMode, opacity) a fog or a light that falls with distance. Nothing when the shot has
 * none (a photo, a passage at another speed, the card unavailable): the composition must still work.
 */
function Depth({ shot, style, invert = false, hold, at }: { shot: number; style?: CSSProperties; invert?: boolean; hold?: number; at?: number }) {
  const source = useContext(FootageContext);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const info = source?.shots[shot];
  if (!info) return null;
  const media = source?.depth?.(info, { width: px(style?.width) ?? width, height: px(style?.height) ?? height });
  if (!media) return null;
  const start = startOf(info, at);
  const local = frame - start;
  const step = hold && hold > 1 ? Math.round(hold) : 0;
  const filter = [style?.filter, invert ? "invert(1)" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div style={{ position: "absolute", overflow: "hidden", ...style, filter }}>
      {local >= 0 && local < info.durationInFrames && step ? (
        <Freeze frame={Math.floor(local / step) * step}>{media}</Freeze>
      ) : local >= 0 && local < info.durationInFrames ? (
        <Sequence from={start} durationInFrames={info.durationInFrames} layout="none">
          {media}
        </Sequence>
      ) : (
        <Freeze frame={Math.max(0, Math.min(info.durationInFrames - 1, local))}>{media}</Freeze>
      )}
    </div>
  );
}

/**
 * The subject of one of her shots cut out at every image (a person walking, a hill under a title), drawn exactly
 * where and how Footage draws the shot in the same box: a text laid between the two passes behind her; laid alone
 * on a colour or on paper, she is a moving cut-out. `rim`: a white scissor edge (px), `shadow`: a warm shadow, both
 * drawn by one SVG filter (shadows stacked in CSS cost 40 to 100 s an image). Nothing when the shot has no cut-out:
 * the text then simply stays in front.
 */
function Subject({
  shot,
  style,
  rim = 0,
  rimColor = "#ffffff",
  shadow = false,
  fill,
  tint,
  hold,
  object,
  at,
}: {
  shot: number;
  /** It plays from that frame instead of its shot's own moment, as Footage at={…} does (the same box, the same frame). */
  at?: number;
  /** An object followed through the shot instead of her (a cup she lifts, a product she shows), by the name its code gives it. */
  object?: string;
  style?: CSSProperties;
  rim?: number;
  rimColor?: string;
  shadow?: boolean;
  /** Her silhouette, all of one colour (black on a pale background, « I'm » written over it). */
  fill?: string;
  /** A colour over her only, multiplied (people tinted blue by a machine that « sees » them). */
  tint?: string;
  hold?: number;
}) {
  const source = useContext(FootageContext);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const info = source?.shots[shot];
  const size = { width: px(style?.width) ?? width, height: px(style?.height) ?? height };
  const name = object ? objectName(object) : "";
  if (!info) return null;
  const media = name ? source?.object?.(info, name, size) : source?.subject?.(info, size);
  if (!media) return null;
  const start = startOf(info, at);
  const local = frame - start;
  const r = Math.max(0, rim);
  const filtered = r > 0 || shadow || Boolean(fill) || Boolean(tint);
  const body = fill ? "sil" : tint ? "tinted" : "SourceGraphic";
  const step = hold && hold > 1 ? Math.round(hold) : 0;
  return (
    <div style={{ position: "absolute", overflow: "hidden", ...style }}>
      {filtered ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <filter id={`s${id}`} x="-10%" y="-10%" width="120%" height="120%">
            {fill ? (
              <>
                <feFlood floodColor={fill} />
                <feComposite in2="SourceAlpha" operator="in" result="sil" />
              </>
            ) : tint ? (
              <>
                <feFlood floodColor={tint} />
                <feBlend in2="SourceGraphic" mode="multiply" />
                <feComposite in2="SourceAlpha" operator="in" result="tinted" />
              </>
            ) : null}
            <feMorphology in="SourceAlpha" operator="dilate" radius={r} result="grown" />
            <feFlood floodColor={rimColor} />
            <feComposite in2="grown" operator="in" result="edge" />
            {shadow ? (
              <>
                <feGaussianBlur in="grown" stdDeviation={r * 1.2 + 6} />
                <feOffset dy={r + 8} result="drop" />
                <feFlood floodColor="rgba(40,26,10,0.34)" />
                <feComposite in2="drop" operator="in" result="shade" />
              </>
            ) : null}
            <feMerge>
              {shadow ? <feMergeNode in="shade" /> : null}
              {r > 0 ? <feMergeNode in="edge" /> : null}
              <feMergeNode in={body} />
            </feMerge>
          </filter>
        </svg>
      ) : null}
      <div style={{ position: "absolute", inset: 0, filter: filtered ? `url(#s${id})` : undefined }}>
        {local >= 0 && local < info.durationInFrames && step ? (
          <Freeze frame={Math.floor(local / step) * step}>{media}</Freeze>
        ) : local >= 0 && local < info.durationInFrames ? (
          <Sequence from={start} durationInFrames={info.durationInFrames} layout="none">
            {media}
          </Sequence>
        ) : (
          <Freeze frame={Math.max(0, Math.min(info.durationInFrames - 1, local))}>{media}</Freeze>
        )}
      </div>
    </div>
  );
}

// FitText: a box whose text shrinks until it fits (see Fit.tsx), so a long text never leaves the frame.
// Cutout: a photo's subject cut out, with its scissor rim (collages, her photos in an animation).
// Footage: one of her shots, where a collage's composition lays it.
// Marker: a word circled or underlined by hand, the stroke following the word as it is laid out.
// Tiles, Window, Stack, Split: the layout kit (Kit.tsx), tested once, so an animation lays its pictures in tiles,
// windows, stacks and split screens without coding their geometry.
// Decode, TypeOn, Reveal, Count, Edges, Paper, Emboss, Card, Scribble, WordSearch, Kinetic, WordArt, Burst: the text and
// materials kit (Type.tsx), with the timings of the reference Reels.
const kit = makeKit({ useCurrentFrame, useVideoConfig });
const type = makeType({ useCurrentFrame, useVideoConfig });
// Cursor, Toggle, Button, ProfileCard, WordList, Timeline, Grid, Fan, Turn, Whip, ZoomThrough, Through, Flash, Tint: the
// interface, graphics and transitions kit (Graphic.tsx).
const graphic = makeGraphic({ useCurrentFrame, useVideoConfig });
// Letterbox, ColorPop, MaskReveal, Glitch, Callout, Brackets, Outline: the effects kit (Effects.tsx, lot 7).
const effects = makeEffects({ useCurrentFrame, useVideoConfig });
export const SCOPE = {
  AbsoluteFill,
  Sequence,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
  spring,
  Easing,
  random,
  FitText: Fit,
  Cutout,
  Footage,
  Subject,
  Depth,
  Marker,
  Tiles: kit.Tiles,
  Window: kit.Window,
  Stack: kit.Stack,
  Split: kit.Split,
  Decode: type.Decode,
  TypeOn: type.TypeOn,
  Reveal: type.Reveal,
  Count: type.Count,
  Edges: type.Edges,
  Paper: type.Paper,
  Emboss: type.Emboss,
  Card: type.Card,
  Scribble: type.Scribble,
  WordSearch: type.WordSearch,
  Kinetic: type.Kinetic,
  WordArt: type.WordArt,
  Burst: type.Burst,
  Cursor: graphic.Cursor,
  Toggle: graphic.Toggle,
  Button: graphic.Button,
  ProfileCard: graphic.ProfileCard,
  WordList: graphic.WordList,
  Timeline: graphic.Timeline,
  Grid: graphic.Grid,
  Fan: graphic.Fan,
  Turn: graphic.Turn,
  Whip: graphic.Whip,
  ZoomThrough: graphic.ZoomThrough,
  Through: graphic.Through,
  Flash: graphic.Flash,
  Tint: graphic.Tint,
  Detect: graphic.Detect,
  Sketch: graphic.Sketch,
  Captions,
  Letterbox: effects.Letterbox,
  ColorPop: effects.ColorPop,
  MaskReveal: effects.MaskReveal,
  Glitch: effects.Glitch,
  Callout: effects.Callout,
  Brackets: effects.Brackets,
  Outline: effects.Outline,
  SubjectBox,
  SubjectOutline,
  SubjectParts,
};

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
  /** For a collage's composition that draws the whole picture: the Reel's texts, each at its moment (frames from its start), and its end. */
  reelTexts: ComposeText[];
  end: ComposeEnd | null;
  /** The words said under it, each { w, from, to } in frames from its start (empty when nobody speaks): what its Captions writes. */
  spoken: { w: string; from: number; to: number }[];
}) => ReactNode;

/**
 * The component a generated code defines (`Scene` for a motion scene, `Layer` for a text layer, `Carousel` for a whole carousel…), or null.
 * The code runs in its own block under the scope, so a name it declares itself (its own `Card`) comes before the scope's
 * instead of failing to compile.
 */
export function compileComponent<C>(js: string, name: "Scene" | "Layer" | "Element" | "Carousel", scope: Record<string, unknown> = SCOPE): C | null {
  try {
    const factory = new Function(
      "React",
      "scope",
      `"use strict";\nconst { ${Object.keys(scope).join(", ")} } = scope;\n{\n${js}\nreturn typeof ${name} === "function" ? ${name} : null;\n}`,
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
  /** A composition that draws the whole picture: the Reel's texts and its end. */
  reelTexts?: ComposeText[];
  end?: ComposeEnd | null;
  /** The words said under it, when its code writes them itself (`spoken`). */
  spoken?: { w: string; from: number; to: number }[];
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
      reelTexts={p.reelTexts ?? []}
      end={p.end ?? null}
      spoken={p.spoken ?? []}
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
