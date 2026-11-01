import express from "express";
import { createBookings } from "../controllers/booking.controller.js";
import { authMiddleware } from "../Middlewares/auth.middleware.js";
import { roleMiddleware } from "../Middlewares/role.middleware.js";




const router = express.Router();



router.post("/bookings",authMiddleware,roleMiddleware("customer"),createBookings)




export default router;