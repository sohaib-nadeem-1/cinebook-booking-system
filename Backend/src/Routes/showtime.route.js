import express from "express";
import { createShowtime, deleteShowtime, getAllShowtimes, getSingleShowtime, updateShowtime } from "../controllers/showtime.controller.js";
import { authMiddleware } from "../Middlewares/auth.middleware.js";
import { roleMiddleware } from "../Middlewares/role.middleware.js";


const router = express.Router()

router.put(
  "/update-show/:id",
  authMiddleware,
  roleMiddleware("admin"),
  updateShowtime
);
router.post("/create-showtime",authMiddleware,roleMiddleware("admin"),createShowtime);
router.get("/get-show",getAllShowtimes)
router.get("/single-show/:id",getSingleShowtime)
router.delete("/delete/:id",authMiddleware,roleMiddleware("admin"),deleteShowtime)




export default router;