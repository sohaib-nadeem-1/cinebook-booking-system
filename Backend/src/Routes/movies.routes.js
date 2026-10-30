import express from "express";
import {
  createMovies,
  deleteMovie,
  getAllMovies,
  getSingleMovie,
  updateMovies,
} from "../controllers/movie.controller.js";
import { authMiddleware } from "../Middlewares/auth.middleware.js";
import { roleMiddleware } from "../Middlewares/role.middleware.js";

const router = express.Router();

router.post(
  "/create-movie",
  authMiddleware,
  roleMiddleware("admin"),
  createMovies,
);

router.get("/all-movies", authMiddleware, getAllMovies);

router.get("/movie/:id", authMiddleware, getSingleMovie);

router.put("/movie/:id", authMiddleware, roleMiddleware("admin"), updateMovies);

router.delete(
  "/movie/:id",
  authMiddleware,
  roleMiddleware("admin"),
  deleteMovie,
);
export default router;
