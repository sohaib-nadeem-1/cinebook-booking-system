import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db/index.js";

import { showtimes } from "../db/schema/showTime.schema.js";
import { seats } from "../db/Schema/seats.schema.js";

import { booking } from "../db/Schema/bookings.schema.js";
import { booking_seats } from "../db/Schema/booking_seats.schema.js";

// Helper for expected booking errors
const createBookingError = (statusCode, message, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.extra = extra;
  return error;
};

// 1. CREATE BOOKING

export const createBookings = async (req, res) => {
  try {
    const { showtimeId, seatsID } = req.body;
    const userid = Number(req.user.userid);
    const parsedShowtimeId = Number(showtimeId);

    // STEP 1: Validate request data
    if (
      !Number.isInteger(parsedShowtimeId) ||
      parsedShowtimeId <= 0 ||
      !Array.isArray(seatsID) ||
      seatsID.length === 0
    ) {
      return res.status(400).json({
        message: "A valid showtime ID and at least one seat are required",
      });
    }

    if (!Number.isInteger(userid) || userid <= 0) {
      return res.status(401).json({
        message: "Invalid authenticated user",
      });
    }

    const uniqueSeatsID = seatsID.map(Number);

    if (
      uniqueSeatsID.some(
        (seatId) => !Number.isInteger(seatId) || seatId <= 0
      )
    ) {
      return res.status(400).json({
        message: "All seat IDs must be valid positive integers",
      });
    }

    if (new Set(uniqueSeatsID).size !== uniqueSeatsID.length) {
      return res.status(400).json({
        message: "Duplicate seats are not allowed",
      });
    }

    // STEP 2: Transaction-based booking
    const createdBooking = await db.transaction(async (tx) => {
      // Lock showtime row to prevent concurrent booking conflicts
      const [show] = await tx
        .select()
        .from(showtimes)
        .where(eq(showtimes.id, parsedShowtimeId))
        .for("update");

      if (!show) {
        throw createBookingError(404, "Showtime not found");
      }

      // STEP 3: Fetch selected seats
      const selectedSeats = await tx
        .select()
        .from(seats)
        .where(inArray(seats.id, uniqueSeatsID));

      if (selectedSeats.length !== uniqueSeatsID.length) {
        throw createBookingError(
          404,
          "One or more selected seats were not found"
        );
      }

      // STEP 4: Validate auditorium
      const wrongSeats = selectedSeats.some(
        (seat) => seat.auditorium_id !== show.auditorium_id
      );

      if (wrongSeats) {
        throw createBookingError(
          400,
          "Selected seat does not belong to this auditorium"
        );
      }

      // STEP 5: Check already booked seats
      const alreadyBookedSeats = await tx
        .select({
          seat_id: booking_seats.seat_id,
        })
        .from(booking_seats)
        .innerJoin(
          booking,
          eq(booking_seats.booking_id, booking.id)
        )
        .where(
          and(
            eq(booking.showtime_id, parsedShowtimeId),
            inArray(booking_seats.seat_id, uniqueSeatsID),
            eq(booking.status, "confirmed")
          )
        );

      if (alreadyBookedSeats.length > 0) {
        const bookedSeatIds = alreadyBookedSeats.map(
          (seat) => seat.seat_id
        );

        throw createBookingError(
          409,
          "Some selected seats are already booked",
          { bookedSeats: bookedSeatIds }
        );
      }

      // STEP 6: Calculate individual seat prices
      const seatsWithPrice = selectedSeats.map((seat) => {
        let price;

        if (seat.seat_category === "standard") {
          price = show.standard_price;
        } else if (seat.seat_category === "prime") {
          price = show.prime_price;
        } else {
          throw createBookingError(
            400,
            `Unsupported seat category: ${seat.seat_category}`
          );
        }

        const numericPrice = Number(price);

        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
          throw createBookingError(
            400,
            "Invalid price configured for this showtime"
          );
        }

        return {
          seat_id: seat.id,
          price: numericPrice.toFixed(2),
        };
      });

      // STEP 7: Calculate total amount in cents
      const totalCents = seatsWithPrice.reduce((total, seat) => {
        return total + Math.round(Number(seat.price) * 100);
      }, 0);

      const totalAmount = (totalCents / 100).toFixed(2);

      // STEP 8: Create booking
      const [newBooking] = await tx
        .insert(booking)
        .values({
          user_id: userid,
          showtime_id: parsedShowtimeId,
          total_amount: totalAmount,
          status: "confirmed",
        })
        .returning();

      // STEP 9: Create booking seats
      await tx
        .insert(booking_seats)
        .values(
          seatsWithPrice.map((seat) => ({
            booking_id: newBooking.id,
            seat_id: seat.seat_id,
            price: seat.price,
          }))
        );

      return {
        booking: newBooking,
        seats: seatsWithPrice,
        totalAmount,
      };
    });

    // STEP 10: Success response
    return res.status(201).json({
      message: "Booking created successfully",
      booking: createdBooking.booking,
      seats: createdBooking.seats,
      totalAmount: createdBooking.totalAmount,
    });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
        ...error.extra,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        message: "A selected seat conflicts with an existing booking",
      });
    }

    console.error("Create Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// 2. GET MY BOOKINGS

export const getMyBookings = async (req, res) => {
  try {
    const userid = req.user.userid;

    const myBookings = await db
      .select()
      .from(booking)
      .where(eq(booking.user_id, userid));

    return res.status(200).json({
      message: "Bookings fetched successfully",
      bookings: myBookings,
    });

  } catch (error) {
    console.error("Get My Bookings Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// 3. GET SINGLE BOOKING

export const getSingleBooking = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const userid = req.user.userid;

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    const result = await db
      .select()
      .from(booking)
      .where(
        and(
          eq(booking.id, bookingId),
          eq(booking.user_id, userid)
        )
      );

    if (result.length === 0) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const selectedSeats = await db
      .select()
      .from(booking_seats)
      .where(eq(booking_seats.booking_id, bookingId));

    return res.status(200).json({
      message: "Booking fetched successfully",
      booking: result[0],
      seats: selectedSeats,
    });

  } catch (error) {
    console.error("Get Single Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// 4. CANCEL MY BOOKING

export const cancelBooking = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const userid = req.user.userid;

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    const existingBooking = await db
      .select()
      .from(booking)
      .where(
        and(
          eq(booking.id, bookingId),
          eq(booking.user_id, userid)
        )
      );

    if (existingBooking.length === 0) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const currentBooking = existingBooking[0];

    if (currentBooking.status === "cancelled") {
      return res.status(400).json({
        message: "Booking is already cancelled",
      });
    }

    if (currentBooking.status === "refunded") {
      return res.status(400).json({
        message: "Refunded booking cannot be cancelled",
      });
    }

    const [cancelledBooking] = await db
      .update(booking)
      .set({
        status: "cancelled",
        updated_at: new Date(),
      })
      .where(
        and(
          eq(booking.id, bookingId),
          eq(booking.user_id, userid)
        )
      )
      .returning();

    return res.status(200).json({
      message: "Booking cancelled successfully",
      booking: cancelledBooking,
    });

  } catch (error) {
    console.error("Cancel Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// 5. ADMIN / STAFF - GET ALL BOOKINGS

export const getAllBookings = async (req, res) => {
  try {
    const allBookings = await db
      .select()
      .from(booking);

    return res.status(200).json({
      message: "All bookings fetched successfully",
      bookings: allBookings,
    });

  } catch (error) {
    console.error("Get All Bookings Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// 6. ADMIN / STAFF - GET ANY BOOKING

export const getBookingByIdAdmin = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    const result = await db
      .select()
      .from(booking)
      .where(eq(booking.id, bookingId));

    if (result.length === 0) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const selectedSeats = await db
      .select()
      .from(booking_seats)
      .where(eq(booking_seats.booking_id, bookingId));

    return res.status(200).json({
      message: "Booking fetched successfully",
      booking: result[0],
      seats: selectedSeats,
    });

  } catch (error) {
    console.error("Admin Get Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// 7. ADMIN / STAFF - CANCEL ANY BOOKING

export const adminCancelBooking = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    const existingBooking = await db
      .select()
      .from(booking)
      .where(eq(booking.id, bookingId));

    if (existingBooking.length === 0) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const currentBooking = existingBooking[0];

    if (currentBooking.status === "cancelled") {
      return res.status(400).json({
        message: "Booking is already cancelled",
      });
    }

    if (currentBooking.status === "refunded") {
      return res.status(400).json({
        message: "Refunded booking cannot be cancelled",
      });
    }

    const [cancelledBooking] = await db
      .update(booking)
      .set({
        status: "cancelled",
        updated_at: new Date(),
      })
      .where(eq(booking.id, bookingId))
      .returning();

    return res.status(200).json({
      message: "Booking cancelled successfully",
      booking: cancelledBooking,
    });

  } catch (error) {
    console.error("Admin Cancel Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};