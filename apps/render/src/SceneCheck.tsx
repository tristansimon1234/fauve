import { Component, createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { fitsPending } from "./Fit";
import { fontsLoaded, loadFonts } from "./fonts";
import { compileScene, SCOPE, type SceneComponent } from "./MotionScene";
import { themeFor } from "./theme";
import { footageTrack, type Seen, type TrackPiece } from "./track";
import type { MotionTemplate, ReelProps } from "./types";

// Layout check of a generated motion scene, run by smoke.mjs before the scene
// reaches a video: the scene is laid out at many frames at once in a real browser,
// with the studio's fonts, and every visible text must stay in the safe zone
// (the side margins, out of the bottom quarter). A text may fly in from outside,
// but not stay out longer than OUT_FRAMES. A failure cancels the render with the
// reason, which goes back to the motion designer; the fixed scene is used if it persists.
// A text that stays on the eyes, nose or mouth of a face tracked under the scene (one
// hung on a hand next to the face) is not a failure: it is reported (FAUVE_FACE), and
// the motion designer gets one more round to move it.

export const SAFE_ZONE = { side: 140, top: 80, bottom: 0.75 };
const TOLERANCE = 12; // px: glyph boxes are a little wider than the ink
const OUT_FRAMES = 12; // 0.4 s at 30 fps
const FACE_FRAMES = 12; // a text may cross a face, not stay on it
const FACE_MARGIN = 10; // px around the eyes, nose and mouth
const STEP = 2; // frames between two samples
/** At most this many copies laid out at once: a collage's composition runs the whole Reel. */
const MAX_COPIES = 120;

export type SceneCheckProps = {
  js: string;
  texts: Record<string, string>;
  durationInFrames: number;
  brand: Parameters<SceneComponent>[0]["brand"];
  photos?: Parameters<SceneComponent>[0]["photos"];
  cuts?: number[];
  /** A collage's composition: the shots it lays (each one a grey card here). */
  shots?: Parameters<SceneComponent>[0]["shots"];
  /** What moves in the footage under it (its `track` reads the real places, so a text that follows a hand is checked where it goes). */
  track?: TrackPiece[];
  /** The Reel's rhythm and look, for its camera moves (the same theme as the render). */
  look?: { template?: MotionTemplate; tempo?: number; signature?: ReelProps["brand"]["signature"] };
};

const FrameContext = createContext(0);

/** The scene's own scope, with the frame given by the copy it is drawn in (and its Sequences). */
function checkScope(width: number, height: number, durationInFrames: number): typeof SCOPE {
  const useCurrentFrame = () => useContext(FrameContext);
  const Sequence = ({ from = 0, durationInFrames: length = Infinity, layout, style, children }: {
    from?: number;
    durationInFrames?: number;
    layout?: "none" | "absolute-fill";
    style?: CSSProperties;
    children?: ReactNode;
  }) => {
    const frame = useCurrentFrame();
    if (frame < from || frame >= from + length) return null;
    const content = <FrameContext.Provider value={frame - from}>{children}</FrameContext.Provider>;
    return layout === "none" ? content : <AbsoluteFill style={style}>{content}</AbsoluteFill>;
  };
  // A cut-out as a plain image: only the texts are measured, and a rim drawn in a canvas in every copy is slow.
  const Cutout = ({ photo, x, y, height: h, style }: Parameters<typeof SCOPE.Cutout>[0]) =>
    photo?.cutout && photo.subject ? <img src={photo.cutout} style={{ position: "absolute", left: x, top: y, height: h, ...style }} /> : null;
  return {
    ...SCOPE,
    useCurrentFrame,
    useVideoConfig: () => ({ ...SCOPE.useVideoConfig(), width, height, durationInFrames }),
    Sequence: Sequence as unknown as typeof SCOPE.Sequence,
    Cutout: Cutout as typeof SCOPE.Cutout,
  };
}

class Catch extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Out = { text: string; frames: number[]; box: [number, number, number, number] };

/** A text over a face of the footage: the frames it is on it, and the face's box (px). */
type OnFace = { text: string; frames: number[]; face: [number, number, number, number] };

/** The rows its texts cover while they hold still (the middle of the scene, entrances and exits aside), in px. */
type Band = { top: number; bottom: number };

/**
 * Visible texts outside the safe zone, per text, in one copy of the scene; those over the eyes, nose
 * or mouth of a face seen under it at that frame (`onFace`); and the rows its texts cover when it holds (`band`).
 */
function measure(copy: HTMLElement, frame: number, width: number, height: number, out: Map<string, Out>, seen: Seen, onFace: Map<string, OnFace>, band?: Band) {
  const origin = copy.getBoundingClientRect();
  const zone = {
    left: SAFE_ZONE.side - TOLERANCE,
    right: width - SAFE_ZONE.side + TOLERANCE,
    top: SAFE_ZONE.top - TOLERANCE,
    bottom: height * SAFE_ZONE.bottom + TOLERANCE,
  };
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (!text || !node.parentElement) continue;
    // Effective opacity: a text faded out does not count.
    let opacity = 1;
    for (let el: HTMLElement | null = node.parentElement; el && el !== copy; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden") opacity = 0;
      opacity *= Number(style.opacity);
    }
    if (opacity < 0.15) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      const box: Out["box"] = [r.left - origin.left, r.top - origin.top, r.right - origin.left, r.bottom - origin.top];
      if (band) {
        band.top = Math.min(band.top, box[1]);
        band.bottom = Math.max(band.bottom, box[3]);
      }
      for (const face of seen.faces) {
        const features = [face.points?.right_eye, face.points?.left_eye, face.points?.nose, face.points?.mouth];
        const covered = features.some(
          (p) => p && p.x >= box[0] - FACE_MARGIN && p.x <= box[2] + FACE_MARGIN && p.y >= box[1] - FACE_MARGIN && p.y <= box[3] + FACE_MARGIN,
        );
        if (!covered) continue;
        const entry = onFace.get(text) ?? { text, frames: [], face: [face.x - face.width / 2, face.y - face.height / 2, face.x + face.width / 2, face.y + face.height / 2] };
        if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
        onFace.set(text, entry);
      }
      if (box[0] >= zone.left && box[2] <= zone.right && box[1] >= zone.top && box[3] <= zone.bottom) continue;
      const entry = out.get(text) ?? { text, frames: [], box };
      if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
      entry.box = [Math.min(entry.box[0], box[0]), Math.min(entry.box[1], box[1]), Math.max(entry.box[2], box[2]), Math.max(entry.box[3], box[3])];
      out.set(text, entry);
    }
  }
}

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

