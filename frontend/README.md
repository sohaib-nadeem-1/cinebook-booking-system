# CineBook frontend

React 18, Vite, Tailwind CSS, React Router, Context API, and Lucide React. The frontend calls the Express API for the main movie, showtime, seat, booking, and authentication workflows. Several admin screens still use local demo data and must not be treated as operational reporting.

## Run locally

Restore the dependencies listed in `package.json` using your usual package manager. Configure `frontend/.env` from `.env.example`, setting `VITE_API_URL` to the backend API URL when it differs from `http://localhost:3000/api`.

```bash
npm run dev
npm test
npm run build
```

The full frontend tests/build were not run in the editing sandbox because project dependencies were unavailable there. JavaScript syntax and JSX parsing were checked; the frontend still needs a dependency-backed build and browser test.

## Routes

Customer: `/`, `/movies`, `/movies/:slug`, `/booking/:showtimeId/seats`, `/checkout`, `/booking-confirmation`, `/my-bookings`, `/profile`, `/login`, `/register`.

Admin: `/admin/login`, `/admin/dashboard`, `/admin/movies`, `/admin/showtimes`, `/admin/bookings`, `/admin/users`, `/admin/settings`.

Guest mode supports browsing only. Booking and checkout require a signed-in customer because the current backend booking schema requires a customer account.

## Booking behavior

- Seat data and seat status are loaded for the selected showtime from the API.
- The map is built from the returned seat records; local browser data is not the source of seat availability.
- A temporary seat selection is held in page memory only. It is not a reservation. Availability is checked before checkout and again by the booking transaction.
- Cinema preferences and admin showtime scheduling use saved cinema and auditorium records; schedule forms show actual standard/prime prices and the server checks conflicts again when saving.
- The displayed total uses backend-provided per-seat prices. The backend recalculates the total at booking time.
- Checkout does not request card details. A successful operation creates a confirmed but unpaid booking; no payment is processed.
- QR verification is provided by the API. Ticket download currently saves an HTML file for printing, not a PDF.

## Remaining demo-only screens

`adminService`, `userService`, and `settingsService` still contain local demo data. Admin dashboard/revenue/telemetry, user management, notifications, audit log, and system settings need database-backed endpoints before operational use. The customer notifications widget and fabricated movie popularity/trailer actions have been removed until real data and services exist. See the root `DEVELOPMENT_PROGRESS.md` and `docs/API.md`.
