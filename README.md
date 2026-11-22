# CineBook

CineBook is a React/Vite cinema booking interface with an Express API, PostgreSQL schema, and Drizzle ORM. It has a real API-backed booking path alongside older demo-only admin services. **It is not yet production-ready**: database-backed workflows, frontend build, browser flows, and several admin features still need verification or implementation.

## Project structure

- `frontend/` — React 18, Vite, Tailwind CSS, React Router, Context API, Lucide icons.
- `Backend/` — Node.js ESM, Express, PostgreSQL, Drizzle ORM, bcryptjs, JWT.
- `Backend/drizzle/` — existing database migrations; no schema migration was needed for the code changes in this update.
- `Backend/test/` — database-independent tests for scheduling, timezone conversion, and seat pricing.
- `docs/API.md` — current API routes and known endpoint gaps.
- `DEVELOPMENT_PROGRESS.md` — feature status and remaining work.
- `TEST_RESULTS.md` — checks completed and limitations.

## Requirements and setup

Use Node.js 18 or newer and a PostgreSQL database. Neon is supported through `DATABASE_URL`. Install the dependencies listed in each package manifest using your usual package manager on a machine with network access; dependencies were not present in the editing sandbox.

### Backend

```bash
cd Backend
cp .env.example .env
```

Configure `Backend/.env`:

- `DATABASE_URL`: Neon/PostgreSQL connection string. Use the provider's SSL-enabled string; keep it private.
- `JWT_SECRET_KEY`: at least 32 random characters. Generate one locally, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `FRONTEND_URL`: comma-separated allowed browser origins, such as `http://localhost:5173`.
- `CINEMA_TIME_ZONE`: valid IANA timezone for the cinema, e.g. `America/New_York` or `Asia/Karachi`. The sample is `UTC`; change it to the real cinema timezone.
- `PORT`: optional; defaults through the existing server configuration.

Review the two existing migrations against the target database and Drizzle history before applying them. Do not apply a migration blindly to production.

```bash
cd Backend
npm run db:migrate
npm run dev
```

Review `Backend/src/db/seed.js` before running the seed script against anything other than a disposable database:

```bash
npm run db:seed
```

### Frontend

Create `frontend/.env` from `.env.example`. Set `VITE_API_URL` if the API is not at `http://localhost:3000/api`.

```bash
cd frontend
npm run dev
```

The API root health route is `GET /`. See `docs/API.md` for current endpoints.

## Tests and checks

Backend tests use Node's built-in runner:

```bash
cd Backend
npm test
```

The 13 schedule, timezone, and pricing tests passed in the editing sandbox. Backend JavaScript files also passed `node --check` syntax checks.

Not run here: frontend Vitest tests, frontend production build, live API/database tests, migration application/schema comparison, or browser tests for booking, cancellation, ticket download, and QR scanning. The sandbox had no network access, configured database credentials, or installed project dependencies. Run these checks in your configured environment before treating the app as ready.

## Current booking behavior

- The backend verifies each selected seat against the selected show's auditorium and confirmed bookings.
- Booking creation and seat assignment use a PostgreSQL transaction. Requests for the same showtime lock its row while confirming a booking.
- Seat availability is per showtime; cancelled bookings no longer occupy seats.
- Seat prices are calculated on the backend. The existing VIP policy is 125% of prime, rounded to the nearest 0.50 currency unit. The seat and booking endpoints now share this rule.
- The customer seat map uses records returned for the selected show's auditorium, not the old demo layout.
- Temporary seat selection is held in page memory only. It is **not a reservation**; availability is checked before checkout and again in the booking transaction.
- Checkout creates a **confirmed but unpaid** booking. No payment provider is connected and no card details are requested or stored. The stored total is ticket seats only; tax, service fees, concessions, and actual revenue are not implemented.
- QR data contains a signed, expiring verification token. `GET /api/bookings/verify/:token` checks that the booking remains confirmed. Downloaded ticket files are HTML for browser printing; generated PDF is not implemented.
- Cancellation does not process a refund. The screening-time check uses `CINEMA_TIME_ZONE`.
- Showtime overlap checking handles overnight time ranges and a 15-minute turnaround buffer, and serializes changes by locking the auditorium row. The buffer is currently a code constant, not an admin setting.

## Important gaps

- Admin Dashboard, Admin Users, and Admin Settings still use demo/local browser data in parts of their workflows. Charts, counts, audit log, notification switches, and settings are not all backed by PostgreSQL.
- Cinema/auditorium management endpoints and admin screens are not implemented.
- Temporary seat holds, payment processing, email delivery, automated refunds, and persistent business settings are not implemented.
- Guest browsing is available, but booking requires a signed-in customer because the current database requires each booking to belong to a user.
- Profile editing, password reset, and account lifecycle administration are incomplete.
- Some UI copy and movie metadata still refer to illustrative/demo information. Do not treat demo values as operational data.

See `DEVELOPMENT_PROGRESS.md` for the detailed checklist.
