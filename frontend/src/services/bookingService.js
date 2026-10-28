import { db } from './db.js';
import { simulate, ApiError } from './api.js';
import { hydrate } from './showtimeService.js';
import { seatService } from './seatService.js';
import { readSettings } from './settingsService.js';
import { calcPricing } from '../utils/pricing.js';
import { tierPrices } from '../data/seats.js';
import { showDateTime } from '../utils/format.js';

export const bookingPhase = (b) => {
  if (['cancelled', 'refunded'].includes(b.status)) return 'cancelled';
  return showDateTime(b.date, b.start).getTime() + 3 * 3600 * 1000 < Date.now() ? 'completed' : 'upcoming';
};

/** Hours until the show starts (negative if started). */
export const hoursUntil = (b) => (showDateTime(b.date, b.start).getTime() - Date.now()) / 3600000;
export const canRefund = (b) => ['confirmed', 'pending'].includes(b.status) && hoursUntil(b) >= readSettings().system.refundWindowHours;
export const canCancel = (b) => ['confirmed', 'pending'].includes(b.status) && hoursUntil(b) > 0;

export const bookingService = {
  list: ({ userId, email, search = '', status, date, movieId, phase } = {}) => simulate(() => {
    const q = search.trim().toLowerCase();
    return db.bookings.all().filter((b) => {
      if (userId && b.userId !== userId && b.customer.email !== email) return false;
      if (status && b.status !== status) return false;
      if (date && b.date !== date) return false;
      if (movieId && b.movieId !== movieId) return false;
      if (phase && bookingPhase(b) !== phase) return false;
      if (q && !`${b.id} ${b.customer.name} ${b.customer.email} ${b.movieTitle}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, 250),

  get: (id) => simulate(() => {
    const b = db.bookings.all().find((x) => x.id.toLowerCase() === String(id).toLowerCase());
    if (!b) throw new ApiError('Booking not found.', 'NOT_FOUND');
    return b;
  }, 150),

  create: ({ showtimeId, seats, contact, payment, combo, userId = null }) => simulate(() => {
    const errors = {};
    if (!contact.name?.trim()) errors.name = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email || '')) errors.email = 'Enter a valid email address';
    if (!/^[+\d][\d\s().-]{6,19}$/.test(contact.phone || '')) errors.phone = 'Enter a valid phone number';
    if (payment?.method === 'card') {
      const digits = (payment.number || '').replace(/\s/g, '');
      if (!/^\d{13,19}$/.test(digits)) errors.cardNumber = 'Enter a valid card number (demo: 4242 4242 4242 4242)';
      if (!/^(0[1-9]|1[0-2])\s?\/\s?\d{2}$/.test(payment.expiry || '')) errors.expiry = 'Use MM/YY';
      if (!/^\d{3,4}$/.test(payment.cvc || '')) errors.cvc = '3–4 digits';
    }
    if (Object.keys(errors).length) throw Object.assign(new ApiError('Please fix the highlighted fields.', 'VALIDATION'), { errors });
    if (!seats?.length) throw new ApiError('Select at least one seat before checking out.', 'NO_SEATS');

    const st = db.showtimes.all().find((s) => s.id === showtimeId);
    if (!st) throw new ApiError('This showtime is no longer available.', 'NOT_FOUND');
    const check = seatService.verify(showtimeId, seats.map((s) => s.id));
    if (!check.ok) throw Object.assign(new ApiError(`Seat ${check.taken.join(', ')} is no longer available.`, 'SEAT_TAKEN'), { taken: check.taken });
    if (payment?.method === 'card' && payment.number.replace(/\s/g, '').endsWith('0002')) throw new ApiError('Your card was declined. Try the demo card 4242 4242 4242 4242.', 'PAYMENT_DECLINED');

    const h = hydrate(st); const prices = tierPrices(st.price);
    const full = seats.map((s) => ({ id: s.id, tier: s.tier, price: prices[s.tier] }));
    const settings = readSettings();
    const pricing = calcPricing(full, st.price, { taxRate: settings.cinema.taxRate, serviceFee: settings.system.serviceFee }, { combo });
    const booking = {
      id: db.bookings.nextId(), userId, customer: { name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim() },
      showtimeId, movieId: st.movieId, movieTitle: h.movie.title, poster: h.movie.poster, format: st.format, cinemaName: h.cinema.name, cinemaShort: h.cinema.short,
      auditoriumName: h.auditorium.name, date: st.date, start: st.start, tag: st.tag, seats: full, pricing, total: pricing.total, status: 'confirmed',
      paymentMethod: payment?.method || 'card', refund: null, createdAt: new Date().toISOString(),
    };
    db.bookings.save([booking, ...db.bookings.all()]);
    return booking;
  }, 1200),

  /** Customer or admin cancel. Seats are released automatically (cancelled bookings don't count as sold). */
  cancel: (id, { refund = false, by = 'customer' } = {}) => simulate(() => {
    const all = db.bookings.all(); const b = all.find((x) => x.id === id);
    if (!b) throw new ApiError('Booking not found.', 'NOT_FOUND');
    if (!canCancel(b)) throw new ApiError('This booking can no longer be cancelled.', 'NOT_ALLOWED');
    const eligible = refund && canRefund(b);
    if (refund && !eligible) throw new ApiError(`Refunds close ${readSettings().system.refundWindowHours} hours before showtime.`, 'REFUND_WINDOW');
    const next = { ...b, status: eligible ? 'refunded' : 'cancelled', cancelledBy: by, cancelledAt: new Date().toISOString(), refund: eligible ? { state: 'processed (demo)', amount: b.total, at: new Date().toISOString() } : null };
    db.bookings.save(all.map((x) => (x.id === id ? next : x))); return next;
  }),

  stats: ({ userId, email }) => simulate(() => {
    const mine = db.bookings.all().filter((b) => b.userId === userId || b.customer.email === email);
    const live = mine.filter((b) => !['cancelled', 'refunded'].includes(b.status));
    return { total: mine.length, tickets: live.reduce((a, b) => a + b.seats.length, 0), spent: live.reduce((a, b) => a + b.total, 0), upcoming: mine.filter((b) => bookingPhase(b) === 'upcoming').length };
  }, 120),
};
