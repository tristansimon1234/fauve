import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema } from "./schemas.ts";
import { canTransition } from "./status.ts";
import { claudeCostUsd, usdToEur } from "./pricing.ts";
import { isInSessionWindow } from "./whatsapp-templates.ts";

const validPlan = {
  format: "9:16",
  duration: 12,
  template: "class_of_the_day",
  segments: [{ clip_id: "a", in: 1.2, out: 3, zoom: "none" }],
  texts: [{ text: "6 h 45. Le studio se réveille.", from: 0, to: 2.5, style: "hook" }],
  images: [{ asset_id: "logo", position: "bottom_left", from: 9, to: 12 }],
  transitions: "cut",
  subtitles: true,
  music: null,
};

test("edit plan: accepts the reference plan", () => {
  assert.equal(editPlanSchema.safeParse(validPlan).success, true);
});

test("edit plan: rejects segments that end before they start", () => {
  const plan = { ...validPlan, segments: [{ clip_id: "a", in: 3, out: 1 }] };
  assert.equal(editPlanSchema.safeParse(plan).success, false);
});

test("edit plan: rejects texts past the end of the video", () => {
  const plan = { ...validPlan, texts: [{ text: "x", from: 10, to: 20, style: "caption" }] };
  assert.equal(editPlanSchema.safeParse(plan).success, false);
});

test("edit plan: no embedded music", () => {
  assert.equal(editPlanSchema.safeParse({ ...validPlan, music: "trend.mp3" }).success, false);
});

test("status: nothing is scheduled without validation", () => {
  assert.equal(canTransition("draft", "scheduled"), false);
  assert.equal(canTransition("draft", "validated"), true);
  assert.equal(canTransition("validated", "scheduled"), true);
  assert.equal(canTransition("published", "draft"), false);
});

test("pricing: opus input + output", () => {
  const usd = claudeCostUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 });
  assert.equal(usd, 6);
  assert.equal(usdToEur(1, 0.9), 0.9);
});

test("whatsapp: 24 h window", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  assert.equal(isInSessionWindow(new Date("2026-10-12T00:00:00Z"), now), true);
  assert.equal(isInSessionWindow(new Date("2026-10-11T11:59:00Z"), now), false);
  assert.equal(isInSessionWindow(null, now), false);
});

test("phone: normalizes French and international numbers", async () => {
  const { normalizePhone, formatPhone } = await import("./phone.ts");
  assert.equal(normalizePhone("06 12 34 56 78"), "+33612345678");
  assert.equal(normalizePhone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizePhone("0033612345678"), "+33612345678");
  assert.equal(normalizePhone("+32 470 12 34 56"), "+32470123456");
  assert.equal(normalizePhone("12"), null);
  assert.equal(formatPhone("+33612345678"), "+33 6 12 34 56 78");
});
