import jwt  from "jsonwebtoken";
import config from "../config/config.data.js";

export const authMiddleware = async (req,res,next)=>{

    if(!req.headers.authorization){
        res.status(401).json({
            message : "HEader not Found"
        })
    }
    const token = req.headers.authorization.split(" ")[1];
if(!token){
    res.status(401).json({
        Message : " Credetials Not Found"
    })
}

     try{
    const tokenVerifyng = jwt.verify(token,config.JWT_SECRET_KEY);

req.user = tokenVerifyng
next()


     }
     catch(err){
           res.status(401).json({
            Message : "User Credentials Not Matched"
        })
     }

    



}