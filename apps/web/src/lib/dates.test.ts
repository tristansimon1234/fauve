import assert from "node:assert/strict";
import { test } from "node:test";
import { localDateOf, mondayOf, parseIsoDate, startOfLocalDay, weekLabel, weekOf } from "./dates.ts";

const PARIS = "Europe/Paris";

test("local midnight in Paris, summer and winter time", () => {
  assert.equal(startOfLocalDay({ year: 2026, month: 10, day: 12 }, PARIS).toISOString(), "2026-10-11T22:00:00.000Z");
  assert.equal(startOfLocalDay({ year: 2026, month: 12, day: 1 }, PARIS).toISOString(), "2026-11-30T23:00:00.000Z");
});

test("week across the end of daylight saving time", () => {
  const week = weekOf({ year: 2026, month: 10, day: 28 }, PARIS);
  assert.deepEqual(week.monday, { year: 2026, month: 10, day: 26 });
  assert.equal(week.start.toISOString(), "2026-10-25T23:00:00.000Z");
  assert.equal(week.end.toISOString(), "2026-11-01T23:00:00.000Z");
  assert.equal(weekLabel(week), "Semaine du 26 octobre au 1er novembre");
});

test("late evening UTC is already the next day in Paris", () => {
  assert.deepEqual(localDateOf(new Date("2026-10-11T22:30:00Z"), PARIS), { year: 2026, month: 10, day: 12 });
});

test("monday of a sunday, and week labels", () => {
  assert.deepEqual(mondayOf({ year: 2026, month: 10, day: 18 }), { year: 2026, month: 10, day: 12 });
  assert.equal(weekLabel(weekOf({ year: 2026, month: 10, day: 14 }, PARIS)), "Semaine du 12 au 18 octobre");
});

test("parseIsoDate rejects junk and impossible days", () => {
  assert.deepEqual(parseIsoDate("2026-10-12"), { year: 2026, month: 10, day: 12 });
  assert.equal(parseIsoDate("2026-02-31"), null);
  assert.equal(parseIsoDate("demain"), null);
  assert.equal(parseIsoDate(undefined), null);
});
