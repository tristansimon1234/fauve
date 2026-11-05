import assert from "node:assert/strict";
import { test } from "node:test";
import { MOTION_SCOPE } from "../motion-scene.ts";
import { editPlanSchema } from "../schemas.ts";
import { pieceTestPlan } from "../pieces.ts";
import { silhouette, typedName } from "./silhouette.ts";

// « La silhouette », the effect of the bank (silhouette.ts): its own checks, beside the bank's (features.test.ts).

const WORDS = { je: "Je suis", nom: "Héloïse", nom_famille: "Martin" };

test("« La silhouette » (effect v1): its layer over her profile, her cut-out on its shots, its marks on the beat, no sound", () => {
  for (const n of [1, 2]) {
    const shots = [
      { file: "lead", at: 1, seconds: 1.2 },
      ...Array.from({ length: n }, (_, i) => ({ file: "profile", at: 0.5 + i * 2, seconds: 4 / n })),
      { file: "after", at: 2, seconds: 1.8 },
    ];
    const plan = pieceTestPlan({ piece: silhouette, shots, span: [1.2, 5.2], fill: { texts: WORDS, objects: {}, settings: {} }, bpm: 100 });
    assert.ok(editPlanSchema.safeParse(plan).success);
    const motion = plan.layers![0]!.motion;
    // Her cut-out on each of its shots (her shots after the lead one), by their index among her shots; no object.
    assert.deepEqual(motion.drawn, { shots: n + 2, subjects: Array.from({ length: n }, (_, i) => i + 1) });
    // No sound of its own: its model's clicks are its opening's, and none could follow her head when it is measured.
    assert.equal(motion.sounds, undefined);
    assert.deepEqual(motion.piece, { key: "silhouette", version: 1 });
  }
  // Its marks on the Reel's beat, as the skill's after its cut on her (0,61, 0,845 and 1,92 beat), the word read first
  // (half a second at least), her name typed six images after the word starts going, her full name held 12 images.
  const marks = (bpm: number, words: Record<string, string> = WORDS) => {
    const plan = pieceTestPlan({ piece: silhouette, shots: [{ file: "profile", at: 0, seconds: 4 }], span: [0, 4], fill: { texts: words, objects: {}, settings: {} }, bpm });
    const t = plan.layers![0]!.motion.texts!;
    return [t.beat, t.head_down, t.type_at, t.last_out].map(Number);
  };
  assert.deepEqual(marks(100), [18, 15, 21, 44]);
  assert.deepEqual(marks(70), [25.714, 16, 22, 50]);
  assert.deepEqual(marks(130), [13.846, 15, 21, 44]);
  // Her last name is optional (a place's name stays whole): none written, a shorter name typed.
  const bare = pieceTestPlan({ piece: silhouette, shots: [{ file: "profile", at: 0, seconds: 4 }], span: [0, 4], fill: { texts: { je: "Voici", nom: "Maison Farine" }, objects: {}, settings: {} }, bpm: 100 });
  assert.equal(bare.layers![0]!.motion.texts!.nom_famille, undefined);
  assert.deepEqual(typedName({ nom: "Héloïse", nom_famille: "Martin" }).join(""), "Héloïse Martin");
  assert.deepEqual(typedName({ nom: "Maison Farine" }).length, 13);
  // Its words for the editor: its two required, its last name optional.
  assert.deepEqual(silhouette.texts.map((t) => [t.slot, t.max, t.required]), [["je", 10, true], ["nom", 16, true], ["nom_famille", 12, false]]);
});

// ——— Its code at a frame, the kit's pieces as named nodes ———————————————————————————————————————————————————————————

type Node = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Laid = { left: number; top: number; width: number; height: number };
type Box = { x: number; y: number; w: number; h: number };
const nodes = (n: unknown): Node[] =>
  Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === "object" && "children" in n ? [n as Node, ...(n as Node).children.flatMap(nodes)] : [];
