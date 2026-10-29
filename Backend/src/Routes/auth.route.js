import express from "express";
import { loginApi, registerApi } from "../controllers/auth.controller.js";



const router = express.Router();

router.post("/register",registerApi)
router.post("/login",loginApi)
export default router;