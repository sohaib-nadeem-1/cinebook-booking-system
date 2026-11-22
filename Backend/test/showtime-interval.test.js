import test from "node:test";
import assert from "node:assert/strict";
import { intervalsConflict, isValidSchedule, toInterval } from "../src/utils/showtime-interval.js";

test("accepts normal and overnight schedules, rejects identical times", () => {
  assert.equal(isValidSchedule("2026-03-10", "09:00", "11:30"), true);
  assert.equal(isValidSchedule("2026-03-10", "22:00", "01:00"), true);
  assert.equal(isValidSchedule("2026-03-10", "22:00", "00:00"), true);
  assert.equal(isValidSchedule("2026-03-10", "22:00", "22:00"), false);
});

test("rejects malformed dates and times", () => {
  assert.equal(isValidSchedule("2026-02-30", "10:00", "11:00"), false);
  assert.equal(isValidSchedule("2026-03-10", "24:00", "01:00"), false);
  assert.equal(isValidSchedule("10/03/2026", "10:00", "11:00"), false);
});

test("treats midnight as the following calendar day", () => {
  const interval = toInterval("2026-03-10", "22:00", "00:00");
  assert.equal(interval.end - interval.start, 2 * 60 * 60 * 1000);
});

test("detects a conflict across midnight within the turnaround buffer", () => {
  const late = toInterval("2026-03-10", "22:00", "00:30");
  const early = toInterval("2026-03-11", "00:40", "02:00");
  assert.equal(intervalsConflict(late, early), true);
});

test("allows screenings separated by the full turnaround buffer", () => {
  const late = toInterval("2026-03-10", "22:00", "00:30");
  const next = toInterval("2026-03-11", "00:45", "02:00");
  assert.equal(intervalsConflict(late, next), false);
});

test("detects same-day overlap and allows non-overlap", () => {
  const first = toInterval("2026-03-10", "10:00", "12:00");
  const overlap = toInterval("2026-03-10", "11:00", "13:00");
  const separated = toInterval("2026-03-10", "12:15", "14:00");
  assert.equal(intervalsConflict(first, overlap), true);
  assert.equal(intervalsConflict(first, separated), false);
});
