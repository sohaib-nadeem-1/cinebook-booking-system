
import { db } from "../db/index.js";
import { movies } from "../db/schema/movies.schema.js";
import { eq } from "drizzle-orm";
import { showtimes } from "../db/schema/showTime.schema.js";




export const createMovies = async (req, res) => {
    const {
        title,
        runtime,
        release_date,
        age_rating,
        status,
        director,
        language,
        genres,
        formats,
        poster_url,
        synopsis
    } = req.body;

    const savingMovies = await db
        .insert(movies)
        .values({
            title,
            runtime,
            release_date,
            age_rating,
            status,
            director,
            language,
            genres,
            formats,
            poster_url,
            synopsis
        })
        .returning();

    return res.status(201).json({
        message: "Movies Created Successfully",
        savingMovies
    });
};

export const getAllMovies = async(req,res)=>{

    const allMovies =await db.select().from(movies);

    res.status(200).json({
        message : "All Movies Fetched SucessFully",
        allMovies
    })
}

export const getSingleMovie = async(req,res)=>{
    const id = Number(req.params.id);

    if(!id){
        res.status(401).json({
            message : "MovieId Not Found"
        })
    }
    const getMovie =await db.select().from(movies).where(eq(movies.id,id))
   if(getMovie.length===0){
   return res.status(404).json({
        message : "Movie Not Found in Db"
    })

   }

   res.status(200).json({
    message : "Movie Fetched SucessFully",
    getMovie
   })
    
}

export const updateMovies = async(req,res)=>{
    const id = Number(req.params.id);

    if(!id){
        res.status(404).json({
            message : "Movie Not Found"
        })
    }
    const {title,
        runtime,
        release_date,
        age_rating,
        status,
        director,
        language,
        genres,
        formats,
        poster_url,
        synopsis}=req.body;

  const updatingMovies =await db.update(movies).set({title,
        runtime,
        release_date,
        age_rating,
        status,
        director,
        language,
        genres,
        formats,
        poster_url,
        synopsis}).where(eq(movies.id,id)).returning()

        res.status(201).json({
            message: "Message Updated SucessFully",
            updatingMovies
        })


}

export const deleteMovie = async (req, res) => {
    const id = Number(req.params.id);

    // 1. Check movie exists
    const movie = await db
        .select()
        .from(movies)
        .where(eq(movies.id, id));

    if (movie.length === 0) {
        return res.status(404).json({
            message: "Movie Not Found"
        });
    }

    // 2. Check related showtimes
    const movieShowtimes = await db
        .select()
        .from(showtimes)
        .where(eq(showtimes.movie_id, id));

    if (movieShowtimes.length > 0) {
        return res.status(409).json({
            message: "Cannot delete movie because showtimes exist"
        });
    }

    // 3. Delete movie
    const deletedMovie = await db
        .delete(movies)
        .where(eq(movies.id, id))
        .returning();

    return res.status(200).json({
        message: "Movie Deleted Successfully",
        deletedMovie
    });
};