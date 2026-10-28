import { tierPrices } from '../data/seats.js';

export const DEFAULT_PRICING = { taxRate: 8, serviceFee: 1.5 };
export const CONCESSIONS = { duoCombo: { id: 'duoCombo', name: 'Duo Combo (1 Large + 2 Drinks)', price: 14 } };

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Pure pricing calculation shared by seat selection, checkout and the booking service,
 * so the three can never disagree.
 * seats: [{id, tier}] — primePrice: showtime.price — settings: {taxRate (%), serviceFee ($/ticket)}
 */
export function calcPricing(seats, primePrice, settings = DEFAULT_PRICING, { combo = false } = {}) {
  const prices = tierPrices(primePrice);
  const lines = {};
  seats.forEach((s) => {
    const l = (lines[s.tier] ||= { tier: s.tier, unit: prices[s.tier], qty: 0, total: 0 });
    l.qty += 1; l.total = round2(l.total + prices[s.tier]);
  });
  const quantity = seats.length;
  const ticketSubtotal = round2(Object.values(lines).reduce((a, l) => a + l.total, 0));
  const concessions = combo && quantity > 0 ? CONCESSIONS.duoCombo.price : 0;
  const serviceFee = round2(quantity * (settings.serviceFee ?? DEFAULT_PRICING.serviceFee));
  const taxable = ticketSubtotal + serviceFee + concessions;
  const tax = round2(taxable * ((settings.taxRate ?? DEFAULT_PRICING.taxRate) / 100));
  const total = round2(taxable + tax);
  return { lines: Object.values(lines), quantity, ticketSubtotal, serviceFee, concessions, tax, total, taxRate: settings.taxRate ?? DEFAULT_PRICING.taxRate };
}
