import express from "express";
import {
  getMyBookings,
  getSingleBooking,
  cancelBooking,
  createBookings,
} from "../controllers/booking.controller.js";

import { authMiddleware } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createBookings);

router.get(
  "/my-bookings",
  authMiddleware,
  getMyBookings
);

router.get(
  "/:id",
  authMiddleware,
  getSingleBooking
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  cancelBooking
);

export default router;