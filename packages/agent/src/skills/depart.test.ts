import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, segmentSeconds } from "../schemas.ts";
import { skillPlan, type MontageSkill } from "../skills.ts";

// « Le grand départ », the model (depart.ts, version 1), on its original's fiche (docs/fiches/depart.md); and the tool it
// added to the engine: a slot played faster than filmed (SkillShot.speed).

test("a skill's slot played faster than filmed (SkillShot.speed): that much more of her video, as much as it gives, never slower than filmed", () => {
  const fast: MontageSkill = {
    key: "test-vite",
    version: 1,
    bpm: 120,
    shots: [3, 3],
    files: [1, 3],
    how: "",
    end: false,
    texts: [],
    timeline: () => ({
      duration: 6,
      shots: [
        { start: 0, end: 2, want: "" },
        { start: 2, end: 4, want: "", speed: 2 },
        { start: 4, end: 6, want: "", speed: 2 },
      ],
      texts: {},
      marks: {},
    }),
    code: "function Scene() { return null; }",
  };
  const files = [
    { id: "a", photo: false, seconds: 10 },
    { id: "b", photo: false, seconds: 3 },
    { id: "p", photo: true, seconds: 0 },
  ];
  const plan = skillPlan({ skill: fast, name: "Test", files, fill: { shots: [{ file: "a", at: 0 }, { file: "a", at: 5 }, { file: "b", at: 0 }], texts: {}, end: null } });
  assert.ok(editPlanSchema.safeParse(plan).success);
  const [first, second, third] = plan.segments as { clip_id: string; in: number; out: number; speed?: number }[];
  // As filmed where its model says nothing; twice as fast where it says so: four seconds of her video in two.
  assert.equal(first!.speed, undefined);
  assert.deepEqual([second!.in, second!.out, second!.speed], [5, 9, 2]);
  // A video too short for it: as fast as it allows (3 s in 2: 1,5 times), all of it.
  assert.deepEqual([third!.in, third!.out, third!.speed], [0, 3, 1.5]);
  // Each one lasts its slot on the Reel: the timeline holds.
  for (const s of plan.segments) assert.ok(Math.abs(segmentSeconds(s) - 2) < 0.01, JSON.stringify(s));
  assert.equal(plan.duration, 6);
  // A photo stays still, whatever its slot says.
  const still = skillPlan({ skill: fast, name: "Test", files, fill: { shots: [{ file: "a", at: 0 }, { file: "p", at: 0 }, { file: "a", at: 4 }], texts: {}, end: null } });
  assert.equal((still.segments[1] as { speed?: number }).speed, undefined);
});
