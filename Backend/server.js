import app from "./src/app.js";


const port = process.env.PORT;

app.listen(port,()=>{
    console.log("Server is Running on POrt 3000");
    
})