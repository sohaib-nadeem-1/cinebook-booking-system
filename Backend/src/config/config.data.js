import { configDotenv } from "dotenv";
configDotenv();

const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
  CINEMA_TIME_ZONE: process.env.CINEMA_TIME_ZONE || "UTC",
  NODE_ENV: process.env.NODE_ENV || "development",
};

if (!config.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.");
}

if (!config.JWT_SECRET_KEY || Buffer.byteLength(config.JWT_SECRET_KEY, "utf8") < 32) {
  throw new Error("JWT_SECRET_KEY must contain at least 32 characters.");
}

try {
  new Intl.DateTimeFormat("en-US", { timeZone: config.CINEMA_TIME_ZONE });
} catch {
  throw new Error("CINEMA_TIME_ZONE must be a valid IANA timezone name.");
}

export default config;