const styleOf = (n: Node | undefined) => ((n?.props.style ?? {}) as Record<string, unknown>);
const byKey = (tree: Node, key: string) => nodes(tree).find((n) => n.props.key === key);
/** The words seen in a node: those of spans whose opacity (and their parents') is over a half. */
function seen(n: unknown, alpha = 1): string {
  if (typeof n === "string") return alpha > 0.5 ? n : "";
  if (Array.isArray(n)) return n.map((c) => seen(c, alpha)).join("");
  if (!n || typeof n !== "object" || !("children" in n)) return "";
  const node = n as Node;
  return node.children.map((c) => seen(c, alpha * Number(styleOf(node).opacity ?? 1))).join("");
}
/** The order of the root's pieces, by their key. */
const order = (tree: Node) => (tree.children as unknown[]).flat().filter(Boolean).map((c) => String((c as Node).props.key));

/**
 * Her profile, facing right, on her 16:9 video (shares of the picture): her head lowered by a tenth of the picture from
 * image 12 to 20, held, then raised a little higher than it was from image 70 to 80; her body cut by the bottom.
 */
const PROFILE: [number, number][] = [
  [0.47, 0.2], [0.53, 0.2], [0.58, 0.26], [0.6, 0.34], [0.62, 0.4], [0.59, 0.46], [0.58, 0.52], [0.56, 0.56],
  [0.65, 0.7], [0.65, 1], [0.35, 1], [0.37, 0.7], [0.44, 0.56], [0.42, 0.4], [0.43, 0.27],
];
const lowered = (f: number) => (f < 12 ? 0 : f < 20 ? ((f - 12) / 8) * 0.1 : f < 70 ? 0.1 : f < 80 ? 0.1 - ((f - 70) / 10) * 0.15 : -0.05);
/** Her profile at an image: `top` raises her head out of her picture (a close-up), `slide` moves her away to the left from image 60 to 80. */
const profileAt = (f: number, top = 0, slide = 0) =>
  PROFILE.map(([x, y]): [number, number] => [x - slide * Math.min(1, Math.max(0, (f - 60) / 20)), y <= 0.56 ? Math.max(0, y + lowered(f) - top) : y]);
