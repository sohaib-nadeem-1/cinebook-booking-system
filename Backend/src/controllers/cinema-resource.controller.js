import { asc } from "drizzle-orm";

import { db } from "../db/index.js";
import { auditoriums } from "../db/schema/auditorium.schema.js";
import { cinemas } from "../db/schema/cinemas.schema.js";
import { seats } from "../db/schema/seats.schema.js";

// Cinema names and room capacity are public scheduling information.
export const getCinemaResources = async (req, res) => {
  try {
    const [cinemaRows, auditoriumRows, seatRows] = await Promise.all([
      db.select().from(cinemas).orderBy(asc(cinemas.name)),
      db.select().from(auditoriums).orderBy(asc(auditoriums.cinema_id), asc(auditoriums.hall_no)),
      db.select({ auditorium_id: seats.auditorium_id }).from(seats),
    ]);

    const capacityByAuditorium = new Map();
    for (const seat of seatRows) {
      const id = Number(seat.auditorium_id);
      capacityByAuditorium.set(id, (capacityByAuditorium.get(id) || 0) + 1);
    }

    return res.status(200).json({
      cinemas: cinemaRows,
      auditoriums: auditoriumRows.map((auditorium) => ({
        ...auditorium,
        capacity: capacityByAuditorium.get(Number(auditorium.id)) || 0,
      })),
    });
  } catch (error) {
    console.error("Get cinema resources error:", error);
    return res.status(500).json({ message: "Failed to load cinema and auditorium data" });
  }
};
