import test from "node:test";
import assert from "node:assert/strict";
import { cinemaLocalDateTimeToUtc } from "../src/utils/cinema-time.js";

test("converts UTC cinema wall time directly", () => {
  assert.equal(
    cinemaLocalDateTimeToUtc("2026-03-10", "22:15:00", "UTC").toISOString(),
    "2026-03-10T22:15:00.000Z"
  );
});

test("converts a non-UTC cinema wall time", () => {
  assert.equal(
    cinemaLocalDateTimeToUtc("2026-01-15", "22:15:00", "Asia/Karachi").toISOString(),
    "2026-01-15T17:15:00.000Z"
  );
});

test("rejects malformed or nonexistent local times", () => {
  assert.equal(cinemaLocalDateTimeToUtc("2026-02-30", "10:00", "UTC"), null);
  assert.equal(cinemaLocalDateTimeToUtc("2026-03-08", "02:30", "America/New_York"), null);
});
