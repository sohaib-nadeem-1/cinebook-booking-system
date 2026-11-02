import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db/index.js";

import { showtimes } from "../db/schema/showTime.schema.js";
import { seats } from "../db/Schema/seats.schema.js";

import { booking } from "../db/Schema/bookings.schema.js";
import { booking_seats } from "../db/Schema/booking_seats.schema.js";


// ======================================================
// 1. CREATE BOOKING
// ======================================================

export const createBookings = async (req, res) => {
  try {
    const { showtimeId, seatsID } = req.body;

    const userid = req.user.userid;

    // --------------------------------------------------
    // STEP 1: Basic Validation
    // --------------------------------------------------

    if (
      !showtimeId ||
      !Array.isArray(seatsID) ||
      seatsID.length === 0
    ) {
      return res.status(400).json({
        message: "Showtime ID and seats are required",
      });
    }

    // Remove duplicate seat IDs
    const uniqueSeatsID = [...new Set(seatsID)];

    if (uniqueSeatsID.length !== seatsID.length) {
      return res.status(400).json({
        message: "Duplicate seats are not allowed",
      });
    }

    // --------------------------------------------------
    // STEP 2: Check Showtime
    // --------------------------------------------------

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

    // --------------------------------------------------
    // STEP 3: Check Selected Seats
    // --------------------------------------------------

    const checkSeats = await db
      .select()
      .from(seats)
      .where(inArray(seats.id, uniqueSeatsID));

    if (checkSeats.length !== uniqueSeatsID.length) {
      return res.status(404).json({
        message: "One or more selected seats not found",
      });
    }

    // --------------------------------------------------
    // STEP 4: Check Auditorium
    // --------------------------------------------------

    const wrongSeats = checkSeats.some(
      (seat) => seat.auditorium_id !== showAuditoriumID
    );

    if (wrongSeats) {
      return res.status(400).json({
        message: "Selected seat does not belong to this auditorium",
      });
    }

    // --------------------------------------------------
    // STEP 5: Check Already Booked Seats
    // --------------------------------------------------

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
          inArray(booking_seats.seat_id, uniqueSeatsID),
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

    // --------------------------------------------------
    // STEP 6: Calculate Individual Seat Prices
    // --------------------------------------------------

    const seatsWithPrice = checkSeats.map((seat) => {
      let price;

      if (seat.seat_category === "standard") {
        price = show.standard_price;
      } else if (seat.seat_category === "prime") {
        price = show.prime_price;
      } else {
        return null;
      }

      return {
        seat_id: seat.id,
        price: price,
      };
    });

    // Check invalid seat category
    if (seatsWithPrice.some((seat) => seat === null)) {
      return res.status(400).json({
        message: "Invalid seat category",
      });
    }

    // --------------------------------------------------
    // STEP 7: Calculate Total
    // --------------------------------------------------

    const totalAmount = seatsWithPrice.reduce(
      (total, seat) => {
        return total + Number(seat.price);
      },
      0
    );

    // --------------------------------------------------
    // STEP 8: Transaction
    // --------------------------------------------------

    const createdBooking = await db.transaction(async (tx) => {

      // ------------------------------------------------
      // STEP 9: Create Booking
      // ------------------------------------------------

      const [newBooking] = await tx
        .insert(booking)
        .values({
          user_id: userid,
          showtime_id: showtimeId,
          total_amount: totalAmount.toString(),
          status: "confirmed",
        })
        .returning();

      // ------------------------------------------------
      // STEP 10: Create Booking Seats
      // ------------------------------------------------

      await tx
        .insert(booking_seats)
        .values(
          seatsWithPrice.map((seat) => ({
            booking_id: newBooking.id,
            seat_id: seat.seat_id,
            price: seat.price.toString(),
          }))
        );

      return newBooking;
    });

    // --------------------------------------------------
    // STEP 11: Success Response
    // --------------------------------------------------

    return res.status(201).json({
      message: "Booking Created Successfully",

      booking: createdBooking,

      seats: seatsWithPrice,

      totalAmount: totalAmount,
    });

  } catch (error) {
    console.error("Create Booking Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};


// ======================================================
// 2. GET MY BOOKINGS
// ======================================================

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

    if (Number.isNaN(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }
 
    // Find user's booking
 

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
        message: "Booking Not Found",
      });
    }
 
    // Get booked seats
    
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

    if (Number.isNaN(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }
 
    // Find user's booking
 

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
        message: "Booking Not Found",
      });
    }

    const currentBooking = existingBooking[0];
 
    // Check current status
 

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
 
    // Cancel booking
     
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

    if (Number.isNaN(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

     
    // Get booking
     
    const result = await db
      .select()
      .from(booking)
      .where(eq(booking.id, bookingId));

    if (result.length === 0) {
      return res.status(404).json({
        message: "Booking Not Found",
      });
    }

    // Get seats
    
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

    if (Number.isNaN(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

  
    // Find booking
   
    const existingBooking = await db
      .select()
      .from(booking)
      .where(eq(booking.id, bookingId));

    if (existingBooking.length === 0) {
      return res.status(404).json({
        message: "Booking Not Found",
      });
    }

    const currentBooking = existingBooking[0];

    
    // Check status
   

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

    
    // Cancel booking
    

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