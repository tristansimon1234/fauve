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
// A mark (an arrow, a number, a key: isMark) only has to stay inside the picture.
// A text that stays on the eyes, nose or mouth of a face tracked under the scene (one
// hung on a hand next to the face) is not a failure: it is reported (FAUVE_FACE), and
// the motion designer gets one more round to move it. So is a sentence that does not stay
// whole on screen long enough to be read (FAUVE_READ: Tristan, « parfois c'est trop rapide
// donc on peut même pas lire »). And what it draws, row by row (FAUVE_COVER), for the engine
// to set a voice's subtitles where the animations leave room (Tristan: « il faut pas masquer
// mais bien les placer là où ça ne gêne pas les anim et les visages »).

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
  /** The fonts its code brings besides the Reel's two: checked with them, as the render draws it. */
  fonts?: string[];
  /** A collage's composition that draws the whole picture: the Reel's texts (each must be written, whole, at its moment) and its end. */
  reelTexts?: Parameters<SceneComponent>[0]["reelTexts"];
  end?: Parameters<SceneComponent>[0]["end"];
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

/**
 * A mark, not words to read: an arrow, a number, a key of a drawn keyboard, a dot of an interface
 * (no letter and 3 characters at most, or a single character). It may sit near the edge, as in the
 * interfaces of the Reels she copies, but stays inside the picture: a fake app's « ↑ » and « 01 »
 * by its side had the whole composition of Tristan's Reel left out.
 */
const isMark = (text: string) => [...text].length <= 1 || ([...text].length <= 3 && !/\p{L}/u.test(text));

/** A text over a face of the footage: the frames it is on it, and the face's box (px). */
type OnFace = { text: string; frames: number[]; face: [number, number, number, number] };

/**
 * Visible texts outside the safe zone, per text, in one copy of the scene; and those over the eyes,
 * nose or mouth of a face seen under it at that frame (`onFace`).
 */
function measure(copy: HTMLElement, frame: number, width: number, height: number, out: Map<string, Out>, seen: Seen, onFace: Map<string, OnFace>) {
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
      const limit = isMark(text) ? { left: -TOLERANCE, right: width + TOLERANCE, top: -TOLERANCE, bottom: height + TOLERANCE } : zone;
      if (box[0] >= limit.left && box[2] <= limit.right && box[1] >= limit.top && box[3] <= limit.bottom) continue;
      const entry = out.get(text) ?? { text, frames: [], box };
      if (entry.frames.at(-1) !== frame) entry.frames.push(frame);
      entry.box = [Math.min(entry.box[0], box[0]), Math.min(entry.box[1], box[1]), Math.max(entry.box[2], box[2]), Math.max(entry.box[3], box[3])];
      out.set(text, entry);
    }
  }
}

/**
 * How long a sentence must stay whole on screen to be read on a phone: about 0.3 s a word
 * after a first glance, between 1.2 and 4.5 s (the same as readingSeconds in @fauve/agent).
 */
export const readingSeconds = (text: string) => {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * words));
};

/** The block a text sits in (its sentence), past the inline spans of its words. */
function blockOf(node: Node, copy: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el && el !== copy; el = el.parentElement) {
    if (!getComputedStyle(el).display.startsWith("inline")) return el;
  }
  return node.parentElement;
}

/**
 * Sentences that do not stay whole on screen long enough to be read (3 words or more), with how
 * long they stay and how long they need. A sentence still on screen when the scene ends is left
 * to the montage; one that only grows into a longer one is read as the longer one.
 */
function tooQuick(frames: number[], step: number, last: number): { text: string; seconds: number; needs: number; from: number }[] {
  const seen = new Map<string, number[]>();
  document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => {
    const frame = Number(copy.dataset.checkFrame);
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const blocks = new Set<HTMLElement>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      let opacity = 1;
      for (let el: HTMLElement | null = node.parentElement; el && el !== copy; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden") opacity = 0;
        opacity *= Number(style.opacity);
      }
      const block = opacity >= 0.5 ? blockOf(node, copy) : null;
      if (block) blocks.add(block);
    }
    for (const block of blocks) {
      const text = (block.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text.split(" ").length < 3) continue;
      const at = seen.get(text) ?? [];
      if (at.at(-1) !== frame) at.push(frame);
      seen.set(text, at);
    }
  });
  const texts = [...seen.keys()];
  return [...seen.entries()].flatMap(([text, at]) => {
    if (texts.some((other) => other !== text && other.includes(text))) return [];
    // Its longest stay, in one piece.
    let best = { from: at[0]!, to: at[0]! };
    let run = { from: at[0]!, to: at[0]! };
    for (const f of at.slice(1)) {
      run = f - run.to <= step ? { ...run, to: f } : { from: f, to: f };
      if (run.to - run.from > best.to - best.from) best = run;
    }
    if (best.to >= last) return [];
    const seconds = (best.to - best.from + step) / 30;
    const needs = readingSeconds(text);
    return seconds < needs * 0.8 && frames.length > 1 ? [{ text, seconds, needs, from: best.from }] : [];
  });
}

