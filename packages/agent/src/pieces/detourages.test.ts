import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "../schemas.ts";
import { pieceShots, pieceTestPlan, piecesOffered, readPieceFill } from "../pieces.ts";
import { ANY_SHOT, clearsDrawn, readsDrawn, subjectShots } from "../subject.ts";
import { checkMotionCode } from "../motion-scene.ts";
import { detourages, eyeTimeline } from "./detourages.ts";

// « L'œil qui s'ouvre », the effect of the bank (detourages.ts): its own checks, beside the bank's (features.test.ts).

/** Her shots as the chain cuts them: a lead shot, her wide still shot under the effect, the shot after it. */
const run = (seconds: number) => [
  { file: "lead", at: 1, seconds: 1.2 },
  { file: "wide", at: 0.5, seconds },
  { file: "after", at: 2, seconds: 1.8 },
];
const marksOf = (texts: Record<string, string>) => Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, Number(v)]));

test("« L'œil qui s'ouvre » (effect v2): its layer over one wide shot, her cut-out declared on it only, her name lit letter by letter, a tick on each flash", () => {
  const plan = pieceTestPlan({ piece: detourages, shots: run(4), span: [1.2, 5.2], fill: { texts: { nom: "Brighton" }, objects: {}, settings: {} }, bpm: 100 });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const motion = plan.layers![0]!.motion;
  assert.deepEqual(motion.piece, { key: "detourages", version: 2 });
  // Her cut-out on its shot alone (the second of her shots), for her name behind what stands before her wall.
  assert.deepEqual(motion.drawn, { shots: 3, subjects: [1] });
  assert.deepEqual([...subjectShots(plan)], [1]);
  const marks = marksOf(motion.texts!);
  assert.equal(motion.texts!.nom, "Brighton");
  assert.equal(marks.beat, 18);
  // Black for an image, the eye open a little after the first flash, the whole name lit long enough to read it before the cut.
  const frames = 120;
  assert.equal(marks.eye_from, 1);
  assert.ok(marks.name! > marks.eye_from! && marks.eye_to! > marks.name! && marks.eye_to! < marks.lit!, JSON.stringify(marks));
  assert.ok(frames - marks.lit! >= 36, `${frames - marks.lit!} images lit`);
  // Each of its 8 letters flashes, goes dark, then lights for good, by the whole name's moment; out of order.
  const letters = Array.from({ length: 8 }, (_, k) => ({ fl: marks[`fl${k}`]!, dk: marks[`dk${k}`]!, on: marks[`on${k}`]! }));
  for (const l of letters) assert.ok(l.fl >= marks.name! && l.fl < l.dk && l.dk <= l.on && l.on <= marks.lit!, JSON.stringify(l));
  const order = [...letters.keys()].sort((a, b) => letters[a]!.fl - letters[b]!.fl);
  assert.notDeepEqual(order, [...letters.keys()]);
  // Faster and faster: the first gap between two flashes is wider than the last.
  const flashes = [...new Set(letters.map((l) => l.fl))].sort((a, b) => a - b);
  assert.ok(flashes[1]! - flashes[0]! > flashes.at(-1)! - flashes.at(-2)!, JSON.stringify(flashes));
  // A tick on each flash and when the whole name is lit, within its span.
  assert.equal(motion.sounds!.length, flashes.length + 1);
  for (const s of motion.sounds!) assert.ok(s.at >= 0 && s.at < 4 && s.sound === "soft high glass tick" && s.skill, JSON.stringify(s));
  assert.equal(motion.sounds!.at(-1)!.at, Math.round((marks.lit! / 30) * 1000) / 1000);
});

