import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Film, Navigation, PlayCircle, Share2, Star, Volume2, Ticket, MapPin } from 'lucide-react';
import Poster from '../../components/common/Poster.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Button from '../../components/common/Button.jsx';
import TrailerModal from '../../components/movies/TrailerModal.jsx';
import Modal from '../../components/common/Modal.jsx';
import { Field } from '../../components/common/Field.jsx';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '../../components/common/States.jsx';
import { movieService } from '../../services/movieService.js';
import { showtimeService } from '../../services/showtimeService.js';
import { tierPrices } from '../../data/seats.js';
import { CAST_PHOTOS } from '../../data/images.js';
import { CINEMAS } from '../../data/cinemas.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePrefs } from '../../context/PrefsContext.jsx';
import { useDocTitle } from '../../hooks/useDocTitle.js';
import { store } from '../../utils/storage.js';
import { addDays, dayNum, dayShort, duration, formatDate, monthShort, money, showDateTime, time12, todayKey } from '../../utils/format.js';

const FORMAT_FILTERS = ['All Formats', 'IMAX', 'Dolby', 'Standard Digital'];
const matchFormat = (f, label) => label === 'All Formats' || (label === 'IMAX' && f.includes('IMAX')) || (label === 'Dolby' && f.includes('DOLBY')) || (label === 'Standard Digital' && !f.includes('IMAX') && !f.includes('DOLBY'));

