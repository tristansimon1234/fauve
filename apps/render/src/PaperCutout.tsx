import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Img, continueRender, delayRender } from "remotion";

// A cut-out subject with its white scissor rim and its warm shadow. The rim was eight
// stacked CSS drop-shadows recomputed on every frame: in the render's software
// compositing that cost 40 to 100 s a frame on a large photo, and a collage timed out.
// The same rim and shadow are now drawn once, into a canvas under the subject; the
// subject stays an image on top, its colour filters in CSS like any photo's, so they
// never tint the rim. Plain canvas drawing (no canvas filter): the same in every browser.

export const PAPER = "#FBFAF7";

/** A rim of `rim` px with `diag` px more on the diagonals (stacked shadows of paper), then an optional warm shadow under it all. */
export type RimSpec = { rim: number; diag: number; shadow?: { y: number; blur: number; color: string } };

/** The offsets of the stacked paper shadows, each adding a copy of the shape so far. */
function ringOffsets({ rim: w, diag: d }: RimSpec): [number, number][] {
  return w > 0 ? [[w, 0], [-w, 0], [0, w], [0, -w], [d, d], [-d, -d], [d, -d], [-d, d]] : [];
}

/** How far the rim and the shadow reach past the subject (the canvas margin). */
export function rimReach(spec: RimSpec): number {
  // The stacked shadows add up: one ring's offset plus two diagonals'.
  const ring = spec.rim > 0 ? spec.rim + 2 * spec.diag : 0;
  // A blur fades out within three sigmas (sigma = blur / 2).
  return Math.ceil(ring + (spec.shadow ? spec.shadow.y + 1.5 * spec.shadow.blur : 0) + 2);
}

/** Draws the rim and the shadow of `image` (drawn at `width` × `height`, `pad` px in) into `target`. */
function drawRim(target: HTMLCanvasElement, image: HTMLImageElement, width: number, height: number, pad: number, spec: RimSpec) {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  // The subject's shape in paper white.
  const shape = document.createElement("canvas");
  shape.width = target.width;
  shape.height = target.height;
  const s = shape.getContext("2d")!;
  s.drawImage(image, pad, pad, width, height);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = PAPER;
  s.fillRect(0, 0, shape.width, shape.height);
  s.globalCompositeOperation = "source-over";
  // The ring: each offset adds a copy of the shape so far, as each stacked shadow did.
  const copy = document.createElement("canvas");
  copy.width = shape.width;
  copy.height = shape.height;
  const c = copy.getContext("2d")!;
  for (const [x, y] of ringOffsets(spec)) {
    c.clearRect(0, 0, copy.width, copy.height);
    c.drawImage(shape, 0, 0);
    s.drawImage(copy, x, y);
  }
  // Then the warm shadow under all of it (a canvas blur is two sigmas, like a CSS one).
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.save();
  if (spec.shadow) {
    ctx.shadowColor = spec.shadow.color;
    ctx.shadowBlur = spec.shadow.blur;
    ctx.shadowOffsetY = spec.shadow.y;
  }
  ctx.drawImage(shape, 0, 0);
  ctx.restore();
}

/**
 * The cut-out drawn in a box of `width` × `height` px (the photo's frame, the subject where
 * the photo shows it), placed by `style`. The rim is drawn at the size the cut-out first
 * shows; a later size or a transform scales it like the image.
 */
export function PaperCutout({ src, width, height, spec, filter, style }: { src: string; width: number; height: number; spec: RimSpec; filter?: string; style?: CSSProperties }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [base] = useState(() => ({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }));
  const rimmed = spec.rim > 0 || Boolean(spec.shadow);
  const pad = rimmed ? rimReach(spec) : 0;
  // The render waits for the rim; a new photo (the editor's preview) waits again.
  const [first] = useState(() => (rimmed ? delayRender("cut-out rim", { timeoutInMilliseconds: 20000 }) : null));
  const waited = useRef(false);

  useLayoutEffect(() => {
    if (!rimmed) return;
    const handle = waited.current ? delayRender("cut-out rim", { timeoutInMilliseconds: 20000 }) : first!;
    waited.current = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };
    const image = new Image();
    image.onload = () => {
      try {
        if (canvas.current) drawRim(canvas.current, image, base.width, base.height, pad, spec);
      } finally {
        finish();
      }
    };
    // Without its rim rather than a stuck render.
    image.onerror = finish;
    image.src = src;
    return finish;
  }, [src]);

  const share = (px: number, of: number) => `${(px / of) * 100}%`;
  return (
    <div style={{ position: "absolute", width, height, ...style }}>
      {rimmed ? (
        <canvas
          ref={canvas}
          width={base.width + 2 * pad}
          height={base.height + 2 * pad}
          style={{
            position: "absolute",
            left: share(-pad, base.width),
            top: share(-pad, base.height),
            width: share(base.width + 2 * pad, base.width),
            height: share(base.height + 2 * pad, base.height),
          }}
        />
      ) : null}
      <Img src={src} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "block", filter }} />
    </div>
  );
}
