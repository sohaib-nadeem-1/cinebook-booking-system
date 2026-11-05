import { api, ApiError } from "./api.js";
import { movieService } from "./movieService.js";
import { AUDITORIUMS, CINEMAS } from "../data/cinemas.js";

export const CONFLICT_MESSAGE =
  "This auditorium already has a scheduled screening during this time.";

const API_ENDPOINT = "/showtime";

const toNumber = (value) => Number(value);

const getArrayResult = (response, key) => {
  const result = response?.[key];

  if (Array.isArray(result)) return result;

  return result ? [result] : [];
};

const getOneResult = (response, key) => {
  const result = response?.[key];

  if (Array.isArray(result)) return result[0] || null;

  return result || null;
};

const normalizeTime = (time) => {
  if (!time) return "";

  return String(time).slice(0, 5);
};

const getShowStatus = (date, start) => {
  const showDateTime = new Date(`${date}T${start}:00`);

  return showDateTime.getTime() > Date.now()
    ? "scheduled"
    : "completed";
};

const validate = (data) => {
  const errors = {};

  if (!data.movieId) {
    errors.movieId = "Select a movie";
  }

  if (!data.auditoriumId) {
    errors.auditoriumId = "Select an auditorium";
  }

  if (!data.date) {
    errors.date = "Pick a date";
  }

  if (!data.start) {
    errors.start = "Enter a start time";
  }

  if (!data.end) {
    errors.end = "Enter an end time";
  }

  const standardPrice = Number(
    data.standardPrice ?? data.price
  );

  const primePrice = Number(
    data.primePrice ?? data.price
  );

  if (!(standardPrice > 0)) {
    errors.price = "Enter a valid standard ticket price";
  }

  if (!(primePrice > 0)) {
    errors.primePrice = "Enter a valid prime ticket price";
  }

  if (
    data.start &&
    data.end &&
    data.end <= data.start
  ) {
    errors.end = "End time must be greater than start time";
  }

  return errors;
};

/**
 * Converts backend showtime fields into the frontend structure.
 *
 * Backend:
 * movie_id, auditorium_id, start_time, end_time
 *
 * Frontend:
 * movieId, auditoriumId, start, end
 */
const mapShowtime = (showtime, movies = []) => {
  const movieId = toNumber(showtime.movie_id);
  const auditoriumId = toNumber(showtime.auditorium_id);

  const movie =
    movies.find((item) => toNumber(item.id) === movieId) || null;

  const auditorium =
    AUDITORIUMS.find(
      (item) => toNumber(item.id) === auditoriumId
    ) || null;

  const cinema =
    CINEMAS.find(
      (item) =>
        toNumber(item.id) === toNumber(auditorium?.cinemaId)
    ) || null;

  const start = normalizeTime(showtime.start_time);
  const end = normalizeTime(showtime.end_time);

  return {
    id: toNumber(showtime.id),

    movieId,
    auditoriumId,
    cinemaId: auditorium?.cinemaId ?? null,

    movie,

    auditorium,
    cinema,

    format: showtime.format,

    date: showtime.date,
    start,
    end,

    standardPrice: Number(showtime.standard_price),
    primePrice: Number(showtime.prime_price),

    // Compatibility with existing UI components
    price: Number(showtime.standard_price),

    status: getShowStatus(showtime.date, start),

    createdAt: showtime.created_at,
    updatedAt: showtime.updated_at,

    // Seat availability will be connected separately.
    capacity: null,
    seatsLeft: null,
    soldPct: null,
    soldOut: false,
  };
};

const getMovieList = async () => {
  return movieService.list({
    scope: "admin",
    sort: "title",
  });
};

const getRawShowtimes = async () => {
  const response = await api.get(`${API_ENDPOINT}/get-show`);

  return getArrayResult(response, "allShowtimes");
};

const getRawShowtime = async (id) => {
  const response = await api.get(
    `${API_ENDPOINT}/single-show/${id}`
  );

  const showtime = getOneResult(response, "showtime");

  if (!showtime) {
    throw new ApiError(
      "This showtime could not be found.",
      "NOT_FOUND",
      404
    );
  }

  return showtime;
};

const toBackendPayload = (data) => {
  const standardPrice = Number(
    data.standardPrice ?? data.price
  );

  const primePrice = Number(
    data.primePrice ?? data.price
  );

  return {
    movie_id: toNumber(data.movieId),
    auditorium_id: toNumber(data.auditoriumId),

    format: data.format,

    date: data.date,
    start_time: data.start,
    end_time: data.end,

    standard_price: standardPrice,
    prime_price: primePrice,
  };
};

/**
 * Fetches all showtimes and attaches movie/cinema/auditorium data.
 */
export const hydrate = async (showtime) => {
  if (!showtime) return null;

  const [movies] = await Promise.all([
    getMovieList(),
  ]);

  return mapShowtime(showtime, movies);
};

/**
 * Backend handles actual auditorium conflict validation.
 * This helper checks conflicts against currently fetched showtimes.
 */
export const findConflict = async (
  candidate,
  ignoreId = null
) => {
  const allShowtimes = await showtimeService.list({
    date: candidate.date,
    includePast: true,
  });

  const start = candidate.start;
  const end = candidate.end;

  return (
    allShowtimes.find((showtime) => {
      if (showtime.id === ignoreId) return false;

      if (
        showtime.auditoriumId !==
        toNumber(candidate.auditoriumId)
      ) {
        return false;
      }

      if (showtime.date !== candidate.date) return false;

      return (
        start < showtime.end &&
        end > showtime.start
      );
    }) || null
  );
};

