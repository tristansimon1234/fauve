import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { coverLayout, Photo } from "./Retouch";
import type { Theme } from "./theme";
import { cameraMotion } from "./track";
import type { Box, CameraMove, PhotoEdit } from "./types";

// A photo in relief (Prequel's 3D photo, CapCut's 3D zoom), the engine's way: its subject cut out
// once (the same cut-out as a collage's sticker, framed exactly like the photo) moves a little more
// than the room behind it, so the camera seems to travel between them. No picture is invented: the
// subject only grows over its own place in the photo (it always covers itself). Nothing is blurred: the room behind
// softened like a lens took the photo's detail (Tristan: « ça floute un poil l'image ? »).

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** How much more the subject grows than the room over the shot (a push), or holds over it (a pan). */
const POP = 0.06;
/** A pan slides the subject this much further than the room (share of the room's slide). */
const PAN_LEAD = 0.35;

/** The moves a photo plays in relief: a slow push in or out, a slow pan. */
export const DEPTH_MOVES: CameraMove[] = ["in", "out", "left", "right"];

/**
 * A moving photo whose depth the rented card read (relief.py): the video of every pixel moved by its own depth, the
 * nearer the more, drawn in the photo's place with its framing and retouch, and the room's own move on top (the same
 * as any moving photo), so the camera seems to travel through it. Nothing is invented: a nearer thing grows or slides
 * over what is behind it, and the room behind softens a touch.
 */
export function ReliefPhoto({
  src,
  relief,
  edit,
  grade,
  move,
  durationInFrames,
  theme,
}: {
  src: string;
  relief: string;
  edit: PhotoEdit;
  grade?: string;
  move: CameraMove;
  durationInFrames: number;
  theme: Theme;
}) {
  const frame = useCurrentFrame();
  const camera = cameraMotion(move, frame, durationInFrames, theme) ?? { scale: 1 };
  return (
    <AbsoluteFill style={{ transform: `scale(${camera.scale})${camera.shift !== undefined ? ` translateX(${camera.shift}%)` : ""}` }}>
      <Photo src={src} moving={relief} edit={edit} grade={grade} />
    </AbsoluteFill>
  );
}

export function DepthPhoto({
  src,
  cutout,
  edit,
  grade,
  move,
  durationInFrames,
  theme,
}: {
  src: string;
  cutout: { src: string; box: Box };
  edit: PhotoEdit;
  grade?: string;
  move: CameraMove;
  durationInFrames: number;
  theme: Theme;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const camera = cameraMotion(move, frame, durationInFrames, theme) ?? { scale: 1 };
  const room = `scale(${camera.scale})${camera.shift !== undefined ? ` translateX(${camera.shift}%)` : ""}`;
  // Where the subject's centre is in the frame: it grows about it, over its own place.
  const layout = coverLayout({ width, height }, edit.source, edit.adjust);
  const cx = layout.left + (cutout.box.x + cutout.box.w / 2) * layout.width;
  const cy = layout.top + (cutout.box.y + cutout.box.h / 2) * layout.height;
  const pan = move === "left" || move === "right";
  const pop = pan ? POP * 0.8 : move === "out" ? POP * (1 - p) : POP * p;
  const lead = pan && camera.shift !== undefined ? (camera.shift / 100) * width * PAN_LEAD : 0;
  return (
    <AbsoluteFill style={{ transform: room }}>
      <Photo src={src} edit={edit} grade={grade} />
      <AbsoluteFill style={{ transform: `translateX(${lead.toFixed(2)}px) scale(${(1 + pop).toFixed(4)})`, transformOrigin: `${cx.toFixed(1)}px ${cy.toFixed(1)}px` }}>
        <Photo src={cutout.src} edit={edit} grade={grade} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
