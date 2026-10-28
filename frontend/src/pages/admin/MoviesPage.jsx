import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Eye, LayoutGrid, List, Pencil, Plus, Search, Trash2, Film, X } from 'lucide-react';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import MovieFormModal from '../../components/admin/MovieFormModal.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import Pagination, { paginate } from '../../components/common/Pagination.jsx';
import Poster from '../../components/common/Poster.jsx';
import Badge, { STATUS_TONE } from '../../components/common/Badge.jsx';
import Progress from '../../components/common/Progress.jsx';
import Button from '../../components/common/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/common/Modal.jsx';
import IconButton from '../../components/common/IconButton.jsx';
import { SearchInput, Select } from '../../components/common/Field.jsx';
import { EmptyState, ErrorState } from '../../components/common/States.jsx';
import { movieService } from '../../services/movieService.js';
import { showtimeService } from '../../services/showtimeService.js';
import { logAudit } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useQueryState } from '../../hooks/useQueryState.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocTitle } from '../../hooks/useDocTitle.js';
import { GENRES, MOVIE_STATUS } from '../../data/movies.js';
import { duration, formatDate, todayKey } from '../../utils/format.js';

const PAGE = 6;

export default function AdminMoviesPage() {
  useDocTitle('Movies management');
  const { admin, can } = useAuth(); const toast = useToast();
  const [f, set, reset] = useQueryState({ q: '', genre: '', status: '', fmt: '', view: 'list', page: '1' });
  const [text, setText] = useState(f.q); const dq = useDebounce(text, 250);
  useEffect(() => { if (dq !== f.q) set({ q: dq, page: '1' }); }, [dq]); // eslint-disable-line
  useEffect(() => { setText(f.q); }, [f.q]);
  const movies = useAsync(() => movieService.list({ search: f.q, genre: f.genre, status: f.status, scope: 'admin', sort: 'newest' }), [f.q, f.genre, f.status]);
  const shows = useAsync(() => showtimeService.list({}), []);
  const [form, setForm] = useState({ open: false, movie: null }); const [del, setDel] = useState(null); const [delBusy, setDelBusy] = useState(false); const [view, setView] = useState(null); const [busyId, setBusyId] = useState(null);

  const stats = useMemo(() => {
    const by = {}; (shows.data || []).filter((s) => s.date >= todayKey()).forEach((s) => { (by[s.movieId] ||= []).push(s); });
    return Object.fromEntries(Object.entries(by).map(([id, l]) => [id, { count: l.length, occ: Math.round(l.reduce((a, s) => a + s.soldPct, 0) / l.length) }]));
  }, [shows.data]);
  const all = useMemo(() => (movies.data || []).filter((m) => !f.fmt || (f.fmt === 'ATMOS' ? m.sound === 'Atmos' : m.formats.some((x) => x.includes(f.fmt)))), [movies.data, f.fmt]);
  const page = Math.min(Number(f.page) || 1, Math.max(1, Math.ceil(all.length / PAGE)));
  const { rows, pages } = paginate(all, page, PAGE);
  const active = (movies.data || []).filter((m) => m.status !== 'archived').length;
  const todayShows = (shows.data || []).filter((s) => s.date === todayKey()); const screens = todayShows.length ? Math.round(todayShows.reduce((a, s) => a + s.soldPct, 0) / todayShows.length) : 0;

  const toggleArchive = async (m) => { setBusyId(m.id); try { const next = m.status === 'archived' ? 'now_showing' : 'archived'; await movieService.setStatus(m.id, next); logAudit(admin.name, `${next === 'archived' ? 'Archived' : 'Activated'} movie “${m.title}”`); toast.success(next === 'archived' ? `“${m.title}” archived` : `“${m.title}” is active again`); movies.reload(true); } catch { toast.error('Unable to complete this action'); } finally { setBusyId(null); } };
  const confirmDelete = async () => { setDelBusy(true); try { await movieService.remove(del.id); logAudit(admin.name, `Deleted movie “${del.title}”`); toast.success(`“${del.title}” deleted`); setDel(null); movies.reload(true); shows.reload(true); } catch (e) { toast.error(e.message || 'Unable to complete this action'); } finally { setDelBusy(false); } };
  const onSaved = (m, editing) => { logAudit(admin.name, `${editing ? 'Edited' : 'Added'} movie “${m.title}”`); setForm({ open: false, movie: null }); movies.reload(true); };
  const clear = () => { reset(); setText(''); };

  const actions = (m) => (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton icon={Eye} label={`View ${m.title}`} onClick={() => setView(m)} />
      <IconButton icon={Pencil} label={`Edit ${m.title}`} onClick={() => setForm({ open: true, movie: m })} />
      <IconButton icon={m.status === 'archived' ? ArchiveRestore : Archive} label={m.status === 'archived' ? `Activate ${m.title}` : `Archive ${m.title}`} disabled={busyId === m.id} onClick={() => toggleArchive(m)} />
      <IconButton icon={Trash2} tone="danger" label={can('movies:delete') ? `Delete ${m.title}` : 'Only System Admins can delete movies'} disabled={!can('movies:delete')} onClick={() => setDel(m)} />
    </div>);
  const cols = [
    { key: 'poster', header: 'Poster', render: (m) => <Poster src={m.poster} title={m.title} className="w-11" /> },
    { key: 'title', header: 'Title & Formats', render: (m) => <div><p className="font-headline text-title-md text-white">{m.title}</p><div className="mt-1 flex flex-wrap gap-1">{[...m.formats.slice(0, 2), m.rating].map((x) => <span key={x} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-secondary">{x}</span>)}</div></div> },
    { key: 'genre', header: 'Genre', render: (m) => <span className="text-on-surface">{m.genres.slice(0, 2).join(', ')}</span> },
    { key: 'dur', header: 'Duration', render: (m) => <span className="whitespace-nowrap">{duration(m.runtime)}</span> },
    { key: 'rel', header: 'Release date', render: (m) => <span className="whitespace-nowrap">{formatDate(m.releaseDate, { year: true })}</span> },
    { key: 'status', header: 'Status', render: (m) => <Badge tone={STATUS_TONE[m.status]} dot>{MOVIE_STATUS[m.status].label}</Badge> },
    { key: 'occ', header: 'Occupancy', className: 'min-w-[120px]', render: (m) => { const s = stats[m.id]; return s ? <div><div className="flex justify-between text-label-sm"><b className="text-white">{s.occ}%</b><span className="text-on-surface-variant">{s.count} shows</span></div><Progress value={s.occ} className="mt-1" label={`${m.title} occupancy`} /></div> : <span className="text-label-sm text-on-surface-variant">No upcoming shows</span>; } },
    { key: 'a', header: 'Actions', headerClass: 'text-right', render: actions },
  ];

  if (movies.error) return <ErrorState onRetry={movies.reload} />;
  return (
    <div>
      <AdminPageHeader eyebrow="Catalog operations" title="Movies Management" description="Catalog management, release scheduling, and format availability.">
        <div className="flex items-center gap-5 rounded-2xl bg-surface-container-low border border-white/5 px-5 py-3"><div><p className="text-label-sm text-on-surface-variant">Active Titles</p><p className="font-headline text-headline-sm font-bold text-white">{active}</p></div><span className="w-px h-8 bg-white/10" /><div><p className="text-label-sm text-on-surface-variant">Screens Occupied</p><p className="font-headline text-headline-sm font-bold text-secondary">{screens}%</p></div></div>
        <Button icon={Plus} onClick={() => setForm({ open: true, movie: null })}>Add Movie</Button>
      </AdminPageHeader>

      <div className="panel p-4"><div className="flex flex-wrap items-center gap-3">
        <SearchInput className="flex-1 min-w-[220px]" value={text} onChange={setText} placeholder="Search movies by title, director…" label="Search movies" />
        <Select aria-label="Filter by genre" value={f.genre} onChange={(e) => set({ genre: e.target.value, page: '1' })} className="w-44"><option value="">All Genres</option>{GENRES.map((g) => <option key={g}>{g}</option>)}</Select>
        <Select aria-label="Filter by status" value={f.status} onChange={(e) => set({ status: e.target.value, page: '1' })} className="w-44"><option value="">All Statuses</option>{Object.entries(MOVIE_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}</Select>
        <div role="group" aria-label="View mode" className="inline-flex rounded-xl bg-surface-container-lowest p-1">{[['list', List, 'List'], ['grid', LayoutGrid, 'Grid']].map(([v, I, l]) => <button key={v} aria-pressed={f.view === v} onClick={() => set({ view: v })} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-md ${f.view === v ? 'bg-surface-container-highest text-white' : 'text-on-surface-variant hover:text-white'}`}><I className="w-4 h-4" aria-hidden />{l}</button>)}</div>
        <div className="flex items-center gap-2 text-label-sm text-on-surface-variant"><span className="hidden xl:inline">Quick formats:</span>{['IMAX', 'ATMOS'].map((q) => <button key={q} aria-pressed={f.fmt === q} onClick={() => set({ fmt: f.fmt === q ? '' : q, page: '1' })} className={`rounded-lg px-3 py-1.5 font-bold border ${f.fmt === q ? 'bg-primary-container border-primary-container text-white' : 'border-white/10 text-on-surface hover:bg-white/5'}`}>{q}</button>)}</div>
        {(f.q || f.genre || f.status || f.fmt) && <button onClick={clear} className="flex items-center gap-1 text-label-md text-primary hover:underline"><X className="w-4 h-4" aria-hidden />Clear</button>}</div></div>

      <div className="mt-4 panel overflow-hidden">
        {f.view === 'list' ? (
          <DataTable caption="Movies" columns={cols} rows={rows} loading={movies.loading && !movies.data} minWidth={980} empty={<EmptyState icon={Film} title={movies.data?.length === 0 && !f.q && !f.genre && !f.status ? 'No movies yet' : 'No movies match your filters'} message="Add a movie or adjust your search and filters." action={<div className="flex gap-2"><Button variant="secondary" onClick={clear}>Clear filters</Button><Button icon={Plus} onClick={() => setForm({ open: true, movie: null })}>Add movie</Button></div>} />} />
        ) : rows.length === 0 ? <EmptyState icon={Film} title="No movies match your filters" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} /> : (
          <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4">{rows.map((m) => <li key={m.id} className="rounded-xl bg-surface-container border border-white/5 p-3 flex gap-3"><Poster src={m.poster} title={m.title} className="w-20 shrink-0" /><div className="min-w-0 flex-1 flex flex-col"><p className="font-headline text-title-md text-white truncate">{m.title}</p><p className="text-label-sm text-on-surface-variant">{m.genres.slice(0, 2).join(', ')} • {duration(m.runtime)}</p><div className="mt-1"><Badge tone={STATUS_TONE[m.status]} dot>{MOVIE_STATUS[m.status].label}</Badge></div><div className="mt-auto pt-2">{actions(m)}</div></div></li>)}</ul>)}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4 text-body-sm text-on-surface-variant"><span>{all.length === 0 ? 'No titles' : <>Showing <b className="text-white">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, all.length)}</b> of <b className="text-white">{all.length}</b> titles</>}</span><Pagination page={page} pages={pages} onChange={(p) => set({ page: String(p) })} /></div>
      </div>

      <MovieFormModal open={form.open} movie={form.movie} onClose={() => setForm({ open: false, movie: null })} onSaved={onSaved} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} loading={delBusy} danger title={`Delete “${del?.title}”?`} confirmText="Delete movie" message="This permanently removes the movie and all of its scheduled showtimes. Existing bookings are kept for the audit ledger. This can’t be undone." />
      <Modal open={!!view} onClose={() => setView(null)} variant="drawer" title={view?.title || ''} description="Title telemetry" footer={view && <><Button variant="secondary" onClick={() => setView(null)}>Close</Button><Button icon={Pencil} onClick={() => { const m = view; setView(null); setForm({ open: true, movie: m }); }}>Edit</Button></>}>
        {view && <div className="space-y-4"><Poster src={view.poster} title={view.title} className="w-40 mx-auto" /><Badge tone={STATUS_TONE[view.status]} dot>{MOVIE_STATUS[view.status].label}</Badge><p className="text-body-md text-on-surface-variant">{view.synopsis}</p>
          <dl className="grid grid-cols-2 gap-3 text-body-sm">{[['Director', view.director], ['Runtime', duration(view.runtime)], ['Rating', view.rating], ['Language', view.language], ['Released', formatDate(view.releaseDate, { year: true })], ['Upcoming shows', stats[view.id]?.count || 0], ['Avg occupancy', `${stats[view.id]?.occ || 0}%`], ['Formats', view.formats.join(', ')]].map(([k, v]) => <div key={k} className="rounded-lg bg-surface-container-lowest/70 p-3"><dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">{k}</dt><dd className="text-white">{v}</dd></div>)}</dl></div>}
      </Modal>
    </div>
  );
}
