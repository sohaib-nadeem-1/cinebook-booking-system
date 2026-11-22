
import { eq, getTableColumns } from "drizzle-orm";

import { db } from "../db/index.js";
import { auditoriums } from "../db/schema/auditorium.schema.js";
import { cinemas } from "../db/schema/cinemas.schema.js";
import { movies } from "../db/schema/movies.schema.js";
import { showtimes } from "../db/schema/showTime.schema.js";
import { booking } from "../db/schema/bookings.schema.js";
import { seats } from "../db/schema/seats.schema.js";
import { intervalsConflict, isValidSchedule, toInterval } from "../utils/showtime-interval.js";

const requestError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const isPositiveId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const assertAuditoriumHasSeats = async (auditoriumId, executor = db) => {
  const [seat] = await executor
    .select({ id: seats.id })
    .from(seats)
    .where(eq(seats.auditorium_id, Number(auditoriumId)))
    .limit(1);
  if (!seat) throw requestError(400, "This auditorium has no seats configured");
};

// The caller locks the auditorium row in its transaction before this check.
const findAuditoriumConflict = async (candidate, ignoreId = null, executor = db) => {
  const candidateInterval = toInterval(candidate.date, candidate.start_time, candidate.end_time);
  if (!candidateInterval) throw requestError(400, "Invalid date or showtime value");
  const rows = await executor
    .select()
    .from(showtimes)
    .where(eq(showtimes.auditorium_id, Number(candidate.auditorium_id)));

  return rows.find((row) => {
    if (ignoreId !== null && Number(row.id) === Number(ignoreId)) return false;
    const interval = toInterval(row.date, row.start_time, row.end_time);
    return interval && intervalsConflict(candidateInterval, interval);
  }) || null;
};

// Reusable query for showtime details with auditorium and cinema
const getShowtimesWithDetails = () => {
  return db
    .select({
      ...getTableColumns(showtimes),

      auditorium: {
        id: auditoriums.id,
        cinema_id: auditoriums.cinema_id,
        hall_no: auditoriums.hall_no,
      },

      cinema: {
        id: cinemas.id,
        name: cinemas.name,
        city: cinemas.city,
        address: cinemas.address,
        phone: cinemas.phone,
      },
    })
    .from(showtimes)
    .leftJoin(
      auditoriums,
      eq(showtimes.auditorium_id, auditoriums.id)
    )
    .leftJoin(
      cinemas,
      eq(auditoriums.cinema_id, cinemas.id)
    );
};

// CREATE SHOWTIME

export const createShowtime = async (req, res) => {
  try {
    const {
      movie_id,
      auditorium_id,
      format,
      date,
      start_time,
      end_time,
      standard_price,
      prime_price,
    } = req.body;

    if (
      !movie_id ||
      !auditorium_id ||
      !format ||
      !date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        message: "Required fields are missing",
      });
    }
    if (!isPositiveId(movie_id) || !isPositiveId(auditorium_id)) {
      return res.status(400).json({ message: "Movie and auditorium IDs must be positive integers" });
    }
    if (typeof format !== "string" || !format.trim() || format.trim().length > 32) {
      return res.status(400).json({ message: "Enter a valid screening format" });
    }

    if (
      standard_price === undefined ||
      prime_price === undefined ||
      Number(standard_price) <= 0 ||
      Number(prime_price) <= 0 ||
      !Number.isFinite(Number(standard_price)) ||
      !Number.isFinite(Number(prime_price))
    ) {
      return res.status(400).json({
        message: "Valid ticket prices are required",
      });
    }

    if (start_time === end_time) {
      return res.status(400).json({
        message: "Start time and end time cannot be the same",
      });
    }
    if (!isValidSchedule(date, start_time, end_time)) {
      return res.status(400).json({ message: "Enter a valid date and 24-hour time" });
    }

    const movie = await db
      .select()
      .from(movies)
      .where(eq(movies.id, Number(movie_id)));

    if (movie.length === 0) {
      return res.status(404).json({
        message: "Movie not found",
      });
    }

    const auditorium = await db
      .select()
      .from(auditoriums)
      .where(eq(auditoriums.id, Number(auditorium_id)));

    if (auditorium.length === 0) {
      return res.status(404).json({
        message: "Auditorium not found",
      });
    }

    const insertingShowtime = await db.transaction(async (tx) => {
      const [lockedAuditorium] = await tx
        .select({ id: auditoriums.id })
        .from(auditoriums)
        .where(eq(auditoriums.id, Number(auditorium_id)))
        .for("update");
      if (!lockedAuditorium) throw requestError(404, "Auditorium not found");
      await assertAuditoriumHasSeats(auditorium_id, tx);

      const conflict = await findAuditoriumConflict(
        { auditorium_id, date, start_time, end_time },
        null,
        tx
      );
      if (conflict) {
        throw requestError(409, "Showtime conflict: this auditorium already has a screening during this time (including cleaning buffer)");
      }

      return tx
        .insert(showtimes)
        .values({
          movie_id: Number(movie_id),
          auditorium_id: Number(auditorium_id),
          format,
          date,
          start_time,
          end_time,
          standard_price,
          prime_price,
        })
        .returning();
    });

    return res.status(201).json({
      message: "Showtime created successfully",
      insertingShowtime,
    });

  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error("Create Showtime Error:", error);

    return res.status(500).json({
      message: "Failed to create showtime",
    });
  }
};

