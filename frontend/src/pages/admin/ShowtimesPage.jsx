import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Pencil, Plus, Save, Trash2, X, Banknote, Gauge, Armchair, ShieldCheck } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import Pagination, { paginate } from '../../components/common/Pagination.jsx';
import Poster from '../../components/common/Poster.jsx';
import Progress from '../../components/common/Progress.jsx';
import Button from '../../components/common/Button.jsx';
import IconButton from '../../components/common/IconButton.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { Field, Select, SearchInput } from '../../components/common/Field.jsx';
import { EmptyState, ErrorState } from '../../components/common/States.jsx';
import { showtimeService, findConflict, CONFLICT_MESSAGE } from '../../services/showtimeService.js';
import { movieService } from '../../services/movieService.js';
import { readSettings } from '../../services/settingsService.js';
import { logAudit } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocTitle } from '../../hooks/useDocTitle.js';
import { AUDITORIUMS, CINEMAS, FORMATS } from '../../data/cinemas.js';
import { profileCapacity } from '../../data/seats.js';
import { addDays, dayShort, dayNum, duration, formatDate, fromMinutes, money, time12, toMinutes, todayKey } from '../../utils/format.js';
import { tierPrices } from '../../data/seats.js';

const FMT_CHIPS = [['', 'All Formats'], ['IMAX 70MM', 'IMAX 70mm'], ['DOLBY CINEMA', 'Dolby Cinema'], ['VIP LOUNGE', 'VIP Lounge']];
const EMPTY = { movieId: '', cinemaId: 'c1', auditoriumId: 'a1', date: todayKey(), start: '18:00', end: '', price: '24.50', format: 'IMAX 70MM' };

