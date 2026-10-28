import { user } from "../db/schema/user.schema.js";
import { db } from "../db/index.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"
import config from "../config/config.data.js";



export const registerApi = async (req, res) => {
  const { email, username } = req.body;
  // const data = req.body;
  const password = req.body.password;
  const hashPassword = await bcrypt.hash(password, 10);
  // console.log(password);

  const findEmail = await db.select().from(user).where(eq(user.email, email));
  const findUsername = await db
    .select()
    .from(user)
    .where(eq(user.username, username));
  if (findEmail.length > 0 || findUsername.length > 0) {
    res.status(409).json({
      Message: "username or email already exist",
    });
  }

  const data = {
    ...req.body,
    password: hashPassword,
  };
  
  const savingUser = await db.insert(user).values(data).returning();
  const token = jwt.sign(
    {userID : savingUser[0].id, role : savingUser[0].role},
      config.JWT_SECRET_KEY,
    {expiresIn: "1d"}
  )



  res.status(201).json({
    message: "User Created SucessFully ",
    savingUser,
    token
  });
};


export const loginApi = async(req,res)=>{
    const {email,password}=req.body;
    const id = req.params.id;

    const getUserdata =await db.select().from(user).where(eq(id,user.id))

    res.status(200).json({
        Message : "Data Get SucessFUlly",
        getUserdata
    })
}