function ShowtimePill({ st, onPick }) {
  const started = showDateTime(st.date, st.start).getTime() < Date.now();
  const disabled = st.soldOut || started;
  const low = !disabled && st.seatsLeft <= 14;
  return (
    <button disabled={disabled} onClick={() => onPick(st)} aria-label={`${time12(st.start)}, ${st.format}, ${disabled ? (st.soldOut ? 'sold out' : 'already started') : `${st.seatsLeft} seats left`}, ${money(st.price)}`}
      className={`group text-left rounded-xl border p-3 transition-all ${disabled ? 'border-white/5 bg-surface-container-lowest/60 cursor-not-allowed' : 'border-white/10 bg-surface-container hover:border-primary-container hover:bg-primary-container/10 hover:-translate-y-0.5'}`}>
      <div className="flex items-center justify-between gap-2"><span className={`font-headline text-title-md font-bold tabular-nums ${disabled ? 'text-on-surface-variant/50 line-through' : 'text-white'}`}>{time12(st.start)}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${disabled ? 'bg-error-container/40 text-error' : 'bg-white/10 text-on-surface-variant'}`}>{st.soldOut ? 'SOLD OUT' : started ? 'STARTED' : st.format.split(' ')[0]}</span></div>
      <div className="mt-1 flex items-center justify-between text-label-sm"><span className={disabled ? 'text-on-surface-variant/50' : low ? 'text-secondary' : 'text-on-surface-variant'}>{st.soldOut ? 'No seats remaining' : started ? 'Not bookable' : low ? `${st.seatsLeft} seats left` : st.tag === 'Standard' ? 'Available' : st.tag}</span><span className={disabled ? 'text-on-surface-variant/40' : 'text-white font-semibold'}>{money(st.price)}</span></div>
    </button>
  );
}

export default function MovieDetailsPage() {
  const { slug } = useParams(); const nav = useNavigate(); const toast = useToast(); const { hash } = useLocation(); const { cinemaId } = usePrefs();
  const [params, setParams] = useSearchParams();
  const movie = useAsync(() => movieService.getBySlug(slug), [slug]);
  useDocTitle(movie.data?.title);
  const m = movie.data;
  const [date, setDate] = useState(params.get('date') || todayKey());
  const [fmt, setFmt] = useState('All Formats'); const [trailer, setTrailer] = useState(false); const [more, setMore] = useState(false);
  const [dateModal, setDateModal] = useState(false); const [saved, setSaved] = useState(() => store.get('saved', []).includes(slug));
  const shows = useAsync(() => (m ? showtimeService.list({ movieId: m.id, date }) : []), [m?.id, date]);
  const dates = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(todayKey(), i)), []);
  const preferred = params.get('cinema') || cinemaId;
  // If nothing is bookable today (all shows started / sold out), jump to the next day once.
  const advanced = useRef(false);
  useEffect(() => {
    if (advanced.current || params.get('date') || !shows.data || date !== todayKey()) return;
    advanced.current = true;
    if (!shows.data.some((s) => !s.soldOut && showDateTime(s.date, s.start) > new Date())) { setDate(addDays(todayKey(), 1)); toast.info('No more bookable shows today — showing tomorrow.'); }
  }, [shows.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (hash === '#showtimes' && m) setTimeout(() => document.getElementById('showtimes')?.scrollIntoView({ behavior: 'smooth' }), 200); }, [hash, m]);

  const groups = useMemo(() => {
    const list = (shows.data || []).filter((s) => matchFormat(s.format, fmt));
    return CINEMAS.map((c) => ({ cinema: c, auds: Object.values(list.filter((s) => s.cinemaId === c.id).reduce((a, s) => { (a[s.auditoriumId] ||= { aud: s.auditorium, items: [] }).items.push(s); return a; }, {})) }))
      .filter((g) => g.auds.length).sort((a, b) => (b.cinema.id === preferred) - (a.cinema.id === preferred));
  }, [shows.data, fmt, preferred]);
  const nextShow = useMemo(() => (shows.data || []).find((s) => !s.soldOut && showDateTime(s.date, s.start) > new Date()), [shows.data]);

  const pick = (st) => nav(`/booking/${st.id}/seats`);
  const share = async () => { const url = window.location.href; try { await navigator.clipboard.writeText(url); toast.success('Link copied to clipboard.'); } catch { toast.info(`Copy this link: ${url}`); } };
  const toggleSave = () => { const list = store.get('saved', []); const next = saved ? list.filter((x) => x !== slug) : [...list, slug]; store.set('saved', next); setSaved(!saved); toast.success(saved ? 'Removed from your watchlist.' : 'Saved to your watchlist.'); };

  if (movie.loading) return <PageLoader label="Loading movie…" />;
  if (movie.error) return <ErrorState title="Movie not found" message={movie.error.message} onRetry={() => nav('/movies')} />;
  const long = m.synopsis.length > 230;
  const soon = m.status === 'coming_soon';

  return (
    <div className="pb-28">
      <section className="relative overflow-hidden border-b border-white/5">
        {m.backdrop && <div className="absolute inset-0 bg-cover bg-center opacity-25 blur-sm scale-110" style={{ backgroundImage: `url(${m.backdrop})` }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/50" />
        <div className="relative px-margin-mobile md:px-margin py-6 max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between gap-3 text-body-sm">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-on-surface-variant"><Link to="/movies" className="flex items-center gap-1 hover:text-white"><ArrowLeft className="w-4 h-4" aria-hidden />Explore Movies</Link><span aria-hidden>/</span><span className="text-white">{m.title}</span></nav>
            <div className="flex gap-2"><Button variant="secondary" size="sm" icon={Share2} onClick={share}>Share</Button><button onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'} className="btn-secondary btn-sm !px-2.5">{saved ? <BookmarkCheck className="w-4 h-4 text-secondary" /> : <Bookmark className="w-4 h-4" />}</button></div>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr]">
            <div className="relative mx-auto md:mx-0 w-52 md:w-full"><span className="absolute -left-2 top-3 z-10 rounded bg-primary-container px-2.5 py-1 text-label-sm font-bold text-white shadow-glow">{m.badge}</span><Poster src={m.poster} title={m.title} eager rounded="rounded-xl" className="shadow-card border border-white/10" />
              <div className="mt-3 flex items-center justify-between text-label-md text-white"><span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-secondary" aria-hidden />{duration(m.runtime)}</span><span className="rounded bg-white/10 px-2 py-0.5">{m.rating}</span><span className="flex items-center gap-1.5 text-secondary"><Volume2 className="w-4 h-4" aria-hidden />{m.sound}</span></div></div>
            <div>
              <div className="flex flex-wrap gap-2"><span className="chip bg-secondary-container/15 text-secondary"><Film className="w-3.5 h-3.5" aria-hidden />{soon ? 'Coming soon' : 'Now showing in ' + m.formats.slice(0, 2).join(' & ')}</span><span className="text-label-sm text-on-surface-variant self-center">{soon ? 'Releases' : 'Released'} {formatDate(m.releaseDate, { year: true })}</span></div>
              <h1 className="mt-3 font-headline text-display-hero-mobile md:text-display-hero font-extrabold text-white">{m.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {m.score > 0 && <div className="flex items-center gap-3 rounded-xl bg-surface-container-low border border-white/5 px-4 py-2"><Star className="w-6 h-6 fill-secondary text-secondary" aria-hidden /><div><p className="font-headline text-headline-sm font-bold text-white leading-none">{m.score}<span className="text-body-sm text-on-surface-variant font-normal"> / 10</span></p><p className="text-label-sm text-on-surface-variant">{m.votes} cinephile votes</p></div></div>}
                {m.rt > 0 && <div className="flex items-center gap-3 rounded-xl bg-surface-container-low border border-white/5 px-4 py-2"><span className="text-primary-container font-bold">{m.rt}%</span><div><p className="text-label-md text-white">Verified Audience</p><p className="text-label-sm text-on-surface-variant">Rotten Tomatoes Certified</p></div></div>}
                {m.genres.map((g) => <Link key={g} to={`/movies?genre=${encodeURIComponent(g)}`} className="rounded-xl bg-surface-container-low border border-white/5 px-4 py-2 text-label-md text-on-surface hover:bg-surface-container-high">{g}</Link>)}
              </div>
              <h2 className="mt-6 label-caps text-secondary">Synopsis</h2>
              <p className={`mt-2 text-body-lg text-on-surface max-w-3xl ${!more && long ? 'line-clamp-3' : ''}`}>{m.synopsis}</p>
              {long && <button onClick={() => setMore(!more)} className="mt-1 flex items-center gap-1 text-label-md text-secondary hover:underline" aria-expanded={more}>{more ? 'Show less' : 'Read more'}{more ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>}
              <h2 className="mt-6 label-caps text-secondary">Director &amp; Cast</h2>
              <ul className="mt-2 flex flex-wrap gap-2">{m.cast.map((c, i) => <li key={c.name} className="flex items-center gap-2.5 rounded-xl bg-surface-container-low border border-white/5 pr-4 p-1.5"><Avatar name={c.name} src={CAST_PHOTOS[c.name]} size="sm" /><div className="leading-tight"><p className="text-label-md text-white">{c.name}</p><p className={`text-label-sm ${i === 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>{c.role}</p></div></li>)}</ul>
              <div className="mt-6 flex flex-wrap items-center gap-4"><Button variant="secondary" className="!rounded-full !px-6" icon={PlayCircle} onClick={() => setTrailer(true)}>Watch Official Trailer ({m.trailer})</Button>{m.filmedFor && <span className="flex items-center gap-1.5 text-label-sm text-secondary"><CheckCircle2 className="w-4 h-4" aria-hidden />{m.filmedFor}</span>}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="showtimes" className="px-margin-mobile md:px-margin py-10 max-w-[1600px] mx-auto scroll-mt-24" aria-labelledby="st-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="flex items-center gap-2 label-caps text-primary-container"><span className="w-1.5 h-1.5 rounded-full bg-primary-container" />Live box office &amp; seating</p><h2 id="st-title" className="mt-1 font-headline text-headline-lg-mobile md:text-headline-lg font-bold text-white">Select Date &amp; Showtime</h2></div>
          <p className="flex items-center gap-2 text-body-sm text-on-surface-variant"><MapPin className="w-4 h-4 text-secondary" aria-hidden />Showing near <b className="text-white">Manhattan, NY</b></p></div>
        {soon ? <EmptyState icon={Calendar} title="Tickets aren’t on sale yet" message={`${m.title} opens ${formatDate(m.releaseDate, { long: true })}. Check back for showtimes and pre-booking.`} action={<Button onClick={() => toast.success(`Reminder set for ${m.title}.`)}>Remind me</Button>} /> : (<>
          <div className="mt-6 flex gap-3 overflow-x-auto no-scrollbar pb-2" role="tablist" aria-label="Choose date">
            {dates.map((d, i) => <button key={d} role="tab" aria-selected={date === d} onClick={() => { setDate(d); setParams((p) => { p.set('date', d); return p; }, { replace: true }); }} className={`shrink-0 w-20 rounded-2xl py-3 text-center transition-all ${date === d ? 'bg-primary-container text-white shadow-glow' : 'bg-surface-container-low border border-white/5 hover:bg-surface-container-high'}`}><span className="block text-[10px] font-bold uppercase tracking-wider">{i === 0 ? 'Today' : dayShort(d)}</span><span className="block font-headline text-headline-md font-bold leading-none my-1">{dayNum(d)}</span><span className="block text-[11px] opacity-80">{monthShort(d)}, {dayShort(d)}</span></button>)}
            <button onClick={() => setDateModal(true)} className="shrink-0 w-20 rounded-2xl bg-surface-container-low border border-white/5 hover:bg-surface-container-high grid place-items-center text-on-surface-variant"><span><Calendar className="w-5 h-5 mx-auto" aria-hidden /><span className="text-label-sm">More</span></span></button></div>
          <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by format"><span className="text-label-sm text-on-surface-variant mr-1">Filter experience:</span>{FORMAT_FILTERS.map((f) => <button key={f} onClick={() => setFmt(f)} aria-pressed={fmt === f} className={`rounded-full px-4 py-1.5 text-label-sm font-semibold transition-colors ${fmt === f ? 'bg-white/15 text-white' : 'bg-surface-container-low text-on-surface-variant hover:text-white'}`}>{f}</button>)}</div>
          <div className="mt-6 space-y-5">
            {shows.loading && !shows.data ? [0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />) : shows.error ? <ErrorState onRetry={shows.reload} /> : groups.length === 0 ? <EmptyState icon={Ticket} title="No showtimes for this selection" message={`There are no ${fmt === 'All Formats' ? '' : fmt + ' '}screenings on ${formatDate(date, { weekday: true })}. Try another date or format.`} action={<Button variant="secondary" onClick={() => { setFmt('All Formats'); setDate(addDays(date, 1)); }}>Check next day</Button>} /> :
              groups.map(({ cinema, auds }) => (
                <article key={cinema.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${cinema.tag.includes('FLAGSHIP') ? 'bg-primary-container text-white' : 'bg-white/10 text-on-surface-variant'}`}>{cinema.tag}</span>{cinema.id === preferred && <span className="text-label-sm text-secondary">Your cinema</span>}</div>
                    <h3 className="mt-2 font-headline text-headline-sm text-white">{cinema.name} – {cinema.short}</h3><p className="mt-1 flex items-center gap-1.5 text-body-sm text-on-surface-variant"><Navigation className="w-3.5 h-3.5 text-secondary" aria-hidden />{cinema.distance} • {cinema.area}</p></div>
                    <div className="flex flex-wrap gap-2">{cinema.amenities.map((a) => <span key={a} className="chip bg-white/5 text-on-surface-variant">{a}</span>)}</div></div>
                  {auds.map(({ aud, items }) => { const p = items.map((s) => s.price); return (
                    <div key={aud.id} className="mt-5"><div className="flex flex-wrap justify-between gap-2 text-label-sm"><span className="font-bold uppercase tracking-wider text-on-surface-variant">{aud.name} • {aud.spec}</span><span className="text-secondary">Pricing: {money(Math.min(...p.map((x) => tierPrices(x).standard)))} – {money(Math.max(...p.map((x) => tierPrices(x).vip)))}</span></div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{items.map((s) => <ShowtimePill key={s.id} st={s} onPick={pick} />)}</div></div>); })}
                </article>))}
          </div></>)}
      </section>

      {!soon && nextShow && (
        <div className="fixed bottom-0 inset-x-0 z-30 glass border-t border-white/10 pb-[env(safe-area-inset-bottom)] md:pb-0 md:bottom-0">
          <div className="max-w-[1600px] mx-auto px-margin-mobile md:px-margin py-3 flex items-center gap-4 justify-between">
            <div className="hidden sm:flex items-center gap-3 min-w-0"><span className="w-11 h-11 rounded-xl bg-surface-container-high grid place-items-center"><Film className="w-5 h-5 text-primary-container" aria-hidden /></span><div className="min-w-0"><p className="text-label-md text-white truncate">{m.title} <span className="ml-1 rounded bg-primary-container/20 px-1.5 py-0.5 text-[10px] text-[#ff8a80]">{nextShow.format}</span></p><p className="text-body-sm text-on-surface-variant truncate">{nextShow.cinema.short} • <span className="text-secondary">{formatDate(nextShow.date, { weekday: true })}, {time12(nextShow.start)}</span></p></div></div>
            <div className="flex items-center gap-4 ml-auto"><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Starting from</p><p className="font-headline text-headline-sm font-bold text-white">{money(tierPrices(nextShow.price).standard)}</p></div>
              <Button className="!px-5 sm:!px-8 !py-3" onClick={() => pick(nextShow)} icon={Ticket}>Select seats for {time12(nextShow.start)}</Button></div></div></div>)}
      <TrailerModal movie={m} open={trailer} onClose={() => setTrailer(false)} />
      <Modal open={dateModal} onClose={() => setDateModal(false)} size="sm" title="Pick another date" footer={<Button variant="secondary" onClick={() => setDateModal(false)}>Done</Button>}>
        <Field type="date" label="Showtime date" min={todayKey()} max={addDays(todayKey(), 30)} value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); } }} data-autofocus hint="Schedules are published up to 7 days ahead." /></Modal>
    </div>
  );
}
