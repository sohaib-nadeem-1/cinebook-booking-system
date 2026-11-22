import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const Ctx = createContext(null);
const EMPTY = { showtimeId: null, seats: [] };

// This stores only the viewer's temporary selection in page memory. It does not
// reserve seats; PostgreSQL availability is checked before checkout and again
// inside the booking transaction.
export function BookingProvider({ children }) {
  const [hold, setHold] = useState(EMPTY);

  const toggleSeat = useCallback((showtimeId, seat) => {
    setHold((current) => {
      const base = current.showtimeId === showtimeId
        ? current
        : { ...EMPTY, showtimeId };
      const exists = base.seats.some((item) => item.id === seat.id);
      const seats = exists
        ? base.seats.filter((item) => item.id !== seat.id)
        : [...base.seats, {
            id: seat.id,
            dbId: Number(seat.dbId ?? seat.seatId),
            seatId: Number(seat.seatId ?? seat.dbId),
            tier: seat.tier,
            category: seat.category,
            price: Number(seat.price),
          }];
      return seats.length ? { ...base, seats } : EMPTY;
    });
  }, []);

  const removeSeat = useCallback((seatId) => {
    setHold((current) => {
      const seats = current.seats.filter((seat) => seat.id !== seatId);
      return seats.length ? { ...current, seats } : EMPTY;
    });
  }, []);

  const clear = useCallback(() => setHold(EMPTY), []);
  const value = useMemo(
    () => ({ hold, toggleSeat, removeSeat, clear }),
    [hold, toggleSeat, removeSeat, clear]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBooking = () => useContext(Ctx);
