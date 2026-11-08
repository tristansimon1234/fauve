import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, type EditPlan } from "./schemas.ts";
import { fontOrColorOnly, parsesAsJs, readSource, rewriteFamilies, rewriteTextColors, withReelFonts } from "./reel-fonts.ts";
import { FAUVE_SYSTEM_PROMPT } from "./prompts.ts";
import { toolSpecs } from "./tools.ts";
import { APP_GUIDES } from "./app-guide.ts";

// Tristan, 7 November, « Met ma police please » on « Novembre, version cocon »: a whole paid correction (6 credits, editor
// and motion designer again: 0,77 €) for « J'ai remis ta police partout… le reste du Reel ne bouge pas ».

/** A motion designer's composition that names its families and its texts' colours in its code. */
const CODE = String.raw`function Scene({ width, height, brand, reelTexts, shots }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  // A title in 'Bebas Neue', as the copied Reel ("Bebas Neue" in a comment stays).
  const TITLE = "'Bebas Neue', 'Impact', sans-serif";
  const INK = "#fff3df";
  const quote = /['"]+/g;
  const label = ` + "`Bebas Neue est la police ${frame}`" + String.raw`;
  const half = width / 2 / 1;
  return h(AbsoluteFill, null,
    h("div", { style: { fontFamily: TITLE, fontSize: 120, color: INK } }, reelTexts[0] ? reelTexts[0].text : label.replace(quote, "")),
    h("div", { style: { fontFamily: "'" + brand.bodyFont + "', sans-serif", fontSize: 40, color: "#ffffff", backgroundColor: "#000000" } }, "Anton"),
    h("div", { style: { fontFamily: "Anton", left: half, color: "#ffffff" } }, "x"),
    h("div", { style: { backgroundColor: "#222222", color: "#ff0000" } }));
}`;

const plan = (over: Partial<EditPlan> = {}): EditPlan =>
  editPlanSchema.parse({
    format: "9:16",
    duration: 12,
    template: "libre",
    segments: [{ clip_id: "a", in: 0, out: 4 }],
    texts: [
      { text: "Novembre, on rentre", from: 0, to: 2.5, style: "hook", look: { font: "Inter Tight", weight: 600, italic: false, uppercase: false, size: 46, letter_spacing: 0, line_height: 1.25, color: "#FFFFFF", align: "center", shadow: "strong", rotate: 0, enter: "fade" } },
      { text: "Ce soir, on reste au chaud", from: 4, to: 7, style: "caption" },
      { text: "chaud", from: 8, to: 9, style: "caption", font: "Caveat" },
    ],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    fonts: { display: "Playfair Display", body: "Lato" },
    layers: [{ from: 0, to: 12, compose: true, motion: { brief: "la rue, la bougie, le salon", code: CODE, js: CODE, fonts: ["Bebas Neue", "Anton"], draws_texts: true } }],
    ...over,
  });

test("A composition's code is read: its strings, templates, comments and regular expressions", () => {
  const read = readSource(CODE)!;
  assert.ok(read);
  const strings = read.literals.map((l) => CODE.slice(l.start, l.end));
  assert.ok(strings.includes("'Bebas Neue', 'Impact', sans-serif"));
  assert.ok(strings.includes("Bebas Neue est la police "));
  assert.ok(!strings.some((s) => s.includes("in a comment")));
  assert.equal(readSource('const a = "never closed'), null);
  assert.ok(parsesAsJs(CODE));
  // « ci++ / n » is a division (« Interface » had read a regular expression there, and then nothing).
  const division = readSource('const o = (ci++ / mx(1, n)) * 2; const s = "Anton";')!;
  assert.deepEqual(division.literals.map((l) => 'const o = (ci++ / mx(1, n)) * 2; const s = "Anton";'.slice(l.start, l.end)), ["Anton"]);
});

test("Every composition of Edith's models reads, and stays valid once its families and colours are changed", async () => {
  const { MONTAGE_SKILLS } = await import("./skill-library.ts");
  for (const skill of Object.values(MONTAGE_SKILLS)) {
    assert.ok(readSource(skill.code), skill.key);
    if (!parsesAsJs(skill.code)) continue;
    assert.ok(parsesAsJs(rewriteFamilies(skill.code, { Anton: "Instrument Serif", "Inter Tight": "Lato" }).code), skill.key);
    assert.ok(parsesAsJs(rewriteTextColors(skill.code, "#FFD400").code), skill.key);
  }
});

test("Its families are changed only where a string names them as a family", () => {
  const r = rewriteFamilies(CODE, { "Bebas Neue": "Instrument Serif", Anton: "Instrument Serif" });
  assert.deepEqual(r.replaced.sort(), ["Anton", "Bebas Neue"]);
  assert.ok(r.code.includes(`const TITLE = "'Instrument Serif', 'Impact', sans-serif";`));
  assert.ok(r.code.includes(`fontFamily: "Instrument Serif"`));
  // Words that are not a family, a comment, a word of text written by the Reel: never changed.
  assert.ok(r.code.includes("`Bebas Neue est la police ${frame}`"));
  assert.ok(r.code.includes(`("Bebas Neue" in a comment stays)`));
  assert.ok(parsesAsJs(r.code));
  // A string that is only the word « Anton » as text: a family position (the whole literal), changed too: accepted.
  assert.equal(rewriteFamilies(CODE, {}).code, CODE);
  assert.equal(rewriteFamilies(CODE, { "Bebas Neue": "Bebas Neue" }).replaced.length, 0);
  // A new name that is not a family name is never written in code.
  assert.equal(rewriteFamilies(CODE, { "Bebas Neue": `x"; alert(1); "` }).replaced.length, 0);
});

