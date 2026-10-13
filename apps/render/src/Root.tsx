import { Composition, type CalculateMetadataFunction } from "remotion";
import { Reel } from "./Reel";
import { SceneCheck, type SceneCheckProps } from "./SceneCheck";
import type { ReelProps } from "./types";

// The web app sends fully computed props (frames, sizes); metadata comes from them.
const calculateMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: Math.max(1, props.durationInFrames),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

const preview: ReelProps = {
  template: "doux",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 90,
  fadeFrames: 0,
  segments: [],
  texts: [{ text: "À ton rythme", style: "hook", emphasis: ["rythme"], from: 0, durationInFrames: 90 }],
  words: [],
  brand: { name: "Studio", accent: "#5B3FD9", accentInk: "#FFFFFF", displayFont: "Instrument Serif", bodyFont: "Plus Jakarta Sans", logoUrl: null },
  endCard: null,
};

const checkPreview: SceneCheckProps = {
  js: "function Scene() { return null; }",
  texts: {},
  durationInFrames: 60,
  brand: { ...preview.brand, ink: "#1C1530", cream: "#FBF7F4" },
};

export function Root() {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={preview}
        calculateMetadata={calculateMetadata}
      />
      {/* Layout check of a generated scene (smoke.mjs): one still, never a video. */}
      <Composition id="SceneCheck" component={SceneCheck} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={checkPreview} />
    </>
  );
}
