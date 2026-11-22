# CineBook API reference

Development base URL: `http://localhost:3000/api`. Protected endpoints require `Authorization: Bearer <JWT>`. The API resolves the current user, account status, and role from PostgreSQL for each protected request; do not send a user ID or role as proof of identity. Responses are JSON; errors generally include `{ "message": "..." }`.

## Authentication

- `POST /register` — public. Body: `{name,email,password,phone?}`. Creates a customer with a bcrypt hash and returns a JWT plus safe user fields. Duplicate email: `409`; invalid input: `400`.
- `POST /login` — public. Body: `{email,password}`. Returns `{message,token}`. Invalid credentials: `401`; inactive account: `403`.
- `GET /profile` — signed in. Returns authenticated profile in `data`; no password hash.
- `PATCH /change-password` — signed in. Body: `{current,next,confirm}`.
- `GET /admin-test` — admin only; test route, not a dashboard API.

## Movies

- `GET /all-movies` — public; returns `{allMovies:[...]}` from PostgreSQL.
- `GET /movie/:id` — public; returns `{getMovie:[...]}`.
- `POST /create-movie` — admin or Box Office Staff. Required: `title`, numeric `runtime`, `age_rating`, `status`; optional: `release_date`, `director`, `language`, `genres`, `formats`, `poster_url`, `synopsis`.
- `PUT /movie/:id` — admin or Box Office Staff; sends a complete validated movie record. Frontend merges partial edits with the current movie.
- `DELETE /movie/:id` — admin only; returns `409` if the movie has showtimes.

## Showtimes

- `GET /showtime/get-show` — public; returns `{allShowtimes:[...]}` with auditorium and cinema details.
- `GET /showtime/resources` — public; returns saved cinemas and auditoriums with actual seat counts for cinema selection and the admin scheduling form.
- `GET /showtime/single-show/:id` — public; returns one showtime with auditorium and cinema.
- `POST /showtime/create-showtime` — admin or Box Office Staff. Body:

```json
{
  "movie_id": 1,
  "auditorium_id": 1,
  "format": "Standard",
  "date": "2026-03-10",
  "start_time": "22:00",
  "end_time": "01:00",
  "standard_price": 10,
  "prime_price": 12
}
```

IDs, date/time, format, and positive prices are validated. An end earlier than start means the following day; identical start/end is rejected. Conflicts are checked across dates with a 15-minute turnaround buffer. The auditorium row is locked in a transaction while checking and creating the schedule.

- `PUT /showtime/update-show/:id` — admin or Box Office Staff; same request shape and conflict rules, excluding the current showtime.
- `DELETE /showtime/delete/:id` — admin or Box Office Staff; returns `409` if any booking record is attached. There is no cancellation/refund workflow, and no refund is processed.

## Seats

- `GET /seats/showtime/:showtimeId` — public; returns actual auditorium seats for that showtime, including PostgreSQL ID, display label, row/number, category, backend-calculated price, and `available`/`occupied` state. Availability is showtime-specific.

## Bookings and ticket verification

- `POST /bookings/` — signed-in customer. Body: `{ "showtimeId": 1, "seatsID": [101,102] }`. Rejects duplicate/invalid IDs, wrong-auditorium seats, or already-booked seats. Calculates seat prices and total from database values, then commits the booking and booking-seat rows in a transaction. Success is a confirmed booking, not proof of payment.
- `GET /bookings/my-bookings` — signed in; customer's history.
- `GET /bookings/:id` — signed-in owner only; other users receive `404`.
- `PATCH /bookings/:id/cancel` — signed-in owner; cancels an eligible booking before screening starts; no payment refund is processed.
- `GET /bookings/admin/all` — admin or Box Office Staff; all bookings with movie, cinema, showtime, customer, and seats.
- `GET /bookings/admin/:id` — admin or Box Office Staff; one booking with full details.
- `PATCH /bookings/admin/:id/cancel` — admin or Box Office Staff; cancellation only, no payment refund.
- `GET /bookings/verify/:token` — public; validates a signed, expiring QR token and confirms the booking remains `confirmed`. Response contains limited ticket fields, not private account data.

## Not implemented

No backend endpoints currently exist for cinema/auditorium CRUD, admin dashboard statistics/revenue, admin user management, persistent business settings, payment processing, email receipts, or payment refunds. Related frontend screens/widgets may still show demo values.
