
import { api, ApiError } from "./api.js";
import { seatService } from "./seatService.js";

const API_ENDPOINT = "/bookings";

const getArray = (response, key) => {
  const result = response?.[key];

  if (Array.isArray(result)) return result;
  return result ? [result] : [];
};

const getOne = (response, key) => {
  const result = response?.[key];

  return Array.isArray(result)
    ? result[0] || null
    : result || null;
};

const getBookingDateTime = (booking) => {
  const date = booking.date;
  const time = booking.start || booking.start_time;

  if (!date || !time) return null;

  const target = new Date(
    `${String(date).slice(0, 10)}T${time}`
  );

  return Number.isNaN(target.getTime()) ? null : target;
};

export const hoursUntil = (date, time) => {
  if (!date || !time) return null;

  const target = new Date(`${date}T${time}`);

  if (Number.isNaN(target.getTime())) return null;

  return (target.getTime() - Date.now()) / 3600000;
};

export const bookingPhase = (booking) => {
  if (
    booking.status === "cancelled" ||
    booking.status === "refunded"
  ) {
    return "cancelled";
  }

  const target = getBookingDateTime(booking);

  if (target && target.getTime() <= Date.now()) {
    return "completed";
  }

  return "upcoming";
};

export const canCancel = (booking) => {
  if (booking.status !== "confirmed") return false;

  const target = getBookingDateTime(booking);

  return target !== null && target.getTime() > Date.now();
};

export const canRefund = (booking) => {
  if (!canCancel(booking)) return false;

  const target = getBookingDateTime(booking);
  const hours = (target.getTime() - Date.now()) / 3600000;

  return hours >= 2;
};

const enrichBooking = async (booking) => {
  const bookingId = Number(booking.id);
  const showtimeId = Number(booking.showtime_id);

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    throw new ApiError(
      "Invalid booking returned by server.",
      "INVALID_RESPONSE"
    );
  }

  const detailResponse = await api.get(
    `${API_ENDPOINT}/${bookingId}`
  );

  const detail = getOne(detailResponse, "booking");

  if (!detail) {
    throw new ApiError(
      `Booking ${bookingId} details not found.`,
      "INVALID_RESPONSE"
    );
  }

  const bookingSeats = getArray(detailResponse, "seats");

  let showtime = null;
  let availableSeats = [];

  if (Number.isInteger(showtimeId) && showtimeId > 0) {
    try {
      const seatMap = await seatService.getSeatMap(showtimeId);

      showtime = seatMap.showtime;
      availableSeats = seatMap.seats || [];
    } catch (error) {
      console.error(
        `Unable to load details for booking ${bookingId}:`,
        error
      );
    }
  }

  const seatLookup = new Map(
    availableSeats.map((seat) => [
      Number(seat.dbId),
      seat,
    ])
  );

  const seats = bookingSeats.map((bookingSeat) => {
    const seatId = Number(bookingSeat.seat_id);
    const seatDetails = seatLookup.get(seatId);

    return {
      ...(seatDetails || {}),
      dbId: seatId,
      seatId,
      id: seatDetails?.id || String(seatId),
      tier:
        seatDetails?.tier ||
        seatDetails?.type ||
        "standard",
      category:
        seatDetails?.category ||
        seatDetails?.seat_category ||
        "standard",
      price: Number(bookingSeat.price),
    };
  });

  const movie = showtime?.movie || {};
  const cinema = showtime?.cinema || {};
  const auditorium = showtime?.auditorium || {};

  const total = Number(
    detail.total_amount ??
    booking.total_amount ??
    0
  );

  const date = showtime?.date
    ? String(showtime.date).slice(0, 10)
    : null;

  const start =
    showtime?.start_time ||
    showtime?.startTime ||
    null;

  return {
    ...detail,

    id: bookingId,
    showtime_id: showtimeId,
    status: detail.status || booking.status,

    date,
    start,
    start_time: start,

    format: showtime?.format || "Movie",

    movie,
    movieTitle:
      movie.title || "Movie details unavailable",

    poster:
      movie.poster_url || "",

    cinema,
    cinemaShort:
      cinema.name || "Cinema details unavailable",

    city: cinema.city || "",
    address: cinema.address || "",

    auditorium,
    auditoriumName:
      auditorium.name ||
      (auditorium.hall_no
        ? `Hall ${auditorium.hall_no}`
        : "Auditorium unavailable"),

    seats,
    total,
    total_amount: total,
  };
};

export const bookingService = {
  list: async () => {
    const response = await api.get(
      `${API_ENDPOINT}/my-bookings`
    );

    const bookings = getArray(response, "bookings");

    return Promise.all(
      bookings.map(enrichBooking)
    );
  },

  get: async (id) => {
    const response = await api.get(
      `${API_ENDPOINT}/${id}`
    );

    const booking = getOne(response, "booking");

    if (!booking) return null;

    return enrichBooking(booking);
  },

  create: async ({ showtimeId, seats }) => {
    if (!Array.isArray(seats)) {
      throw new ApiError(
        "Seats must be an array.",
        "VALIDATION",
        400
      );
    }

    const seatsID = seats.map((seat) =>
      Number(seat.dbId ?? seat.seatId ?? seat.id)
    );

    if (
      !Number.isInteger(Number(showtimeId)) ||
      Number(showtimeId) <= 0 ||
      seatsID.length === 0 ||
      seatsID.some(
        (id) => !Number.isInteger(id) || id <= 0
      ) ||
      new Set(seatsID).size !== seatsID.length
    ) {
      throw new ApiError(
        "Invalid showtime or seat selection.",
        "VALIDATION",
        400
      );
    }

    try {
      const response = await api.post(
        `${API_ENDPOINT}/`,
        {
          showtimeId: Number(showtimeId),
          seatsID,
        }
      );

      const createdBooking = response?.booking;

      if (!createdBooking?.id) {
        throw new ApiError(
          "Invalid booking response from server.",
          "INVALID_RESPONSE"
        );
      }

      return {
        ...createdBooking,
        id: Number(createdBooking.id),
        seats: response.seats || [],
        total: Number(response.totalAmount),
      };
    } catch (error) {
      if (error.status === 409) {
        throw new ApiError(
          error.message ||
            "One or more seats are already booked.",
          "SEAT_TAKEN",
          409
        );
      }

      throw error;
    }
  },

  cancel: async (id) => {
    const response = await api.patch(
      `${API_ENDPOINT}/${id}/cancel`
    );

    const cancelledBooking = getOne(response, "booking");

    if (!cancelledBooking) {
      throw new ApiError(
        "Invalid cancellation response.",
        "INVALID_RESPONSE"
      );
    }

    return cancelledBooking;
  },

  stats: async () => {
    const bookings = await bookingService.list();

    return {
      total: bookings.length,

      tickets: bookings.reduce(
        (sum, booking) => sum + booking.seats.length,
        0
      ),

      spent: bookings
        .filter(
          (booking) =>
            booking.status === "confirmed" ||
            booking.status === "pending"
        )
        .reduce(
          (sum, booking) => sum + booking.total,
          0
        ),
    };
  },
};
