import { db } from './db.js';
import { simulate, ApiError } from './api.js';
import { showtimeService } from './showtimeService.js';
import { slugify, uid } from '../utils/format.js';

const SORTS = {
  popularity: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  rating: (a, b) => (b.score || 0) - (a.score || 0),
  newest: (a, b) => b.releaseDate.localeCompare(a.releaseDate),
  title: (a, b) => a.title.localeCompare(b.title),
  runtime: (a, b) => a.runtime - b.runtime,
};
export const SORT_OPTIONS = [['popularity', 'Popularity'], ['rating', 'Top Rated'], ['newest', 'Newest'], ['title', 'Title A–Z'], ['runtime', 'Shortest runtime']];

const validate = (d) => {
  const e = {};
  if (!d.title?.trim()) e.title = 'Title is required';
  if (!d.genres?.length) e.genres = 'Choose at least one genre';
  if (!(Number(d.runtime) >= 30 && Number(d.runtime) <= 360)) e.runtime = 'Runtime must be 30–360 minutes';
  if (!d.releaseDate) e.releaseDate = 'Release date is required';
  if (!d.rating) e.rating = 'Select an age rating';
  if (!d.formats?.length) e.formats = 'Choose at least one format';
  return e;
};

export const movieService = {
  list: ({ search = '', genre, format, language, rating, sort = 'popularity', status, scope = 'public' } = {}) => simulate(() => {
    const q = search.trim().toLowerCase();
    return db.movies.all().filter((m) => {
      if (scope === 'public' && m.status === 'archived') return false;
      if (status === 'now_showing' ? !['now_showing', 'advance_booking'].includes(m.status) : status && m.status !== status) return false;
      if (genre && !m.genres.includes(genre)) return false;
      if (format && !m.formats.includes(format)) return false;
      if (language && m.language !== language) return false;
      if (rating && m.rating !== rating) return false;
      if (q && !`${m.title} ${m.director} ${m.cast.map((c) => c.name).join(' ')} ${m.genres.join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort(SORTS[sort] || SORTS.popularity);
  }, 250),

  getBySlug: (slug) => simulate(() => {
    const m = db.movies.all().find((x) => x.slug === slug);
    if (!m) throw new ApiError('We couldn’t find that movie. It may have been archived or removed.', 'NOT_FOUND');
    return m;
  }, 200),

  create: (data) => simulate(() => {
    const errors = validate(data);
    if (Object.keys(errors).length) throw Object.assign(new ApiError('Please fix the highlighted fields.', 'VALIDATION'), { errors });
    const all = db.movies.all();
    let slug = slugify(data.title); if (all.some((m) => m.slug === slug)) slug += `-${all.length + 1}`;
    const movie = {
      id: uid('mv'), slug, poster: data.poster || null, backdrop: data.poster || null, language: 'English', featured: false, popularity: 40, score: 0, votes: '—', rt: 0,
      cast: [], director: data.director || 'TBA', synopsis: data.synopsis || 'Synopsis coming soon.', badge: data.formats[0], trailer: '2m 00s', sound: 'Atmos',
      ...data, runtime: Number(data.runtime),
    };
    db.movies.save([movie, ...all]); return movie;
  }),

  update: (id, data) => simulate(() => {
    const all = db.movies.all(); const cur = all.find((m) => m.id === id);
    if (!cur) throw new ApiError('This movie no longer exists.', 'NOT_FOUND');
    const errors = validate({ ...cur, ...data });
    if (Object.keys(errors).length) throw Object.assign(new ApiError('Please fix the highlighted fields.', 'VALIDATION'), { errors });
    const next = { ...cur, ...data, runtime: Number(data.runtime ?? cur.runtime) };
    db.movies.save(all.map((m) => (m.id === id ? next : m))); return next;
  }),

  setStatus: (id, status) => simulate(() => {
    const all = db.movies.all();
    db.movies.save(all.map((m) => (m.id === id ? { ...m, status } : m)));
    return all.find((m) => m.id === id);
  }, 250),

  remove: (id) => simulate(() => {
    const all = db.movies.all();
    if (!all.some((m) => m.id === id)) throw new ApiError('This movie no longer exists.', 'NOT_FOUND');
    db.movies.save(all.filter((m) => m.id !== id));
    showtimeService.removeByMovie(id);
    return { id };
  }),
};
