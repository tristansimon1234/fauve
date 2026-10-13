import type { CSSProperties } from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import type { Adjust, Box, ClipBlur, PhotoEdit } from "./types";

// Retouch and blur, as decided by Gemini (or by hand) and computed by the web
// app: CSS filters for light and colour, a cover layout for framing and
// straightening, and a backdrop blur over each sensitive zone. Mirrors
// packages/agent/src/retouch.ts (this package ships alone to the sandbox).

export function cssFilter(a: Adjust | undefined): string | undefined {
  if (!a) return undefined;
  const parts: string[] = [];
  if (a.exposure) parts.push(`brightness(${(1 + a.exposure * 0.35).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast * 0.3).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${(1 + a.saturation * 0.45).toFixed(3)})`);
  if (a.warmth && a.warmth > 0) parts.push(`sepia(${(a.warmth * 0.22).toFixed(3)})`, `saturate(${(1 + a.warmth * 0.12).toFixed(3)})`);
  if (a.warmth && a.warmth < 0) parts.push(`hue-rotate(${(a.warmth * 10).toFixed(1)}deg)`, `saturate(${(1 + a.warmth * 0.1).toFixed(3)})`);
  return parts.length ? parts.join(" ") : undefined;
}

export function coverLayout(frame: { width: number; height: number }, source: { width: number; height: number }, adjust?: Adjust) {
  const zoom = adjust?.zoom ?? 1;
  // Straightening rotates the picture about the frame's centre: cover the rotated frame's bounding box, so no corner shows.
  const angle = (Math.abs(adjust?.straighten ?? 0) * Math.PI) / 180;
  const box = {
    width: frame.width * Math.cos(angle) + frame.height * Math.sin(angle),
    height: frame.width * Math.sin(angle) + frame.height * Math.cos(angle),
  };
  const originX = (frame.width - box.width) / 2;
  const originY = (frame.height - box.height) / 2;
  const scale = Math.max(box.width / source.width, box.height / source.height) * zoom;
  const width = source.width * scale;
  const height = source.height * scale;
  const fx = adjust?.focus?.x ?? 0.5;
  const fy = adjust?.focus?.y ?? 0.5;
  // The focus point as close to the centre as the edges allow.
  const left = originX + Math.min(0, Math.max(box.width - width, box.width / 2 - fx * width));
  const top = originY + Math.min(0, Math.max(box.height - height, box.height / 2 - fy * height));
  return { left, top, width, height };
}

export function boxAt(keys: (Box & { t: number })[], t: number, hold = 0.4): Box | null {
  if (!keys.length) return null;
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (t < first.t - hold || t > last.t + hold) return null;
  if (t <= first.t) return first;
  if (t >= last.t) return last;
  const i = keys.findIndex((k) => k.t > t);
  const a = keys[i - 1]!;
  const b = keys[i]!;
  if (b.t - a.t > 1.2 && t - a.t > hold && b.t - t > hold) return null;
  const p = (t - a.t) / Math.max(0.001, b.t - a.t);
  const mix = (u: number, v: number) => u + (v - u) * p;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w), h: mix(a.h, b.h) };
}

/** A blurred zone, placed in shares of the picture it sits on (which may be scaled or rotated). */
function BlurBox({ box, shape, size }: { box: Box; shape: "ellipse" | "rect"; size: { width: number; height: number } }) {
  const px = Math.min(box.w * size.width, box.h * size.height);
  const radius = Math.round(Math.min(64, Math.max(24, px * 0.18)));
  const style: CSSProperties = {
    position: "absolute",
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
    borderRadius: shape === "ellipse" ? "50%" : Math.max(6, px * 0.08),
    // Strong enough that nobody can be recognised, whatever the zone's size.
    // Chrome weakens very large backdrop blurs: 24–64 px wipes a face out at any size we draw.
    backdropFilter: `blur(${radius}px)`,
    WebkitBackdropFilter: `blur(${radius}px)`,
    background: "rgba(128,128,128,0.18)",
  };
  return <div style={style} />;
}

/** A photo with its retouch and blurred zones, covering the frame. */
export function Photo({ src, edit }: { src: string; edit?: PhotoEdit }) {
  const { width, height } = useVideoConfig();
  if (!edit) return <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  const layout = coverLayout({ width, height }, edit.source, edit.adjust);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: edit.adjust?.straighten ? `rotate(${edit.adjust.straighten}deg)` : undefined }}>
        <div style={{ position: "absolute", left: layout.left, top: layout.top, width: layout.width, height: layout.height }}>
          <Img src={src} style={{ width: "100%", height: "100%", display: "block", filter: cssFilter(edit.adjust) }} />
          {(edit.blur ?? []).map((region, i) => (
            <BlurBox key={i} box={region} shape={region.shape} size={layout} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Blurred zones over a clip, at the clip's own time (they follow faces as Gemini tracked them). */
export function ClipBlurLayer({ blur, startFrom }: { blur: ClipBlur; startFrom: number }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = (startFrom + frame) / fps;
  // The clip covers the frame like object-fit: cover, centred.
  const layout = coverLayout({ width, height }, { width: blur.aspect * 1000, height: 1000 });
  return (
    <div style={{ position: "absolute", left: layout.left, top: layout.top, width: layout.width, height: layout.height }}>
      {blur.tracks.map((track, i) => {
        const box = boxAt(track.keys, t);
        return box ? <BlurBox key={i} box={box} shape={track.kind === "face" ? "ellipse" : "rect"} size={layout} /> : null;
      })}
    </div>
  );
}
