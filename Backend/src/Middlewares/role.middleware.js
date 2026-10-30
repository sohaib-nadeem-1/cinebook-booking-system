

export const roleMiddleware = (...role)=>{
    return (req,res,next)=>{

 const user = req.user.userRole;

 if(!role.includes(user)){
return res.status(403).json({
message : " Access Not Authorized"
})}
next()
   
}

}