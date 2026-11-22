
import { api, ApiError } from "./api.js";
import { movieService } from "./movieService.js";

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

// VALIDATION

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

  if (!(standardPrice > 0) || !Number.isFinite(standardPrice)) {
    errors.standardPrice = "Enter a valid standard ticket price";
  }

  if (!(primePrice > 0) || !Number.isFinite(primePrice)) {
    errors.primePrice = "Enter a valid prime ticket price";
  }

  if (
    data.start &&
    data.end &&
    data.end === data.start
  ) {
    errors.end = "Start time and end time cannot be the same";
  }

  return errors;
};

// MAP BACKEND DATA TO FRONTEND STRUCTURE

const mapShowtime = (showtime, movies = []) => {
  const movieId = toNumber(showtime.movie_id);
  const auditoriumId = toNumber(showtime.auditorium_id);

  const movie =
    movies.find((item) => toNumber(item.id) === movieId) || null;

  // Actual auditorium data from backend JOIN
  const rawAuditorium = showtime.auditorium || null;

  const auditorium = rawAuditorium
    ? {
        ...rawAuditorium,
        id: toNumber(rawAuditorium.id),
        cinemaId: toNumber(rawAuditorium.cinema_id),
        hall_no: toNumber(rawAuditorium.hall_no),

        // Compatibility with existing frontend components
        name: `Hall ${rawAuditorium.hall_no}`,
        spec: showtime.format || "",
      }
    : null;

  // Actual cinema data from backend JOIN
  const rawCinema = showtime.cinema || null;

  const cinema = rawCinema
    ? {
        ...rawCinema,
        id: toNumber(rawCinema.id),

        // Compatibility with existing UI
        short: rawCinema.name,
      }
    : null;

  const start = normalizeTime(showtime.start_time);
  const end = normalizeTime(showtime.end_time);

  return {
    id: toNumber(showtime.id),

    movieId,
    auditoriumId,

    cinemaId:
      cinema?.id ??
      auditorium?.cinemaId ??
      null,

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

// FETCH MOVIES

const getMovieList = async () => {
  return movieService.list({
    scope: "admin",
    sort: "title",
  });
};

// FETCH ALL RAW SHOWTIMES

const getRawShowtimes = async () => {
  const response = await api.get(`${API_ENDPOINT}/get-show`);

  return getArrayResult(response, "allShowtimes");
};

const getCinemaResources = async () => {
  const response = await api.get(`${API_ENDPOINT}/resources`);
  return {
    cinemas: (response?.cinemas || []).map((cinema) => ({
      ...cinema,
      id: toNumber(cinema.id),
      short: cinema.name,
    })),
    auditoriums: (response?.auditoriums || []).map((auditorium) => ({
      ...auditorium,
      id: toNumber(auditorium.id),
      cinemaId: toNumber(auditorium.cinema_id),
      hall_no: toNumber(auditorium.hall_no),
      capacity: toNumber(auditorium.capacity),
      name: `Hall ${auditorium.hall_no}`,
    })),
  };
};

// FETCH SINGLE RAW SHOWTIME

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

// MAP FRONTEND DATA TO BACKEND PAYLOAD

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

// HYDRATE SINGLE SHOWTIME

export const hydrate = async (showtime) => {
  if (!showtime) return null;

  const [rawShowtime, movies] = await Promise.all([
    showtime.auditorium && showtime.cinema
      ? Promise.resolve(showtime)
      : getRawShowtime(showtime.id),

    getMovieList(),
  ]);

  return mapShowtime(rawShowtime, movies);
};

// --- Overnight-aware interval helpers (mirror the backend) ---
const TURNAROUND_MINUTES = 15;

const dateToDayNumber = (dateStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? Math.floor(stamp / (24 * 60 * 60 * 1000))
    : null;
};

const toMinutes = (time) => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(time));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 60 + minutes + seconds / 60;
};

const toInterval = (dateStr, start, end) => {
  const day = dateToDayNumber(dateStr);
  const startMin = toMinutes(start);
  let endMin = toMinutes(end);
  if (day === null || startMin === null || endMin === null) return null;
  if (endMin <= startMin) endMin += 24 * 60;
  const base = day * 24 * 60;
  return { start: base + startMin, end: base + endMin };
};

// CHECK SHOWTIME CONFLICT

export const findConflictInList = (candidate, allShowtimes = [], ignoreId = null) => {
  const bufferMinutes = TURNAROUND_MINUTES;
  const auditoriumId = toNumber(candidate.auditoriumId);
  const candidateInterval = toInterval(candidate.date, candidate.start, candidate.end);
  if (!candidateInterval || !Number.isSafeInteger(auditoriumId)) return null;

  return allShowtimes.find((showtime) => {
    if (ignoreId !== null && Number(showtime.id) === Number(ignoreId)) return false;
    if (Number(showtime.auditoriumId) !== auditoriumId) return false;
    const other = toInterval(showtime.date, showtime.start, showtime.end);
    return other && (
      candidateInterval.start < other.end + bufferMinutes &&
      other.start < candidateInterval.end + bufferMinutes
    );
  }) || null;
};

export const findConflict = async (candidate, ignoreId = null) => {
  const allShowtimes = await showtimeService.list({ includePast: true });
  return findConflictInList(candidate, allShowtimes, ignoreId);
};

// SHOWTIME SERVICE

export const showtimeService = {
  // Load actual cinema and auditorium records for the admin schedule form.
  resources: getCinemaResources,

  // GET ALL SHOWTIMES

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
            showtime.cinema?.name,
            showtime.cinema?.city,
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

  // GET SINGLE SHOWTIME

  get: async (id) => {
    const [rawShowtime, movies] = await Promise.all([
      getRawShowtime(id),
      getMovieList(),
    ]);

    return mapShowtime(rawShowtime, movies);
  },

  // GET NEXT UPCOMING SHOW FOR EACH MOVIE

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

  // GET UPCOMING DATES FOR A MOVIE

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

  // CREATE SHOWTIME

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

      // Fetch enriched data using backend JOIN
      return showtimeService.get(createdShowtime.id);

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

  // UPDATE SHOWTIME

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

      // Fetch enriched data using backend JOIN
      return showtimeService.get(id);

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

  // DELETE SHOWTIME

  remove: async (id) => {
    const response = await api.delete(
      `${API_ENDPOINT}/delete/${id}`
    );

    return {
      id: toNumber(id),
      response,
    };
  },

  // DELETE ALL SHOWTIMES FOR A MOVIE

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
