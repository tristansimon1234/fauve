// Where a text can be set in one of her shots (ClearBox, Effects.tsx): the largest clear area of the picture, its sky
// first, else an empty wall or any calm, even area, chosen on the grid apps/render/clear_area.py read before the render
// (which cells stay calm through the passage, which of them are the sky, and how the camera moves). The area is chosen
// once for the shot, where it stays clear and inside the box the shot is laid in at every image (the camera's move and
// the Reel's own push or punch included), then follows the camera. Pure geometry, no React: the render, the live
// preview, the scene check and the tests make the same choice.

/** A grid read on a passage (mirror of ClearMap in packages/agent/src/subject.ts): « 2 » sky, « 1 » calm, « 0 » busy, rows from the top; the camera's move (s, dx, dy) for each image. */
export type ClearMap = { cols: number; rows: number; cells: string; motion?: number[] };
export type Box = { x: number; y: number; w: number; h: number };
export type Rect = { left: number; top: number; width: number; height: number };
/** A map from shares of the shot's first image to px of the composition: x = a·u + b·v + c, y = d·u + e·v + f. */
export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };
type Edges = { x0: number; y0: number; x1: number; y1: number };
/** Where the area may lie (px): inside, and out of its holes (the apps' buttons). */
export type Room = { inside: Edges; holes: Edges[] };

export type ClearOptions = {
  /** The shape wanted, width / height (a one-line name: its width over its height); the largest of any shape without it. */
  aspect?: number;
  /** Its smallest acceptable size (px): smaller, there is none (the fallback). 20 % of the room's width and 5 % of its height by default. */
  min?: { w?: number; h?: number };
  /** Its largest size (px): a larger area gives a box this size (its shape kept) in its middle. */
  max?: { w?: number; h?: number };
  /** Where it is looked for first: the upper part (default), the lower, or anywhere alike. */
  prefer?: "top" | "bottom" | "any";
  /** The sky first (default): an area open to the top of the picture when one is large enough, else any calm one. false: any calm area alike. */
  sky?: boolean;
  /** px kept clear around it, inside the calm area (2 % of the room's smaller side by default). */
  pad?: number;
  /** Where it may lie (px, the same space as the box the shot is laid in): the Reel's safe zone by default, null for the whole box. */
  within?: Box | null;
  /** Where that space's (0, 0) is on the Reel's frame (a shot laid inside a box at top 656: { x: 0, y: 656 }), so the default safe zone falls right. */
  origin?: { x: number; y: number };
};

/** The Reel's frame and its safe zone (mirror of SAFE_ZONE in SceneCheck.tsx): where a text to read may be. */
const FRAME = { width: 1080, height: 1920 };
const SAFE = { edge: 40, top: 80, bottom: 0.75, side: 140, buttons: 0.5 };
/** The images of the shot its room is checked on (spread along it, its first and last among them). */
const SAMPLES = 24;

const apply = (p: Affine, u: number, v: number): [number, number] => [p.a * u + p.b * v + p.c, p.d * u + p.e * v + p.f];

/** An affine map read from a placing function (its image of three points): exact for the Reel's placer, a similarity once its turn is in. */
export function affineOf(at: (x: number, y: number) => readonly [number, number]): Affine {
  const [c, f] = at(0, 0);
  const [x1, y1] = at(1, 0);
  const [x2, y2] = at(0, 1);
  return { a: x1 - c, b: x2 - c, c, d: y1 - f, e: y2 - f, f };
}

/** How the camera moved the picture at image t of the passage (s, dx, dy: x' = 0.5 + s·(x − 0.5) + dx); still when the map has no move. */
export function cameraAt(map: ClearMap, t: number): [number, number, number] {
  const m = map.motion;
  if (!m || m.length < 3) return [1, 0, 0];
  const i = Math.max(0, Math.min(Math.floor(m.length / 3) - 1, Math.round(t))) * 3;
  const s = m[i]!;
  return Number.isFinite(s) && s > 0 ? [s, m[i + 1] ?? 0, m[i + 2] ?? 0] : [1, 0, 0];
}

