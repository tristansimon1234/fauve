// Smoke test for generated motion scenes, run in the render sandbox (never in the
// web app). Usage: node smoke.mjs scenes.json [bundle-dir] → prints
// {"results": {"<id>": null | "error"}, "faces": {"<id>": "what to move"}}.
// scenes.json: [{ id, js, durationInFrames, texts?, brand?, photos?, cuts?, shots?, track?, look?, fonts?, reelTexts?, end? }] (photos: the ones
// the scene composes with, with their links; cuts: for an animation over several shots; shots: the
// shots a collage's composition lays, each one a grey card here; track: what moves in the footage under it,
// read by its `track`, with look, the Reel's rhythm and look for the camera moves; fonts: the Google Fonts
// families its code brings besides the brand's two, laid out with them; reelTexts, end: for a composition that
// draws the whole picture, the Reel's texts it must write at their moment, and its end; backdrop: the colours of the
// picture under it, each shot's and the footage's at some of its frames, for the words lost on it; probeSpoken: its
// code reads what is said, so it is given words said under it, and how many of them it writes is measured).
// 1. Each scene is rendered at its first, middle and last frame with React's server
//    renderer and minimal Remotion shims, which catches crashes and bad output early. Its `track` sees
//    nothing there: a scene must stand without anyone in the picture (reused over other footage).
// 2. The scenes that pass are laid out in Chrome (the SceneCheck composition of the
//    bundle, default ./build) at many frames, with the studio's fonts: a text that
//    leaves the frame or the safe zone fails the scene. A scene that passes says which
//    of its texts stay on a face it follows (faces: not a failure, a reason for one more
//    round of the motion designer), its sentences that do not stay long enough to be
//    read, its texts drawn too small for a phone, its words lost on the picture under them and its words laid behind
//    a person who hides them (in faces too), and, when its code reads what is said, how much of it it writes (spoken).
// BROWSER_EXECUTABLE overrides Remotion's own Chrome (local runs).
import { existsSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { Easing, interpolate, interpolateColors, random, spring } from "remotion";

let frame = 0;
let config = { fps: 30, width: 1080, height: 1920, durationInFrames: 60 };
/** What a kit piece shows: a node, or a function of the size it is drawn at. */
const drawn = (d, size) => (typeof d === "function" ? d(size) : (d ?? null));

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
  // Its content may be a function of the scale, as in Fit.tsx: drawn at its full size here.
  FitText: ({ style, innerStyle, children }) => React.createElement("div", { style }, React.createElement("div", { style: innerStyle }, typeof children === "function" ? children(1) : children)),
  Cutout: ({ photo, x, y, height, style }) =>
    photo?.cutout && photo.subject ? React.createElement("img", { src: photo.cutout, style: { position: "absolute", left: x, top: y, height, ...style } }) : null,
  // One of her shots in a collage's composition: a grey card stands in.
  Footage: ({ style }) => React.createElement("div", { style: { position: "absolute", background: "#777", ...style } }),
  // Her subject cut out: none here (cut out before the render), the scene must stand without it.
  Subject: () => null,
  // A shot's depth (read on the card before the render): nothing here, the composition must work without it.
  Depth: () => null,
  // A word circled by hand: the word itself is what the check reads.
  Marker: ({ children }) => React.createElement("span", null, children),
  // The layout kit (Kit.tsx): what each piece shows is drawn, so its words and its code run here too.
  Tiles: ({ steps = [] }) => React.createElement("div", null, ...steps.map((s, i) => React.createElement("div", { key: i }, drawn(s?.show, { width: config.width, height: config.height })))),
  Window: ({ box, children }) => React.createElement("div", null, drawn(children, { width: box?.w ?? config.width, height: box?.h ?? config.height })),
  Stack: ({ items = [], size }) =>
    React.createElement("div", null, ...items.map((item, i) => React.createElement("div", { key: i }, drawn(item && typeof item === "object" && "draw" in item ? item.draw : item, { width: size ?? 540, height: size ?? 540 })))),
  Split: ({ parts = [], labels = [] }) =>
    React.createElement("div", null, ...parts.map((part, i) => React.createElement("div", { key: i }, drawn(part, { width: config.width / Math.max(1, parts.length), height: config.height }), labels[i] ?? null))),
  // The text and materials kit (Type.tsx): its words are written whole here, what it carries drawn.
  ...Object.fromEntries(
    ["Decode", "TypeOn", "Reveal", "Emboss", "WordArt"].map((name) => [name, ({ text, style }) => React.createElement("span", { style }, String(text ?? ""))]),
  ),
  Count: ({ to, prefix = "", suffix = "", style }) => React.createElement("span", { style }, `${prefix}${Number(to)}${suffix}`),
  Edges: ({ items = [] }) => React.createElement("div", null, ...items.map((item, i) => React.createElement("div", { key: i }, String(item?.text ?? "")))),
  Paper: ({ style, children }) => React.createElement("div", { style }, children),
  Card: ({ text, steps }) => React.createElement("div", null, String(steps?.at?.(-1)?.text ?? text ?? "")),
  Scribble: () => React.createElement("svg", null),
  WordSearch: ({ words = [] }) => React.createElement("div", null, ...words.map((w, i) => React.createElement("div", { key: i }, String(w)))),
  Kinetic: ({ text }) => React.createElement("div", null, Array.isArray(text) ? text.join(" ") : String(text ?? "")),
  Burst: ({ children }) => React.createElement("div", null, children),
  // The interface, graphics and transitions kit (Graphic.tsx): its words are written, what it shows is drawn.
  Cursor: () => React.createElement("div", null),
  Toggle: () => React.createElement("div", null),
  Button: ({ text }) => React.createElement("div", null, String(text ?? "")),
  ProfileCard: ({ name, handle, bio, avatar }) =>
    React.createElement("div", null, drawn(avatar, { width: 150, height: 150 }), String(name ?? ""), String(handle ?? ""), String(bio ?? ""), "Follow", "Message"),
  WordList: ({ items = [] }) => React.createElement("div", null, ...items.map((w, i) => React.createElement("div", { key: i }, String(w)))),
  Timeline: () => React.createElement("div", null),
  Grid: ({ children }) => React.createElement("div", null, children),
  Fan: ({ items = [], middle }) => React.createElement("div", null, ...items.map((d, i) => React.createElement("div", { key: i }, drawn(d, { width: 1500, height: 220 }))), middle ?? null),
  Turn: ({ draw }) => React.createElement("div", null, drawn(draw, { width: config.height, height: config.width })),
  Whip: ({ from, to }) => React.createElement("div", null, drawn(from, config), drawn(to, config)),
  ZoomThrough: ({ from, to }) => React.createElement("div", null, drawn(from, config), drawn(to, config)),
  Through: ({ text, from, to }) => React.createElement("div", null, drawn(from, config), drawn(to, config), String(text ?? "")),
  Flash: () => null,
  Tint: () => React.createElement("div", null),
  // Nobody is seen here: no box; a sketch draws what it wraps.
  Detect: () => null,
  Sketch: ({ children }) => React.createElement("div", null, children),
  // The picture kit (Picture.tsx): what each piece shows is drawn, an echo its element; a burn, a shadow and a dot grid carry nothing to read.
  Burn: () => null,
  LensEdges: ({ children }) => React.createElement("div", null, drawn(children, config)),
  Smear: ({ children }) => React.createElement("div", null, drawn(children, config)),
  Punch: ({ children }) => React.createElement("div", null, drawn(children, config)),
  WindowStar: ({ children, box }) => React.createElement("div", null, drawn(children, { width: box?.w ?? config.width, height: box?.h ?? config.height })),
  LumaFade: ({ children }) => React.createElement("div", null, children),
  Echo: ({ draw }) => React.createElement("div", null, typeof draw === "function" ? draw(frame, 0) : null),
  CastShadow: () => null,
  DotGrid: () => null,
  Ascii: ({ children }) => React.createElement("div", null, children),
  // The effects kit (Effects.tsx): what it wraps is drawn, its labels written.
  Letterbox: () => null,
  ColorPop: ({ children }) => React.createElement("div", null, children),
  MaskReveal: ({ children }) => React.createElement("div", null, children),
  Glitch: ({ children }) => React.createElement("div", null, children),
  Callout: ({ label }) => React.createElement("div", null, String(label ?? "")),
  Brackets: ({ label }) => React.createElement("div", null, String(label ?? "")),
  // Nothing is cut out here: the scene must hold without a subject's box or outline.
  SubjectBox: () => null,
  SubjectOutline: () => null,
  // An object's pieces (read on the card before the render): none here, the scene must stand without them.
  SubjectParts: () => [],
  // Where a text can be set in a shot (its clear areas, read before the render): its fallback here, where the scene puts it without them.
  ClearBox: (shot, frame, laid, options) => options?.fallback ?? null,
  // Its sky, its skyline, its vanishing point, its light, its depth as a mask, her head's moves (read before the render): none here.
  Skyline: () => null,
  SkylineAt: () => null,
  Near: () => null,
  VanishingPoint: (shot, frame, laid, options) => options?.fallback ?? null,
  LightUnder: () => null,
  HeadMoves: () => [],
  Outline: () => null,
  // What is said, written: the words themselves are what the check reads.
  Captions: ({ words = [] }) => React.createElement("div", null, (Array.isArray(words) ? words : []).map((w) => String(w?.w ?? "")).join(" ")),
  // A ready look on one passage (laid by the render): what it wraps is drawn, at its box's size.
  Look: ({ style, children }) => React.createElement("div", { style }, drawn(children, { width: style?.width ?? config.width, height: style?.height ?? config.height })),
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
const faces = {};
// What each scene draws, row by row: where a voice's subtitles leave it room.
const cover = {};
// For a scene whose code reads what is said (probeSpoken): the share of the words said it writes at their moment.
const spoken = {};
for (const scene of scenes) {
  try {
    const factory = new Function(
      "React",
      "scope",
      `"use strict";\nconst { ${Object.keys(scope).join(", ")} } = scope;\n{\n${scene.js}\nreturn typeof Scene === "function" ? Scene : null;\n}`,
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
          reelTexts: scene.reelTexts ?? [],
          end: scene.end ?? null,
          spoken: [],
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
        ...(scene.fonts?.length ? { fonts: scene.fonts } : {}),
        ...(scene.reelTexts?.length ? { reelTexts: scene.reelTexts } : {}),
        ...(scene.end ? { end: scene.end } : {}),
        ...(scene.backdrop ? { backdrop: scene.backdrop } : {}),
        ...(scene.probeSpoken ? { probeSpoken: true } : {}),
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
            // Not failures, reasons for one more round: a text on a face, a sentence too quick to read, a text too small, a word lost on the picture, a text of the Reel not written.
            const note = /^FAUVE_(?:FACE|READ|SIZE|INK|HIDDEN|MISSING) (".*")$/.exec(log.text)?.[1];
            if (note) faces[scene.id] = [faces[scene.id], JSON.parse(note)].filter(Boolean).join("\n");
            const drawn = /^FAUVE_COVER (\[.*\])$/.exec(log.text)?.[1];
            if (drawn) cover[scene.id] = JSON.parse(drawn);
            // Its code reads what is said: the share of the words said it writes at their moment.
            const written = /^FAUVE_SPOKEN ([0-9.]+)$/.exec(log.text)?.[1];
            if (written) spoken[scene.id] = Number(written);
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
console.log(JSON.stringify({ results, faces, cover, spoken }));
