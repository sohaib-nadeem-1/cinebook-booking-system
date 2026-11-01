import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { showtimes } from "../db/schema/showTime.schema.js";





export const createBookings = (req,res)=>{
    const {showtimeId} = req.body;
    const userid =req.user.userid;
    console.log(userid);

    const checkShowID = db.select().from(showtimes).where(eq(showtimeId,showtimes.id))
    if(!checkShowID){
        res.status(404).json({
            message :"Showtime Not Found"
        })
    }


    res.status(201).json({
        message : "Booking Created "
    })
    

}