/** A place (shares of the image → px) after the camera's move (shares of the first image → of this one). */
export function withCamera(place: Affine, [s, dx, dy]: [number, number, number]): Affine {
  // u' = s·u + ou, v' = s·v + ov.
  const ou = 0.5 - 0.5 * s + dx;
  const ov = 0.5 - 0.5 * s + dy;
  return { a: place.a * s, b: place.b * s, c: place.a * ou + place.b * ov + place.c, d: place.d * s, e: place.e * s, f: place.d * ou + place.e * ov + place.f };
}

const cut = (a: Edges, b: Edges): Edges => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });

/** Where the area may lie in the box a shot is laid in: inside it and `within` (the Reel's safe zone, its buttons' strip left out, unless given). */
export function clearRoom(laid: Rect, within?: Box | null, origin: { x: number; y: number } = { x: 0, y: 0 }): Room {
  const box = { x0: laid.left, y0: laid.top, x1: laid.left + laid.width, y1: laid.top + laid.height };
  if (within === null) return { inside: box, holes: [] };
  if (within) return { inside: cut(box, { x0: within.x, y0: within.y, x1: within.x + within.w, y1: within.y + within.h }), holes: [] };
  const zone = { x0: SAFE.edge - origin.x, y0: SAFE.top - origin.y, x1: FRAME.width - SAFE.edge - origin.x, y1: FRAME.height * SAFE.bottom - origin.y };
  return { inside: cut(box, zone), holes: [{ x0: FRAME.width - SAFE.side - origin.x, y0: FRAME.height * SAFE.buttons - origin.y, x1: Infinity, y1: Infinity }] };
}

/** A grid that can be read: its cells all there, of the three kinds. */
export const readableMap = (map: ClearMap | undefined): map is ClearMap =>
  Boolean(map && Number.isInteger(map.cols) && Number.isInteger(map.rows) && map.cols > 1 && map.rows > 1 && map.cells.length === map.cols * map.rows && /^[012]+$/.test(map.cells));

/**
 * The clear area chosen for a shot, in shares of its first image ({ x, y, w, h }), or null when none is large enough:
 * of the cells calm through the passage (its sky alone first, unless `sky` is false) that stay in the room at every
 * image (`project(t)`: shares of the first image → px at image t of the shot, its camera's move included) and off
 * `avoid` (her faces, shares), the band of rows and stretch of columns whose box (less `pad`, to `aspect` and `max`)
 * is the largest, the upper ones first.
 */
