import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditoriums } from "../db/schema/auditorium.schema.js";
import { movies } from "../db/schema/movies.schema.js";
import { showtimes } from "../db/schema/showTime.schema.js";

 

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


    // Basic validation

    if (!movie_id || !auditorium_id || !format || !date || !start_time || !end_time) {
      return res.status(400).json({
        message: "Required fields are missing",
      });
    }

    if (standard_price <= 0) {
      return res.status(400).json({
        message: "Standard price must be greater than 0",
      });
    }

    if (prime_price <= 0) {
      return res.status(400).json({
        message: "Prime price must be greater than 0",
      });
    }

    if (end_time <= start_time) {
      return res.status(400).json({
        message: "End time must be greater than start time",
      });
    }


    // Check movie

    const movie = await db
      .select()
      .from(movies)
      .where(eq(movies.id, movie_id));

    if (movie.length === 0) {
      return res.status(404).json({
        message: "Movie not found",
      });
    }


    // Check auditorium

    const auditorium = await db
      .select()
      .from(auditoriums)
      .where(eq(auditoriums.id, auditorium_id));

    if (auditorium.length === 0) {
      return res.status(404).json({
        message: "Auditorium not found",
      });
    }


    // Check Showtime Conflict

    const conflictingShowtimes = await db
      .select()
      .from(showtimes)
      .where(
        and(
          eq(showtimes.auditorium_id, auditorium_id),
          eq(showtimes.date, date),
          lt(showtimes.start_time, end_time),
          gt(showtimes.end_time, start_time)
        )
      );

    if (conflictingShowtimes.length > 0) {
      return res.status(409).json({
        message: "Showtime conflict: Auditorium is already occupied",
      });
    }


    // Create Showtime

    const insertingShowtime = await db
      .insert(showtimes)
      .values({
        movie_id,
        auditorium_id,
        format,
        date,
        start_time,
        end_time,
        standard_price,
        prime_price,
      })
      .returning();


    return res.status(201).json({
      message: "Showtime created successfully",
      insertingShowtime,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to create showtime",
    });
  }
};


 
// GET ALL SHOWTIMES
 

export const getAllShowtimes = async (req, res) => {
  try {

    const allShowtimes = await db
      .select()
      .from(showtimes);


    return res.status(200).json({
      message: "All showtimes fetched successfully",
      allShowtimes,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch showtimes",
    });
  }
};

 
// GET SINGLE SHOWTIME
 

export const getSingleShowtime = async (req, res) => {
  try {

    const id = Number(req.params.id);


    if (!id) {
      return res.status(400).json({
        message: "Showtime ID is required",
      });
    }


    const showtime = await db
      .select()
      .from(showtimes)
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
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch showtime",
    });
  }
};


 
// UPDATE SHOWTIME
 

export const updateShowtime = async (req, res) => {
  try {

    const id = Number(req.params.id);


    if (!id) {
      return res.status(400).json({
        message: "Showtime ID is required",
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


    // Basic validation

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


    if (standard_price <= 0) {
      return res.status(400).json({
        message: "Standard price must be greater than 0",
      });
    }


    if (prime_price <= 0) {
      return res.status(400).json({
        message: "Prime price must be greater than 0",
      });
    }


    if (end_time <= start_time) {
      return res.status(400).json({
        message: "End time must be greater than start time",
      });
    }


    // Check movie

    const movie = await db
      .select()
      .from(movies)
      .where(eq(movies.id, movie_id));


    if (movie.length === 0) {
      return res.status(404).json({
        message: "Movie not found",
      });
    }


    // Check auditorium

    const auditorium = await db
      .select()
      .from(auditoriums)
      .where(eq(auditoriums.id, auditorium_id));


    if (auditorium.length === 0) {
      return res.status(404).json({
        message: "Auditorium not found",
      });
    }


    // Check conflict excluding current showtime

    const conflictingShowtimes = await db
      .select()
      .from(showtimes)
      .where(
        and(
          eq(showtimes.auditorium_id, auditorium_id),
          eq(showtimes.date, date),
          lt(showtimes.start_time, end_time),
          gt(showtimes.end_time, start_time)
        )
      );


    const realConflict = conflictingShowtimes.filter(
      (showtime) => showtime.id !== id
    );


    if (realConflict.length > 0) {
      return res.status(409).json({
        message: "Showtime conflict: Auditorium is already occupied",
      });
    }


    // Update

    const updatedShowtime = await db
      .update(showtimes)
      .set({
        movie_id,
        auditorium_id,
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


    if (updatedShowtime.length === 0) {
      return res.status(404).json({
        message: "Showtime not found",
      });
    }


    return res.status(200).json({
      message: "Showtime updated successfully",
      updatedShowtime,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to update showtime",
    });
  }
};


 
// DELETE SHOWTIME
 
export const deleteShowtime = async (req, res) => {
  try {

    const id = Number(req.params.id);


    if (!id) {
      return res.status(400).json({
        message: "Showtime ID is required",
      });
    }


    // Check existence

    const existingShowtime = await db
      .select()
      .from(showtimes)
      .where(eq(showtimes.id, id));


    if (existingShowtime.length === 0) {
      return res.status(404).json({
        message: "Showtime not found",
      });
    }


    // Delete

    const deletedShowtime = await db
      .delete(showtimes)
      .where(eq(showtimes.id, id))
      .returning();


    return res.status(200).json({
      message: "Showtime deleted successfully",
      deletedShowtime,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to delete showtime",
    });
  }
};