export function SceneCheck({ js, texts, durationInFrames, brand, photos = [], cuts = [], shots = [], track: pieces, look }: SceneCheckProps) {
  const width = 1080;
  const height = 1920;
  const [track] = useState(() => footageTrack(pieces, themeFor(look?.template ?? "libre", look?.signature, look?.tempo), { width, height }, { shots }));
  loadFonts([brand.displayFont, brand.bodyFont]);
  const [handle] = useState(() => delayRender("scene check", { timeoutInMilliseconds: 60000 }));
  const [Scene] = useState(() => compileScene(js, checkScope(width, height, durationInFrames)));
  const step = Math.max(STEP, Math.ceil(durationInFrames / MAX_COPIES));
  const frames: number[] = [];
  for (let f = 0; f < durationInFrames; f += step) frames.push(f);

  useEffect(() => {
    if (!Scene) {
      cancelRender(new Error("Scene introuvable dans le code"));
      return;
    }
    (async () => {
      await fontsLoaded();
      // Let FitText boxes measure their text first.
      for (let i = 0; i < 300 && fitsPending() > 0; i++) await waitFrame();
      await waitFrame();
      const out = new Map<string, Out>();
      const onFace = new Map<string, OnFace>();
      const band: Band = { top: Infinity, bottom: -Infinity };
      document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => {
        const frame = Number(copy.dataset.checkFrame);
        const settled = frame >= durationInFrames * 0.2 && frame <= durationInFrames * 0.8;
        measure(copy, frame, width, height, out, track(frame), onFace, settled ? band : undefined);
      });
      const failures = [...out.values()].filter((o) => o.frames.length * step > OUT_FRAMES);
      const r = (n: number) => Math.round(n);
      if (!failures.length) {
        // Read by smoke.mjs: where the texts sit, so the render can move the scene off the faces under it.
        if (Number.isFinite(band.top)) console.log(`FAUVE_BAND ${JSON.stringify([Math.round(band.top) / height, Math.round(band.bottom) / height])}`);
        // And the texts that stay on a face of the footage, for one more round of the motion designer.
        const onFaces = [...onFace.values()].filter((o) => o.frames.length * step > FACE_FRAMES);
        if (onFaces.length) {
          const detail = onFaces
            .slice(0, 3)
            .map((o) => `« ${o.text.slice(0, 40)} » (images ${o.frames[0]} à ${o.frames.at(-1)}, visage de x ${r(o.face[0])} à ${r(o.face[2])}, y ${r(o.face[1])} à ${r(o.face[3])})`)
            .join(" ; ");
          const message = `texte sur un visage de la vidéo : ${detail}. Un texte ne se pose jamais sur les yeux, le nez ou la bouche de quelqu'un : lis track(frame).faces et pose-le du côté libre (de l'autre côté de la main, au-dessus de la tête ou plus bas), sans changer l'idée. Sauf si l'effet qu'elle a demandé a besoin d'être devant un visage (un mot tenu entre ses doigts, un message posé sur elle comme dans le Reel qu'elle recopie) : alors garde-le, sa demande l'autorise.`;
          console.log(`FAUVE_FACE ${JSON.stringify(message)}`);
        }
        return continueRender(handle);
      }
      const detail = failures
        .slice(0, 3)
        .map((o) => `« ${o.text.slice(0, 40)} » (x ${r(o.box[0])} à ${r(o.box[2])}, y ${r(o.box[1])} à ${r(o.box[3])}, images ${o.frames[0]} à ${o.frames.at(-1)})`)
        .join(" ; ");
      cancelRender(
        new Error(
          `texte hors du cadre ou de la zone de sécurité : ${detail}. Chaque texte doit rester entier entre x = ${SAFE_ZONE.side} et x = ${width - SAFE_ZONE.side}, et entre y = ${SAFE_ZONE.top} et y = ${height * SAFE_ZONE.bottom}, zooms, rebonds et rotations compris (une entrée depuis le bord doit finir en moins de ${(OUT_FRAMES / 30).toFixed(1).replace(".", ",")} s) : mets les textes dans FitText et n'agrandis pas un texte au-delà de sa boîte.`,
        ),
      );
    })().catch((error: unknown) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!Scene) return null;
  return (
    <AbsoluteFill>
      {frames.map((f) => (
        // Stacked copies, one per sampled frame; nothing clips them, so overflow can be measured.
        <div key={f} data-check-frame={f} style={{ position: "absolute", left: 0, top: 0, width, height }}>
          <Catch onError={(error) => cancelRender(new Error(`erreur à l'image ${f} : ${error instanceof Error ? error.message : String(error)}`))}>
            <FrameContext.Provider value={f}>
              <Scene width={width} height={height} fps={30} durationInFrames={durationInFrames} brand={brand} texts={texts} photos={photos} cuts={cuts} shots={shots} track={track} />
            </FrameContext.Provider>
          </Catch>
        </div>
      ))}
    </AbsoluteFill>
  );
}