type Read = { profile?: boolean; top?: number; slide?: number; heads?: { from: number; to: number; what: string }[]; light?: { mean: number; high: number } };
function drawAt(frame: number, read: Read = { profile: true }, brand: Record<string, unknown> = {}): Node {
  const React = { createElement: (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Node => ({ type, props: p ?? {}, children }), Fragment: "Fragment" };
  // Her profile is the second of her shots (after a lead shot that ended before it), its box and outline placed in the box it is laid in.
  const px = (pts: [number, number][], laid?: Laid) => pts.map(([x, y]) => [(laid?.left ?? 0) + x * (laid?.width ?? 1080), (laid?.top ?? 0) + y * (laid?.height ?? 1920)] as const);
  const hers = (shot: { segment?: number }) => read.profile && shot.segment === 1;
  const scope: Record<string, unknown> = Object.fromEntries(MOTION_SCOPE.filter((n) => n !== "React").map((n) => [n, n]));
  Object.assign(scope, {
    useCurrentFrame: () => frame,
    interpolate: (x: number, [a, b]: [number, number], [y0, y1]: [number, number], o?: { easing?: (t: number) => number }) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
      return y0 + (y1 - y0) * (o?.easing ? o.easing(t) : t);
    },
    interpolateColors: (x: number, [a, b]: [number, number], [c0, c1]: [string, string]) => (x <= a ? c0 : x >= b ? c1 : `mix(${c0},${c1})`),
    SubjectBox: (shot: { segment?: number }, f: number, laid?: Laid): Box | null => {
      if (!hers(shot)) return null;
      const p = px(profileAt(f, read.top, read.slide), laid);
      const xs = p.map((q) => q[0]);
      const ys = p.map((q) => q[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    },
    SubjectOutline: (shot: { segment?: number }, f: number, laid?: Laid) =>
      hers(shot) ? `M ${px(profileAt(f, read.top, read.slide), laid).map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z` : null,
    HeadMoves: () => read.heads ?? [],
    LightUnder: () => read.light ?? null,
  });
  const make = new Function("React", ...Object.keys(scope), `"use strict";\n${silhouette.code}\nreturn Scene;`) as (...args: unknown[]) => (p: Record<string, unknown>) => Node;
  const plan = pieceTestPlan({ piece: silhouette, shots: [{ file: "lead", at: 0, seconds: 1 }, { file: "profile", at: 0.5, seconds: 4 }], span: [1, 5], fill: { texts: WORDS, objects: {}, settings: {} }, bpm: 100 });
  const props = {
    width: 1080,
    height: 1920,
    durationInFrames: 120,
    brand: { name: "Atelier Rose", displayFont: "Inter Tight", bodyFont: "Inter Tight", accent: "#5b3fd9", palette: { secondary: "#5b3fd9", light: "#ffffff", dark: "#141414" }, ...brand },
    // Its shots as the layer gets them: the lead one, ended before it, then her profile over all of it.
    shots: [
      { segment: 0, from: -30, durationInFrames: 30, kind: "video", aspect: 16 / 9 },
      { segment: 1, from: 0, durationInFrames: 120, kind: "video", aspect: 16 / 9 },
    ],
    texts: plan.layers![0]!.motion.texts!,
    track: () => ({ hands: [], faces: [], bodies: [] }),
  };
  return make(React, ...Object.values(scope))(props);
}

test("« La silhouette » (effect v1): her silhouette of one tone, « Je suis » in her head, her name typed behind her, lifted when she raises her head", () => {
  // On the pale, her profile cut out and filled with one tone (the original's midnight and cold pale: her charter has
  // neither), her picture laid whole at its shape, her head a third of the frame's width, her body down to the bottom.
  const open = drawAt(0);
  assert.equal(styleOf(open).backgroundColor, "#f3f4f9");
  const her = nodes(open).find((n) => n.type === "Subject")!;
  assert.deepEqual([her.props.shot, her.props.fill], [1, "#0f0f1c"]);
  const laid = styleOf(her) as Record<string, number>;
  assert.ok(Math.abs(laid.width! / laid.height! - 16 / 9) < 0.01 && laid.top! + laid.height! >= 1920, JSON.stringify(laid));
  assert.ok(!nodes(open).some((n) => n.type === "Footage"));
  // « Je suis » in white in her head, kept inside her outline, sliding 13 px into place, then still.
  const je = byKey(open, "je")!;
  assert.equal(seen(je), "Je suis");
  assert.match(String(styleOf(je).clipPath), /^path\('M [\d.]+ [\d.]+ L /);
  const line = nodes(je).find((n) => n.type === "FitText")!;
  const inner = line.props.innerStyle as Record<string, unknown>;
  assert.equal(inner.color, "#ffffff");
  assert.ok(Number(inner.fontSize) >= 48);
  const left = (f: number) => Number(styleOf(nodes(byKey(drawAt(f), "je")!).find((n) => n.type === "FitText")).left);
  assert.equal(left(0) - left(8), 13);
  // As her head starts down (on the beat: 15 images at 100 BPM), its first letter in the cursor's colour (the original's
  // peach: her violet would not read on the midnight), its others going from its end, its last gone two images in;
  // the word gone six images in.
  const going = nodes(byKey(drawAt(17), "je")!).filter((n) => n.type === "span");
  assert.equal(styleOf(going[0]).color, "#d99868");
  assert.equal(styleOf(going.at(-1)).opacity, 0);
  assert.equal(byKey(drawAt(21), "je"), undefined);
  // Her name typed from image 21, 40 letters a second, laid before her (she passes in front of it), its cursor after her.
  assert.equal(byKey(drawAt(20), "name"), undefined);
  const typing = drawAt(23);
  assert.equal(seen(byKey(typing, "name")), "Hélo");
  assert.ok(order(typing).indexOf("name") < order(typing).indexOf("her") && order(typing).indexOf("her") < order(typing).indexOf("caret"));
  assert.equal(seen(byKey(typing, "caret")), "");
  assert.ok(nodes(byKey(typing, "caret")).some((n) => styleOf(n).background === "#d99868"));
  assert.equal(seen(byKey(drawAt(32), "name")), "Héloïse Martin");
  // In ink of her tone on the pale, on her hair: above her lowered head, within the frame's safe zone.
  const name = byKey(drawAt(40), "name")!;
  const box = styleOf(name) as Record<string, number>;
  assert.equal((name.props.innerStyle as Record<string, unknown>).color, "#0f0f1c");
  assert.ok(box.left! >= 140 && box.left! + box.width! <= 925 && box.top! >= 110 && box.top! + box.height! <= 1920 * 0.72, JSON.stringify(box));
  // (Her head's top at that image: a tenth of her picture lower than at the start, where it was at 42 % of the frame.)
  assert.ok(Math.abs(laid.top! + 0.2 * laid.height! - 1920 * 0.42) < 1, `${laid.top! + 0.2 * laid.height!}`);
  const headTop = laid.top! + (0.2 + 0.1) * laid.height!;
  assert.ok(box.top! + box.height! <= headTop + 12, `${box.top! + box.height!} over her head at ${headTop}`);
  // Her last name rises 10 px away (from image 44), her first name stays, the cursor back after it.
  const rising = nodes(byKey(drawAt(46), "name")!).find((n) => seen(n, 1) === " Martin" || n.props.key === "l")!;
  assert.ok(Number(styleOf(rising).opacity) < 1 && /translateY\(-\d+px\)/.test(String(styleOf(rising).transform)));
  assert.equal(seen(byKey(drawAt(50), "name")), "Héloïse");
  // When she raises her head (images 70 to 80, higher than it was), her head lifts her name with it, never over it.
  const y = (f: number) => Number(styleOf(byKey(drawAt(f), "name")).top);
  assert.equal(y(60), y(40));
  assert.ok(y(100) < y(60) - 150, `${y(100)} after ${y(60)}`);
});

test("« La silhouette » (effect v1): timed on her head when it is measured, in her charter, without her cut-out, without room above her head", () => {
  // Her head lowered as her tracks measure it (frames of its own clock): « Je suis » goes as it starts, her name six images in.
  const heads = [{ from: 40, to: 48, what: "down" }];
  assert.equal(seen(byKey(drawAt(39, { profile: true, heads }), "je")), "Je suis");
  assert.equal(byKey(drawAt(46, { profile: true, heads }), "je"), undefined);
  assert.equal(byKey(drawAt(45, { profile: true, heads }), "name"), undefined);
  assert.equal(seen(byKey(drawAt(46, { profile: true, heads }), "name")), "H");
  // In her charter: her pale, her dark for her silhouette and her name, her accent for its cursor when it reads on both.
  const charter = { accent: "#c0563b", palette: { secondary: "#c0563b", light: "#f6efe6", dark: "#1d2b22" } };
  const dressed = drawAt(25, { profile: true }, charter);
  assert.equal(styleOf(dressed).backgroundColor, "#f6efe6");
  assert.equal(nodes(dressed).find((n) => n.type === "Subject")!.props.fill, "#1d2b22");
  assert.ok(nodes(byKey(dressed, "caret")).some((n) => styleOf(n).background === "#c0563b"));
  // Without her cut-out: her shot as a hard black and white print on the pale (its threshold from her shot's light),
  // its words in ink of the tone with a tight pale edge (the fiche's « à l'encre sur le pâle »), her name where its word
  // was; white with an edge of the tone where her shot is dark under them.
  const bare = drawAt(0, {});
  assert.match(String(styleOf(nodes(bare).find((n) => n.type === "Footage")).filter), /grayscale\(1\) brightness\(1\.35\) contrast\(3\.2\)/);
  assert.equal(nodes(bare).find((n) => n.type === "Subject"), undefined);
  const ink = (tree: Node, key: string) => {
    const inner = nodes(byKey(tree, key)!).find((n) => n.type === "FitText")!.props.innerStyle as Record<string, unknown>;
    return [inner.color, /#f3f4f9/.test(String(inner.textShadow)) ? "pale edge" : /#0f0f1c/.test(String(inner.textShadow)) ? "tone edge" : "none"];
  };
  assert.deepEqual(ink(bare, "je"), ["#0f0f1c", "pale edge"]);
  assert.deepEqual(ink(drawAt(40, {}), "name"), ["#0f0f1c", "pale edge"]);
  assert.deepEqual(ink(drawAt(40, { light: { mean: 0.5, high: 0.9 } }), "name"), ["#0f0f1c", "pale edge"]);
  assert.deepEqual(ink(drawAt(40, { light: { mean: 0.1, high: 0.3 } }), "name"), ["#ffffff", "tone edge"]);
  assert.match(String(styleOf(nodes(drawAt(0, { light: { mean: 0.25, high: 0.6 } })).find((n) => n.type === "Footage")).filter), /brightness\(2\.00\)/);
  // On her silhouette, white with an edge of her tone (unseen on her, read off her).
  assert.deepEqual(ink(drawAt(0), "je"), ["#ffffff", "tone edge"]);
  // Her picture cutting her head (a close-up): her picture's top on the frame's, covering it, her name in her head,
  // after her, moving with her head (lowered here, then raised again).
  const cut = { profile: true, top: 0.2 };
  const close = drawAt(40, cut);
  const closeLaid = styleOf(nodes(close).find((n) => n.type === "Subject")) as Record<string, number>;
  assert.deepEqual([closeLaid.top, closeLaid.height], [0, 1920]);
  assert.ok(order(close).indexOf("her") < order(close).indexOf("name"));
  assert.equal((byKey(close, "name")!.props.innerStyle as Record<string, unknown>).color, "#ffffff");
  const inHead = (f: number) => Number(styleOf(byKey(drawAt(f, cut), "name")).top);
  assert.ok(inHead(40) - inHead(100) > 150, `${inHead(40)} then ${inHead(100)}`);
  // She turns away (her silhouette sliding left): her first name, alone once her last name has gone, stays inside her
  // across its line, never astride her edge.
  const away = { profile: true, top: 0.2, slide: 0.12 };
  for (const f of [90, 100, 110]) {
    const late = drawAt(f, away);
    const row = byKey(late, "name")!;
    const size = Number((row.props.innerStyle as Record<string, unknown>).fontSize);
    const rowBox = styleOf(row) as Record<string, number>;
    const herBox = styleOf(nodes(late).find((n) => n.type === "Subject")) as Record<string, number>;
    const y = rowBox.top! + size * 0.65;
    const pts = profileAt(f, 0.2, 0.12).map(([x, v]) => [herBox.left! + x * herBox.width!, herBox.top! + v * herBox.height!] as const);
    const xs = pts
      .flatMap((a, k) => {
        const b = pts[(k + 1) % pts.length]!;
        return a[1] <= y !== b[1] <= y ? [a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])] : [];
      })
      .sort((p, q) => p - q);
    const firstHalf = ("Héloïse".length * size * 0.56) / 2;
    const firstCentre = rowBox.left! + rowBox.width! / 2 - (" Martin".length * size * 0.56) / 2;
    assert.ok(firstCentre - firstHalf >= xs[0]! && firstCentre + firstHalf <= xs.at(-1)! && firstCentre - firstHalf >= 139, `image ${f}: ${firstCentre - firstHalf} to ${firstCentre + firstHalf}, her span ${xs[0]} to ${xs.at(-1)}`);
  }
  // Words to read at 48 px at least, at every frame.
  for (const f of [0, 15, 23, 32, 50, 100]) for (const n of nodes(drawAt(f)).filter((m) => m.type === "FitText")) assert.ok(Number((n.props.innerStyle as Record<string, unknown>).fontSize) >= 48, `image ${f}`);
});
