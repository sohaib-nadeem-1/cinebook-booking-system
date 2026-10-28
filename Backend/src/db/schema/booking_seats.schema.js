// booking_seats
// ├── id
// ├── booking_id
// ├── seat_id
// ├── price
// └── created_at

import { serial,integer,numeric,timestamp, pgTable } from "drizzle-orm/pg-core";
import { booking } from "./bookings.schema.js";
import { seats } from "../schema/seats.schema.js";

export const booking_seats = pgTable("booking_seats",{
    id: serial("id").notNull().primaryKey(),
    booking_id : integer("booking_id").references(()=>booking.id).notNull(),
    seat_id:integer("seat_id").references(()=>seats.id).notNull(),
    price : numeric("price").notNull(),
    created_at : timestamp("created_at").defaultNow()
})