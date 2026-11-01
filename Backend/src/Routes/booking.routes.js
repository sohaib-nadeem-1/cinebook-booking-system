import express from "express";
import { createBookings } from "../controllers/booking.controller";
import { authMiddleware } from "../Middlewares/auth.middleware";
import { roleMiddleware } from "../Middlewares/role.middleware";




const router = express.router();



router.post("/bookings",authMiddleware,roleMiddleware("customer"),createBookings)