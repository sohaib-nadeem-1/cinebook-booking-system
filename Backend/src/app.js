import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./Routes/auth.route.js";
import movieRouter from "./Routes/movies.routes.js"
import showTimeRouter from "./Routes/showtime.route.js"


dotenv.config()

const app = express();

app.use(cors());
app.use(express.json());

// app.use("/api/app",getUser)

app.use("/api",authRouter);
app.use("/api",movieRouter);
app.use("/showtime",showTimeRouter)
export default app;