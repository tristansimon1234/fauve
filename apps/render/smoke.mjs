// Smoke test for generated motion scenes, run in the render sandbox (never in the
// web app). Usage: node smoke.mjs scenes.json → prints {"<id>": null | "error"}.
// Each scene is rendered at its first, middle and last frame with React's server
// renderer and minimal Remotion shims, which catches crashes and bad output early.
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Easing, interpolate, interpolateColors, random, spring } from "remotion";

let frame = 0;
let config = { fps: 30, width: 1080, height: 1920, durationInFrames: 60 };
const scope = {
  AbsoluteFill: ({ style, children }) => React.createElement("div", { style }, children),
  Sequence: ({ children }) => React.createElement(React.Fragment, null, children),
  Img: (props) => React.createElement("img", props),
  useCurrentFrame: () => frame,
  useVideoConfig: () => config,
  interpolate,
  interpolateColors,
  spring,
  Easing,
  random,
};

const brand = {
  name: "Studio",
  accent: "#F2694E",
  accentInk: "#FFFFFF",
  ink: "#1C1530",
  cream: "#FBF7F4",
  displayFont: "Instrument Serif",
  bodyFont: "Plus Jakarta Sans",
  logoUrl: null,
};

const scenes = JSON.parse(readFileSync(process.argv[2], "utf8"));
const results = {};
for (const scene of scenes) {
  try {
    const factory = new Function(
      "React",
      "scope",
      `"use strict";\nconst { ${Object.keys(scope).join(", ")} } = scope;\n${scene.js}\nreturn typeof Scene === "function" ? Scene : null;`,
    );
    const Scene = factory(React, scope);
    if (!Scene) throw new Error("Scene is not defined");
    config = { ...config, durationInFrames: scene.durationInFrames };
    for (const f of [0, Math.floor(scene.durationInFrames / 2), scene.durationInFrames - 1]) {
      frame = f;
      const html = renderToStaticMarkup(
        React.createElement(Scene, { width: 1080, height: 1920, fps: 30, durationInFrames: scene.durationInFrames, brand }),
      );
      if (html.length < 20) throw new Error(`empty output at frame ${f}`);
      if (/NaN/.test(html)) throw new Error(`NaN in styles at frame ${f}`);
    }
    results[scene.id] = null;
  } catch (error) {
    results[scene.id] = String(error instanceof Error ? error.message : error).slice(0, 600);
  }
}
console.log(JSON.stringify(results));
