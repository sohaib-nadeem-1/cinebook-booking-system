import { api, ApiError } from "./api.js";

const API_ENDPOINT = "/bookings";

const getArray = (response, key) => {
  const result = response?.[key];

  return Array.isArray(result)
    ? result
    : result
      ? [result]
      : [];
};

const getOne = (response, key) => {
  const result = response?.[key];

  return Array.isArray(result)
    ? result[0] || null
    : result || null;
};

export const bookingPhase = (booking) => {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "refunded") return "refunded";

  return "upcoming";
};

export const hoursUntil = (date, time) => {
  if (!date || !time) return null;

  const target = new Date(`${date}T${time}`);
  return (target.getTime() - Date.now()) / 3600000;
};

export const canCancel = (booking) => {
  const hours = hoursUntil(
    booking.date,
    booking.start_time
  );

  return (
    booking.status === "confirmed" &&
    hours !== null &&
    hours > 0
  );
};

export const canRefund = (booking) => {
  const hours = hoursUntil(
    booking.date,
    booking.start_time
  );

  return canCancel(booking) && hours >= 2;
};

export const bookingService = {
  list: async () => {
    const response = await api.get(
      `${API_ENDPOINT}/my-bookings`
    );

    return getArray(response, "bookings");
  },

  get: async (id) => {
    const response = await api.get(
      `${API_ENDPOINT}/${id}`
    );

    return getOne(response, "booking");
  },

  create: async ({ showtimeId, seats }) => {
    const seatsID = seats.map((seat) =>
      Number(seat.dbId ?? seat.seatId ?? seat.id)
    );

    if (
      !Number.isInteger(Number(showtimeId)) ||
      seatsID.length === 0 ||
      seatsID.some(
        (id) => !Number.isInteger(id) || id <= 0
      )
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
        totalAmount: response.totalAmount,
      };
    } catch (error) {
      if (error.status === 409) {
        throw new ApiError(
          error.message || "One or more seats are already booked.",
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

    return getOne(response, "booking");
  },

  stats: async () => {
    const bookings = await bookingService.list();

    const total = bookings.length;

    const confirmed = bookings.filter(
      (item) => item.status === "confirmed"
    ).length;

    const cancelled = bookings.filter(
      (item) => item.status === "cancelled"
    ).length;

    const refunded = bookings.filter(
      (item) => item.status === "refunded"
    ).length;

    return {
      total,
      confirmed,
      cancelled,
      refunded,
    };
  },
};