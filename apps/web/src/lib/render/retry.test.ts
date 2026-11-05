import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSING_RETRY_MS, RETRY_MS, retryDue } from "./retry.ts";

test("a failed reading: asked again two minutes later when no card came, six hours later when the shot has nothing", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  // No card free (November 5, 9:24): the next Reel asks again.
  const noCard = "no A10G nor L40S card free after 90 s";
  assert.equal(retryDue({ failed_at: ago(PASSING_RETRY_MS - 10_000), error: noCard }), false);
  assert.equal(retryDue({ failed_at: ago(PASSING_RETRY_MS + 10_000), error: noCard }), true);
  for (const error of ["no machine started after 90 s", "Modal did not answer", "its image was not ready after 90 s", "the card came after the deadline", "no time left to cut out"])
    assert.equal(retryDue({ failed_at: ago(PASSING_RETRY_MS + 10_000), error }), true, error);
  // Nothing in the shot (no sky, the object not found): six hours.
  assert.equal(retryDue({ failed_at: ago(PASSING_RETRY_MS + 10_000), error: "aucun ciel" }), false);
  assert.equal(retryDue({ failed_at: ago(RETRY_MS + 10_000), error: "aucun ciel" }), true);
  assert.equal(retryDue({ failed_at: ago(PASSING_RETRY_MS + 10_000) }), false);
});