// GET ALL SHOWTIMES WITH AUDITORIUM AND CINEMA

export const getAllShowtimes = async (req, res) => {
  try {
    const allShowtimes = await getShowtimesWithDetails();

    return res.status(200).json({
      message: "All showtimes fetched successfully",
      allShowtimes,
    });

  } catch (error) {
    console.error("Get All Showtimes Error:", error);

    return res.status(500).json({
      message: "Failed to fetch showtimes",
    });
  }
};

// GET SINGLE SHOWTIME WITH AUDITORIUM AND CINEMA

export const getSingleShowtime = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Valid Showtime ID is required",
      });
    }

    const showtime = await getShowtimesWithDetails()
      .where(eq(showtimes.id, id));

    if (showtime.length === 0) {
      return res.status(404).json({
        message: "Showtime not found",
      });
    }

    return res.status(200).json({
      message: "Showtime fetched successfully",
      showtime,
    });

  } catch (error) {
    console.error("Get Single Showtime Error:", error);

    return res.status(500).json({
      message: "Failed to fetch showtime",
    });
  }
};

// UPDATE SHOWTIME

export const updateShowtime = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Valid Showtime ID is required",
      });
    }

    const {
      movie_id,
      auditorium_id,
      format,
      date,
      start_time,
      end_time,
      standard_price,
      prime_price,
    } = req.body;

    if (
      !movie_id ||
      !auditorium_id ||
      !format ||
      !date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        message: "Required fields are missing",
      });
    }
    if (!isPositiveId(movie_id) || !isPositiveId(auditorium_id)) {
      return res.status(400).json({ message: "Movie and auditorium IDs must be positive integers" });
    }
    if (typeof format !== "string" || !format.trim() || format.trim().length > 32) {
      return res.status(400).json({ message: "Enter a valid screening format" });
    }

    if (
      standard_price === undefined ||
      prime_price === undefined ||
      !Number.isFinite(Number(standard_price)) ||
      !Number.isFinite(Number(prime_price)) ||
      Number(standard_price) <= 0 ||
      Number(prime_price) <= 0
    ) {
      return res.status(400).json({
        message: "Valid ticket prices are required",
      });
    }

    if (start_time === end_time) {
      return res.status(400).json({
        message: "Start time and end time cannot be the same",
      });
    }
    if (!isValidSchedule(date, start_time, end_time)) {
      return res.status(400).json({ message: "Enter a valid date and 24-hour time" });
    }

    const movie = await db
      .select()
      .from(movies)
      .where(eq(movies.id, Number(movie_id)));

    if (movie.length === 0) {
      return res.status(404).json({
        message: "Movie not found",
      });
    }

    const auditorium = await db
      .select()
      .from(auditoriums)
      .where(eq(auditoriums.id, Number(auditorium_id)));

    if (auditorium.length === 0) {
      return res.status(404).json({
        message: "Auditorium not found",
      });
    }

    const existingShowtime = await db
      .select()
      .from(showtimes)
      .where(eq(showtimes.id, id));

    if (existingShowtime.length === 0) {
      return res.status(404).json({
        message: "Showtime not found",
      });
    }

    const updatedShowtime = await db.transaction(async (tx) => {
      const [lockedAuditorium] = await tx
        .select({ id: auditoriums.id })
        .from(auditoriums)
        .where(eq(auditoriums.id, Number(auditorium_id)))
        .for("update");
      if (!lockedAuditorium) throw requestError(404, "Auditorium not found");
      await assertAuditoriumHasSeats(auditorium_id, tx);

      const conflict = await findAuditoriumConflict(
        { auditorium_id, date, start_time, end_time },
        id,
        tx
      );
      if (conflict) {
        throw requestError(409, "Showtime conflict: this auditorium already has a screening during this time (including cleaning buffer)");
      }

      const updated = await tx
        .update(showtimes)
        .set({
          movie_id: Number(movie_id),
          auditorium_id: Number(auditorium_id),
          format,
          date,
          start_time,
          end_time,
          standard_price,
          prime_price,
          updated_at: new Date(),
        })
        .where(eq(showtimes.id, id))
        .returning();
      if (updated.length === 0) throw requestError(404, "Showtime not found");
      return updated;
    });

    return res.status(200).json({
      message: "Showtime updated successfully",
      updatedShowtime,
    });

  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error("Update Showtime Error:", error);

    return res.status(500).json({
      message: "Failed to update showtime",
    });
  }
};

// DELETE SHOWTIME

export const deleteShowtime = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Valid showtime ID is required" });
    }

    const deletedShowtime = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: showtimes.id })
        .from(showtimes)
        .where(eq(showtimes.id, id))
        .for("update");

      if (!existing) throw requestError(404, "Showtime not found");

      const [linkedBooking] = await tx
        .select({ id: booking.id })
        .from(booking)
        .where(eq(booking.showtime_id, id))
        .limit(1);

      if (linkedBooking) {
        throw requestError(409, "This showtime has booking history and cannot be deleted. Resolve its bookings through a cancellation/refund workflow first.");
      }

      return tx
        .delete(showtimes)
        .where(eq(showtimes.id, id))
        .returning();
    });

    return res.status(200).json({
      message: "Showtime deleted successfully",
      deletedShowtime,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Delete Showtime Error:", error);
    return res.status(500).json({ message: "Failed to delete showtime" });
  }
};
