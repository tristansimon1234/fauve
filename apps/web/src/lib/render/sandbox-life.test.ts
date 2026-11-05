import assert from "node:assert/strict";
import { test } from "node:test";
import { extensionMs, IDLE_TAIL_MS, idleTailSeconds, KEEP_ALIVE_MS, seatsOf } from "./sandbox-life.ts";

test("a sandbox stops about a minute and a half after its last command, not fifteen", () => {
  assert.equal(IDLE_TAIL_MS, 90_000);
  // Kept up while a command runs: two missed beats still leave it time.
  assert.ok(IDLE_TAIL_MS - 2 * KEEP_ALIVE_MS > 0);
});

test("a running command's session is extended only by what it misses, a minute at least", () => {
  assert.equal(extensionMs(IDLE_TAIL_MS), 0);
  assert.equal(extensionMs(10 * 60_000), 0);
  // 60 s left: 30 s are missing, the API takes a minute at least.
  assert.equal(extensionMs(60_000), 60_000);
  assert.equal(extensionMs(5_000), 85_000);
  assert.equal(extensionMs(-20_000), 90_000);
  assert.equal(extensionMs(Number.POSITIVE_INFINITY), 0);
  // Between two beats, a session kept up never falls under the beat's own length.
  let left = IDLE_TAIL_MS;
  for (let beat = 0; beat < 40; beat++) {
    left -= KEEP_ALIVE_MS;
    assert.ok(left > 0);
    left += extensionMs(left);
    assert.ok(left >= IDLE_TAIL_MS && left <= IDLE_TAIL_MS + 60_000);
  }
});

test("the idle tail of a finished session: from its last command to its stop", () => {
  const session = { id: "sbx_1", startedAt: Date.parse("2026-11-04T21:25:20Z"), stoppedAt: Date.parse("2026-11-04T21:43:51Z") };
  assert.equal(idleTailSeconds({ session: "sbx_1", at: "2026-11-04T21:36:46.816Z" }, session), 424);
  assert.equal(idleTailSeconds({ session: "sbx_2", at: "2026-11-04T21:36:46Z" }, session), null);
  assert.equal(idleTailSeconds({ session: "sbx_1", at: "2026-11-04T21:36:46Z" }, { id: "sbx_1", startedAt: session.startedAt }), null);
  assert.equal(idleTailSeconds({ session: "sbx_1", at: "2026-11-04T21:20:00Z" }, session), null);
  assert.equal(idleTailSeconds({ session: "sbx_1", at: "2026-11-04T21:50:00Z" }, session), null);
  assert.equal(idleTailSeconds({ session: "sbx_1", at: "not a date" }, session), null);
});

test("the seats of a machine, as take_work_slot numbers them", () => {
  assert.deepEqual(seatsOf(0, 2), [0, 1]);
  assert.deepEqual(seatsOf(2, 2), [4, 5]);
  assert.deepEqual(seatsOf(1, 1), [1]);
});