test("Its texts' colour is changed where a style with a font holds it, never a background nor a shape", () => {
  const r = rewriteTextColors(CODE, "#FFD400");
  assert.equal(r.count, 3);
  assert.ok(r.code.includes(`const INK = "#FFD400";`));
  assert.ok(r.code.includes(`backgroundColor: "#000000"`));
  assert.ok(r.code.includes(`{ backgroundColor: "#222222", color: "#ff0000" }`));
  assert.ok(parsesAsJs(r.code));
  // A colour passed in (« color » given to a function) or computed: nothing to change.
  const passed = String.raw`function Scene({ brand }) { const words = (color) => h("div", { style: { fontFamily: brand.displayFont, color } }); const TUBE = warm ? "#fff3df" : "#ffe1dc"; return words(TUBE); }`;
  assert.equal(rewriteTextColors(passed, "#FFD400").count, 0);
  assert.equal(rewriteTextColors(CODE, "jaune").count, 0);
});

test("Her charter back on a Reel: its fonts, its texts by role, its composition's families, nothing else", () => {
  const before = plan();
  const shown = { display: "Playfair Display", body: "Lato" };
  const charter = { display: "Instrument Serif", body: "Inter Tight" };
  const r = withReelFonts(before, { charter: true }, shown, charter);
  assert.equal(r.changed, true);
  assert.equal(r.plan.fonts, undefined);
  // Its texts on her two fonts by role; a word in a font of its own in hers.
  assert.equal(r.plan.texts[0]!.look!.font, "brand_display");
  assert.equal(r.plan.texts[2]!.font, undefined);
  assert.equal(r.plan.texts[1], before.texts[1]);
  // Its composition: the families its code names changed to her title font, no longer loaded apart.
  assert.deepEqual(r.rewritten, [0]);
  const motion = r.plan.layers![0]!.motion;
  assert.ok(motion.code!.includes(`"'Instrument Serif', 'Impact', sans-serif"`));
  assert.ok(motion.js!.includes(`"'Instrument Serif', 'Impact', sans-serif"`));
  assert.equal(motion.fonts, undefined);
  // Nothing else of the Reel moves.
  assert.deepEqual(r.plan.segments, before.segments);
  assert.equal(r.plan.duration, before.duration);
  assert.equal(r.plan.layers![0]!.motion.brief, before.layers![0]!.motion.brief);
  assert.ok(editPlanSchema.safeParse(r.plan).success);
});

test("A font asked, a text colour asked, and a skill's code never rewritten", () => {
  const before = plan();
  const shown = { display: "Playfair Display", body: "Lato" };
  const r = withReelFonts(before, { display: "Anton", color: "#FFD400" }, shown, { display: "Anton", body: "Lato" });
  assert.deepEqual(r.plan.fonts, { display: "Anton", body: "Lato" });
  assert.equal(r.plan.texts[0]!.look!.color, "#FFD400");
  assert.ok(r.plan.layers![0]!.motion.code!.includes(`const INK = "#FFD400";`));
  assert.equal(r.colorMissed, false);
  // Anton was loaded apart and is now its title font: no longer loaded apart.
  assert.equal(r.plan.layers![0]!.motion.fonts, undefined);
  // A Reel played on a skill: its code reads her fonts (brand.displayFont), never rewritten; only the plan's fonts.
  const skilled = plan({ skill: { key: "petites-lumieres", version: 3 } } as Partial<EditPlan>);
  const s = withReelFonts(skilled, { charter: true }, shown, { display: "Instrument Serif", body: "Inter Tight" });
  assert.deepEqual(s.rewritten, []);
  assert.equal(s.plan.layers![0]!.motion.code, CODE);
  assert.equal(s.plan.fonts, undefined);
  // A colour its composition computes: said (colorMissed), its code kept.
  const computed = plan({ layers: [{ from: 0, to: 12, compose: true, motion: { brief: "x", code: "function Scene({ brand }) { return h('div', { style: { fontFamily: brand.displayFont, color: brand.palette.dark } }); }", draws_texts: true } }] });
  const c = withReelFonts(computed, { color: "#FFD400" }, shown, shown);
  assert.equal(c.colorMissed, true);
  assert.deepEqual(c.rewritten, []);
});

test("Edith sends a font or a colour to style_texts, free, never to a correction", () => {
  assert.ok(FAUVE_SYSTEM_PROMPT.includes("A font or a text colour (« remets ma police », « change la couleur du texte ») is style_texts, free, the Reel kept: never a correction."));
  assert.ok(FAUVE_SYSTEM_PROMPT.length < 12_000);
  assert.match(toolSpecs.style_texts.description, /jamais une correction/);
  assert.match(toolSpecs.montage.description, /ni sa police ou la couleur de ses textes : c'est style_texts/);
  assert.equal(toolSpecs.style_texts.input.parse({ post_id: "6a6ad050-75d8-462c-872a-583262c505e9", charter: "fonts" }).charter, "fonts");
  assert.match(APP_GUIDES.editeur_reel, /remets ma police/);
  // A look that only changes a font or a colour takes the free path on a Reel that draws its texts; anything else does not.
  assert.equal(fontOrColorOnly({ font: "Anton" }), true);
  assert.equal(fontOrColorOnly({ color: "#FFD400", emphasis: { color: "#000000" } }), true);
  assert.equal(fontOrColorOnly({ font: "Anton", size: 80 }), false);
  assert.equal(fontOrColorOnly({ fill: { kind: "box" } }), false);
  assert.equal(fontOrColorOnly(undefined), false);
});
