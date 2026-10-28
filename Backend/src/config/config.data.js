import { configDotenv } from "dotenv";
configDotenv()

if(!process.env.DATABASE_URI){
    console.log("DB URl IS NOT FETCHING OR INCRORRECT URL");
    
}

if(!process.env.JWT_SECRET_KEY){
    console.log("JWT KEY NOT AVAILABEL OR INVALID");
    
}

const config = {
  DATABASE_URI : process.env.DATABASE_URI,
 JWT_SECRET_KEY : process.env.JWT_SECRET_KEY,
}

export default config;