/** Rows of the frame the drawing is measured in (20 px each). */
const COVER_ROWS = 96;
/** Elements drawn as shapes (an image, a canvas, a vector shape), whatever their style. */
const SHAPES = new Set(["img", "canvas", "video", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "image", "use"]);
/** A colour's alpha (computed colours are rgb() or rgba()). */
const alpha = (color: string) => (color.startsWith("rgba") ? Number(color.slice(color.lastIndexOf(",") + 1, -1)) : color.startsWith("rgb") ? 1 : 0);

/**
 * What a copy of the scene draws, row by row: the share of the subtitles' width (the safe zone's)
 * covered by its texts, its pictures and its painted shapes. A backdrop over most of the frame does
 * not count: subtitles read on it, as on her footage.
 */
function drawn(copy: HTMLElement, width: number, height: number): number[] {
  const origin = copy.getBoundingClientRect();
  const [left, right] = [SAFE_ZONE.side, width - SAFE_ZONE.side];
  const rows: [number, number][][] = Array.from({ length: COVER_ROWS }, () => []);
  const add = (r: DOMRect) => {
    if (r.width * r.height > width * height * 0.6) return;
    const x0 = Math.max(left, r.left - origin.left);
    const x1 = Math.min(right, r.right - origin.left);
    if (x1 <= x0) return;
    const from = Math.max(0, Math.floor(((r.top - origin.top) / height) * COVER_ROWS));
    const to = Math.min(COVER_ROWS, Math.ceil(((r.bottom - origin.top) / height) * COVER_ROWS));
    for (let i = from; i < to; i++) rows[i]!.push([x0, x1]);
  };
  // Effective opacity, top down: a faded element and all it holds do not count.
  const opacity = new Map<Element, number>();
  const visit = (el: Element, parent: number) => {
    const style = getComputedStyle(el);
    if (style.display === "none") return;
    const seen = style.visibility === "hidden" ? 0 : parent * Number(style.opacity);
    if (seen < 0.15) return;
    opacity.set(el, seen);
    const border = ["Top", "Right", "Bottom", "Left"].some((side) => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0) && alpha(style.borderTopColor) > 0.15;
    if (SHAPES.has(el.tagName.toLowerCase()) || alpha(style.backgroundColor) > 0.15 || style.backgroundImage !== "none" || border) add(el.getBoundingClientRect());
    for (const child of Array.from(el.children)) visit(child, seen);
  };
  for (const child of Array.from(copy.children)) visit(child, 1);
  const range = document.createRange();
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || !node.parentElement || !opacity.has(node.parentElement)) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) if (r.width >= 1 && r.height >= 1) add(r);
  }
  return rows.map((spans) => {
    // The width the spans cover together, overlaps counted once.
    let covered = 0;
    let end = -Infinity;
    for (const [a, b] of spans.sort((p, q) => p[0] - q[0])) {
      if (b <= end) continue;
      covered += b - Math.max(a, end);
      end = b;
    }
    return covered / (right - left);
  });
}

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

/** Words compared as written: spaces of any kind and case aside. */
const plain = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, "").toLowerCase();

/**
 * The Reel's texts a composition does not write: each one is looked for, whole, in the copies of
 * the frames it holds (its words may come one by one, so the fullest copy counts).
 */
function missingTexts(reelTexts: NonNullable<SceneCheckProps["reelTexts"]>, frames: number[]): string[] {
  const copies = new Map<number, string>();
  document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => copies.set(Number(copy.dataset.checkFrame), plain(copy.textContent ?? "")));
  return reelTexts.flatMap((t) => {
    const held = frames.filter((f) => f >= t.from && f < t.to);
    const words = [t.text, ...(t.items ?? []).map((item) => item.title)].map(plain);
    const found = held.some((f) => words.every((w) => copies.get(f)?.includes(w)));
    return held.length && !found ? [`« ${t.text.slice(0, 50)} » (images ${t.from} à ${t.to})`] : [];
  });
}

