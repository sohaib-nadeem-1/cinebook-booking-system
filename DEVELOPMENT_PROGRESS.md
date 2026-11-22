# CineBook development progress

## Scope and verification note

This update is a code-level repair and audit, not a production-readiness certification. No Neon/PostgreSQL credentials or network access were available, and project dependencies were not installed in the editing sandbox. Status below is based on source inspection and only the tests explicitly listed as run.

Status labels follow the requested checklist. “Partially Working” means code exists and was inspected, but the live database/browser flow was not verified. “Broken” means the current page or service still uses demo data rather than the production API.

## Feature checklist

| Feature | Status | Current evidence / remaining work |
|---|---|---|
| Customer registration and login | Partially Working | Backend bcrypt/JWT code exists; email normalization and password length validation improved. Not tested against PostgreSQL. |
| Expired/invalid JWT handling | Partially Working | Protected requests verify current database user, account status, and role; frontend clears stale stored sessions on `401`. Live verification pending. |
| Role authorization | Partially Working | Backend middleware resolves current role from the database, not the token claim. Admin/customer portal and API checks are not integration-tested. |
| Profile editing and password reset | Not Implemented | Profile read and change-password exist; profile edit/reset workflows do not. |
| Movie listing/details/admin CRUD | Partially Working | Real API services and protected routes exist. Movie validation is mounted on create/update and partial frontend edits send a complete record. No DB test; trailer, ratings, cast, and popularity data are not stored in the current schema. |
| Cinema and auditorium CRUD | Not Implemented | Admin can now read saved cinemas, halls, and seat counts for scheduling. Create/update/delete management screens are still missing. |
| Seat availability per showtime | Partially Working | Backend query is showtime-specific; seat endpoint now returns prices, and the map builds from actual seat records. No live DB/browser test. |
| Double-booking prevention | Partially Working | Booking transaction locks the showtime row and checks availability before insert. Not concurrency-tested against PostgreSQL. |
| Temporary seat holds | Not Implemented | Removed the fake localStorage timer/hold claim. Selection is page-memory state only; it is not a reservation. |
| Showtime overnight/conflict/buffer checks | Partially Working | Date-aware overnight comparisons, 15-minute buffer, auditorium row lock, database-backed cinema/hall choices, and input validation added. The admin form compares against loaded records; the server remains authoritative. Pure time logic tests passed; database transactions were not exercised. Auditorium format capabilities are not represented in the existing schema, and daylight-saving transition edge cases need a product/schema decision. |
| Booking lifecycle and seat prices | Partially Working | Transactional booking code, duplicate checks, ownership checks, and server-side totals exist. VIP uses 125% of prime rounded to the nearest 0.50; no database end-to-end test. |
| Checkout/payment | Partially Working | Checkout now creates a confirmed but unpaid booking and does not request/store card data. No payment gateway or paid status. |
| Booking history | Partially Working | Customer/admin API routes and frontend service exist. Database access and UI flow not tested. |
| Ticket download and QR verification | Partially Working | Signed expiring token and verification endpoint exist; download is HTML for printing, not PDF. QR scan/browser flow not tested. |
| Cancellation | Partially Working | Owner/status/show-start checks exist; screening-time check uses `CINEMA_TIME_ZONE`. No payment refund is processed. |
| Admin Dashboard | Broken (demo data) | Dashboard service still reads local demo data and fabricated revenue/telemetry instead of database statistics. |
| Admin Users | Broken (demo data) | User list and actions still use local demo data; no real user-admin API. |
| Admin Settings | Broken (demo data) | Settings, audit log, and notifications are browser-local; no persistent business settings API/table. |
| Email, payment, refund providers | Requires External Credentials | Provider accounts and implementation are absent; no email, charge, or refund is claimed. |
| Frontend production build | Not verified | Dependencies absent in sandbox; build was not run. |
| Database migrations/schema comparison | Not verified | Existing migrations were inspected; no production DB access, migration application, or new schema migration. |

## Changes made in this update

### Backend

- `Backend/src/Middlewares/auth.middleware.js` — verifies JWT and loads the current active account and role from PostgreSQL for each protected request.
- `Backend/src/controllers/showtime.controller.js` — validates identifiers/date/time, supports overnight screenings, checks adjacent-day conflicts and 15-minute turnaround, uses auditorium-row locking in transactions, and blocks deletion when any booking history exists.
- `Backend/src/utils/showtime-interval.js` — shared pure schedule interval logic.
- `Backend/src/controllers/seat.controller.js` — returns backend-calculated category prices and corrects the occupied-seat count.
- `Backend/src/controllers/cinema-resource.controller.js` — exposes saved cinemas, auditoriums, and seat counts to authenticated admins for scheduling.
- `Backend/src/controllers/booking.controller.js` — uses the shared pricing rule and configured cinema timezone for cancellation eligibility.
- `Backend/src/utils/pricing.js` — shared server-side seat/VIP price and total calculation.
- `Backend/src/utils/cinema-time.js` — cinema-local date/time conversion with invalid/nonexistent local times rejected.
- `Backend/src/Middlewares/validation.middleware.js` is now used by the movie create/update routes.
- `Backend/src/app.js` — JSON size limit, restricted CORS origins, and centralized JSON/error handling.
- `Backend/src/config/config.data.js` — fails fast when the database URL or a 32+ byte JWT secret is missing, and validates the timezone.
- `Backend/test/*.test.js` — 13 tests for schedule intervals, timezone conversion, and pricing.
- `Backend/package.json` — adds a focused built-in test command.

