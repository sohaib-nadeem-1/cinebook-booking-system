import { describe, it, expect, beforeEach } from 'vitest';
import { calcPricing } from '../utils/pricing.js';
import { tierPrices, buildSeats } from '../data/seats.js';
import { showtimeService, findConflict } from '../services/showtimeService.js';
import { bookingService } from '../services/bookingService.js';
import { seatService } from '../services/seatService.js';
import { db } from '../services/db.js';
import { authService } from '../services/authService.js';
import { todayKey, addDays } from '../utils/format.js';

describe('pricing', () => {
  it('computes tiers, fee and tax consistently', () => {
    const p = calcPricing([{ id: 'E7', tier: 'prime' }, { id: 'E8', tier: 'prime' }, { id: 'E9', tier: 'prime' }], 22.5, { taxRate: 8, serviceFee: 1.5 });
    expect(p.ticketSubtotal).toBe(67.5); expect(p.serviceFee).toBe(4.5); expect(p.tax).toBe(5.76); expect(p.total).toBe(77.76);
  });
  it('adds combo before tax', () => {
    const p = calcPricing([{ id: 'A1', tier: 'standard' }], 20, { taxRate: 10, serviceFee: 1 }, { combo: true });
    expect(p.concessions).toBe(14); expect(p.total).toBe(((tierPrices(20).standard + 1 + 14) * 1.1).toFixed(2) * 1);
  });
  it('seat layouts have unique ids', () => { ['grand', 'boutique'].forEach((k) => { const s = buildSeats(k); expect(new Set(s.map((x) => x.id)).size).toBe(s.length); }); });
});

describe('showtimes & bookings', () => {
  beforeEach(() => { localStorage.clear(); });
  it('rejects overlapping showtimes in the same auditorium (incl. buffer)', async () => {
    const st = db.showtimes.all().find((s) => s.date >= addDays(todayKey(), 1));
    const clash = { movieId: st.movieId, auditoriumId: st.auditoriumId, date: st.date, start: st.start, end: st.end, price: 20 };
    expect(findConflict(clash)).toBeTruthy();
    await expect(showtimeService.create(clash)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('books seats once, then blocks double-booking, and cancel releases them', async () => {
    const st = db.showtimes.all().find((s) => s.date >= addDays(todayKey(), 2));
    const map = await seatService.getSeatMap(st.id);
    const free = map.seats.filter((s) => s.status === 'available').slice(0, 2).map((s) => ({ id: s.id, tier: s.tier }));
    const contact = { name: 'T', email: 't@t.com', phone: '+1 555 123 4567' };
    const payment = { method: 'wallet' };
    const b = await bookingService.create({ showtimeId: st.id, seats: free, contact, payment });
    expect(b.seats).toHaveLength(2); expect(b.id).toMatch(/^CB-\d+$/);
    await expect(bookingService.create({ showtimeId: st.id, seats: free, contact, payment })).rejects.toMatchObject({ code: 'SEAT_TAKEN' });
    await bookingService.cancel(b.id, { by: 'customer' });
    const again = await bookingService.create({ showtimeId: st.id, seats: free, contact, payment });
    expect(again.status).toBe('confirmed');
  });
  it('auth: wrong password rejected, staff cannot use customer portal', async () => {
    await expect(authService.login({ email: 'customer@cinebook.com', password: 'x', portal: 'customer' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(authService.login({ email: 'admin@cinebook.com', password: 'admin123', portal: 'customer' })).rejects.toMatchObject({ code: 'WRONG_PORTAL' });
    const u = await authService.login({ email: 'customer@cinebook.com', password: 'password123', portal: 'customer' });
    expect(u.password).toBeUndefined();
  });
});
