import assert from "node:assert/strict";
import { test } from "node:test";
import { beyondSkills, EMPTY_CONTRACT, settleFrame, skillFillInput, skillFramed, type ReelContract } from "@fauve/agent";
import { MONTAGE_SKILLS } from "@fauve/agent/skills";
import { chainLetterbox, skillContract } from "./reel-frame.ts";

// Her Reel's frame as the montage reads it (lib/agent/editor.ts for the chain, skill-design.ts for a model): vertical by
// default (Tristan, 6 November: « tout vertical please »), her videos whole on black only when she asks for it.

test("a model's filler gets her frame apart, never the editor's line on the engine's letterbox", () => {
  const whole: ReelContract = { ...EMPTY_CONTRACT, frame: "letterbox", musts: ["coupes rapides"] };
  const read = skillContract(whole);
  assert.equal(read.frame, "letterbox");
  assert.deepEqual(read.contract, ["Demandé : coupes rapides"]);
  assert.ok(!read.contract.some((l) => /^Cadre/.test(l)));
  // Nothing fixed, or the vertical frame: no frame said, no line.
  assert.deepEqual(skillContract(undefined), { contract: [] });
  assert.deepEqual(skillContract({ ...EMPTY_CONTRACT, frame: "vertical" }), { contract: [] });
  // What the filler then reads of « Défilé d'assiettes »: its band, and that the code lays it.
  const assiettes = MONTAGE_SKILLS.assiettes!;
  const input = skillFillInput({ skill: assiettes, name: "Défilé d'assiettes", n: 12, files: [{ id: "v", photo: false, seconds: 10, aspect: 16 / 9 }], business: {}, request: "garde mes vidéos entières", ...read });
  assert.match(String(input.cadre), /« horizontal »/);
  assert.deepEqual(skillFramed(assiettes, {}, read.frame), { format: "horizontal" });
});

test("the bench's « … en vertical plein écran », read as a layout, keeps its Reel on its model, at its default vertical frame", () => {
  const read = settleFrame({ ...EMPTY_CONTRACT, layout: "en vertical plein écran" });
  assert.equal(beyondSkills(read, false), false);
  assert.deepEqual(skillContract(read), { contract: [] });
  assert.deepEqual(skillFramed(MONTAGE_SKILLS.assiettes!, {}, read.frame), {});
});

test("the chain lays her videos on black only when she asks, and a correction fills the frame again when she says so", () => {
  const whole = { frame: "letterbox" as const };
  const upright = { frame: "vertical" as const };
  assert.equal(chainLetterbox({ contract: whole, correction: false }), true);
  assert.equal(chainLetterbox({ contract: upright, correction: false }), false);
  assert.equal(chainLetterbox({ correction: false }), false);
  // A correction of a Reel laid on black keeps it, unless its request asks for the whole vertical frame.
  const base = { frame: "letterbox" };
  assert.equal(chainLetterbox({ contract: upright, correction: true, base, brief: "le texte plus gros" }), true);
  assert.equal(chainLetterbox({ contract: upright, correction: true, base, brief: "remets-le en vertical plein écran" }), false);
  assert.equal(chainLetterbox({ contract: upright, correction: true, base: {}, brief: "le texte plus gros" }), false);
  assert.equal(chainLetterbox({ contract: whole, correction: true, base: {}, brief: "garde mes vidéos entières" }), true);
});
