import { db } from './db.js';
import { simulate, ApiError } from './api.js';
import { AUDITORIUMS, CINEMAS } from '../data/cinemas.js';
import { availability } from './availability.js';
import { readSettings } from './settingsService.js';
import { toMinutes, todayKey, uid } from '../utils/format.js';

export const CONFLICT_MESSAGE = 'This auditorium already has a scheduled screening during this time.';

const endMinutes = (st) => { const s = toMinutes(st.start); const e = toMinutes(st.end); return e <= s ? e + 1440 : e; };

/** Attach movie/cinema/auditorium/availability so UI never joins data itself. */
export const hydrate = (st) => {
  if (!st) return null;
  const movie = db.movies.all().find((m) => m.id === st.movieId) || null;
  const auditorium = AUDITORIUMS.find((a) => a.id === st.auditoriumId) || null;
  const cinema = CINEMAS.find((c) => c.id === st.cinemaId) || null;
  return { ...st, movie, auditorium, cinema, ...availabilityOf(st) };
};
const availabilityOf = (st) => { const a = availability(st); return { capacity: a.capacity, seatsLeft: a.left, soldPct: a.pct, soldOut: a.left === 0 }; };

/** Overlap check incl. turnaround buffer. Returns the clashing showtime or null. */
export function findConflict(candidate, ignoreId = null) {
  const buffer = readSettings().system.turnaroundMinutes;
  const s = toMinutes(candidate.start); let e = toMinutes(candidate.end); if (e <= s) e += 1440;
  return db.showtimes.all().find((o) => {
    if (o.id === ignoreId || o.auditoriumId !== candidate.auditoriumId || o.date !== candidate.date || o.status === 'cancelled') return false;
    const os = toMinutes(o.start); const oe = endMinutes(o);
    return s < oe + buffer && os < e + buffer;
  }) || null;
}

const validate = (data) => {
  const errors = {};
  if (!data.movieId) errors.movieId = 'Select a movie';
  if (!data.auditoriumId) errors.auditoriumId = 'Select an auditorium';
  if (!data.date) errors.date = 'Pick a date';
  if (!data.start) errors.start = 'Enter a start time';
  if (!data.end) errors.end = 'Enter an end time';
  if (!(Number(data.price) > 0)) errors.price = 'Enter a ticket price above $0';
  if (data.start && data.end && data.start === data.end) errors.end = 'End time must differ from start';
  return errors;
};

export const showtimeService = {
  list: ({ movieId, cinemaId, date, search = '', format, includePast = true } = {}) => simulate(() => {
    const q = search.trim().toLowerCase();
    return db.showtimes.all().map(hydrate).filter((s) => s.movie
      && (!movieId || s.movieId === movieId) && (!cinemaId || s.cinemaId === cinemaId) && (!date || s.date === date)
      && (!format || s.format === format) && (includePast || s.date >= todayKey())
      && (!q || `${s.movie.title} ${s.auditorium?.name} ${s.cinema?.short}`.toLowerCase().includes(q)))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }, 200),

  get: (id) => simulate(() => {
    const st = db.showtimes.all().find((s) => s.id === id);
    if (!st) throw new ApiError('This showtime could not be found.', 'NOT_FOUND');
    return hydrate(st);
  }, 150),

  /** Sync helper for components that already have loaded data (e.g. next-show badges). */
  nextByMovie: () => simulate(() => {
    const now = Date.now(); const map = {};
    db.showtimes.all().map(hydrate).filter((s) => s.movie && new Date(`${s.date}T${s.start}:00`).getTime() > now && !s.soldOut && s.status !== 'cancelled')
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach((s) => { map[s.movieId] ||= s; });
    return map;
  }, 150),

  datesFor: (movieId) => simulate(() => [...new Set(db.showtimes.all().filter((s) => s.movieId === movieId && s.date >= todayKey()).map((s) => s.date))].sort(), 80),

  create: (data) => simulate(() => {
    const errors = validate(data);
    if (Object.keys(errors).length) throw Object.assign(new ApiError('Please fix the highlighted fields.', 'VALIDATION'), { errors });
    const aud = AUDITORIUMS.find((a) => a.id === data.auditoriumId);
    const next = { id: uid('st'), movieId: data.movieId, cinemaId: aud.cinemaId, auditoriumId: aud.id, date: data.date, start: data.start, end: data.end, price: Number(data.price), format: data.format || aud.format, tag: data.tag || 'Standard', status: 'scheduled' };
    if (findConflict(next)) throw Object.assign(new ApiError(CONFLICT_MESSAGE, 'CONFLICT'), { errors: { start: CONFLICT_MESSAGE } });
    db.showtimes.save([...db.showtimes.all(), next]);
    return hydrate(next);
  }),

  update: (id, data) => simulate(() => {
    const all = db.showtimes.all(); const cur = all.find((s) => s.id === id);
    if (!cur) throw new ApiError('This showtime no longer exists.', 'NOT_FOUND');
    const errors = validate({ ...cur, ...data });
    if (Object.keys(errors).length) throw Object.assign(new ApiError('Please fix the highlighted fields.', 'VALIDATION'), { errors });
    const aud = AUDITORIUMS.find((a) => a.id === (data.auditoriumId || cur.auditoriumId));
    const patch = Object.fromEntries(['movieId', 'date', 'start', 'end', 'format', 'tag'].filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));
    const next = { ...cur, ...patch, price: Number(data.price ?? cur.price), cinemaId: aud.cinemaId, auditoriumId: aud.id };
    if (findConflict(next, id)) throw Object.assign(new ApiError(CONFLICT_MESSAGE, 'CONFLICT'), { errors: { start: CONFLICT_MESSAGE } });
    db.showtimes.save(all.map((s) => (s.id === id ? next : s)));
    return hydrate(next);
  }),

  remove: (id) => simulate(() => {
    const all = db.showtimes.all();
    const active = db.bookings.all().filter((b) => b.showtimeId === id && ['confirmed', 'pending'].includes(b.status));
    if (!all.some((s) => s.id === id)) throw new ApiError('This showtime no longer exists.', 'NOT_FOUND');
    db.showtimes.save(all.filter((s) => s.id !== id));
    // cascade: cancel + refund bookings of a removed show so no customer is left holding a dead ticket
    if (active.length) {
      const at = new Date().toISOString();
      db.bookings.save(db.bookings.all().map((b) => (active.some((a) => a.id === b.id) ? { ...b, status: 'refunded', refund: { state: 'processed', amount: b.total, at, reason: 'Showtime removed' } } : b)));
    }
    return { id, refunded: active.length };
  }),

  removeByMovie: (movieId) => { db.showtimes.save(db.showtimes.all().filter((s) => s.movieId !== movieId)); },
};
