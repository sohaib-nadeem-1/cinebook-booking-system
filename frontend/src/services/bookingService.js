import { api, ApiError } from "./api.js";

const getBookingDateTime = (booking) => {
  const date = booking.date;
  const startTime = booking.start_time || booking.start;

  if (!date || !startTime) return null;

  return new Date(`${date}T${startTime}`);
};

export const bookingPhase = (booking) => {
  if (["cancelled", "refunded"].includes(booking.status)) {
    return "cancelled";
  }

  const start = getBookingDateTime(booking);

  if (!start) return "upcoming";

  return start.getTime() + 3 * 3600 * 1000 < Date.now()
    ? "completed"
    : "upcoming";
};

export const hoursUntil = (booking) => {
  const start = getBookingDateTime(booking);

  if (!start) return 0;

  return (start.getTime() - Date.now()) / 3600000;
};

export const canCancel = (booking) => {
  return (
    ["confirmed", "pending"].includes(booking.status) &&
    hoursUntil(booking) > 0
  );
};

export const canRefund = () => false;

// =====================================================
// BOOKING SERVICE
// =====================================================

export const bookingService = {
  // GET MY BOOKINGS
  list: async ({
    search = "",
    status,
    date,
    movieId,
    phase,
  } = {}) => {
    const response = await api.get("/bookings/my-bookings");

    let bookings = response.bookings || [];

    const query = search.trim().toLowerCase();

    if (query) {
      bookings = bookings.filter((booking) =>
        String(booking.id).toLowerCase().includes(query)
      );
    }

    if (status) {
      bookings = bookings.filter(
        (booking) => booking.status === status
      );
    }

    if (date) {
      bookings = bookings.filter(
        (booking) => booking.date === date
      );
    }

    if (movieId) {
      bookings = bookings.filter(
        (booking) => booking.movie_id === movieId
      );
    }

    if (phase) {
      bookings = bookings.filter(
        (booking) => bookingPhase(booking) === phase
      );
    }

    return bookings.sort(
      (a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
    );
  },

  // GET SINGLE BOOKING
  get: async (id) => {
    if (!id) {
      throw new ApiError("Booking ID is required.", "INVALID_ID");
    }

    const response = await api.get(`/bookings/${id}`);

    if (!response.booking) {
      throw new ApiError("Booking not found.", "NOT_FOUND", 404);
    }

    return {
      ...response.booking,
      seats: response.seats || [],
    };
  },

  // CREATE BOOKING
  create: async ({ showtimeId, seats }) => {
    if (!showtimeId) {
      throw new ApiError("Showtime is required.", "VALIDATION");
    }

    if (!Array.isArray(seats) || seats.length === 0) {
      throw new ApiError("Select at least one seat.", "NO_SEATS");
    }

    const seatIds = seats.map((seat) => {
      const id = Number(
        seat.dbId ?? seat.seatId ?? seat.id
      );

      if (!Number.isInteger(id) || id <= 0) {
        throw new ApiError(
          "Invalid database seat ID.",
          "INVALID_SEAT_ID"
        );
      }

      return id;
    });

    if (new Set(seatIds).size !== seatIds.length) {
      throw new ApiError(
        "Duplicate seats are not allowed.",
        "DUPLICATE_SEATS"
      );
    }

    try {
      const response = await api.post("/bookings/", {
        showtimeId: Number(showtimeId),
        seatsID: seatIds,
      });

      if (!response.booking?.id) {
        throw new ApiError(
          "Invalid booking response from server.",
          "INVALID_RESPONSE"
        );
      }

      // Normalize backend response for CheckoutPage
      return {
        ...response.booking,
        seats: response.seats || [],
        totalAmount: response.totalAmount,
      };
    } catch (error) {
      if (error.status === 409) {
        throw new ApiError(
          error.message,
          "SEAT_TAKEN",
          409
        );
      }

      throw error;
    }
  },

  // CANCEL BOOKING
  cancel: async (id) => {
    if (!id) {
      throw new ApiError("Booking ID is required.", "INVALID_ID");
    }

    const response = await api.patch(
      `/bookings/${id}/cancel`
    );

    if (!response.booking) {
      throw new ApiError(
        "Unable to cancel booking.",
        "CANCEL_FAILED"
      );
    }

    return response.booking;
  },

  // BOOKING STATS
  stats: async () => {
    const response = await api.get("/bookings/my-bookings");

    const bookings = response.bookings || [];

    const activeBookings = bookings.filter(
      (booking) =>
        !["cancelled", "refunded"].includes(booking.status)
    );

    let tickets = 0;

    for (const booking of activeBookings) {
      try {
        const detail = await api.get(`/bookings/${booking.id}`);
        tickets += detail.seats?.length || 0;
      } catch (error) {
        console.error(
          `Unable to fetch booking ${booking.id}:`,
          error
        );
      }
    }

    const spent = activeBookings.reduce(
      (total, booking) =>
        total + Number(booking.total_amount || 0),
      0
    );

    const upcoming = activeBookings.filter(
      (booking) => bookingPhase(booking) === "upcoming"
    ).length;

    return {
      total: bookings.length,
      tickets,
      spent,
      upcoming,
    };
  },
};