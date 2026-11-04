
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { user } from "../db/Schema/user.schema.js";

export const changePasswordApi = async (req, res) => {
  try {
    const { current, next, confirm } = req.body;

    // User ID JWT middleware se milegi
    const userId = req.user.userid;

    // 1. Validate request body
    if (!current || !next || !confirm) {
      return res.status(400).json({
        message: "All password fields are required",
      });
    }

    if (next.length < 8) {
      return res.status(400).json({
        message: "New password must contain at least 8 characters",
      });
    }

    if (next !== confirm) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    if (current === next) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // 2. Find logged-in user
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (existingUser.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // 3. Verify current password
    const isPasswordCorrect = await bcrypt.compare(
      current,
      existingUser[0].password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // 4. Hash new password
    const hashedPassword = await bcrypt.hash(next, 12);

    // 5. Update password in database
    await db
      .update(user)
      .set({
        password: hashedPassword,
        updated_at: new Date(),
      })
      .where(eq(user.id, userId));

    return res.status(200).json({
      message: "Password changed successfully",
    });

  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
