import assert from "node:assert/strict";
import { test } from "node:test";
import { beyondSkills } from "./copy-model.ts";
import { CONTRACT_PROMPT, contractLines, EMPTY_CONTRACT, formatAsked, formatOnly, fullFrameAsked, settleFrame, type ReelContract } from "./contract.ts";
import { MONTAGE_SKILLS } from "./skill-library.ts";
import { playedSettings, replaySkillAudio, settingWords, SKILL_FILL_PROMPT, SKILL_FORMAT, skillBand, skillFillInput, skillFramed, skillPlan, type MontageSkill } from "./skills.ts";

// Vertical by default for every model (Tristan, 6 November, on seven benches of /admin: « vertical please », « tout
// vertical please », « vertical serait mieux », « encore une fois à mettre en vertical »): with nothing asked, a model
// fills the 9:16 frame with every one of her files, a horizontal one cropped on its subject; its band only when she asks
// for it. And a format she asks for never takes a Reel out of its model (the bench's « … en vertical plein écran »).

/**
 * The models whose format keeps another default than the vertical full frame, and why (each one's fiche,
 * docs/fiches/<key>.md): its band is its signature, or its format is not a band at all.
 */
const KEEPS: Record<string, string> = {
  "court-metrage": "a film projected in a band with round corners on a soft black, as her videos: its signature",
  coulisses: "its card on its page is the model (a 16:9 card for her horizontal videos, a square one else), never a band on black",
  "ecran-partage": "« auto » is the whole screen as her files (side by side, or one above the other), its card on black on her word",
  createur: "« auto » splits the screen for her horizontal talk, never black",
  tourne: "its videos in width turned a quarter to fill the screen: its format says how her upright ones are taken",
  affiches: "the shape of her prints on its flat colours, the Reel always vertical",
  pile: "the shape of her prints on its page, the Reel always vertical",
  "mon-travail": "the shape of her photos in its collage, the Reel always vertical",
};

test("every model is vertical full frame by default, its code told so, its band marked for her videos kept whole", () => {
  for (const skill of Object.values(MONTAGE_SKILLS)) {
    const format = skill.settings?.find((s) => s.name === SKILL_FORMAT);
    if (!format) continue;
    const first = format.choices[0]!.value;
    // Its default: the vertical full frame, unless its fiche says another (KEEPS).
    if (KEEPS[skill.key]) assert.notEqual(first, undefined, skill.key);
    else assert.equal(first, "vertical", `${skill.key}: its format's default`);
    // Its code's own fallback is its default (a code read outside the engine, by the motion designer, plays it too).
    const fallback = /setting\("format", "([^"]+)"\)/.exec(skill.code)?.[1];
    if (fallback) assert.equal(fallback, first, `${skill.key}: its code's fallback`);
    // A choice that lays her files whole (in a band, a window, a card on black) is its band: one at most.
    const bands = format.choices.filter((c) => c.band);
    assert.ok(bands.length <= 1, skill.key);
    const banded = format.choices.some((c) => ["horizontal", "fenetre", "carte", "bandes"].includes(c.value));
    if (banded && skill.key !== "affiches") assert.equal(bands.length, 1, `${skill.key}: its band marked`);
    // Never its default.
    assert.ok(!format.choices[0]!.band, skill.key);
    // Its words say the default (Edith's « reglages »).
    assert.match(settingWords(format), /\(par défaut\)/);
  }
  // Every model kept apart is in the library and has a format (the list stays true).
  for (const key of Object.keys(KEEPS)) assert.ok(MONTAGE_SKILLS[key]?.settings?.some((s) => s.name === SKILL_FORMAT), key);
});

/** A toy model: its format told to its code and its timeline, its slots' words saying where her file goes. */
const TOY: MontageSkill = {
  key: "toy",
  version: 1,
  bpm: 120,
  shots: [2, 4],
  files: [1, 4],
  how: "Ses plans l'un après l'autre.",
  texts: [],
  end: false,
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou ses vidéos entières dans une bande",
      choices: [
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 sur du noir", band: true },
        { value: "auto", says: "comme ses vidéos" },
      ],
    },
    { name: "vitesse", want: "la vitesse", choices: [{ value: "normale", says: "normale" }, { value: "lente", says: "lente" }] },
  ],
  timeline(n, { settings }) {
    const want = settings?.format === "horizontal" ? "dans la bande" : settings?.format === "vertical" ? "plein cadre" : "comme ses vidéos";
    return { duration: n, shots: Array.from({ length: n }, (_, i) => ({ start: i, end: i + 1, want })), texts: {}, marks: { beat: 15 } };
  },
  code: `function Scene({ texts }) { const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; }; return React.createElement("div", { format: setting("format", "vertical") }); }`,
};
const FILES = [
  { id: "a", photo: false, seconds: 8, aspect: 16 / 9 },
  { id: "b", photo: false, seconds: 8, aspect: 16 / 9 },
];
const FILL = { shots: [{ file: "a", at: 0 }, { file: "b", at: 0 }], texts: {}, end: null };

