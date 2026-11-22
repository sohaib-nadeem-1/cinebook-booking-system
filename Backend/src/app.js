import express from "express";
import cors from "cors";
import dotenv from "dotenv";


import adminRouter from "./Routes/admin.route.js";
import authRouter from "./Routes/auth.route.js";
import movieRouter from "./Routes/movies.routes.js";
import showTimeRouter from "./Routes/showtime.route.js";
import bookingRouter from "./Routes/booking.routes.js";
import seatRouter from "./Routes/seat.route.js";


dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Non-browser tools such as Postman do not send an Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "CineBook API is running",
  });
});

app.use("/api", authRouter);
app.use("/api", movieRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/seats", seatRouter);
// Showtime routes now use the same /api base URL.
app.use("/api/showtime", showTimeRouter);
app.use("/api/admin", adminRouter);
app.use((req, res) => {
  res.status(404).json({
    message: "Route Not Found",
  });
});

// Centralized error handler: never leak stack traces to clients in production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }
  console.error("Unhandled error:", err);
  const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  return res.status(status).json({
    message:
      status === 500 ? "Internal Server Error" : err.message || "Request failed",
  });
});

export default app;