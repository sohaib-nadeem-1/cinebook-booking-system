import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, X, Film } from 'lucide-react';
import MovieCard from '../../components/movies/MovieCard.jsx';
import Pagination, { paginate } from '../../components/common/Pagination.jsx';
import { Select, SearchInput } from '../../components/common/Field.jsx';
import Button from '../../components/common/Button.jsx';
import { EmptyState, ErrorState, MovieGridSkeleton } from '../../components/common/States.jsx';
import { movieService, SORT_OPTIONS } from '../../services/movieService.js';
import { showtimeService } from '../../services/showtimeService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { useDocTitle } from '../../hooks/useDocTitle.js';

const PAGE = 8;
const TABS = [['', 'All films'], ['now_showing', 'Now showing'], ['coming_soon', 'Coming soon']];

export default function MoviesPage() {
  const [f, set, reset] = useQueryState({ q: '', genre: '', format: '', language: '', rating: '', sort: 'newest', status: '', page: '1' });
  useDocTitle(f.status === 'coming_soon' ? 'Coming soon' : 'Explore movies');
  const [text, setText] = useState(f.q);
  const dq = useDebounce(text, 250);
  useEffect(() => { if (dq !== f.q) set({ q: dq, page: '1' }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setText(f.q); }, [f.q]);

  const { data: catalogueData, loading, error, reload } = useAsync(
    () => movieService.list({ sort: f.sort }),
    [f.sort]
  );
  const next = useAsync(() => showtimeService.nextByMovie(), []);
  const catalogue = catalogueData || [];
  const genres = Array.from(new Set(catalogue.flatMap((movie) => movie.genres || []))).sort();
  const formats = Array.from(new Set(catalogue.flatMap((movie) => movie.formats || []))).sort();
  const languages = Array.from(new Set(catalogue.map((movie) => movie.language).filter(Boolean))).sort();
  const ratings = Array.from(new Set(catalogue.map((movie) => movie.rating).filter(Boolean))).sort();
  const query = f.q.trim().toLowerCase();
  const movies = useMemo(() => catalogue.filter((movie) => {
    if (f.status && movie.status !== f.status) return false;
    if (f.genre && !(movie.genres || []).includes(f.genre)) return false;
    if (f.format && !(movie.formats || []).includes(f.format)) return false;
    if (f.language && movie.language !== f.language) return false;
    if (f.rating && movie.rating !== f.rating) return false;
    if (query) {
      const searchable = [movie.title, movie.director, movie.language, ...(movie.genres || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  }), [catalogue, f.status, f.genre, f.format, f.language, f.rating, query]);
  const page = Math.min(Number(f.page) || 1, Math.max(1, Math.ceil(movies.length / PAGE)));
  const { rows, pages } = useMemo(() => paginate(movies, page, PAGE), [movies, page]);
  const active = [['genre', f.genre && `Genre: ${f.genre}`], ['format', f.format && `Format: ${f.format}`], ['language', f.language && `Language: ${f.language}`], ['rating', f.rating && `Rated: ${f.rating}`], ['q', f.q && `Search: “${f.q}”`]].filter(([, value]) => value);
  const change = (key) => (event) => set({ [key]: event.target.value, page: '1' });

  return (
    <div className="px-margin-mobile md:px-margin py-8 max-w-[1600px] mx-auto">
      <p className="label-caps text-secondary flex items-center gap-2"><Film className="w-4 h-4" aria-hidden />CineBook movie catalogue</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg font-bold text-white">{f.status === 'coming_soon' ? 'Coming Soon' : 'Explore Movies'}</h1>
          <p className="mt-1 text-body-md text-on-surface-variant max-w-xl">Browse saved titles and upcoming releases. Choose a screening to check current seat availability.</p>
        </div>
      </div>

      <SearchInput className="mt-6" value={text} onChange={setText} placeholder="Search by movie title, director or genre…" label="Search movies" shortcut />
      <div role="tablist" aria-label="Release status" className="mt-4 inline-flex rounded-full bg-surface-container-low p-1 border border-white/5">
        {TABS.map(([value, label]) => <button key={label} role="tab" aria-selected={f.status === value} onClick={() => set({ status: value, page: '1' })} className={`rounded-full px-4 py-1.5 text-label-md transition-colors ${f.status === value ? 'bg-primary-container text-white shadow-glow' : 'text-on-surface-variant hover:text-white'}`}>{label}</button>)}
      </div>

      <div className="mt-4 panel p-4 md:p-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <Select label="Genre" value={f.genre} onChange={change('genre')}><option value="">All genres</option>{genres.map((value) => <option key={value}>{value}</option>)}</Select>
          <Select label="Experience / format" value={f.format} onChange={change('format')}><option value="">All formats</option>{formats.map((value) => <option key={value}>{value}</option>)}</Select>
          <Select label="Language" value={f.language} onChange={change('language')}><option value="">All languages</option>{languages.map((value) => <option key={value}>{value}</option>)}</Select>
          <Select label="Age rating" value={f.rating} onChange={change('rating')}><option value="">All ratings</option>{ratings.map((value) => <option key={value}>{value}</option>)}</Select>
          <Select label="Sort by" value={f.sort} onChange={change('sort')}>{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Button variant="secondary" icon={RotateCcw} onClick={() => { reset(); setText(''); }} className="col-span-2 lg:col-span-1">Reset</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-label-sm" aria-live="polite">
          {active.length > 0 && <span className="text-on-surface-variant">Active:</span>}
          {active.map(([key, label]) => <button key={key} onClick={() => { set({ [key]: '', page: '1' }); if (key === 'q') setText(''); }} aria-label={`Remove filter ${label}`} className="chip bg-surface-container-high text-on-surface hover:bg-surface-container-highest">{label}<X className="w-3 h-3" aria-hidden /></button>)}
          {active.length > 0 && <button onClick={() => { reset(); setText(''); }} className="text-primary underline">Clear all</button>}
          <span className="ml-auto text-on-surface-variant">{loading ? 'Loading…' : <>Showing <b className="text-white">{movies.length}</b> {movies.length === 1 ? 'movie' : 'movies'}</>}</span>
        </div>
      </div>

      <div className="mt-6">
        {error ? <ErrorState onRetry={reload} /> : loading && !catalogueData ? <MovieGridSkeleton /> : movies.length === 0 ? (
          <EmptyState title="No movies match your search" message="Try removing a filter or searching by a different title, director or genre." action={<Button onClick={() => { reset(); setText(''); }} icon={RotateCcw}>Clear all filters</Button>} />
        ) : (
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-gutter-mobile md:gap-gutter transition-opacity ${loading ? 'opacity-60' : ''}`}>{rows.map((movie) => <MovieCard key={movie.id} movie={movie} next={next.data?.[movie.id]} />)}</div>
        )}
      </div>

      {movies.length > 0 && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-body-sm text-on-surface-variant"><span>Showing <b className="text-white">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, movies.length)}</b> of <b className="text-white">{movies.length}</b> movies</span><Pagination page={page} pages={pages} onChange={(nextPage) => { set({ page: String(nextPage) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></div>}
    </div>
  );
}
