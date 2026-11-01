import { arrayContains, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { showtimes } from "../db/schema/showTime.schema.js";
import { seats } from "../db/Schema/seats.schema.js";





export const createBookings =async (req,res)=>{
    const {showtimeId,seatsID} = req.body;
    const userid =req.user.userid;
    console.log(userid);

    const seatsCounted = seatsID.length;
console.log(seatsCounted);

    const checkShowID =await db.select().from(showtimes).where(eq(showtimes.id,showtimeId));
    // console.log(checkShowID);
    const showAuditoriumID = checkShowID[0].auditorium_id;
    
    if(checkShowID.length===0){
       return res.status(404).json({
            message :"Showtime Not Found"
        })
    }

    const checkSeats = await db.select().from(seats).where(inArray(seats.id,seatsID))
    console.log(checkSeats.length);

    if(checkSeats.length != seatsCounted){
        return res.status(404).json({
            message : "Seat not Found"
        })
    }
    
//     showtime auditorium_id
//         ↓
// compare
//         ↓
// each selected seat auditorium_id


  
const wrongSeats = checkSeats.some((chkseats)=>{
    checkSeats.auditorium_id!==showAuditoriumID
})

if(wrongSeats){
    res.status(404).json({
        message : "Selected seat does not belong to this auditoriumudit"
    })
}




    res.status(201).json({
        message : "Booking Created "
    })
    

}