
import "dotenv/config";
import bcrypt from "bcryptjs";

import { and, eq, asc } from "drizzle-orm";
import { db } from "../db/index.js";

import { user } from "./schema/user.schema.js";
import { cinemas } from "./schema/cinemas.schema.js";
import { auditoriums } from "./schema/auditorium.schema.js";
import { seats } from "./schema/seats.schema.js";
import { movies } from "./schema/movies.schema.js";
import { showtimes } from "./schema/showTime.schema.js";

// Find an existing record or create it.
async function findOrCreate(table, conditions, values) {
    const existing = await db
        .select()
        .from(table)
        .where(conditions)
        .orderBy(asc(table.id))
        .limit(1);

    if (existing.length > 0) {
        return existing[0];
    }

    const [created] = await db
        .insert(table)
        .values(values)
        .returning();

    return created;
}

// =========================
// 1. USERS
// =========================

async function seedUsers() {
    const usersData = [
        {
            name: "Ali Khan",
            username: "alikhan",
            email: "ali.admin@example.com",
            password: await bcrypt.hash("Admin@123", 10),
            role: "admin",
            status: "active",
        },
        {
            name: "Ahmed Raza",
            username: "ahmedstaff",
            email: "ahmed.staff@example.com",
            password: await bcrypt.hash("Staff@123", 10),
            role: "Box Office Staff",
            status: "active",
        },
        {
            name: "Usman Ali",
            username: "usmanali",
            email: "usman.customer@example.com",
            password: await bcrypt.hash("User@123", 10),
            role: "customer",
            status: "active",
        },
    ];

    let created = 0;
    let skipped = 0;

    for (const data of usersData) {
        const result = await db
            .select()
            .from(user)
            .where(eq(user.email, data.email))
            .limit(1);

        if (result.length > 0) {
            skipped++;
            continue;
        }

        await db.insert(user).values(data);
        created++;
    }

    console.log(`Users: ${created} created, ${skipped} already existed.`);
}

// =========================
// 2. CINEMAS
// =========================

async function seedCinemas() {
    const cinemasData = [
        {
            name: "CineBook Cinema",
            city: "Lahore",
            address: "Main Boulevard Gulberg, Lahore",
            phone: "0300-1111111",
        },
        {
            name: "CineBook Downtown",
            city: "Islamabad",
            address: "Blue Area, Islamabad",
            phone: "0300-2222222",
        },
    ];

    const result = [];

    for (const data of cinemasData) {
        const cinema = await findOrCreate(
            cinemas,
            and(
                eq(cinemas.name, data.name),
                eq(cinemas.city, data.city)
            ),
            data
        );

        result.push(cinema);
    }

    console.log(`Cinemas ready: ${result.length}`);
    return result;
}

// =========================
// 3. AUDITORIUMS
// =========================

async function seedAuditoriums(cinemasData) {
    const auditoriumData = [
        { cinema_id: cinemasData[0].id, hall_no: 1 },
        { cinema_id: cinemasData[0].id, hall_no: 2 },
        { cinema_id: cinemasData[1].id, hall_no: 1 },
    ];

    const result = [];

    for (const data of auditoriumData) {
        const auditorium = await findOrCreate(
            auditoriums,
            and(
                eq(auditoriums.cinema_id, data.cinema_id),
                eq(auditoriums.hall_no, data.hall_no)
            ),
            data
        );

        result.push(auditorium);
    }

    console.log(`Auditoriums ready: ${result.length}`);
    return result;
}

// =========================
// 4. SEATS
// =========================

async function seedSeats(auditoriumsData) {
    let insertedCount = 0;

    for (const auditorium of auditoriumsData) {
        const existingSeats = await db
            .select({
                seat_number: seats.seat_number,
            })
            .from(seats)
            .where(eq(seats.auditorium_id, auditorium.id));

        const existingNumbers = new Set(
            existingSeats.map((seat) => seat.seat_number)
        );

        const seatsData = [];

        for (let row = 1; row <= 5; row++) {
            for (let seat = 1; seat <= 10; seat++) {
                const seatNumber = `${String.fromCharCode(64 + row)}${seat}`;

                if (existingNumbers.has(seatNumber)) {
                    continue;
                }

                let category = "standard";

                if (row === 4) {
                    category = "prime";
                }

                if (row === 5) {
                    category = "vip lounge";
                }

                seatsData.push({
                    auditorium_id: auditorium.id,
                    seat_number: seatNumber,
                    seat_category: category,
                });
            }
        }

        if (seatsData.length > 0) {
            await db.insert(seats).values(seatsData);
            insertedCount += seatsData.length;
        }
    }

    console.log(`Seats inserted: ${insertedCount}`);
}