function ShowtimeForm({ initial, movies, onClose, onSaved }) {
  const toast = useToast(); const editing = !!initial?.id; const turnaround = readSettings().system.turnaroundMinutes;
  const [f, setF] = useState(() => ({ ...EMPTY, movieId: movies[0]?.id || '', ...initial })); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const endTouched = useRef(!!initial?.id);
  const auds = AUDITORIUMS.filter((a) => a.cinemaId === f.cinemaId); const aud = AUDITORIUMS.find((a) => a.id === f.auditoriumId); const movie = movies.find((m) => m.id === f.movieId);
  // Auto-fill end = start + runtime until the user edits end manually
  useEffect(() => { if (!endTouched.current && movie && f.start) setF((x) => ({ ...x, end: fromMinutes(toMinutes(x.start) + movie.runtime) })); }, [f.start, f.movieId]); // eslint-disable-line
  const conflict = useMemo(() => (f.auditoriumId && f.date && f.start && f.end ? findConflict({ ...f, auditoriumId: f.auditoriumId }, initial?.id) : null), [f.auditoriumId, f.date, f.start, f.end, initial?.id]); // eslint-disable-line
  const set = (k) => (e) => { const v = e.target.value; if (k === 'end') endTouched.current = true; setF((x) => { const n = { ...x, [k]: v }; if (k === 'cinemaId') { const a = AUDITORIUMS.find((y) => y.cinemaId === v); n.auditoriumId = a.id; n.format = a.format; } if (k === 'auditoriumId') n.format = AUDITORIUMS.find((y) => y.id === v).format; return n; }); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault(); if (conflict) return toast.error(CONFLICT_MESSAGE);
    setBusy(true);
    try { const s = editing ? await showtimeService.update(initial.id, f) : await showtimeService.create(f); toast.success(editing ? 'Showtime updated successfully' : 'Showtime scheduled successfully'); onSaved(s, editing); }
    catch (err) { if (err.errors) setErrors(err.errors); toast.error(err.code === 'CONFLICT' ? CONFLICT_MESSAGE : err.message); } finally { setBusy(false); }
  };
  return (
    <section className="panel p-5 md:p-6 mb-gutter-mobile border-primary-container/30" aria-labelledby="sf-t">
      <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl bg-primary-container/15 grid place-items-center"><CalendarDays className="w-5 h-5 text-[#ff8a80]" aria-hidden /></span><div><h2 id="sf-t" className="font-headline text-headline-sm text-white">{editing ? 'Edit Showtime' : 'Schedule New Showtime'}</h2><p className="text-body-sm text-on-surface-variant">Configure screening slots, allocate auditoriums, and verify inter-feature turnaround windows.</p></div></div><IconButton icon={X} label="Close form" onClick={onClose} /></div>
      <form onSubmit={submit} noValidate className="mt-5 grid md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Select className="xl:col-span-3" label="Select movie & master format" value={f.movieId} onChange={set('movieId')} error={errors.movieId}>{movies.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.formats[0]} • {m.runtime} min • {m.rating})</option>)}</Select>
        <Select className="xl:col-span-3" label="Cinema complex" value={f.cinemaId} onChange={set('cinemaId')}>{CINEMAS.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.short}</option>)}</Select>
        <Select className="xl:col-span-3" label="Auditorium / hall spec" value={f.auditoriumId} onChange={set('auditoriumId')} error={errors.auditoriumId}>{auds.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.spec})</option>)}</Select>
        <Field className="xl:col-span-2" label="Screening date" type="date" value={f.date} onChange={set('date')} error={errors.date} />
        <div className="xl:col-span-1"><span className="field-label">Capacity</span><div className="field flex items-center gap-2 !bg-surface-container"><Armchair className="w-4 h-4 text-secondary" aria-hidden /><b className="text-secondary">{aud ? profileCapacity(aud.profile) : '—'} seats</b></div></div>
        <Field className="xl:col-span-2" label="Start time" type="time" value={f.start} onChange={set('start')} error={errors.start && errors.start !== CONFLICT_MESSAGE ? errors.start : ''} />
        <Field className="xl:col-span-2" label={`End time (+${turnaround}m turnaround)`} type="time" value={f.end} onChange={set('end')} error={errors.end} hint={movie ? `Runtime ${duration(movie.runtime)}` : undefined} />
        <Field className="xl:col-span-1" label="Base prime price ($)" type="number" step="0.5" min="1" value={f.price} onChange={set('price')} error={errors.price} />
        <Select className="xl:col-span-1" label="Format" value={f.format} onChange={set('format')}>{FORMATS.map((x) => <option key={x}>{x}</option>)}</Select>
        <div className="md:col-span-2 xl:col-span-6">
          {conflict ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/40 bg-error-container/25 px-4 py-3 text-body-sm text-on-error-container"><AlertTriangle className="w-5 h-5 shrink-0" aria-hidden /><div><b>{CONFLICT_MESSAGE}</b><p className="opacity-80">Clashes with {time12(conflict.start)}–{time12(conflict.end)} on {formatDate(conflict.date)} (incl. {turnaround}-minute cleaning buffer). Pick another time or hall.</p></div></div>
            : <p className="flex items-center gap-2 text-body-sm text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden />No conflicts. Prices: Standard {money(tierPrices(Number(f.price) || 0).standard)} • Prime {money(Number(f.price) || 0)} • VIP {money(tierPrices(Number(f.price) || 0).vip)}</p>}</div>
        <div className="md:col-span-2 xl:col-span-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" icon={Save} loading={busy} loadingText="Saving…" disabled={!!conflict}>{editing ? 'Save showtime' : 'Confirm showtime'}</Button></div>
      </form>
    </section>
  );
}

