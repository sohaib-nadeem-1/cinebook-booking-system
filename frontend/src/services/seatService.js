import { api, ApiError } from "./api.js";
import { showtimeService } from "./showtimeService.js";

import { getLayout, tierPrices } from "../data/seats.js";
import { profileFor } from "./availability.js";

const API_ENDPOINT = "/seats";

const fetchSeatAvailability = async (showtimeId) => {
  const response = await api.get(
    `${API_ENDPOINT}/showtime/${showtimeId}`
  );

  if (!Array.isArray(response?.seats)) {
    throw new ApiError(
      "Invalid seat availability response.",
      "INVALID_RESPONSE"
    );
  }

  return response.seats;
};

const mapSeat = (seat, showtime) => {
  const category = seat.seat_category;

  const price =
    category === "standard"
      ? showtime.standardPrice
      : category === "prime"
        ? showtime.primePrice
        : 0;

  return {
    ...seat,

    // Display ID: A1, A2, B1...
    id: String(seat.id),

    // Actual PostgreSQL seat ID
    dbId: Number(seat.dbId),
    seatId: Number(seat.dbId),

    row: seat.row,
    number: Number(seat.number),

    category,
    type: category,

    // BookingSummary and pricing compatibility
    tier: category === "vip lounge" ? "vip" : category,

    price: Number(price),

    // Backend currently supports standard and prime only.
    status:
      category === "vip lounge"
        ? "unavailable"
        : seat.status,
  };
};

export const seatService = {
  getSeatMap: async (showtimeId) => {
    const id = Number(showtimeId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(
        "Invalid showtime ID.",
        "VALIDATION",
        400
      );
    }

    const [showtime, rawSeats] = await Promise.all([
      showtimeService.get(id),
      fetchSeatAvailability(id),
    ]);

    if (!showtime) {
      throw new ApiError(
        "Showtime not found.",
        "NOT_FOUND",
        404
      );
    }

    const profile = profileFor(showtime.auditoriumId);

    const prices = {
      ...tierPrices(showtime.price),
      standard: Number(showtime.standardPrice),
      prime: Number(showtime.primePrice),
    };

    const formattedSeats = rawSeats.map((seat) =>
      mapSeat(seat, showtime)
    );

    return {
      showtime,
      layout: getLayout(profile),
      seats: formattedSeats,
      prices,
    };
  },

  verify: async (showtimeId, selectedSeatIds) => {
    if (!Array.isArray(selectedSeatIds)) {
      throw new ApiError(
        "Invalid selected seats.",
        "VALIDATION",
        400
      );
    }

    const rawSeats = await fetchSeatAvailability(showtimeId);

    const seatMap = new Map(
      rawSeats.map((seat) => [
        Number(seat.dbId),
        seat,
      ])
    );

    const taken = selectedSeatIds.filter((seatId) => {
      const seat = seatMap.get(Number(seatId));

      return !seat || seat.status !== "available";
    });

    return {
      ok: taken.length === 0,
      taken,
    };
  },
};