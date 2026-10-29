import { user } from "../db/Schema/user.schema.js";
import { db } from "../db/index.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config.data.js";

export const registerApi = async (req, res) => {
  const { name, email, password, phone } = req.body;

  const hashPassword = await bcrypt.hash(password, 10);
  // console.log(password);

  const findEmail = await db.select().from(user).where(eq(user.email, email));

  if (findEmail.length > 0) {
    return res.status(409).json({
      Message: " email already exist",
    });
  }

  const data = {
    name: name,
    email: email,
    phone: phone,
    password: hashPassword,
  };

  const savingUser = await db.insert(user).values(data).returning();
  const token = jwt.sign(
    { userID: savingUser[0].id },
     config.JWT_SECRET_KEY, 
   { expiresIn: "1d",}
  );

  res.status(201).json({
    message: "User Created SucessFully ",
    token,
  });
};


export const loginApi = async (req, res) => {
  const { email, password } = req.body;

  console.log("Email from request:", email);
  const getUser = await db.select().from(user).where(eq(user.email, email));

  if (getUser.length === 0) {
    return res.status(401).json({
      message: "User Email Not Found",
    });
  }

  const exixtingUser = getUser[0];
  const checkingPassword = await bcrypt.compare(
    password,
    exixtingUser.password,
  );

  console.log("Entered:", password);
console.log("Stored:", exixtingUser.password);
console.log("Compare:", checkingPassword);

  if (!checkingPassword) {
    return res.status(401).json({
      message: "User password is Incorrect",
    });
  }

  const token = jwt.sign(
    {
      userid : exixtingUser.id,
      userRole : exixtingUser.role,
      userEmail : exixtingUser.email
    },
    config.JWT_SECRET_KEY,
    {
      expiresIn : "1d"
    }
  )
  res.status(200).json({
    Message: "Login SucessFUlly",
    token
  });
};
