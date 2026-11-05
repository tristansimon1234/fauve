import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { pieceLine, pieceShots, piecesOffered, pieceTestPlan } from "../pieces.ts";
import { editPlanSchema, type ClipAnalysis } from "../schemas.ts";
import { clearPassages, objectPassages, readPassages, subjectShots } from "../subject.ts";
import { titleMarks, titreDerriere } from "./titre-derriere.ts";

// « Son nom derrière le décor », the effect of the bank (titre-derriere.ts): its own checks, beside the bank's
// (features.test.ts). Its code is run at a frame with a stand-in scope (each kit piece a named node, its readings
// given), so what it lays and where is read without a browser.

type Node = { type: unknown; props: Record<string, unknown>; children: unknown[] };
type Box = { x: number; y: number; w: number; h: number };
/** What is read on her stage: where her sky ends between two x, her clearest area, the light under the title, the pieces of what its filler named. */
type Reads = { sky?: (from: number, to: number, frame: number) => number | null; clear?: Box | null; light?: { mean: number; high: number } | null; parts?: Box[] };

const BRAND = { name: "Café des Arts", accent: "#b5293f", accentInk: "#ffffff", palette: { secondary: "#b5293f", light: "#ffffff", dark: "#141414" }, displayFont: "Archivo Black", bodyFont: "Inter Tight" };
/** Her shots as its layer gets them: the lead shot that ended as it starts, her wide shot under all of it (90 images, 3 s at 100 BPM), the next one. */
const SHOTS = [
  { from: -36, durationInFrames: 36, kind: "video", aspect: 16 / 9 },
  { from: 0, durationInFrames: 90, kind: "video", aspect: 16 / 9 },
  { from: 90, durationInFrames: 54, kind: "video", aspect: 16 / 9 },
];
const MARKS = { beat: "18", hit: "9", chase: "37", wave: "54" };

function sceneAt(frame: number, words: Record<string, string>, reads: Reads = {}, props: Record<string, unknown> = {}): Node | null {
  const h = (type: unknown, p: Record<string, unknown> | null, ...children: unknown[]): Node => ({ type, props: p ?? {}, children: children.flat() });
  const scope: Record<string, unknown> = {
    React: { createElement: h, Fragment: "Fragment" },
    useCurrentFrame: () => frame,
    AbsoluteFill: "AbsoluteFill",
    FitText: "FitText",
    Skyline: "Skyline",
    Subject: "Subject",
    SkylineAt: (_shot: unknown, f: number, _laid: unknown, span: { from: number; to: number }) => reads.sky?.(span.from, span.to, f) ?? null,
    ClearBox: (_shot: unknown, _f: number, _laid: unknown, options: { fallback?: Box | null }) => (reads.clear !== undefined ? reads.clear : (options.fallback ?? null)),
    LightUnder: () => reads.light ?? null,
    SubjectParts: () => reads.parts ?? [],
  };
  const Scene = new Function(...Object.keys(scope), `${titreDerriere.code}\nreturn Scene;`)(...Object.values(scope)) as (p: unknown) => Node | null;
  return Scene({ width: 1080, height: 1920, durationInFrames: 90, brand: BRAND, shots: SHOTS, texts: { ...MARKS, ...words }, ...props });
}
const nodes = (n: unknown): Node[] => (n && typeof n === "object" && "children" in n ? [n as Node, ...(n as Node).children.flatMap(nodes)] : []);
const styleOf = (n: Node | undefined) => (n?.props.style ?? {}) as Record<string, number | string>;
/** Its title's box: where its foot is (the box's bottom) and its width. */
const titleBox = (tree: Node | null) => {
  const s = styleOf(nodes(tree).find((n) => n.type === "FitText"));
  return { left: Number(s.left), width: Number(s.width), foot: Number(s.top) + Number(s.height) };
};
const drawsSkyline = (tree: Node | null) => nodes(tree).some((n) => n.type === "Skyline");
/** The kit pieces it lays, in the order they are painted (the later over the earlier). */
const painted = (tree: Node | null) => nodes(tree).flatMap((n) => (typeof n.type === "string" && /^[A-Z]/.test(n.type) && n.type !== "AbsoluteFill" ? [n.type] : []));
/** The letters drawn in the wave's white at a frame. */
const lit = (tree: Node | null) => nodes(tree).filter((n) => n.type === "span" && styleOf(n).color === "#FCF8F9").map((n) => n.children.join(""));
/** A skyline of eight eighths across its width (the columns its code reads, x 50 to 1030), from their tops. */
const eighths = (tops: number[]) => (from: number) => tops[Math.max(0, Math.min(7, Math.floor((from - 50) / 122.5 + 1e-6)))] ?? null;

