import { db } from './db.js';
import { simulate } from './api.js';
import { hydrate } from './showtimeService.js';
import { REVENUE_SERIES, NOTIFICATIONS } from '../data/dashboard.js';
import { store } from '../utils/storage.js';
import { todayKey } from '../utils/format.js';

export const logAudit = (actor, action) => {
  const list = store.get('audit', []);
  store.set('audit', [{ id: Date.now() + Math.random(), at: new Date().toISOString(), actor, action }, ...list].slice(0, 100));
};

const live = (b) => !['cancelled', 'refunded'].includes(b.status);

export const adminService = {
  dashboard: () => simulate(() => {
    const movies = db.movies.all(); const today = todayKey();
    const shows = db.showtimes.all().filter((s) => s.date === today).map(hydrate).filter((s) => s.movie).sort((a, b) => a.start.localeCompare(b.start));
    const bookings = db.bookings.all(); const paid = bookings.filter(live);
    const halls = shows.filter((s) => s.soldPct >= 90).length;
    return {
      kpis: {
        movies: movies.filter((m) => m.status !== 'archived').length, shows: shows.length, hallsAtCapacity: halls,
        admissions: paid.reduce((a, b) => a + b.seats.length, 0), revenue: paid.reduce((a, b) => a + b.total, 0),
        avgSeat: paid.length ? paid.reduce((a, b) => a + b.total, 0) / paid.reduce((a, b) => a + b.seats.length, 0) : 0,
      },
      screenings: shows, recent: bookings.slice(0, 8),
    };
  }, 350),
  revenue: (timeframe = 'weekly') => simulate(() => REVENUE_SERIES[timeframe], 250),

  auditList: () => store.get('audit', []),
  notifications: (kind) => simulate(() => {
    const read = store.get(`notifRead:${kind}`, []);
    return NOTIFICATIONS[kind].map((n) => ({ ...n, read: read.includes(n.id) }));
  }, 100),
  markNotificationsRead: (kind) => { store.set(`notifRead:${kind}`, NOTIFICATIONS[kind].map((n) => n.id)); },
};
