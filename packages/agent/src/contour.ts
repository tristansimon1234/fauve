// The outline of a photo's subject, read on its cut-out's transparency (lib/render/cutout.ts), so a word can run along
// its edge or a line be drawn round it on a photo as on a video (SubjectOutline, Outline): the same 64 points as
// matte.py's contour_of (shares of the picture, clockwise on the screen from its top), here on a small copy of the mask.

/** The points of an outline (matte.py's CONTOUR_POINTS). */
export const CONTOUR_POINTS = 64;
/** A piece smaller than this share of the picture has no outline (matte.py: 0.2 %). */
const MIN_AREA = 0.002;

/** The eight neighbours of a pixel, clockwise on the screen (y goes down) from the west. */
const RING: [number, number][] = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
];

/** The pixels of the largest piece (8-connected) of a mask: a set by index, and its first pixel in reading order. */
function largestPiece(on: Uint8Array, w: number, h: number): { piece: Uint8Array; size: number; first: number } | null {
  const label = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  let best = { id: 0, size: 0, first: -1 };
  let id = 0;
  for (let start = 0; start < w * h; start++) {
    if (!on[start] || label[start]) continue;
    id++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    while (head < tail) {
      const p = queue[head++]!;
      const x = p % w;
      const y = (p - x) / w;
      for (const [dx, dy] of RING) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (on[n] && !label[n]) {
          label[n] = id;
          queue[tail++] = n;
        }
      }
    }
    // Reading order: the first pixel met of a piece is its top, leftmost.
    if (tail > best.size) best = { id, size: tail, first: start };
  }
  if (!best.size) return null;
  const piece = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (label[i] === best.id) piece[i] = 1;
  return { piece, size: best.size, first: best.first };
}

/** A piece's edge, pixel by pixel, clockwise from its first pixel (Moore's neighbour tracing, Jacob's stop). */
function traceEdge(piece: Uint8Array, w: number, h: number, first: number): [number, number][] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && piece[y * w + x] === 1;
  const sx = first % w;
  const sy = (first - sx) / w;
  const out: [number, number][] = [[sx, sy]];
  // Its first pixel is the top-left of the piece: the one west of it is outside.
  let [cx, cy] = [sx, sy];
  let [bx, by] = [sx - 1, sy];
  const [b0x, b0y] = [bx, by];
  for (let step = 0; step < 4 * w * h + 8; step++) {
    const k = RING.findIndex(([dx, dy]) => dx === bx - cx && dy === by - cy);
    let moved = false;
    for (let i = 1; i <= 8; i++) {
      const [dx, dy] = RING[(k + i) % 8]!;
      if (inside(cx + dx, cy + dy)) {
        const [px, py] = RING[(k + i - 1) % 8]!;
        [bx, by] = [cx + px, cy + py];
        [cx, cy] = [cx + dx, cy + dy];
        moved = true;
        break;
      }
    }
    // A single pixel: no edge to go round.
    if (!moved) return out;
    if (cx === sx && cy === sy && bx === b0x && by === b0y) return out;
    out.push([cx, cy]);
  }
  return out;
}

/**
 * The outline of the largest piece of a mask (an alpha channel, `w` × `h`, row by row; on above half): CONTOUR_POINTS
 * points evenly along it, clockwise on the screen from its top (its leftmost top point), flat [x0, y0, x1, y1…] in
 * shares of the picture rounded to the thousandth; null when nothing big enough is there.
 */
export function contourOfAlpha(alpha: ArrayLike<number>, w: number, h: number, points = CONTOUR_POINTS): number[] | null {
  if (!(w > 1 && h > 1) || alpha.length < w * h) return null;
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = (alpha[i] ?? 0) > 127 ? 1 : 0;
  const largest = largestPiece(on, w, h);
  if (!largest || largest.size < MIN_AREA * w * h) return null;
  const edge = traceEdge(largest.piece, w, h, largest.first);
  if (edge.length < 3) return null;
  // Clockwise on the screen (y goes down): the shoelace sum is then positive.
  let sum = 0;
  for (let i = 0; i < edge.length; i++) {
    const [x0, y0] = edge[i]!;
    const [x1, y1] = edge[(i + 1) % edge.length]!;
    sum += x0 * y1 - x1 * y0;
  }
  if (sum < 0) edge.reverse();
  // From its top, leftmost point (as matte.py starts).
  let start = 0;
  for (let i = 1; i < edge.length; i++) {
    const [x, y] = edge[i]!;
    const [bx, by] = edge[start]!;
    if (y < by || (y === by && x < bx)) start = i;
  }
  const ring = [...edge.slice(start), ...edge.slice(0, start)];
  ring.push(ring[0]!);
  const along = [0];
  for (let i = 1; i < ring.length; i++) along.push(along[i - 1]! + Math.hypot(ring[i]![0] - ring[i - 1]![0], ring[i]![1] - ring[i - 1]![1]));
  const total = along[along.length - 1]!;
  if (!(total > 0)) return null;
  const out: number[] = [];
  let j = 0;
  for (let n = 0; n < points; n++) {
    const t = (n / points) * total;
    while (j < along.length - 2 && along[j + 1]! < t) j++;
    const span = along[j + 1]! - along[j]!;
    const f = span > 0 ? (t - along[j]!) / span : 0;
    const x = ring[j]![0] + (ring[j + 1]![0] - ring[j]![0]) * f;
    const y = ring[j]![1] + (ring[j + 1]![1] - ring[j]![1]) * f;
    // The centre of the pixel, as a share of the picture.
    out.push(Math.round(((x + 0.5) / w) * 1000) / 1000, Math.round(((y + 0.5) / h) * 1000) / 1000);
  }
  return out;
}
