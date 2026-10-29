






export const profileApi = async (req,res)=>{
    const data = req.user;

    if(!data){
      return  res.status(401).json({
            message: "User Profile Not Found",
            
        })
    }

    res.status(200).json({
        message : "Thi is your profile",
        data
    })
}