export function SceneCheck({ js, texts, durationInFrames, brand, photos = [], cuts = [], shots = [], track: pieces, look, fonts = [], reelTexts = [], end = null }: SceneCheckProps) {
  const width = 1080;
  const height = 1920;
  const [track] = useState(() => footageTrack(pieces, themeFor(look?.template ?? "libre", look?.signature, look?.tempo), { width, height }, { shots }));
  loadFonts([brand.displayFont, brand.bodyFont, ...fonts]);
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
      document.querySelectorAll<HTMLElement>("[data-check-frame]").forEach((copy) => {
        const frame = Number(copy.dataset.checkFrame);
        measure(copy, frame, width, height, out, track(frame), onFace);
      });
      const failures = [...out.values()].filter((o) => o.frames.length * step > OUT_FRAMES);
      const r = (n: number) => Math.round(n);
      // A composition that draws the whole picture writes every text of the Reel.
      const missing = missingTexts(reelTexts, frames);
      if (!failures.length && missing.length) {
        cancelRender(
          new Error(
            `texte du Reel absent : ${missing.slice(0, 3).join(" ; ")}. Ta composition écrit chaque texte de reelTexts pendant son moment (from à to), en entier et tel quel, détails d'un message compris (items).`,
          ),
        );
        return;
      }
      if (!failures.length) {
        // Read by smoke.mjs: the texts that stay on a face of the footage, for one more round of the motion designer.
        const onFaces = [...onFace.values()].filter((o) => o.frames.length * step > FACE_FRAMES);
        if (onFaces.length) {
          const detail = onFaces
            .slice(0, 3)
            .map((o) => `« ${o.text.slice(0, 40)} » (images ${o.frames[0]} à ${o.frames.at(-1)}, visage de x ${r(o.face[0])} à ${r(o.face[2])}, y ${r(o.face[1])} à ${r(o.face[3])})`)
            .join(" ; ");
          const message = `texte sur un visage de la vidéo : ${detail}. Un texte ne se pose pas sur les yeux, le nez ou la bouche de quelqu'un qu'on voit : lis track(frame).faces et pose-le du côté libre (de l'autre côté de la main, au-dessus de la tête ou plus bas), sans changer l'idée. Sauf si ce que tu poses cache la vidéo à cet endroit (un aplat, une carte : le visage ne se voit plus), ou si l'effet qu'elle a demandé a besoin d'être devant un visage (un mot tenu entre ses doigts, un message posé sur elle comme dans le Reel qu'elle recopie) : alors garde-le.`;
          console.log(`FAUVE_FACE ${JSON.stringify(message)}`);
        }
        const quick = tooQuick(frames, step, frames.at(-1) ?? 0);
        if (quick.length) {
          const s = (n: number) => n.toFixed(1).replace(".", ",");
          const detail = quick
            .slice(0, 3)
            .map((q) => `« ${q.text.slice(0, 50)} » (dès l'image ${q.from}) reste ${s(q.seconds)} s entière à l'écran, il lui en faut ${s(q.needs)}`)
            .join(" ; ");
          const message = `texte trop rapide pour être lu : ${detail}. Une phrase reste entière à l'écran au moins 0,8 s plus 0,3 s par mot avant de partir (le temps de la lire sur un téléphone) : fais-la arriver plus tôt ou partir plus tard, ou garde moins de phrases, sans changer l'idée.`;
          console.log(`FAUVE_READ ${JSON.stringify(message)}`);
        }
        // What it draws, row by row, over its length (each row: the share of the subtitles' width it covers, on average).
        const copies = Array.from(document.querySelectorAll<HTMLElement>("[data-check-frame]")).map((copy) => drawn(copy, width, height));
        const cover = Array.from({ length: COVER_ROWS }, (_, i) => Math.round((copies.reduce((sum, c) => sum + c[i]!, 0) / Math.max(1, copies.length)) * 100) / 100);
        console.log(`FAUVE_COVER ${JSON.stringify(cover)}`);
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
              <Scene width={width} height={height} fps={30} durationInFrames={durationInFrames} brand={brand} texts={texts} photos={photos} cuts={cuts} shots={shots} track={track} reelTexts={reelTexts} end={end} />
            </FrameContext.Provider>
          </Catch>
        </div>
      ))}
    </AbsoluteFill>
  );
}