// =========================
// 5. MOVIES
// =========================

async function seedMovies() {
    const moviesData = [
        {
            title: "Interstellar",
            runtime: 169,
            release_date: "2014-11-07",
            age_rating: "PG-13",
            status: "Now Showing",
            director: "Christopher Nolan",
            language: "English",
            genres: ["Adventure", "Drama", "Sci-Fi"],
            formats: ["IMAX 70MM", "DOLBY CINEMA", "LASER 4K"],
            poster_url: "https://example.com/interstellar.jpg",
            synopsis:
                "A team of explorers travels through a wormhole in space in search of a new home for humanity.",
        },
        {
            title: "Inception",
            runtime: 148,
            release_date: "2010-07-16",
            age_rating: "PG-13",
            status: "Now Showing",
            director: "Christopher Nolan",
            language: "English",
            genres: ["Action", "Mystery", "Sci-Fi", "Thriller"],
            formats: ["DOLBY CINEMA", "LASER 4K"],
            poster_url: "https://example.com/inception.jpg",
            synopsis:
                "A skilled thief who steals secrets through dream-sharing technology is given a chance to erase his past.",
        },
        {
            title: "The Dark Knight",
            runtime: 152,
            release_date: "2008-07-18",
            age_rating: "PG-13",
            status: "Now Showing",
            director: "Christopher Nolan",
            language: "English",
            genres: ["Action", "Crime", "Drama", "Thriller"],
            formats: ["IMAX 70MM", "DOLBY CINEMA"],
            poster_url: "https://example.com/dark-knight.jpg",
            synopsis:
                "Batman faces a criminal mastermind who plunges Gotham into chaos.",
        },
    ];

    const result = [];

    for (const data of moviesData) {
        const movie = await findOrCreate(
            movies,
            eq(movies.title, data.title),
            data
        );

        result.push(movie);
    }

    console.log(`Movies ready: ${result.length}`);
    return result;
}

// =========================
// 6. SHOWTIMES
// =========================

async function seedShowtimes(moviesData, auditoriumsData) {
    const showtimesData = [
        {
            movie_id: moviesData[0].id,
            auditorium_id: auditoriumsData[0].id,
            format: "IMAX 70MM",
            date: "2026-10-27",
            start_time: "14:00:00",
            end_time: "16:49:00",
            standard_price: "1200",
            prime_price: "1600",
        },
        {
            movie_id: moviesData[1].id,
            auditorium_id: auditoriumsData[1].id,
            format: "DOLBY CINEMA",
            date: "2026-10-27",
            start_time: "17:00:00",
            end_time: "19:28:00",
            standard_price: "1300",
            prime_price: "1700",
        },
        {
            movie_id: moviesData[2].id,
            auditorium_id: auditoriumsData[2].id,
            format: "IMAX 70MM",
            date: "2026-10-27",
            start_time: "20:00:00",
            end_time: "22:32:00",
            standard_price: "1400",
            prime_price: "1800",
        },
    ];

    let created = 0;
    let skipped = 0;

    for (const data of showtimesData) {
        const existing = await db
            .select()
            .from(showtimes)
            .where(
                and(
                    eq(showtimes.movie_id, data.movie_id),
                    eq(showtimes.auditorium_id, data.auditorium_id),
                    eq(showtimes.date, data.date),
                    eq(showtimes.start_time, data.start_time)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            skipped++;
            continue;
        }

        await db.insert(showtimes).values(data);
        created++;
    }

    console.log(
        `Showtimes: ${created} created, ${skipped} already existed.`
    );
}

// =========================
// MAIN SEED FUNCTION
// =========================

async function seed() {
    try {
        console.log("\nStarting database seed...\n");

        await seedUsers();

        const cinemasData = await seedCinemas();

        const auditoriumsData = await seedAuditoriums(cinemasData);

        await seedSeats(auditoriumsData);

        const moviesData = await seedMovies();

        await seedShowtimes(moviesData, auditoriumsData);

        console.log("\nDatabase seeding completed successfully!");
    } catch (error) {
        console.error("\nDatabase seeding failed:");
        console.error(error);
        process.exitCode = 1;
    }
}

seed();
