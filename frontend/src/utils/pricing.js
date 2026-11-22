const round2 = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

// The backend owns ticket pricing and returns each seat's category price.
// This helper only summarizes those server-provided prices; it never invents
// taxes, service fees, concession purchases, or payment success.
export function calcPricing(seats) {
  if (!Array.isArray(seats)) throw new Error("Seats must be an array.");
  const lines = {};

  seats.forEach((seat) => {
    const tier = seat.tier || (seat.category === "vip lounge" ? "vip" : seat.category);
    const unitPrice = Number(seat.price);
    if (!tier || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Invalid seat pricing data.");
    }
    const line = (lines[tier] ||= { tier, unit: unitPrice, qty: 0, total: 0 });
    line.qty += 1;
    line.total = round2(line.total + unitPrice);
  });

  const ticketSubtotal = round2(Object.values(lines).reduce((sum, line) => sum + line.total, 0));
  return {
    lines: Object.values(lines),
    quantity: seats.length,
    ticketSubtotal,
    serviceFee: 0,
    concessions: 0,
    tax: 0,
    total: ticketSubtotal,
    taxRate: 0,
  };
}