export function chooseClear(map: ClearMap, project: (t: number) => Affine, frames: number, room: Room, options: ClearOptions & { avoid?: Box[] } = {}): Box | null {
  if (!readableMap(map)) return null;
  const { cols, rows } = map;
  const n = Math.max(1, Math.round(frames));
  const step = Math.max(1, Math.round(n / SAMPLES));
  const times: number[] = [];
  for (let t = 0; t < n; t += step) times.push(t);
  if (times.at(-1) !== n - 1) times.push(n - 1);
  const places = times.map(project);
  const roomW = room.inside.x1 - room.inside.x0;
  const roomH = room.inside.y1 - room.inside.y0;
  if (!(roomW > 0 && roomH > 0)) return null;
  const pad = Math.max(0, options.pad ?? 0.02 * Math.min(roomW, roomH));
  // `pad` off the room's edges too: with the stretch's own pad, a text never comes nearer the picture's border than twice it.
  const inside = { x0: room.inside.x0 + pad, y0: room.inside.y0 + pad, x1: room.inside.x1 - pad, y1: room.inside.y1 - pad };
  const { holes } = room;
  const avoid = options.avoid ?? [];
  // Each cell where a text may lie: calm, in the room at every image, off her faces.
  const allowed = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const kind = map.cells.charCodeAt(r * cols + c) - 48;
      if (kind <= 0) continue;
      const [u0, v0, u1, v1] = [c / cols, r / rows, (c + 1) / cols, (r + 1) / rows];
      if (avoid.some((f) => u0 < f.x + f.w && u1 > f.x && v0 < f.y + f.h && v1 > f.y)) continue;
      const fits = places.every((p) => {
        const corners = [apply(p, u0, v0), apply(p, u1, v0), apply(p, u0, v1), apply(p, u1, v1)];
        const xs = corners.map((k) => k[0]);
        const ys = corners.map((k) => k[1]);
        const e = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
        if (e.x0 < inside.x0 || e.y0 < inside.y0 || e.x1 > inside.x1 || e.y1 > inside.y1) return false;
        return !holes.some((h) => e.x0 < h.x1 && e.x1 > h.x0 && e.y0 < h.y1 && e.y1 > h.y0);
      });
      if (fits) allowed[r * cols + c] = kind;
    }
  }
  // A cell's size in px, at the middle of the shot.
  const mid = places[Math.floor(places.length / 2)]!;
  const cw = Math.hypot(mid.a, mid.d) / cols;
  const ch = Math.hypot(mid.b, mid.e) / rows;
  const minW = Math.max(1, options.min?.w ?? 0.2 * roomW);
  const minH = Math.max(1, options.min?.h ?? 0.05 * roomH);
  const aspect = options.aspect && Number.isFinite(options.aspect) && options.aspect > 0 ? options.aspect : undefined;
  const prefer = options.prefer ?? "top";

  const search = (wanted: (kind: number) => boolean): Box | null => {
    let best: { score: number; box: Box } | null = null;
    const consider = (r0: number, r1: number, c0: number, c1: number) => {
      let w = (c1 - c0 + 1) * cw - 2 * pad;
      let h = (r1 - r0 + 1) * ch - 2 * pad;
      if (w <= 0 || h <= 0) return;
      if (aspect) {
        if (w / h > aspect) w = h * aspect;
        else h = w / aspect;
      }
      if (options.max?.w && w > options.max.w) {
        if (aspect) h *= options.max.w / w;
        w = options.max.w;
      }
      if (options.max?.h && h > options.max.h) {
        if (aspect) w *= options.max.h / h;
        h = options.max.h;
      }
      if (w < minW - 0.5 || h < minH - 0.5) return;
      // In the middle of its stretch: as far as it gets from what is busy around it.
      const u = (c0 + c1 + 1) / 2 / cols;
      const v = (r0 + r1 + 1) / 2 / rows;
      const rel = Math.max(0, Math.min(1, (apply(mid, u, v)[1] - inside.y0) / roomH));
      const weight = prefer === "top" ? 1.35 - 0.7 * rel : prefer === "bottom" ? 0.65 + 0.7 * rel : 1;
      const score = w * h * weight;
      if (best && score <= best.score) return;
      const sw = w / (cw * cols);
      const sh = h / (ch * rows);
      best = { score, box: { x: u - sw / 2, y: v - sh / 2, w: sw, h: sh } };
    };
    const open = new Uint8Array(cols);
    for (let r0 = 0; r0 < rows; r0++) {
      open.fill(1);
      for (let r1 = r0; r1 < rows; r1++) {
        let any = false;
        for (let c = 0; c < cols; c++) {
          if (open[c] && !wanted(allowed[r1 * cols + c]!)) open[c] = 0;
          if (open[c]) any = true;
        }
        if (!any) break;
        // Each stretch of columns clear from row r0 to row r1.
        let from = -1;
        for (let c = 0; c <= cols; c++) {
          if (c < cols && open[c]) {
            if (from < 0) from = c;
          } else if (from >= 0) {
            consider(r0, r1, from, c - 1);
            from = -1;
          }
        }
      }
    }
    return (best as { box: Box } | null)?.box ?? null;
  };
  return (options.sky !== false ? search((k) => k === 2) : null) ?? search((k) => k > 0);
}

/** The area (shares of the first image) where the composition draws it at an image (px: the box around its corners). */
export function placeClear(area: Box, place: Affine): Box {
  const corners = [apply(place, area.x, area.y), apply(place, area.x + area.w, area.y), apply(place, area.x, area.y + area.h), apply(place, area.x + area.w, area.y + area.h)];
  const xs = corners.map((k) => k[0]);
  const ys = corners.map((k) => k[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
