import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import Pagination, { paginate } from '../../components/common/Pagination.jsx';
import Poster from '../../components/common/Poster.jsx';
import Button from '../../components/common/Button.jsx';
import IconButton from '../../components/common/IconButton.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { Field, Select, SearchInput } from '../../components/common/Field.jsx';
import { EmptyState, ErrorState } from '../../components/common/States.jsx';
import { showtimeService, findConflictInList, CONFLICT_MESSAGE } from '../../services/showtimeService.js';
import { movieService } from '../../services/movieService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocTitle } from '../../hooks/useDocTitle.js';
import { addDays, duration, formatDate, fromMinutes, money, time12, toMinutes, todayKey } from '../../utils/format.js';

const TURNAROUND_MINUTES = 15;
const EMPTY = { movieId: '', cinemaId: '', auditoriumId: '', date: todayKey(), start: '18:00', end: '', format: '', standardPrice: '12.50', primePrice: '15.00' };

function ShowtimeForm({ initial, movies, resources, showtimes, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const cinemas = resources?.cinemas || [];
  const auditoriums = resources?.auditoriums || [];
  const firstCinemaId = cinemas[0]?.id ?? '';
  const firstAuditorium = auditoriums.find((item) => String(item.cinemaId) === String(initial?.cinemaId ?? firstCinemaId) && Number(item.capacity) > 0);
  const [f, setF] = useState(() => ({
    ...EMPTY,
    movieId: String(movies[0]?.id ?? ''),
    cinemaId: String(firstCinemaId),
    auditoriumId: String(firstAuditorium?.id ?? ''),
    format: movies[0]?.formats?.[0] || '',
    ...initial,
    movieId: String(initial?.movieId ?? movies[0]?.id ?? ''),
    cinemaId: String(initial?.cinemaId ?? firstCinemaId),
    auditoriumId: String(initial?.auditoriumId ?? firstAuditorium?.id ?? ''),
    standardPrice: initial?.standardPrice ?? initial?.price ?? EMPTY.standardPrice,
    primePrice: initial?.primePrice ?? initial?.price ?? EMPTY.primePrice,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const endTouched = useRef(!!initial?.id);
  const auds = auditoriums.filter((item) => String(item.cinemaId) === String(f.cinemaId) && Number(item.capacity) > 0);
  const aud = auds.find((item) => String(item.id) === String(f.auditoriumId));
  const movie = movies.find((item) => String(item.id) === String(f.movieId));
  const formats = Array.from(new Set([...(movie?.formats || []), ...(f.format ? [f.format] : [])]));

  useEffect(() => {
    if (!endTouched.current && movie && f.start) {
      setF((current) => ({ ...current, end: fromMinutes(toMinutes(current.start) + movie.runtime) }));
    }
  }, [f.start, f.movieId]); // eslint-disable-line react-hooks/exhaustive-deps

  const conflict = useMemo(
    () => (f.auditoriumId && f.date && f.start && f.end
      ? findConflictInList({ ...f, auditoriumId: Number(f.auditoriumId) }, showtimes, initial?.id)
      : null),
    [f.auditoriumId, f.date, f.start, f.end, initial?.id, showtimes]
  );

  const set = (key) => (event) => {
    const value = event.target.value;
    if (key === 'end') endTouched.current = true;
    setF((current) => {
      const next = { ...current, [key]: value };
      if (key === 'cinemaId') {
        const firstRoom = auditoriums.find((item) => String(item.cinemaId) === String(value) && Number(item.capacity) > 0);
        next.auditoriumId = firstRoom ? String(firstRoom.id) : '';
      }
      if (key === 'movieId') {
        const selectedMovie = movies.find((item) => String(item.id) === String(value));
        if (!selectedMovie?.formats?.includes(next.format)) next.format = selectedMovie?.formats?.[0] || '';
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (conflict) return toast.error(CONFLICT_MESSAGE);
    setBusy(true);
    try {
      const showtime = editing
        ? await showtimeService.update(initial.id, f)
        : await showtimeService.create(f);
      toast.success(editing ? 'Showtime updated successfully' : 'Showtime scheduled successfully');
      onSaved(showtime, editing);
    } catch (error) {
      if (error.errors) setErrors(error.errors);
      toast.error(error.code === 'CONFLICT' ? CONFLICT_MESSAGE : error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-5 md:p-6 mb-gutter-mobile border-primary-container/30" aria-labelledby="sf-t">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary-container/15 grid place-items-center"><CalendarDays className="w-5 h-5 text-[#ff8a80]" aria-hidden /></span>
          <div><h2 id="sf-t" className="font-headline text-headline-sm text-white">{editing ? 'Edit Showtime' : 'Schedule New Showtime'}</h2><p className="text-body-sm text-on-surface-variant">Choose a movie, an available cinema and hall, and screening times.</p></div>
        </div>
        <IconButton icon={X} label="Close form" onClick={onClose} />
      </div>
      <form onSubmit={submit} noValidate className="mt-5 grid md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Select className="xl:col-span-3" label="Movie" value={f.movieId} onChange={set('movieId')} error={errors.movieId}>
          {movies.map((item) => <option key={item.id} value={String(item.id)}>{item.title} ({item.runtime} min)</option>)}
        </Select>
        <Select className="xl:col-span-3" label="Cinema" value={f.cinemaId} onChange={set('cinemaId')} error={errors.cinemaId}>
          {cinemas.map((item) => <option key={item.id} value={String(item.id)}>{item.name}{item.city ? ` — ${item.city}` : ''}</option>)}
        </Select>
        <Select className="xl:col-span-3" label="Auditorium" value={f.auditoriumId} onChange={set('auditoriumId')} error={errors.auditoriumId}>
          {auds.map((item) => <option key={item.id} value={String(item.id)}>{item.name} ({item.capacity} seats)</option>)}
        </Select>
        <Field className="xl:col-span-2" label="Screening date" type="date" value={f.date} onChange={set('date')} error={errors.date} />
        <div className="xl:col-span-1"><span className="field-label">Capacity</span><div className="field flex items-center gap-2 !bg-surface-container"><b className="text-secondary">{aud ? `${aud.capacity} seats` : '—'}</b></div></div>
        <Field className="xl:col-span-2" label="Start time" type="time" value={f.start} onChange={set('start')} error={errors.start} />
        <Field className="xl:col-span-2" label="End time" type="time" value={f.end} onChange={set('end')} error={errors.end} hint={movie ? `Runtime ${duration(movie.runtime)}; allow ${TURNAROUND_MINUTES} minutes before the next show` : undefined} />
        <Field className="xl:col-span-1" label="Standard price ($)" type="number" step="0.5" min="0.01" value={f.standardPrice} onChange={set('standardPrice')} error={errors.standardPrice} />
        <Field className="xl:col-span-1" label="Prime price ($)" type="number" step="0.5" min="0.01" value={f.primePrice} onChange={set('primePrice')} error={errors.primePrice} />
        <Select className="xl:col-span-2" label="Screening format" value={f.format} onChange={set('format')} error={errors.format}>
          {formats.map((format) => <option key={format} value={format}>{format}</option>)}
        </Select>
        <p className="md:col-span-2 xl:col-span-6 text-label-sm text-on-surface-variant">VIP pricing is calculated by the server from the prime price. A 15-minute turnaround is required between screenings.</p>
        <div className="md:col-span-2 xl:col-span-6">
          {conflict
            ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/40 bg-error-container/25 px-4 py-3 text-body-sm text-on-error-container"><AlertTriangle className="w-5 h-5 shrink-0" aria-hidden /><div><b>{CONFLICT_MESSAGE}</b><p className="opacity-80">Conflicts with {time12(conflict.start)}–{time12(conflict.end)} on {formatDate(conflict.date)}. Choose another time or hall.</p></div></div>
            : <p className="flex items-center gap-2 text-body-sm text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden />No schedule conflict detected.</p>}
        </div>
        <div className="md:col-span-2 xl:col-span-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" icon={Save} loading={busy} loadingText="Saving…" disabled={!!conflict || !f.auditoriumId || !f.format}>{editing ? 'Save showtime' : 'Confirm showtime'}</Button></div>
      </form>
    </section>
  );
}

export default function AdminShowtimesPage() {
  useDocTitle('Showtimes management');
  const toast = useToast();
  const [f, set, reset] = useQueryState({ q: '', cinema: '', date: todayKey(), fmt: '', rows: '5', page: '1' });
  const [text, setText] = useState(f.q);
  const dq = useDebounce(text, 250);
  useEffect(() => { if (dq !== f.q) set({ q: dq, page: '1' }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setText(f.q); }, [f.q]);

  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const all = useAsync(() => showtimeService.list({}), []);
  const movies = useAsync(() => movieService.list({ scope: 'admin' }), []);
  const resources = useAsync(() => showtimeService.resources(), []);
  const rowsPer = Number(f.rows) || 5;
  const cinemaList = resources.data?.cinemas || [];
  const formats = Array.from(new Set((movies.data || []).flatMap((movie) => movie.formats || []))).sort();
  const capacityByAuditorium = new Map((resources.data?.auditoriums || []).map((item) => [Number(item.id), Number(item.capacity)]));
  const list = useMemo(() => (all.data || []).filter((showtime) =>
    (!f.cinema || String(showtime.cinemaId) === f.cinema) &&
    (!f.date || f.date === 'all' || showtime.date === f.date) &&
    (!f.fmt || showtime.format === f.fmt) &&
    (!f.q || `${showtime.movie?.title || ''} ${showtime.auditorium?.name || ''} ${showtime.cinema?.short || ''}`.toLowerCase().includes(f.q.toLowerCase()))
  ), [all.data, f]);
  const page = Math.min(Number(f.page) || 1, Math.max(1, Math.ceil(list.length / rowsPer)));
  const { rows, pages } = paginate(list, page, rowsPer);
  const today = (all.data || []).filter((showtime) => showtime.date === todayKey());
  const conflicts = (all.data || []).filter((showtime) => findConflictInList(showtime, all.data, showtime.id)).length;
  const dates = Array.from({ length: 4 }, (_, index) => addDays(todayKey(), index));
  const formRef = useRef(null);
  const canSchedule = Boolean(movies.data && resources.data && movies.data.length && resources.data.auditoriums.some((auditorium) => Number(auditorium.capacity) > 0));
  const open = (value) => {
    setForm(value);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const remove = async () => {
    setDelBusy(true);
    try {
      await showtimeService.remove(del.id);
      toast.success('Showtime deleted successfully');
      setDel(null);
      all.reload(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDelBusy(false);
    }
  };
  const clear = () => { reset(); setText(''); };
  if (all.error) return <ErrorState onRetry={all.reload} />;
  if (resources.error && form) return <ErrorState title="Scheduling data unavailable" message={resources.error.message} onRetry={resources.reload} />;

  const cols = [
    { key: 'm', header: 'Movie', render: (showtime) => <div className="flex items-center gap-3"><Poster src={showtime.movie?.poster} title={showtime.movie?.title || 'Movie'} className="w-10 shrink-0" /><div><p className="font-headline text-title-md text-white leading-tight">{showtime.movie?.title || 'Movie'}</p><p className="text-label-sm text-on-surface-variant">{showtime.movie?.runtime || '—'} min</p></div></div> },
    { key: 'h', header: 'Hall & Format', render: (showtime) => <><p className="text-white">{showtime.auditorium?.name || 'Hall'} <span className="text-on-surface-variant">• {showtime.cinema?.short || showtime.cinema?.name || 'Cinema'}</span></p><p className="text-label-sm text-on-surface-variant font-semibold">{showtime.format}</p></> },
    { key: 'w', header: 'Screening window', render: (showtime) => <><p className="text-white font-semibold whitespace-nowrap">{time12(showtime.start)} – {time12(showtime.end)}</p><p className="text-label-sm text-on-surface-variant flex items-center gap-1"><CalendarDays className="w-3 h-3" aria-hidden />{formatDate(showtime.date)}</p></> },
    { key: 'p', header: 'Ticket prices', render: (showtime) => <><p className="text-label-sm text-on-surface-variant">Standard {money(showtime.standardPrice)}</p><p className="text-white"><b>Prime {money(showtime.primePrice)}</b></p></> },
    { key: 'c', header: 'Capacity', render: (showtime) => <span className="text-white tabular-nums">{capacityByAuditorium.get(Number(showtime.auditoriumId)) ?? '—'} seats</span> },
    { key: 'a', header: 'Actions', headerClass: 'text-right', render: (showtime) => <div className="flex justify-end gap-0.5"><IconButton icon={Pencil} label={`Edit showtime ${showtime.movie?.title || ''} ${time12(showtime.start)}`} onClick={() => open({ ...showtime })} /><IconButton icon={Trash2} tone="danger" label={`Delete showtime ${showtime.movie?.title || ''} ${time12(showtime.start)}`} onClick={() => setDel(showtime)} /></div> },
  ];

  return (
    <div>
      <AdminPageHeader eyebrow="Showtime scheduling" title="Showtimes Management" description="Schedule screenings using the cinemas, halls, movies and prices saved in CineBook.">
        <Button icon={Plus} onClick={() => open({})} disabled={!canSchedule}>Add Showtime</Button>
      </AdminPageHeader>
      <section aria-label="Showtime metrics" className="grid sm:grid-cols-2 gap-gutter-mobile md:gap-gutter mb-gutter">
        <StatCard label="Scheduled today" value={`${today.length} slots`} icon={Clock} sub="From saved showtimes" />
        <StatCard label="Existing schedule conflicts" value={`${conflicts}`} icon={AlertTriangle} sub="Recheck legacy entries before publishing changes" />
      </section>

      <div ref={formRef}>
        {form && movies.data && resources.data && <ShowtimeForm key={form.id || 'new'} initial={form} movies={movies.data.filter((movie) => movie.status !== 'archived')} resources={resources.data} showtimes={all.data || []} onClose={() => setForm(null)} onSaved={() => { setForm(null); all.reload(true); }} />}
        {resources.error && <div className="mb-4"><ErrorState title="Scheduling data unavailable" message={resources.error.message} onRetry={resources.reload} /></div>}
      </div>

      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput className="flex-1 min-w-[220px]" value={text} onChange={setText} placeholder="Search by movie, hall or cinema…" label="Search showtimes" />
          <div role="group" aria-label="Cinema" className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps text-on-surface-variant mr-1">Location:</span>
            {[{ id: '', short: 'All cinemas' }, ...cinemaList].map((cinema) => <button key={cinema.id} aria-pressed={f.cinema === String(cinema.id)} onClick={() => set({ cinema: String(cinema.id), page: '1' })} className={`rounded-lg px-3 py-1.5 text-label-sm font-semibold ${f.cinema === String(cinema.id) ? 'bg-white/15 text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}>{cinema.short || cinema.name}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Date" className="flex flex-wrap items-center gap-1.5">
            {dates.map((date, index) => <button key={date} role="tab" aria-selected={f.date === date} onClick={() => set({ date, page: '1' })} className={`rounded-lg px-3 py-1.5 text-center ${f.date === date ? 'bg-primary-container text-white shadow-glow' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}><span className="block text-label-sm font-bold">{index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : formatDate(date)}</span><span className="block text-[10px] opacity-80">{formatDate(date)}</span></button>)}
            <input type="date" aria-label="Pick a date" value={f.date === 'all' ? '' : f.date} onChange={(event) => event.target.value && set({ date: event.target.value, page: '1' })} className="field !w-auto !py-2" />
            <button onClick={() => set({ date: 'all', page: '1' })} aria-pressed={f.date === 'all'} className={`rounded-lg px-3 py-2 text-label-sm font-semibold ${f.date === 'all' ? 'bg-white/15 text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}>All dates</button>
          </div>
          <div role="group" aria-label="Format" className="flex flex-wrap gap-1.5 ml-auto">
            {['', ...formats].map((format) => <button key={format || 'all'} aria-pressed={f.fmt === format} onClick={() => set({ fmt: format, page: '1' })} className={`rounded-full px-3.5 py-1.5 text-label-sm font-semibold ${f.fmt === format ? 'bg-white/15 text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}>{format || 'All formats'}</button>)}
          </div>
        </div>
        <p className="text-label-sm text-on-surface-variant" aria-live="polite">Showing <b className="text-white">{list.length}</b> of {(all.data || []).length} showtimes</p>
      </div>

      <div className="mt-4 panel overflow-hidden">
        <DataTable caption="Showtimes" columns={cols} rows={rows} loading={all.loading && !all.data} minWidth={1000} empty={<EmptyState icon={Clock} title="No showtimes match" message="Try another date, cinema or format — or schedule a new showtime." action={<div className="flex gap-2"><Button variant="secondary" onClick={clear}>Clear filters</Button><Button icon={Plus} onClick={() => open({})} disabled={!canSchedule}>Add showtime</Button></div>} />} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4 text-body-sm text-on-surface-variant"><div className="flex items-center gap-3"><label htmlFor="rpp">Rows per page:</label><select id="rpp" value={f.rows} onChange={(event) => set({ rows: event.target.value, page: '1' })} className="field !w-auto !py-1.5">{['5', '10', '25'].map((number) => <option key={number}>{number}</option>)}</select><span>{list.length ? `${(page - 1) * rowsPer + 1}–${Math.min(page * rowsPer, list.length)} of ${list.length}` : '0 showtimes'}</span></div><Pagination page={page} pages={pages} onChange={(nextPage) => set({ page: String(nextPage) })} edges /></div>
      </div>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={delBusy} danger title="Delete this showtime?" confirmText="Delete showtime" message={del && `${del.movie?.title || 'This showtime'} • ${del.auditorium?.name || 'Hall'} • ${formatDate(del.date)} ${time12(del.start)}. Showtimes with any booking history cannot be deleted; a cancellation/refund workflow is not available yet.`} />
    </div>
  );
}
