import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRouter from "./Routes/auth.route.js";
import movieRouter from "./Routes/movies.routes.js";
import showTimeRouter from "./Routes/showtime.route.js";
import bookingRouter from "./Routes/booking.routes.js";

dotenv.config();

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    message: "CineBook API is running",
  });
});

// Booking Routes
app.use("/api/bookings", bookingRouter);

// Authentication Routes
app.use("/api", authRouter);

// Movie Routes
app.use("/api", movieRouter);

// Showtime Routes
app.use("/showtime", showTimeRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route Not Found",
  });
});

export default app;