import { db } from './db.js';
import { simulate, ApiError } from './api.js';
import { getLayout, tierPrices } from '../data/seats.js';
import { profileFor, seatStatuses } from './availability.js';
import { hydrate } from './showtimeService.js';

export const seatService = {
  /** Seat map for a showtime: layout + per-seat status (available/occupied/reserved) and tier prices. */
  getSeatMap: (showtimeId) => simulate(() => {
    const st = db.showtimes.all().find((s) => s.id === showtimeId);
    if (!st) throw new ApiError('This showtime could not be found. It may have been removed.', 'NOT_FOUND');
    const profile = profileFor(st.auditoriumId);
    return { showtime: hydrate(st), layout: getLayout(profile), seats: seatStatuses(st), prices: tierPrices(st.price) };
  }, 250),

  /** Re-check that chosen seats are still free (called at checkout confirm). */
  verify: (showtimeId, seatIds) => {
    const st = db.showtimes.all().find((s) => s.id === showtimeId);
    if (!st) return { ok: false, taken: seatIds };
    const free = new Set(seatStatuses(st).filter((s) => s.status === 'available').map((s) => s.id));
    const taken = seatIds.filter((id) => !free.has(id));
    return { ok: taken.length === 0, taken };
  },
};
