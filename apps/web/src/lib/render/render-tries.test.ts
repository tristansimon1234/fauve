import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReelProps } from "@fauve/agent";
import {
  AFTER_RENDER_MS,
  FIRST_TRY,
  PATIENT_TRY,
  RENDER_LEASE_MS,
  RENDERS_PER_SANDBOX,
  remotionFlags,
  renderBoundSeconds,
  secondTryFits,
  SECOND_TRY_MIN_MS,
  withoutCompositions,
} from "./render-tries.ts";

/** The longest a montage step runs (maxDuration of /api/jobs/montage). */
const STEP_MS = 800_000;

test("one render per sandbox, and its place outlives the longest step", () => {
  assert.equal(RENDERS_PER_SANDBOX, 1);
  assert.ok(RENDER_LEASE_MS > STEP_MS);
});

test("the first try renders with four tabs, the patient one with two and a smaller frame cache", () => {
  assert.equal(remotionFlags(FIRST_TRY), "--concurrency=4 --timeout=60000 --offthreadvideo-cache-size-in-bytes=1500000000");
  assert.equal(remotionFlags(PATIENT_TRY), "--concurrency=2 --timeout=120000 --offthreadvideo-cache-size-in-bytes=1000000000");
  assert.ok(PATIENT_TRY.concurrency < FIRST_TRY.concurrency && PATIENT_TRY.cacheBytes < FIRST_TRY.cacheBytes);
});

test("a render stops before its step ends, leaving the music and the upload their time", () => {
  assert.equal(renderBoundSeconds(Number.POSITIVE_INFINITY), null);
  assert.equal(renderBoundSeconds(10 * 60_000), 480);
  assert.equal(renderBoundSeconds(AFTER_RENDER_MS + 90_500), 90);
  // Never 0, which would mean no limit for timeout.
  assert.equal(renderBoundSeconds(30_000), 1);
  assert.equal(renderBoundSeconds(-5_000), 1);
});

test("a second try starts only when its step still has the time for it", () => {
  assert.equal(secondTryFits(Number.POSITIVE_INFINITY), true);
  assert.equal(secondTryFits(AFTER_RENDER_MS + SECOND_TRY_MIN_MS), true);
  assert.equal(secondTryFits(AFTER_RENDER_MS + SECOND_TRY_MIN_MS - 1), false);
  // 4 November: the first tries failed 6 min into their steps (730 s of budget): 7 min left, the second try fits.
  assert.equal(secondTryFits(730_000 - 6 * 60_000), true);
  assert.equal(secondTryFits(60_000), false);
});

test("the second try keeps the first try's local files and drops the compositions", () => {
  const layer = (extra: Partial<NonNullable<ReelProps["layers"]>[number]>) => ({ js: "x", texts: {}, from: 0, durationInFrames: 30, cuts: [], ...extra });
  const props = {
    segments: [{ type: "clip", src: "/public/jobs/r1/m0.mp4", startFrom: 0, durationInFrames: 30 }],
    layers: [layer({ photos: [{ id: "p", src: "/public/jobs/r1/m1.jpg" }] as never }), layer({ compose: true }), layer({ drawsTexts: true })],
  } as unknown as ReelProps;
  const again = withoutCompositions(props);
  assert.equal(again.segments, props.segments);
  assert.equal(again.layers?.length, 1);
  assert.equal(again.layers?.[0], props.layers?.[0]);
  assert.equal(withoutCompositions({ ...props, layers: [layer({ compose: true })] }).layers, undefined);
  assert.equal(withoutCompositions({ ...props, layers: undefined }).layers, undefined);
});
