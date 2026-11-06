import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMotionCode } from "../motion-scene.ts";
import { skillCode } from "../skills.ts";
import { silhouette } from "./silhouette.ts";

test("« Présente-toi » (v4): its code passes the checks, under 24 000 characters once its object is named", () => {
  assert.deepEqual(checkMotionCode(silhouette.code), []);
  assert.ok(skillCode(silhouette, { forme: "bouquet of roses" }).length < 24000);
});
