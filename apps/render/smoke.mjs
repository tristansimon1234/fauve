// Smoke test for generated motion scenes, run in the render sandbox (never in the
// web app). Usage: node smoke.mjs scenes.json [bundle-dir] → prints
// {"results": {"<id>": null | "error"}, "bands": {"<id>": [top, bottom]}, "faces": {"<id>": "what to move"}}.
// scenes.json: [{ id, js, durationInFrames, texts?, brand?, photos?, cuts?, shots?, track?, look? }] (photos: the ones
// the scene composes with, with their links; cuts: for an animation over several shots; shots: the
// shots a collage's composition lays, each one a grey card here; track: what moves in the footage under it,
// read by its `track`, with look, the Reel's rhythm and look for the camera moves).
// 1. Each scene is rendered at its first, middle and last frame with React's server
//    renderer and minimal Remotion shims, which catches crashes and bad output early. Its `track` sees
//    nothing there: a scene must stand without anyone in the picture (reused over other footage).
// 2. The scenes that pass are laid out in Chrome (the SceneCheck composition of the
//    bundle, default ./build) at many frames, with the studio's fonts: a text that
//    leaves the frame or the safe zone fails the scene. A scene that passes says where
//    its texts sit while it holds (shares of the height), so the render can move it off
//    the faces of the footage under it, and which of its texts stay on a face it follows
//    (faces: not a failure, a reason for one more round of the motion designer).
// BROWSER_EXECUTABLE overrides Remotion's own Chrome (local runs).
import { existsSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
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
  FitText: ({ style, innerStyle, children }) => React.createElement("div", { style }, React.createElement("div", { style: innerStyle }, children)),
  Cutout: ({ photo, x, y, height, style }) =>
    photo?.cutout && photo.subject ? React.createElement("img", { src: photo.cutout, style: { position: "absolute", left: x, top: y, height, ...style } }) : null,
  // One of her shots in a collage's composition: a grey card stands in.
  Footage: ({ style }) => React.createElement("div", { style: { position: "absolute", background: "#777", ...style } }),
};

const defaultBrand = {
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
const bands = {};
const faces = {};
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
    const brand = { ...defaultBrand, ...scene.brand };
    for (const f of [0, Math.floor(scene.durationInFrames / 2), scene.durationInFrames - 1]) {
      frame = f;
      const html = renderToStaticMarkup(
        React.createElement(Scene, {
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: scene.durationInFrames,
          brand,
          texts: scene.texts ?? {},
          photos: scene.photos ?? [],
          cuts: scene.cuts ?? [],
          shots: scene.shots ?? [],
          track: () => ({ hands: [], faces: [], bodies: [] }),
        }),
      );
      if (html.length < 20) throw new Error(`empty output at frame ${f}`);
      if (/NaN/.test(html)) throw new Error(`NaN in styles at frame ${f}`);
    }
    results[scene.id] = null;
  } catch (error) {
    results[scene.id] = String(error instanceof Error ? error.message : error).slice(0, 600);
  }
}

// Layout check in Chrome, for the scenes that run.
const bundle = new URL(process.argv[3] ?? "./build", new URL(`file://${process.cwd()}/`)).pathname;
const passing = scenes.filter((s) => results[s.id] === null);
const browserExecutable = process.env.BROWSER_EXECUTABLE ?? null;
const browser =
  passing.length && existsSync(bundle)
    ? await openBrowser("chrome", { browserExecutable, logLevel: "error" }).catch((error) => {
        // A broken browser must not reject every scene: the server-side checks stand.
        console.error("layout check unavailable:", error);
        return null;
      })
    : null;
if (browser) {
  try {
    for (const scene of passing) {
      const inputProps = {
        js: scene.js,
        texts: scene.texts ?? {},
        durationInFrames: scene.durationInFrames,
        brand: { ...defaultBrand, ...scene.brand },
        photos: scene.photos ?? [],
        cuts: scene.cuts ?? [],
        shots: scene.shots ?? [],
        ...(scene.track ? { track: scene.track } : {}),
        ...(scene.look ? { look: scene.look } : {}),
      };
      try {
        const composition = await selectComposition({ serveUrl: bundle, id: "SceneCheck", inputProps, puppeteerInstance: browser, browserExecutable, logLevel: "error" });
        await renderStill({
          serveUrl: bundle,
          composition,
          inputProps,
          frame: 0,
          imageFormat: "jpeg",
          scale: 0.1,
          puppeteerInstance: browser,
          browserExecutable,
          logLevel: "error",
          timeoutInMilliseconds: 60000,
          onBrowserLog: (log) => {
            const band = /^FAUVE_BAND (\[.*\])$/.exec(log.text)?.[1];
            if (band) bands[scene.id] = JSON.parse(band);
            const face = /^FAUVE_FACE (".*")$/.exec(log.text)?.[1];
            if (face) faces[scene.id] = JSON.parse(face);
          },
        });
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error);
        // The scene's own failures (cancelRender), without Remotion's wrapping; anything else is the tooling's.
        const failure = /(texte hors du cadre[^\n]*|erreur à l'image[^\n]*|Scene introuvable[^\n]*)/.exec(message)?.[1];
        if (failure) results[scene.id] = failure.slice(0, 600);
        else console.error("layout check failed for", scene.id, message.slice(0, 400));
      }
    }
  } finally {
    await browser.close({ silent: true });
  }
}
console.log(JSON.stringify({ results, bands, faces }));
