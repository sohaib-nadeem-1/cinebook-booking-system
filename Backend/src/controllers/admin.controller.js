import { db } from "../db/index.js";
import { user } from "../db/schema/user.schema.js";
import { desc, ne } from "drizzle-orm";

export const getAllUsers = async (req, res) => {
  try {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
      })
      .from(user)
      .orderBy(desc(user.created_at));

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users",
    });
  }
};