export default function AdminShowtimesPage() {
  useDocTitle('Showtimes management');
  const { admin } = useAuth(); const toast = useToast();
  const [f, set, reset] = useQueryState({ q: '', cinema: '', date: todayKey(), fmt: '', rows: '5', page: '1' });
  const [text, setText] = useState(f.q); const dq = useDebounce(text, 250);
  useEffect(() => { if (dq !== f.q) set({ q: dq, page: '1' }); }, [dq]); // eslint-disable-line
  useEffect(() => { setText(f.q); }, [f.q]);
  const [form, setForm] = useState(null); const [del, setDel] = useState(null); const [delBusy, setDelBusy] = useState(false);
  const all = useAsync(() => showtimeService.list({}), []);
  const movies = useAsync(() => movieService.list({ scope: 'admin' }), []);
  const rowsPer = Number(f.rows) || 5;
  const list = useMemo(() => (all.data || []).filter((s) => (!f.cinema || s.cinemaId === f.cinema) && (!f.date || f.date === 'all' || s.date === f.date) && (!f.fmt || s.format === f.fmt) && (!f.q || `${s.movie.title} ${s.auditorium.name} ${s.cinema.short}`.toLowerCase().includes(f.q.toLowerCase()))), [all.data, f]);
  const page = Math.min(Number(f.page) || 1, Math.max(1, Math.ceil(list.length / rowsPer))); const { rows, pages } = paginate(list, page, rowsPer);
  const today = (all.data || []).filter((s) => s.date === todayKey());
  const avg = today.length ? Math.round(today.reduce((a, s) => a + s.soldPct, 0) / today.length) : 0;
  const pace = today.reduce((a, s) => a + s.price * (s.capacity - s.seatsLeft), 0);
  const conflicts = (all.data || []).filter((s) => findConflict(s, s.id)).length;
  const dates = Array.from({ length: 4 }, (_, i) => addDays(todayKey(), i));
  const formRef = useRef(null);
  const open = (v) => { setForm(v); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
  const remove = async () => { setDelBusy(true); try { const r = await showtimeService.remove(del.id); logAudit(admin.name, `Deleted showtime ${del.movie.title} ${del.date} ${del.start}`); toast.success(r.refunded ? `Showtime deleted. ${r.refunded} booking(s) were refunded (demo).` : 'Showtime deleted successfully'); setDel(null); all.reload(true); } catch (e) { toast.error(e.message); } finally { setDelBusy(false); } };
  const clear = () => { reset(); setText(''); };
  if (all.error) return <ErrorState onRetry={all.reload} />;

  const cols = [
    { key: 'm', header: 'Movie & Rating', render: (s) => <div className="flex items-center gap-3"><Poster src={s.movie.poster} title={s.movie.title} className="w-10 shrink-0" /><div><p className="font-headline text-title-md text-white leading-tight">{s.movie.title} <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] align-middle">{s.movie.rating}</span></p><p className="text-label-sm text-on-surface-variant">{s.movie.director} • {s.movie.runtime} min</p></div></div> },
    { key: 'h', header: 'Hall & Format', render: (s) => <><p className="text-white">{s.auditorium.name} <span className="text-on-surface-variant">• {s.cinema.short}</span></p><p className="text-label-sm text-[#ff8a80] font-semibold">{s.format} — {s.auditorium.spec}</p></> },
    { key: 'w', header: 'Screening window', render: (s) => <><p className="text-white font-semibold whitespace-nowrap">{time12(s.start)} – {time12(s.end)}</p><p className="text-label-sm text-on-surface-variant flex items-center gap-1"><CalendarDays className="w-3 h-3" aria-hidden />{formatDate(s.date)}</p></> },
    { key: 'p', header: 'Dynamic pricing', render: (s) => <><p className="text-white"><b>{money(s.price)}</b> <span className="text-secondary text-label-sm">Prime</span></p><p className="text-label-sm text-on-surface-variant">{money(tierPrices(s.price).standard)} Standard</p></> },
    { key: 'o', header: 'Occupancy / capacity', className: 'min-w-[170px]', render: (s) => <div><div className="flex justify-between text-label-sm"><b className="text-white">{s.seatsLeft} / {s.capacity} left</b><span className={s.soldPct > 85 ? 'text-[#ff8a80]' : 'text-on-surface-variant'}>{s.soldPct}% full</span></div><Progress value={s.soldPct} className="mt-1.5" label={`${s.movie.title} occupancy`} /></div> },
    { key: 'a', header: 'Actions', headerClass: 'text-right', render: (s) => <div className="flex justify-end gap-0.5"><IconButton icon={Pencil} label={`Edit showtime ${s.movie.title} ${time12(s.start)}`} onClick={() => open({ ...s })} /><IconButton icon={Trash2} tone="danger" label={`Delete showtime ${s.movie.title} ${time12(s.start)}`} onClick={() => setDel(s)} /></div> },
  ];
  return (
    <div>
      <AdminPageHeader eyebrow="Auditorium dispatch • Live scheduling" title="Showtimes Management" description="Schedule auditoriums, configure screen slots, coordinate laser projector turnarounds, and adjust ticket pricing.">
        <Button icon={Plus} onClick={() => open({})}>Add Showtime</Button></AdminPageHeader>
      <section aria-label="Showtime metrics" className="grid sm:grid-cols-2 xl:grid-cols-4 gap-gutter-mobile md:gap-gutter mb-gutter">
        <StatCard label="Scheduled today" value={`${today.length} Slots`} icon={Clock} sub="Across all complexes" /><StatCard label="Avg circuit occupancy" value={`${avg}%`} icon={Gauge} sub="Today’s screenings" />
        <StatCard label="Prime box office pace" value={money(pace)} icon={Banknote} tone="gold" sub="Today’s projected gate" /><StatCard label="Screen conflicts" value={`${conflicts} Flagged`} icon={ShieldCheck} sub={conflicts ? 'Review overlapping halls' : 'Turnarounds synchronized'} /></section>
      <div ref={formRef}>{form && movies.data && <ShowtimeForm key={form.id || 'new'} initial={form} movies={(movies.data || []).filter((m) => m.status !== 'archived')} onClose={() => setForm(null)} onSaved={() => { setForm(null); all.reload(true); }} />}</div>

      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3"><SearchInput className="flex-1 min-w-[220px]" value={text} onChange={setText} placeholder="Search by movie, hall or cinema…" label="Search showtimes" />
          <div role="group" aria-label="Cinema" className="flex flex-wrap items-center gap-1.5"><span className="label-caps text-on-surface-variant mr-1">Location:</span>{[{ id: '', short: 'All Cinemas' }, ...CINEMAS].map((c) => <button key={c.id} aria-pressed={f.cinema === c.id} onClick={() => set({ cinema: c.id, page: '1' })} className={`rounded-lg px-3 py-1.5 text-label-sm font-semibold ${f.cinema === c.id ? 'bg-white/15 text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}>{c.short}</button>)}</div></div>
        <div className="flex flex-wrap items-center gap-3"><div role="tablist" aria-label="Date" className="flex flex-wrap items-center gap-1.5">{dates.map((d, i) => <button key={d} role="tab" aria-selected={f.date === d} onClick={() => set({ date: d, page: '1' })} className={`rounded-lg px-3 py-1.5 text-center ${f.date === d ? 'bg-primary-container text-white shadow-glow' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}><span className="block text-label-sm font-bold">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayShort(d)}</span><span className="block text-[10px] opacity-80">{formatDate(d)}</span></button>)}
          <input type="date" aria-label="Pick a date" value={f.date === 'all' ? '' : f.date} onChange={(e) => e.target.value && set({ date: e.target.value, page: '1' })} className="field !w-auto !py-2" /><button onClick={() => set({ date: 'all', page: '1' })} aria-pressed={f.date === 'all'} className={`rounded-lg px-3 py-2 text-label-sm font-semibold ${f.date === 'all' ? 'bg-white/15 text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}>All dates</button></div>
          <div role="group" aria-label="Format" className="flex flex-wrap gap-1.5 ml-auto">{FMT_CHIPS.map(([v, l]) => <button key={l} aria-pressed={f.fmt === v} onClick={() => set({ fmt: v, page: '1' })} className={`rounded-full px-3.5 py-1.5 text-label-sm font-semibold ${f.fmt === v ? 'bg-white/15 text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:text-white'}`}>{l}</button>)}</div></div>
        <p className="text-label-sm text-on-surface-variant" aria-live="polite">Showing <b className="text-white">{list.length}</b> of {(all.data || []).length} screen runs</p>
      </div>

      <div className="mt-4 panel overflow-hidden">
        <DataTable caption="Showtimes" columns={cols} rows={rows} loading={all.loading && !all.data} minWidth={1000} empty={<EmptyState icon={Clock} title="No showtimes match" message="Try another date, cinema or format — or schedule a new showtime." action={<div className="flex gap-2"><Button variant="secondary" onClick={clear}>Clear filters</Button><Button icon={Plus} onClick={() => open({})}>Add showtime</Button></div>} />} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4 text-body-sm text-on-surface-variant"><div className="flex items-center gap-3"><label htmlFor="rpp">Rows per page:</label><select id="rpp" value={f.rows} onChange={(e) => set({ rows: e.target.value, page: '1' })} className="field !w-auto !py-1.5">{['5', '10', '25'].map((n) => <option key={n}>{n}</option>)}</select><span>{list.length ? `${(page - 1) * rowsPer + 1}–${Math.min(page * rowsPer, list.length)} of ${list.length}` : '0 showtimes'}</span></div><Pagination page={page} pages={pages} onChange={(p) => set({ page: String(p) })} edges /></div>
      </div>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} loading={delBusy} danger title="Delete this showtime?" confirmText="Delete showtime" message={del && `${del.movie.title} • ${del.auditorium.name} • ${formatDate(del.date)} ${time12(del.start)}. Any active bookings for this show will be refunded automatically (demo). This can’t be undone.`} />
    </div>
  );
}