test("« Son nom derrière le décor » (effect v1): its layer over her wide shot, its marks on the beat, its whoosh into the hit, its decor named for its shot", () => {
  const shots = [
    { file: "lead", at: 1, seconds: 1.2 },
    { file: "wide", at: 0.5, seconds: 3 },
    { file: "after", at: 2, seconds: 1.8 },
  ];
  const fill = { texts: { titre: "Montmartre", surtitre: "un samedi à" }, objects: { decor: "every rooftop" }, settings: {} };
  const plan = pieceTestPlan({ piece: titreDerriere, shots, span: [1.2, 4.2], fill, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  assert.deepEqual(checkMotionCode(titreDerriere.code), []);
  const motion = plan.layers![0]!.motion;
  // Its decor followed on the shot under it (the second of her shots) only; her never cut out (Skyline passes her in front).
  assert.deepEqual(motion.drawn, { shots: 3, objects: [{ shot: 1, name: "every rooftop" }] });
  assert.deepEqual(subjectShots(plan).size, 0);
  assert.deepEqual(
    objectPassages(plan, () => true).map((p) => [p.clip_id, p.from, p.to, p.name]),
    [["wide", 0.5, 3.5, "every rooftop"]],
  );
  // Her sky read on it (its ground for Skyline, its skyline, its light), and its clearest area.
  assert.deepEqual(
    readPassages(plan, () => true).map((p) => [p.clip_id, p.kinds]),
    [["wide", ["ground", "light", "sky"]]],
  );
  assert.deepEqual(clearPassages(plan, () => true).map((p) => p.clip_id), ["wide"]);
  // Its marks at 100 BPM (a beat is 18 images) over 3 s of her shot (5 beats): the hit half a beat in, the paper on the
  // music's return two beats in (an image after it, as the model's), the wave a beat later.
  assert.deepEqual([motion.texts!.beat, motion.texts!.hit, motion.texts!.chase, motion.texts!.wave], ["18", "9", "37", "54"]);
  assert.equal(motion.texts!.titre, "Montmartre");
  // Its one sound, the model's: the low whoosh whose hit lands on the title's (0,3 s in), within its span.
  assert.deepEqual(motion.sounds, [{ at: 0.3, sound: "low whoosh rising into a deep bass hit", seconds: 1, gain: 2, skill: true }]);
  assert.deepEqual(motion.fonts, ["Nothing You Could Do"]);
  // Its small words are optional: left out, none drawn.
  const bare = pieceTestPlan({ piece: titreDerriere, shots, span: [1.2, 4.2], fill: { texts: { titre: "Montmartre" }, objects: {}, settings: {} }, bpm: 100 });
  assert.equal(bare.layers![0]!.motion.texts!.surtitre, undefined);
  assert.equal(bare.layers![0]!.motion.drawn, undefined);
  const tree = sceneAt(30, { titre: "Montmartre" }, { sky: () => 700 });
  assert.equal(nodes(tree).filter((n) => "data-fauve-accent" in n.props).length, 0);
  // Its small words between two crosses, a label beside its title: their capitals 41 % of its own (106 px type), smaller
  // when their line would be wider than its name (« Lune »: 66 px), so its name sets the size of its box.
  const small = (titre: string, surtitre: string) => nodes(sceneAt(30, { titre, surtitre }, { sky: () => 700 })).find((n) => "data-fauve-accent" in n.props)!;
  assert.deepEqual(small("Montmartre", "un samedi à").children, ["++ un samedi à ++"]);
  assert.equal(styleOf(small("Montmartre", "un samedi à")).fontSize, 106);
  assert.equal(styleOf(small("Lune", "bienvenue chez")).fontSize, 66);
  // The editor's line: one wide still shot, 2,5 to 6 s, its words.
  assert.match(pieceLine(titreDerriere), /^titre-derriere — Son nom derrière le décor : .* Il faut : .* Se pose : sur un seul de ses plans.*\(2,5 à 6 s\)\. Ses mots : .*\(12 signes au plus\) ; .*\(18 signes au plus, facultatif\)\.$/);
});

test("« Son nom derrière le décor »: the model's beats on a stage of its section or more, the paper and the wave later by whole beats, closer on a shorter one", () => {
  assert.deepEqual(titleMarks(90, 18), { hit: 9, chase: 37, wave: 54 });
  // 6 s at 100 BPM (10 beats): the title held behind its scenery five beats longer, the wave still 2 beats before the cut.
  assert.deepEqual(titleMarks(180, 18), { hit: 9, chase: 127, wave: 144 });
  // 2,5 s at 60 BPM (2,5 beats): run closer, in proportion.
  assert.deepEqual(titleMarks(75, 30), { hit: 8, chase: 34, wave: 49 });
  // Over every tempo and length it takes: in order, the paper before the wave, the wave of its longest name (12 letters,
  // 1,6 images each at the quickest) done before the cut, the model's beats once its stage is as long as its section.
  for (let bpm = 60; bpm <= 140; bpm += 5) {
    for (let seconds = titreDerriere.seconds[0]; seconds <= titreDerriere.seconds[1] + 1e-9; seconds += 0.25) {
      const frames = Math.round(seconds * 30);
      const beat = 1800 / bpm;
      const m = titleMarks(frames, beat);
      assert.ok(m.hit >= 2 && m.hit < m.chase && m.chase < m.wave, `${bpm} BPM, ${seconds} s: ${JSON.stringify(m)}`);
      assert.ok(m.wave + 12 * 1.6 <= frames, `${bpm} BPM, ${seconds} s: its wave ends at ${m.wave + 12 * 1.6}, its cut at ${frames}`);
      if (frames / beat >= 4.55) assert.ok(Math.abs(m.wave - m.chase - beat) <= 2 && Math.abs(m.hit - beat / 2) <= 0.5, `${bpm} BPM, ${seconds} s`);
    }
  }
  // Its timeline gives them from its stage's start: a shot that only ends under its first image is not its stage.
  const line = titreDerriere.timeline!({ frames: 90, bpm: 100, shots: [{ from: -40, frames: 41 }, { from: 1, frames: 89 }], words: {}, settings: {} });
  assert.deepEqual(line.marks, { hit: 10, chase: 38, wave: 55 });
  assert.deepEqual(line.sounds?.map((s) => s.at), [0.333]);
  // Its code's defaults are its timeline's: drawn without its marks, it lays the same thing at every image.
  const reads: Reads = { sky: eighths([700, 700, 700, 640, 640, 700, 700, 700]), light: { mean: 0.5, high: 0.8 }, parts: [{ x: 100, y: 600, w: 200, h: 300 }] };
  for (const f of [0, 7, 9, 12, 37, 40, 54, 60, 89]) {
    assert.deepEqual(sceneAt(f, { titre: "Paris", surtitre: "un samedi à" }, reads), sceneAt(f, { titre: "Paris", surtitre: "un samedi à", hit: "", chase: "", wave: "" }, reads), `image ${f}`);
  }
  // Gone with the cut, even when its span was rounded an image over the next shot (nothing shows there, never nothing at all).
  const past = sceneAt(89, { titre: "Paris" }, reads, { durationInFrames: 91 });
  assert.ok(past && sceneAt(90, { titre: "Paris" }, reads, { durationInFrames: 91 })!.children.length === 0 && painted(past).includes("FitText"));
  assert.equal(sceneAt(30, { titre: "" }, reads), null);
});

test("« Son nom derrière le décor »: its title behind her scenery, the line of her roofs cutting the feet of its letters, a tower deeper, never two letters hidden", () => {
  const at = (tops: ((from: number, to: number) => number | null) | null, title = "Montmartre", extra: Reads = {}) => sceneAt(30, { titre: title, surtitre: "un samedi à" }, { ...(tops ? { sky: tops } : {}), ...extra });
  // A flat roofline at 700 px: its foot a sixth of its capitals under it (98 px capitals for ten letters across 980 px),
  // across 90,7 % of the width, her scenery (Skyline) laid over it.
  const flat = at(() => 700);
  assert.deepEqual(titleBox(flat), { left: 50, width: 980, foot: 716 });
  assert.deepEqual(painted(flat), ["FitText", "Skyline"]);
  // Laid across its band only (from its small words down to where it rises from: 0,7 of its capitals), at its own edge.
  const front = styleOf(nodes(flat).find((n) => n.children.some((c) => (c as Node)?.type === "Skyline")));
  assert.deepEqual([front.filter, front.clipPath], [undefined, "inset(387px 0 1058px 0)"]);
  // The original's city: two towers (560 and 600 px) over a lower town (900): its foot half a capital under the second
  // highest (89 px capitals for « LOS ANGELES »), the town under it.
  assert.equal(titleBox(at(eighths([900, 900, 900, 560, 600, 900, 900, 900]), "Los Angeles")).foot, 645);
  // A lone spire through one letter: the roofline still cuts the others' feet.
  assert.equal(titleBox(at(eighths([700, 700, 700, 300, 700, 700, 700, 700]))).foot, 716);
  // Her street's facades up to the top on both sides: 70 % of the width, between them.
  const canyon = at((from, to) => (from < 160 || to > 920 ? 40 : 700));
  assert.deepEqual(titleBox(canyon), { left: 162, width: 756, foot: 712 });
  assert.ok(drawsSkyline(canyon));
  // A tree reaching the middle of the frame: within the apps' margins, its crown cutting the feet of the middle letters.
  const tree = at(eighths([1340, 1340, 1020, 1020, 1020, 1020, 1020, 1340]));
  assert.deepEqual(titleBox(tree), { left: 140, width: 800, foot: 1033 });
  // Low hills under the safe zone: in her sky, as low as it may go across the width (nothing in front of it).
  assert.deepEqual(titleBox(at(() => 1650)), { left: 50, width: 980, foot: 911 });
  // A scenery up to the top everywhere, or no sky read: in front, on the bottom of her clearest area, else at the
  // original's place (41,3 % of the height).
  const high = at(() => 100, "Montmartre", { clear: { x: 100, y: 120, w: 880, h: 500 } });
  assert.equal(drawsSkyline(high), false);
  assert.equal(titleBox(high).foot, 620);
  assert.equal(titleBox(at(null)).foot, 793);
  assert.equal(drawsSkyline(at(null)), false);
});

test("« Son nom derrière le décor »: its glyphs within the safe zone, its foot above the apps' buttons across the width, 140 px from the sides under the middle", () => {
  const skylines: ((from: number, to: number) => number | null)[] = [
    () => 700,
    () => 320,
    () => 1200,
    () => 1700,
    eighths([1340, 1340, 1020, 1020, 1020, 1020, 1020, 1340]),
    eighths([900, 900, 900, 560, 600, 900, 900, 900]),
    (from, to) => (from < 160 || to > 920 ? 40 : 700),
  ];
  for (const sky of skylines) {
    for (const titre of ["Lune", "Montmartre", "Saint-Ouen"]) {
      for (const surtitre of ["", "un samedi à"]) {
        const tree = sceneAt(30, { titre, surtitre }, { sky });
        const { left, width, foot } = titleBox(tree);
        const caps = Math.min(192, Math.round(width / Math.max(4, titre.length)));
        const where = `${titre}, ${surtitre || "sans surtitre"}, ${sky(500, 600)}`;
        assert.ok(left >= 40 && left + width <= 1040, where);
        // Its capitals and its small words under the top margin.
        assert.ok(foot - (surtitre ? 1.65 : 1.35) * caps >= 80 - 1, `${where}: foot ${foot}`);
        // Across the width, its glyphs above the middle (the apps' buttons); lower, within their margins, above the bottom quarter.
        if (foot + 0.3 * caps > 940 + 1) assert.ok(left >= 140 && left + width <= 940 && foot + 0.3 * caps <= 1420 + 1, `${where}: ${left}, ${width}, ${foot}`);
      }
    }
  }
});

test("« Son nom derrière le décor »: it rises from below onto the hit, blurred, its small words an image later, then its wave one letter at a time", () => {
  const sky = () => 700;
  const titleOf = (f: number) => {
    const tree = sceneAt(f, { titre: "Le Marais", surtitre: "un samedi à" }, { sky });
    const wrap = styleOf(nodes(tree).find((n) => n.type === "div" && n.children.some((c) => (c as Node)?.type === "FitText")));
    const div = nodes(tree).find((n) => n.type === "div" && styleOf(n).fontWeight === 900)!;
    const small = nodes(tree).find((n) => "data-fauve-accent" in n.props)!;
    return { shown: wrap.opacity, lift: styleOf(div).transform, blur: styleOf(div).filter, small: styleOf(small).opacity, lit: lit(tree) };
  };
  // In the page from its first image, hidden until two images before the hit; then 0,65 of its capitals under its
  // place, blurred upwards, landing on the hit (the original's 44, 20, 6, 1 px).
  assert.equal(titleOf(0).shown, 0);
  assert.equal(titleOf(6).shown, 0);
  assert.deepEqual([titleOf(7).shown, titleOf(7).lift, titleOf(7).blur], [1, "translateY(124.2px)", "url(#tdb0)"]);
  assert.equal(titleOf(8).lift, "translateY(56.4px)");
  assert.deepEqual([titleOf(11).lift, titleOf(11).blur], ["translateY(0.0px)", "none"]);
  // Its small words fade in from the hit (26 %, 90 %).
  assert.deepEqual([8, 9, 10, 11].map((f) => titleOf(f).small), [0, 0.26, 0.9, 1]);
  // Its wave from its mark: each letter white in turn, never two at once, the space skipped, all of them before the cut.
  const seen: string[] = [];
  for (let f = 0; f < 90; f++) {
    const now = titleOf(f).lit;
    assert.ok(now.length <= 1, `image ${f}: ${now}`);
    if (f < 54) assert.deepEqual(now, []);
    if (now.length && seen.at(-1) !== now[0]) seen.push(now[0]!);
  }
  assert.deepEqual(seen.join(""), "LEMARAIS");
});

test("« Son nom derrière le décor »: its scenery in white paper, piece by piece left to right, six at most across its width; nothing named, no paper", () => {
  const sky = () => 700;
  const parts = [700, 100, 400, 250, 900, 550, 820, 330, 620].map((x) => ({ x, y: 600, w: 120, h: 400 }));
  const paperAt = (f: number, given: Box[]) => nodes(sceneAt(f, { titre: "Paris" }, { sky, parts: given })).find((n) => n.type === "Subject");
  // Nine named, six taken evenly across its width, from the left (each drawn by its place in what was read of its
  // object), 2 images each from its mark (an image after the music's return).
  const order: number[] = [];
  for (let f = 30; f < 60; f++) {
    const p = paperAt(f, parts);
    if (f < 37 || f >= 49) assert.equal(p, undefined, `image ${f}`);
    if (p && order.at(-1) !== p.props.part) order.push(p.props.part as number);
  }
  assert.deepEqual(order.map((k) => parts[k]!.x), [100, 330, 400, 620, 700, 900]);
  const piece = paperAt(37, parts)!;
  assert.deepEqual([piece.props.object, piece.props.slices, piece.props.fill], ["@decor", 5, "#EFEDE9"]);
  // At its depth: over the title where her scenery passes in front of it.
  assert.deepEqual(painted(sceneAt(37, { titre: "Paris" }, { sky, parts })), ["FitText", "Skyline", "Subject"]);
  // Three pieces: 3 images each.
  const three = parts.slice(0, 3);
  assert.deepEqual([37, 39, 40, 42, 43, 45, 46].map((f) => paperAt(f, three)?.props.part ?? null), [1, 1, 2, 2, 0, 0, null]);
  // Nothing named or found there: nothing turns white (no flash of the whole scenery).
  for (let f = 30; f < 60; f++) assert.deepEqual(painted(sceneAt(f, { titre: "Paris" }, { sky })), ["FitText", "Skyline"], `image ${f}`);
});

test("« Son nom derrière le décor »: her main colour when it stands out from her sky, else a deeper or lighter shade of it; its pen words white or in its colour", () => {
  const draw = (accent: string, mean: number) => {
    const tree = sceneAt(30, { titre: "Paris", surtitre: "un samedi à" }, { sky: () => 700, light: { mean, high: mean } }, { brand: { ...BRAND, accent } });
    const title = nodes(tree).find((n) => n.type === "div" && styleOf(n).fontWeight === 900)!;
    const small = nodes(tree).find((n) => "data-fauve-accent" in n.props)!;
    return { ink: String(styleOf(title).color), pen: String(styleOf(small).color), edge: String(styleOf(small).textShadow) };
  };
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const lum = (c: string) => {
    const [r, g, b] = rgb(c).map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const sky = (mean: number) => (mean <= 0.04045 ? mean / 12.92 : ((mean + 0.055) / 1.055) ** 2.4);
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const red = (c: string) => {
    const [r, g, b] = rgb(c);
    return r! > g! && r! > b!;
  };
  // Her raspberry on a bright sky: as it is; its pen words in its colour (white would not read there).
  assert.deepEqual(draw("#b5293f", 0.85), { ink: "#b5293f", pen: "#b5293f", edge: "none" });
  // On a grey sky of about its own light: a deeper shade of it (still red), 2,5:1 against it, as the original's blood
  // red; its pen words warm white with a tight dark edge.
  const grey = draw("#b5293f", 0.45);
  assert.ok(ratio(lum(grey.ink), sky(0.45)) >= 2.5 && lum(grey.ink) < lum("#b5293f") && red(grey.ink), grey.ink);
  assert.deepEqual([grey.pen, grey.edge], ["#FFF5ED", "0 0 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.3)"]);
  // Her pale pink on a bright sky: a deeper shade of it, still pink.
  const pink = draw("#f6b7c8", 0.85);
  assert.ok(ratio(lum(pink.ink), sky(0.85)) >= 2.5 && red(pink.ink), pink.ink);
  // Her navy on a night sky: a lighter shade of it.
  const navy = draw("#1f3a5f", 0.08);
  assert.ok(ratio(lum(navy.ink), sky(0.08)) >= 2.5 && lum(navy.ink) > lum("#1f3a5f"), navy.ink);
  // Its wave white on a dark title, a deep shade of it on a light one.
  const waveOn = (accent: string, mean: number) =>
    nodes(sceneAt(54, { titre: "Paris" }, { sky: () => 700, light: { mean, high: mean } }, { brand: { ...BRAND, accent } })).find((n) => n.type === "span" && n.children.join("") === "P");
  assert.equal(styleOf(waveOn("#b5293f", 0.85)).color, "#FCF8F9");
  const pale = String(styleOf(waveOn("#f6b7c8", 0.08)).color);
  assert.ok(pale !== "#FCF8F9" && red(pale), pale);
});

test("« Son nom derrière le décor » is offered for a wide still shot outdoors, never for an interior or a moving camera", () => {
  const clip = (setting: string, description: string, framing: "wide" | "medium", camera: "static" | "handheld") =>
    ({
      duration: 6,
      orientation: "landscape",
      summary: description,
      setting,
      lighting: "good",
      shots: [{ start: 0, end: 6, description, subject: "le lieu", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, framing, camera, subject_box: [0, 0, 1000, 1000], beauty: 4 }],
      best_moments: [],
      transcript: "",
    }) as unknown as ClipAnalysis;
  const offered = (setting: string, description: string, framing: "wide" | "medium", camera: "static" | "handheld") =>
    piecesOffered([titreDerriere], pieceShots([{ media_id: "a", analysis: clip(setting, description, framing, camera) }], {}), 1).map((p) => p.key);
  assert.deepEqual(offered("extérieur, les toits de Paris", "les toits et le ciel, vus d'une fenêtre", "wide", "static"), ["titre-derriere"]);
  assert.deepEqual(offered("intérieur d'une boutique", "la salle vue de l'entrée", "wide", "static"), []);
  assert.deepEqual(offered("extérieur, la rue", "la rue et ses façades", "wide", "handheld"), []);
  assert.deepEqual(offered("extérieur, la rue", "la rue et ses façades", "medium", "static"), []);
});
