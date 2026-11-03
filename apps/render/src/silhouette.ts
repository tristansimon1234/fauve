// Where a person is in a frame, roughly, from what was tracked in her shot (her body's 33 points, her face): the
// scene check uses it to see whether a word laid behind her (before Subject) is hidden by her. The first production
// test of a replaced background had its big words behind her hidden on every close-up (« TOUTE », « CRAQUE » never
// seen, the « -20 % » under her body and her hair). Pure, frame based, no JSX: the tests read it.
//
// Also the words said that the check gives a scene whose code reads `spoken`, to see whether it writes them.

import type { Seen } from "./track";

type Point = { x: number; y: number };
export type Shape =
  | { kind: "ellipse"; x: number; y: number; rx: number; ry: number }
  | { kind: "capsule"; a: Point; b: Point; r: number }
  | { kind: "poly"; points: Point[] };
export type Box = { left: number; top: number; width: number; height: number };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Her silhouette in a box (px of the frame), as a few shapes: her head with its hair, her neck, her torso down to her
 * hips (or to the bottom of the box when they are out of it: a close-up), her arms and hands, her legs. Sized on the
 * width of her shoulders, else of her face. A face seen without a body (too close for the body's model) is a head
 * and a column under it. Nothing when nobody was tracked there.
 */
export function silhouette(seen: Seen, box: Box): Shape[] {
  const shapes: Shape[] = [];
  const bottom = box.top + box.height;
  const facesUsed = new Set<number>();
  for (const body of seen.bodies) {
    const p = body.points;
    const at = (name: keyof typeof p) => (p[name]?.visible ? p[name] : null);
    const ls = at("left_shoulder");
    const rs = at("right_shoulder");
    const nose = at("nose");
    const ears = at("left_ear") && at("right_ear") ? mid(at("left_ear")!, at("right_ear")!) : null;
    const headAt = nose ?? ears ?? (at("left_eye") && at("right_eye") ? mid(at("left_eye")!, at("right_eye")!) : null);
    // Her face, when one was seen around her head: its width sizes her when her shoulders are out of the picture.
    const face = headAt ? seen.faces.find((f) => Math.abs(f.x - headAt.x) < f.width && Math.abs(f.y - headAt.y) < f.height) : undefined;
    const sw =
      ls && rs
        ? dist(ls, rs)
        : face
          ? face.width * 2.3
          : at("left_ear") && at("right_ear")
            ? dist(at("left_ear")!, at("right_ear")!) * 2.6
            : 0;
    if (sw < 8) continue;
    // A face much wider than her shoulders allow is not hers (a phone, a fan of swatches held up near her head).
    if (face && face.width <= 0.9 * sw) facesUsed.add(face.id);
    if (headAt) {
      // Her head with its hair: wider and taller than her face.
      shapes.push({ kind: "ellipse", x: headAt.x, y: headAt.y - 0.1 * sw, rx: 0.45 * sw, ry: 0.58 * sw });
    }
    if (ls && rs) {
      const shoulders = mid(ls, rs);
      if (headAt) shapes.push({ kind: "capsule", a: headAt, b: shoulders, r: 0.2 * sw });
      // Her shoulders a little wider than their joints.
      const ux = (ls.x - rs.x) / sw;
      const uy = (ls.y - rs.y) / sw;
      const out = 0.1 * sw;
      const l = { x: ls.x + ux * out, y: ls.y + uy * out };
      const r = { x: rs.x - ux * out, y: rs.y - uy * out };
      const lh = at("left_hip");
      const rh = at("right_hip");
      if (lh && rh) {
        const hw = Math.max(dist(lh, rh), 0.7 * sw) / 2 + 0.06 * sw;
        const c = mid(lh, rh);
        shapes.push({ kind: "poly", points: [l, r, { x: c.x - ux * hw, y: c.y - uy * hw }, { x: c.x + ux * hw, y: c.y + uy * hw }] });
      } else {
        // Her hips out of the picture: her body goes down to the bottom of it.
        shapes.push({ kind: "poly", points: [l, r, { x: r.x, y: bottom }, { x: l.x, y: bottom }] });
      }
    }
    // Her arms, hands, legs and feet, where they were seen.
    const limb = (a: Point | null, b: Point | null, r: number) => {
      if (a && b) shapes.push({ kind: "capsule", a, b, r: r * sw });
    };
    for (const side of ["left", "right"] as const) {
      limb(at(`${side}_shoulder`), at(`${side}_elbow`), 0.14);
      limb(at(`${side}_elbow`), at(`${side}_wrist`), 0.12);
      const wrist = at(`${side}_wrist`);
      if (wrist) {
        const hand = at(`${side}_index`) ? mid(wrist, at(`${side}_index`)!) : wrist;
        shapes.push({ kind: "ellipse", x: hand.x, y: hand.y, rx: 0.2 * sw, ry: 0.2 * sw });
      }
      limb(at(`${side}_hip`), at(`${side}_knee`), 0.17);
      limb(at(`${side}_knee`), at(`${side}_ankle`), 0.13);
      const ankle = at(`${side}_ankle`);
      if (ankle) shapes.push({ kind: "ellipse", x: ankle.x, y: ankle.y + 0.05 * sw, rx: 0.16 * sw, ry: 0.12 * sw });
    }
  }
  for (const f of seen.faces) {
    // With bodies seen, only the faces that are theirs (another « face » is something held up, or a false reading).
    if (seen.bodies.length && !facesUsed.has(f.id)) continue;
    // Her face with her hair, and, without a body seen, her body as a column under it.
    shapes.push({ kind: "ellipse", x: f.x, y: f.y - 0.12 * f.height, rx: 0.85 * f.width, ry: 0.95 * f.height });
    if (facesUsed.has(f.id)) continue;
    const w = 1.2 * f.width;
    const y = f.y + 0.4 * f.height;
    if (y < bottom) shapes.push({ kind: "poly", points: [{ x: f.x - w, y }, { x: f.x + w, y }, { x: f.x + w, y: bottom }, { x: f.x - w, y: bottom }] });
  }
  return shapes;
}

function inPoly(points: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

/** Whether a point (px of the frame) is in her silhouette. */
export function inShape(s: Shape, x: number, y: number): boolean {
  if (s.kind === "ellipse") return ((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 <= 1;
  if (s.kind === "poly") return inPoly(s.points, x, y);
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const t = Math.max(0, Math.min(1, ((x - s.a.x) * dx + (y - s.a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (s.a.x + t * dx), y - (s.a.y + t * dy)) <= s.r;
}

/** Whether a point is in the box she is drawn in (Subject shows nothing outside it). */
export const inBox = (box: Box, x: number, y: number) => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;

/** The share of a rectangle (px of the frame) her silhouette covers, inside the box she is drawn in, tested every `step` px. */
export function coveredShare(rect: { left: number; top: number; right: number; bottom: number }, shapes: Shape[], box: Box, step = 10): number {
  let points = 0;
  let covered = 0;
  for (let y = rect.top + step / 2; y < rect.bottom; y += step) {
    for (let x = rect.left + step / 2; x < rect.right; x += step) {
      points++;
      if (inBox(box, x, y) && shapes.some((s) => inShape(s, x, y))) covered++;
    }
  }
  return points ? covered / points : 0;
}

// ——— Words said, for a scene whose code reads `spoken` ———————————————————————————————————

/** Ordinary words, all different, none of them a small word the captions might leave out. */
const PROBE = (
  "lumière matin boutique couleur jardin sourire vitrine bouquet rideau terrasse cuisine parfum tissu pinceau " +
  "lavande citron velours cerise falaise théâtre musique soleil nuage montagne rivière forêt village marché " +
  "chocolat biscuit caramel vanille noisette orange framboise tomate basilic olive poivre farine beurre " +
  "fromage miroir peigne ciseaux bouteille carafe assiette fourchette serviette coussin fauteuil lampe " +
  "bougie tableau cadre étagère panier valise chapeau écharpe manteau chemise robe pantalon chaussure " +
  "bracelet collier montre lunettes vélo trottinette voiture bateau avion train station quartier avenue " +
  "fontaine statue musée galerie atelier studio salon comptoir cave grenier balcon fenêtre escalier porte"
).split(" ");

/** The set of the probe's words, to tell them from the scene's own texts. */
export const PROBE_WORDS = new Set(PROBE);

/**
 * Words said over a scene, for the check: phrases of four words, each word 0.3 s with a short gap, a pause between
 * phrases, all different, ending on a full stop; frames from the scene's start.
 */
export function probeSpoken(durationInFrames: number): { w: string; from: number; to: number }[] {
  const words: { w: string; from: number; to: number }[] = [];
  let at = 3;
  for (let i = 0; at + 9 <= durationInFrames; i++) {
    const w = PROBE[i % PROBE.length]!;
    const last = i % 4 === 3;
    words.push({ w: last ? `${w}.` : w, from: at, to: at + 9 });
    at += last ? 21 : 11;
  }
  return words;
}

/** A text made only of the probe's words (the scene writing what is said): left out of the reading-time and size checks. */
export function onlyProbe(text: string): boolean {
  const words = text
    .toLowerCase()
    .split(/[\s  ]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  return words.length > 0 && words.every((w) => PROBE_WORDS.has(w));
}