test("« L'œil qui s'ouvre »: its moments hold over every length it takes, at any tempo, for one letter or twelve", () => {
  for (const seconds of [2.5, 3, 4, 5, 6]) {
    for (const bpm of [60, 90, 100, 120, 140]) {
      for (const nom of ["A", "Lune", "Le Marais", "Boulangeries"]) {
        const frames = Math.round(seconds * 30);
        const { marks, sounds, cutouts, music } = eyeTimeline({ frames, bpm, words: { nom } });
        const at = `${seconds} s, ${bpm} BPM, « ${nom} »: ${JSON.stringify(marks)}`;
        assert.ok(Object.values(marks).every((v) => Number.isInteger(v) && v >= 0 && v <= frames), at);
        assert.ok(marks.eye_from! < marks.name! && marks.name! < marks.lit! && marks.eye_to! <= marks.lit!, at);
        // Its name at a fifth of its span at the earliest, its letters within a third of it.
        assert.ok(marks.name! >= Math.round(frames * 0.2) - 1 && marks.lit! - marks.name! <= Math.round(frames * 0.3) + 1, at);
        // Lit 1,2 s at least before the cut (its reading time, half its span at most).
        assert.ok(frames - marks.lit! >= Math.min(Math.round(frames * 0.5), 36), at);
        const count = nom.replace(/\s/g, "").length;
        for (let k = 0; k < count; k++) assert.ok(marks[`fl${k}`]! < marks[`dk${k}`]! && marks[`on${k}`]! <= marks.lit!, `${at} (letter ${k})`);
        assert.equal(marks[`fl${count}`], undefined, at);
        assert.ok(sounds.length >= 2 && sounds.length <= 16 && sounds.every((s) => s.at * 30 < frames - 1.5), at);
        assert.deepEqual(cutouts, [0]);
        // Her music muffled at first, opening with the eye until it is open, then softer to the cut.
        const [muffled, soft] = music.filters!;
        assert.deepEqual([muffled!.kind, muffled!.from, Math.round(muffled!.to * 30), muffled!.open], ["muffled", 0, marks.eye_to, Math.min(4, muffled!.to)], at);
        assert.deepEqual([soft!.kind, soft!.from, Math.round(soft!.to * 30), soft!.db], ["soft", muffled!.to, frames, -5], at);
      }
    }
  }
  // At its own tempo and length, the original's: its name's first flash past half its span, its letters at the original's pace (37 images).
  const own = eyeTimeline({ frames: 186, bpm: 140, words: { nom: "ICELAND" } }).marks;
  assert.equal(own.lit! - own.name!, 37);
  assert.ok(own.name! > 93 && own.eye_to! > own.name!, JSON.stringify(own));
});

test("« L'œil qui s'ouvre »: its name is required, its code reads her shot under it whatever its place in the Reel, plain JS within the bank's contract", () => {
  const answer = { fits: true, missing: "", texts: [{ slot: "nom", text: "Café Lune" }], objects: [], settings: [] };
  assert.deepEqual(readPieceFill(detourages, answer)!.texts, { nom: "Café Lune" });
  // Longer than its 12 places: cut after a whole word, never in one.
  assert.deepEqual(readPieceFill(detourages, { ...answer, texts: [{ slot: "nom", text: "Maison Farine" }] })!.texts, { nom: "Maison" });
  assert.equal(readPieceFill(detourages, { ...answer, texts: [] }), null);
  assert.deepEqual(checkMotionCode(detourages.code), []);
  // Its sky (Skyline and SkylineAt), its light and her clear wall read on the shot under it, written as a variable.
  const reads = readsDrawn(detourages.code);
  assert.deepEqual(reads, [{ shot: ANY_SHOT, kinds: ["ground", "light", "sky"] }]);
  assert.deepEqual(clearsDrawn(detourages.code), [ANY_SHOT]);
  // Its eye is the kit's, opened by its box at a constant pace (never Window's own eased opening).
  assert.match(detourages.code, /reveal: "eye"/);
  assert.match(detourages.code, /open: 0/);
  assert.doesNotMatch(detourages.code, /Math\.random|Date/);
});

test("« L'œil qui s'ouvre » is offered only over a wide shot filmed still (a photo counts), never over a pan or a close-up", () => {
  const shot = (framing: "wide" | "medium" | "close" | "detail", camera: "static" | "pan") => ({
    start: 0,
    end: 4,
    description: "les toits du quartier vus d'une fenêtre",
    subject: "toits",
    energy: 2,
    hook_score: 3,
    quality: { blurry: false, dark: false, shaky: false },
    faces_visible: false,
    framing,
    camera,
    subject_box: [0, 0, 1000, 1000],
    beauty: 4,
  });
  const clip = (framing: "wide" | "medium" | "close" | "detail", camera: "static" | "pan") =>
    ({ duration: 6, orientation: "landscape", summary: "les toits", setting: "extérieur, les toits du quartier", lighting: "good", shots: [shot(framing, camera)], best_moments: [], transcript: "" }) as never;
  const offered = (framing: "wide" | "medium" | "close" | "detail", camera: "static" | "pan") => piecesOffered([detourages], pieceShots([{ media_id: "a", analysis: clip(framing, camera) }], {}), 1).length;
  assert.equal(offered("wide", "static"), 1);
  assert.equal(offered("wide", "pan"), 0);
  assert.equal(offered("close", "static"), 0);
  const photo = { detection: { regions: [], notes: "la rue et ses toits sous le ciel" } } as never;
  assert.equal(piecesOffered([detourages], pieceShots([], { p: photo }), 1).length, 1);
});
