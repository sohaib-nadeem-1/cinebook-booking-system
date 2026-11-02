import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db/index.js";

import { showtimes } from "../db/schema/showTime.schema.js";
import { seats } from "../db/Schema/seats.schema.js";

import { booking } from "../db/Schema/bookings.schema.js";
import { booking_seats } from "../db/Schema/booking_seats.schema.js";

export const createBookings = async (req, res) => {
  try {
    const { showtimeId, seatsID } = req.body;

    const userid = req.user.userid;

    // ==========================================
    // STEP 1: Basic Validation
    // ==========================================

    if (!showtimeId || !Array.isArray(seatsID) || seatsID.length === 0) {
      return res.status(400).json({
        message: "Showtime ID and seats are required",
      });
    }

    const seatsCounted = seatsID.length;

    // ==========================================
    // STEP 2: Check Showtime
    // ==========================================

    const checkShowID = await db
      .select()
      .from(showtimes)
      .where(eq(showtimes.id, showtimeId));

    if (checkShowID.length === 0) {
      return res.status(404).json({
        message: "Showtime Not Found",
      });
    }

    const show = checkShowID[0];

    const showAuditoriumID = show.auditorium_id;

    // ==========================================
    // STEP 3: Check Selected Seats
    // ==========================================

    const checkSeats = await db
      .select()
      .from(seats)
      .where(inArray(seats.id, seatsID));

    if (checkSeats.length !== seatsCounted) {
      return res.status(404).json({
        message: "One or more selected seats not found",
      });
    }

    // ==========================================
    // STEP 4: Check Auditorium
    // ==========================================

    const wrongSeats = checkSeats.some((seat) => {
      return seat.auditorium_id !== showAuditoriumID;
    });

    if (wrongSeats) {
      return res.status(400).json({
        message: "Selected seat does not belong to this auditorium",
      });
    }

    // ==========================================
    // STEP 5: Check Already Booked Seats
    // ==========================================

    const alreadyBookedSeats = await db
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
          eq(booking.showtime_id, showtimeId),
          inArray(booking_seats.seat_id, seatsID),
          eq(booking.status, "confirmed")
        )
      );

    if (alreadyBookedSeats.length > 0) {
      const bookedSeatIds = alreadyBookedSeats.map(
        (seat) => seat.seat_id
      );

      return res.status(409).json({
        message: "Some selected seats are already booked",
        bookedSeats: bookedSeatIds,
      });
    }

    // ==========================================
    // STEP 6: Calculate Individual Seat Prices
    // ==========================================

    const seatsWithPrice = checkSeats.map((seat) => {

      let price;

      if (seat.seat_category === "standard") {
        price = show.standard_price;
      }

      else if (seat.seat_category === "prime") {
        price = show.prime_price;
      }

      else {
        return null;
      }

      return {
        seat_id: seat.id,
        price: price,
      };
    });

    // Check invalid category
    if (seatsWithPrice.some((seat) => seat === null)) {
      return res.status(400).json({
        message: "Invalid seat category",
      });
    }

    // ==========================================
    // STEP 7: Calculate Total
    // ==========================================

    const totalAmount = seatsWithPrice.reduce(
      (total, seat) => {
        return total + Number(seat.price);
      },
      0
    );

    // ==========================================
    // STEP 8: Transaction
    // ==========================================

    const createdBooking = await db.transaction(async (tx) => {

      // ========================================
      // STEP 9: Create Booking
      // ========================================

      const [newBooking] = await tx
        .insert(booking)
        .values({
          user_id: userid,
          showtime_id: showtimeId,
          total_amount: totalAmount.toString(),
          status: "confirmed",
        })
        .returning();

      // ========================================
      // STEP 10: Create Booking Seats
      // ========================================

      await tx
        .insert(booking_seats)
        .values(
          seatsWithPrice.map((seat) => {
            return {
              booking_id: newBooking.id,
              seat_id: seat.seat_id,
              price: seat.price.toString(),
            };
          })
        );

      return newBooking;
    });

    // ==========================================
    // STEP 11: Success Response
    // ==========================================

    return res.status(201).json({
      message: "Booking Created Successfully",

      booking: createdBooking,
    });

  } catch (error) {

    console.error("Create Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};