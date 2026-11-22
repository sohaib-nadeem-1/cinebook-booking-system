import express from "express";

import { authMiddleware } from "../Middlewares/auth.middleware.js";
import { roleMiddleware } from "../Middlewares/role.middleware.js";
import { getAllUsers } from "../controllers/admin.controller.js";

const router = express.Router();

console.log("Admin route file loaded");

router.get(
  "/users",
  authMiddleware,
  roleMiddleware("admin"),
  getAllUsers
);

export default router;