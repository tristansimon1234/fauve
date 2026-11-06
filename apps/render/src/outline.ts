// Her subject's outline as an SVG path: its points (from its cut-out, image by image), placed by the caller where her
// shot is laid, joined by smooth curves, open where the picture's edge cuts her. Pure, no imports, so the tests read it;
// Effects.tsx places it (SubjectOutline) and draws it (Outline).

/** An object's name as the engine keeps it (packages/agent objectName): lower case, its spaces single. */
export const objectName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);

/** A point of an outline closer than this to the picture's edge (a share of it) lies on the edge. */
const EDGE = 0.004;

/**
 * The path through an outline's points (`c`: x, y shares of the picture, flat), each placed by `at` (shares → px):
 * Catmull-Rom curves (its corners rounded like a hand would draw them), closed when she is whole in the picture, else in
 * pieces between the edges (where the frame cuts her, her outline is the frame's: no line there). Null for too few points.
 */
export function outlinePath(c: number[], at: (x: number, y: number) => readonly [number, number]): string | null {
  if (c.length < 12) return null;
  const pts: (readonly [number, number])[] = [];
  const onEdge: boolean[] = [];
  for (let i = 0; i + 1 < c.length; i += 2) {
    pts.push(at(c[i]!, c[i + 1]!));
    onEdge.push(c[i]! <= EDGE || c[i]! >= 1 - EDGE || c[i + 1]! <= EDGE || c[i + 1]! >= 1 - EDGE);
  }
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  const whole = !onEdge.some(Boolean);
  let d = "";
  let open = false;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (onEdge[i] && onEdge[j]) {
      open = false;
      continue;
    }
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[j]!;
    const p3 = pts[(i + 2) % n]!;
    if (!open) d += `${d ? " " : ""}M ${f(p1[0])} ${f(p1[1])}`;
    open = true;
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d ? `${d}${whole ? " Z" : ""}` : null;
}
