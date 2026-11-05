import { db } from "./db.js";
import { simulate, ApiError } from "./api.js";
import { getLayout, tierPrices } from "../data/seats.js";
import { profileFor, seatStatuses } from "./availability.js";
import { hydrate } from "./showtimeService.js";

export const seatService = {
  getSeatMap: (showtimeId) =>
    simulate(() => {
      const id = Number(showtimeId);

      const showtime = db.showtimes.all().find(
        (item) => Number(item.id) === id
      );

      if (!showtime) {
        throw new ApiError(
          "This showtime could not be found. It may have been removed.",
          "NOT_FOUND"
        );
      }

      const profile = profileFor(showtime.auditoriumId);

      return {
        showtime: hydrate(showtime),
        layout: getLayout(profile),
        seats: seatStatuses(showtime),
        prices: tierPrices(showtime.price),
      };
    }, 250),

  verify: (showtimeId, seatIds) => {
    const id = Number(showtimeId);

    const showtime = db.showtimes.all().find(
      (item) => Number(item.id) === id
    );

    if (!showtime) {
      return {
        ok: false,
        taken: seatIds,
      };
    }

    const availableSeats = new Set(
      seatStatuses(showtime)
        .filter((seat) => seat.status === "available")
        .map((seat) => seat.id)
    );

    const taken = seatIds.filter(
      (seatId) => !availableSeats.has(seatId)
    );

    return {
      ok: taken.length === 0,
      taken,
    };
  },
};