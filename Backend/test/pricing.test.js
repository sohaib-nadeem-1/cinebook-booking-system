import test from "node:test";
import assert from "node:assert/strict";
import { seatPriceFor, totalPriceForSeats } from "../src/utils/pricing.js";

const showtime = { standard_price: "10.00", prime_price: "12.00" };

test("uses configured standard and prime prices", () => {
  assert.equal(seatPriceFor("standard", showtime), 10);
  assert.equal(seatPriceFor("prime", showtime), 12);
});

test("calculates VIP as 125% of prime rounded to the nearest half unit", () => {
  assert.equal(seatPriceFor("vip lounge", showtime), 15);
  assert.equal(seatPriceFor("vip lounge", { prime_price: "11.30" }), 14);
});

test("calculates totals in integer cents", () => {
  assert.equal(totalPriceForSeats([{ price: "10.10" }, { price: "12.20" }, { price: "14.00" }]), "36.30");
});

test("rejects unsupported categories and invalid prices", () => {
  assert.throws(() => seatPriceFor("unknown", showtime), { statusCode: 400 });
  assert.throws(() => totalPriceForSeats([{ price: "NaN" }]), { statusCode: 400 });
});
