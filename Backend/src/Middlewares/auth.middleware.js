import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import config from "../config/config.data.js";
import { db } from "../db/index.js";
import { user } from "../db/schema/user.schema.js";

export const authMiddleware = async (req, res, next) => {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({ message: "Bearer token is required" });
  }

  try {
    const payload = jwt.verify(match[1], config.JWT_SECRET_KEY, {
      algorithms: ["HS256"],
    });
    const userId = Number(payload?.userid);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // The database is authoritative for account state and permissions. This
    // prevents a stale JWT from retaining admin access after a role change or
    // account deactivation.
    const [currentUser] = await db
      .select({
        userid: user.id,
        userRole: user.role,
        userEmail: user.email,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.status !== "active") {
      return res.status(401).json({ message: "Account is unavailable" });
    }

    req.user = currentUser;
    return next();
  } catch (error) {
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError" || error?.name === "NotBeforeError") {
      return res.status(401).json({ message: "Invalid or expired credentials" });
    }
    return next(error);
  }
};