test("the engine plays a model's format: its default told to its code and its timeline when nothing is asked, her choice kept on the plan", () => {
  assert.deepEqual(playedSettings(TOY, undefined), { format: "vertical" });
  assert.deepEqual(playedSettings(TOY, { vitesse: "lente" }), { format: "vertical", vitesse: "lente" });
  assert.deepEqual(playedSettings(TOY, { format: "horizontal" }), { format: "horizontal" });
  assert.equal(playedSettings({ settings: [] }, undefined), undefined);
  assert.deepEqual(playedSettings({}, { cases: "6x8" }), { cases: "6x8" });
  // Nothing asked: vertical in its code's texts, nothing in the plan's settings (the default needs no saying).
  const plain = skillPlan({ skill: TOY, name: "Toy", files: FILES, fill: FILL });
  assert.equal(plain.layers![0]!.motion.texts!.format, "vertical");
  assert.equal(plain.layers![0]!.motion.texts!.beat, "15");
  assert.deepEqual(plain.skill, { key: "toy", version: 1 });
  // Her band asked: in its texts and on the plan, a correction keeps it.
  const banded = skillPlan({ skill: TOY, name: "Toy", files: FILES, fill: { ...FILL, settings: { format: "horizontal" } } });
  assert.equal(banded.layers![0]!.motion.texts!.format, "horizontal");
  assert.deepEqual(banded.skill, { key: "toy", version: 1, settings: { format: "horizontal" } });
  // Its sounds replayed on the same timeline (its format included).
  assert.deepEqual(replaySkillAudio(TOY, plain), {});
});