### Frontend

- `frontend/src/services/showtimeService.js` — loads real cinema/hall resources and performs synchronous overnight/adjacent-date conflict checks against loaded showtimes with a 15-minute buffer; the backend independently checks conflicts.
- `Backend/src/Routes/showtime.route.js` — exposes a read-only cinema/hall resource endpoint for customer preferences and admin scheduling.
- `frontend/src/services/movieService.js` — full merged movie record sent for edits.
- `Backend/src/Routes/movies.routes.js` — movie validation middleware mounted for create/update.
- `frontend/src/services/seatService.js` and `frontend/src/components/seats/SeatMap.jsx` — map built from actual API seat records, not the seeded demo layout.
- `frontend/src/context/BookingContext.jsx` — temporary seat selection kept in memory only, without claiming to reserve seats; PostgreSQL remains the availability authority.
- `frontend/src/utils/pricing.js` and `frontend/src/components/booking/BookingSummary.jsx` — displayed total uses server-provided seat prices only; unconfigured taxes, service fees, and demo concessions are not included.
- `frontend/src/pages/customer/CheckoutPage.jsx`, `frontend/src/routes/AppRoutes.jsx`, and `frontend/src/pages/auth/LoginPage.jsx` — booking requires a signed-in account; unused card collection removed; unpaid status explained.
- `frontend/src/pages/admin/ShowtimesPage.jsx` — scheduling uses actual cinema/hall records and saved standard/prime prices; removed fabricated occupancy/revenue figures and unsupported refund claims. The conflict warning checks loaded records synchronously, with backend enforcement as the final check.
- `frontend/src/context/PrefsContext.jsx`, `frontend/src/components/layout/Navbar.jsx`, and `frontend/src/pages/customer/HomePage.jsx` — cinema selection loads saved records rather than sample IDs; removed the demo notifications widget and fabricated box-office/trailer actions.
- `frontend/src/data/generator.js` — removed a stale pricing import that prevented the demo generator from loading.
- `frontend/src/pages/customer/ConfirmationPage.jsx` — confirmation no longer claims an email receipt or payment.
- `frontend/src/pages/customer/MovieDetailsPage.jsx` and `frontend/src/components/movies/MovieCard.jsx` — removed sample rating/trailer/reminder claims when those features have no backend data or action.
- `frontend/src/services/api.js`, `frontend/src/services/authService.js`, `frontend/src/context/AuthContext.jsx` — remember-me token storage and stale-session cleanup on API `401`.
- `frontend/src/test/logic.test.js` — pricing expectations updated to server-authoritative totals.

### Documentation and migrations

- Root `README.md` rewritten with setup, honest limitations, and verification instructions.
- `docs/API.md` documents existing routes and endpoints that do not exist yet.
- `Backend/.env.example` includes safe placeholders and the cinema timezone.
- No database schema change was made, so no migration was generated.

## Tests actually run

- `node --test test/*.test.js` in `Backend/`: **13 passed, 0 failed** (schedule, timezone, pricing unit tests only).
- `node --check` across backend `.js` files: **passed**.
- `node --check` across frontend `.js` files: **passed**.
- Frontend pricing helper smoke test: **passed** (server-provided prices only).
- Frontend pricing helper smoke test: **passed** (server-provided prices only).
- Frontend `.jsx` compilation, Vitest, production build, live API/database tests, and UI tests: **not run** (dependencies and database/network unavailable).

## Next steps to complete the project

1. Configure a non-production Neon database and a strong JWT secret; review/apply migrations and inspect seed behavior.
2. Install project dependencies locally, run frontend tests/build, and fix any compile/test failures.
3. Run API integration tests against the configured database, including concurrent same-seat and same-auditorium requests.
4. Replace demo `adminService`, `userService`, and `settingsService` with authorized database-backed endpoints and remove fabricated dashboard revenue/telemetry.
5. Implement cinema/auditorium management screens and persistent business settings, including an agreed configurable turnaround policy. The 15-minute turnaround is currently fixed in code. Add auditorium format/capability data before enforcing hardware compatibility.
6. Decide whether to add a payment provider, guest booking model, email, refunds, and PDF ticket generation. Until then, bookings remain confirmed but unpaid.