export const showtimeService = {
  /**
   * GET ALL SHOWTIMES
   */
  list: async ({
    movieId,
    cinemaId,
    date,
    search = "",
    format,
    includePast = true,
  } = {}) => {
    const [rawShowtimes, movies] = await Promise.all([
      getRawShowtimes(),
      getMovieList(),
    ]);

    const query = search.trim().toLowerCase();

    return rawShowtimes
      .map((item) => mapShowtime(item, movies))
      .filter((showtime) => {
        if (!showtime.movie) return false;

        if (
          movieId &&
          showtime.movieId !== toNumber(movieId)
        ) {
          return false;
        }

        if (
          cinemaId &&
          showtime.cinemaId !== toNumber(cinemaId)
        ) {
          return false;
        }

        if (date && showtime.date !== date) {
          return false;
        }

        if (format && showtime.format !== format) {
          return false;
        }

        if (!includePast) {
          const showDateTime = new Date(
            `${showtime.date}T${showtime.start}:00`
          );

          if (showDateTime.getTime() <= Date.now()) {
            return false;
          }
        }

        if (query) {
          const searchableText = [
            showtime.movie.title,
            showtime.auditorium?.name,
            showtime.cinema?.short,
            showtime.format,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!searchableText.includes(query)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) =>
        `${a.date}${a.start}`.localeCompare(
          `${b.date}${b.start}`
        )
      );
  },

  /**
   * GET SINGLE SHOWTIME
   */
  get: async (id) => {
    const [rawShowtime, movies] = await Promise.all([
      getRawShowtime(id),
      getMovieList(),
    ]);

    return mapShowtime(rawShowtime, movies);
  },

  /**
   * GET NEXT UPCOMING SHOW FOR EACH MOVIE
   */
  nextByMovie: async () => {
    const allShowtimes = await showtimeService.list({
      includePast: false,
    });

    const map = {};

    allShowtimes.forEach((showtime) => {
      const movieId = showtime.movieId;

      if (!map[movieId]) {
        map[movieId] = showtime;
      }
    });

    return map;
  },

  /**
   * GET UPCOMING DATES FOR A MOVIE
   */
  datesFor: async (movieId) => {
    const allShowtimes = await showtimeService.list({
      movieId,
      includePast: false,
    });

    return [
      ...new Set(
        allShowtimes.map((showtime) => showtime.date)
      ),
    ].sort();
  },

  /**
   * CREATE SHOWTIME
   */
  create: async (data) => {
    const errors = validate(data);

    if (Object.keys(errors).length) {
      throw Object.assign(
        new ApiError(
          "Please fix the highlighted fields.",
          "VALIDATION"
        ),
        { errors }
      );
    }

    try {
      const payload = toBackendPayload(data);

      const response = await api.post(
        `${API_ENDPOINT}/create-showtime`,
        payload
      );

      const createdShowtime = getOneResult(
        response,
        "insertingShowtime"
      );

      if (!createdShowtime) {
        throw new ApiError(
          "Showtime was not returned by server.",
          "INVALID_RESPONSE"
        );
      }

      const movies = await getMovieList();

      return mapShowtime(createdShowtime, movies);
    } catch (error) {
      if (error.status === 409) {
        throw Object.assign(
          new ApiError(CONFLICT_MESSAGE, "CONFLICT", 409),
          {
            errors: {
              start: CONFLICT_MESSAGE,
            },
          }
        );
      }

      throw error;
    }
  },

  /**
   * UPDATE SHOWTIME
   */
  update: async (id, data) => {
    const existingShowtime = await showtimeService.get(id);

    const updatedData = {
      ...existingShowtime,
      ...data,
    };

    const errors = validate(updatedData);

    if (Object.keys(errors).length) {
      throw Object.assign(
        new ApiError(
          "Please fix the highlighted fields.",
          "VALIDATION"
        ),
        { errors }
      );
    }

    try {
      const payload = toBackendPayload(updatedData);

      const response = await api.put(
        `${API_ENDPOINT}/update-show/${id}`,
        payload
      );

      const updatedShowtime = getOneResult(
        response,
        "updatedShowtime"
      );

      if (!updatedShowtime) {
        throw new ApiError(
          "Updated showtime was not returned by server.",
          "INVALID_RESPONSE"
        );
      }

      const movies = await getMovieList();

      return mapShowtime(updatedShowtime, movies);
    } catch (error) {
      if (error.status === 409) {
        throw Object.assign(
          new ApiError(CONFLICT_MESSAGE, "CONFLICT", 409),
          {
            errors: {
              start: CONFLICT_MESSAGE,
            },
          }
        );
      }

      throw error;
    }
  },

  /**
   * DELETE SHOWTIME
   */
  remove: async (id) => {
    const response = await api.delete(
      `${API_ENDPOINT}/delete/${id}`
    );

    return {
      id: toNumber(id),
      response,
    };
  },

  /**
   * DELETE ALL SHOWTIMES FOR A MOVIE
   *
   * Use carefully. The backend currently has no dedicated
   * remove-by-movie endpoint, so this calls DELETE per showtime.
   */
  removeByMovie: async (movieId) => {
    const allShowtimes = await showtimeService.list({
      movieId,
      includePast: true,
    });

    const results = await Promise.all(
      allShowtimes.map((showtime) =>
        showtimeService.remove(showtime.id)
      )
    );

    return results;
  },
};