test("her videos kept whole (the contract's letterbox) play a model's band; the filler is told so, its slots too", () => {
  assert.equal(skillBand(TOY), "horizontal");
  assert.deepEqual(skillFramed(TOY, {}, "letterbox"), { format: "horizontal" });
  assert.deepEqual(skillFramed(TOY, { vitesse: "lente" }, "letterbox"), { vitesse: "lente", format: "horizontal" });
  // A format her words chose wins (« en carré »), the vertical frame changes nothing, a model without a band keeps its own.
  assert.deepEqual(skillFramed(TOY, { format: "auto" }, "letterbox"), { format: "auto" });
  assert.deepEqual(skillFramed(TOY, {}, "vertical"), {});
  assert.deepEqual(skillFramed(TOY, {}, undefined), {});
  assert.deepEqual(skillFramed({ settings: [{ name: "format", want: "", choices: [{ value: "auto", says: "" }, { value: "partage", says: "" }] }] }, {}, "letterbox"), {});
  // The library's: each model's own band.
  const band = (key: string) => skillFramed(MONTAGE_SKILLS[key]!, {}, "letterbox").format;
  assert.deepEqual(["assiettes", "decode", "detourages", "ecran-partage", "carte-feutre", "mosaique", "court-metrage", "createur"].map(band), ["horizontal", "horizontal", "fenetre", "carte", "bandes", "horizontal", "horizontal", undefined]);
  // The filler: its slots as its format lays them, its band said, its default said.
  const asked = skillFillInput({ skill: TOY, name: "Toy", n: 2, files: FILES, business: {}, request: "garde mes vidéos entières", frame: "letterbox" });
  assert.deepEqual(asked.cases.map((c) => c.veut), ["dans la bande", "dans la bande"]);
  assert.match(String(asked.cadre), /« horizontal » : ses vidéos entières dans une bande/);
  const plain = skillFillInput({ skill: TOY, name: "Toy", n: 2, files: FILES, business: {}, request: "un Reel de ma boutique" });
  assert.deepEqual(plain.cases.map((c) => c.veut), ["plein cadre", "plein cadre"]);
  assert.equal("cadre" in plain, false);
  assert.match(plain.reglages![0]!.choix[0]!, /^vertical : .*\(par défaut\)$/);
  const without = skillFillInput({ skill: MONTAGE_SKILLS.createur!, name: "Face caméra", n: 1, files: FILES, business: {}, request: "garde mes vidéos entières", frame: "letterbox" });
  assert.match(String(without.cadre), /ce modèle ne le fait pas/);
  // Its prompt: a horizontal file cropped on its subject, a format she asks is its setting, never another layout.
  assert.match(SKILL_FILL_PROMPT, /vertical full frame unless the model's « format » setting/);
  assert.match(SKILL_FILL_PROMPT, /A format she asks for \(vertical, full screen, horizontal, in a band, her videos kept whole: « cadre »\) is its « format » setting when it has one, never another layout: it fits/);
  // Edith's words for a model's settings: its default said.
  assert.equal(settingWords(TOY.settings![1]!), "la vitesse : normale (par défaut), lente");
});

test("a format she asks for is never a layout of hers: « en vertical plein écran » kept the bench's Reel out of its model", () => {
  // The bench (6 November, midnight): « Défilé d'assiettes » asked again « … en vertical plein écran » left its model for the
  // chain before its filler (no refusal noted), the reader having noted it as a layout (about 0,45 € instead of 0,24 €).
  const read: ReelContract = { ...EMPTY_CONTRACT, layout: "en vertical plein écran" };
  assert.equal(beyondSkills(read, false), false);
  const settled = settleFrame(read);
  assert.equal(settled.layout, null);
  assert.equal(settled.frame, "vertical");
  assert.equal(beyondSkills(settled, false), false);
  assert.deepEqual(contractLines(settled), []);
  // Its reader is told so.
  assert.match(CONTRACT_PROMPT, /never the format alone \(vertical, full screen, horizontal, in bands, their videos kept whole: that is « frame »\), so « en vertical plein écran » leaves layout null/);
  // Her videos kept whole, said as a layout or a must: her frame, for the chain (plan.frame) and a model's band.
  const whole = settleFrame({ ...EMPTY_CONTRACT, layout: "la vidéo reste horizontale, noir au-dessus et en dessous", musts: ["fond papier", "garde mes vidéos entières"] });
  assert.deepEqual([whole.layout, whole.musts, whole.frame], [null, ["fond papier"], "letterbox"]);
  assert.match(contractLines(whole).join(" "), /Cadre : ses vidéos entières et horizontales/);
  // A layout of hers stays one (a split screen, a text at the top): the chain makes it.
  for (const layout of ["écran partagé 50/50, l'animation en haut, moi en bas", "écran partagé en vertical", "texte en haut, vidéo en vertical", "ma vidéo dans un cadre au milieu"]) {
    assert.equal(formatOnly(layout), false, layout);
    assert.equal(settleFrame({ ...EMPTY_CONTRACT, layout }).layout, layout);
    assert.equal(beyondSkills({ ...EMPTY_CONTRACT, layout }, false), true, layout);
  }
});

test("a format in her words: vertical, full screen, horizontal, in bands, her videos whole", () => {
  const vertical = ["en vertical plein écran", "Vertical please", "tout vertical please", "vertical serait mieux", "encore une fois à mettre en vertical", "plein écran", "format 9:16", "sans bandes noires", "pas de bandes", "en plein cadre stp", "à la verticale"];
  for (const t of vertical) assert.equal(formatAsked(t), "vertical", t);
  const band = ["en horizontal", "garde mes vidéos entières", "en bande", "avec des bandes noires", "la vidéo reste horizontale, noir au-dessus et en dessous", "format 16:9", "sans recadrer mes vidéos", "mes vidéos en entier sur fond noir", "à l'horizontale"];
  for (const t of band) assert.equal(formatAsked(t), "letterbox", t);
  for (const t of ["", null, undefined, "coupes rapides", "en noir et blanc", "une ambiance chaleureuse", "mon logo en bas"]) assert.equal(formatAsked(t), null, String(t));
  // The whole frame asked again in a correction (a Reel the chain laid on black then fills it).
  assert.equal(fullFrameAsked("Remets-le en vertical plein écran, le texte plus gros"), true);
  assert.equal(fullFrameAsked("sans les bandes noires stp"), true);
  assert.equal(fullFrameAsked("garde mes vidéos entières mais plus court"), false);
  assert.equal(fullFrameAsked("le texte plus gros"), false);
  assert.equal(fullFrameAsked(undefined), false);
});
