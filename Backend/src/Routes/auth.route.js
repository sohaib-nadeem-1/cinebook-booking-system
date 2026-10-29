import express from "express";
import { loginApi, registerApi } from "../controllers/auth.controller.js";
import { profileApi } from "../controllers/profile.controller.js";
import { authMiddleware } from "../Middlewares/auth.middleware.js";



const router = express.Router();

router.post("/register",registerApi)
router.post("/login",loginApi);
router.get("/profile",authMiddleware,profileApi)
export default router;