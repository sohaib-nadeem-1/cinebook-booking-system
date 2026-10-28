import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Download, Eye, MapPin, Ticket as TicketIcon, XCircle } from 'lucide-react';
import Ticket from '../../components/booking/Ticket.jsx';
import Poster from '../../components/common/Poster.jsx';
import Badge, { STATUS_TONE } from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/common/Modal.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/common/States.jsx';
import { bookingService, bookingPhase, canCancel, canRefund } from '../../services/bookingService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocTitle } from '../../hooks/useDocTitle.js';
import { downloadTicket } from '../../utils/ticketFile.js';
import { formatDate, money, time12 } from '../../utils/format.js';

const TABS = [['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function MyBookingsPage() {
  useDocTitle('My bookings');
  const { user } = useAuth(); const toast = useToast();
  const [tab, setTab] = useState('upcoming'); const [view, setView] = useState(null); const [cancel, setCancel] = useState(null); const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(() => bookingService.list({ userId: user.id, email: user.email }), [user.id]);
  const stats = useAsync(() => bookingService.stats({ userId: user.id, email: user.email }), [data]);
  const all = data || [];
  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, all.filter((b) => bookingPhase(b) === k).length])), [all]);
  const rows = useMemo(() => all.filter((b) => bookingPhase(b) === tab).sort((a, b) => (tab === 'upcoming' ? (a.date + a.start).localeCompare(b.date + b.start) : (b.date + b.start).localeCompare(a.date + a.start))), [all, tab]);

  const doCancel = async () => {
    setBusy(true);
    try { const r = await bookingService.cancel(cancel.id, { refund: canRefund(cancel), by: 'customer' }); toast.success(r.status === 'refunded' ? `Booking ${r.id} cancelled. A full refund of ${money(r.total)} is on its way (demo).` : `Booking ${r.id} cancelled.`); setCancel(null); setTab('cancelled'); reload(true); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const msg = { upcoming: ['No upcoming bookings', 'When you book a movie, your tickets will appear here.'], completed: ['No completed bookings yet', 'Movies you’ve watched will be listed here.'], cancelled: ['No cancelled bookings', 'Cancelled and refunded bookings appear here.'] }[tab];

  return (
    <div className="max-w-5xl mx-auto px-margin-mobile md:px-margin py-8">
      <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg font-bold text-white">My Bookings</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">View tickets, check showtimes and manage your reservations.</p>
      {stats.data && <dl className="mt-5 grid grid-cols-3 gap-3 max-w-xl">{[['Bookings', stats.data.total], ['Tickets', stats.data.tickets], ['Spent', money(stats.data.spent)]].map(([l, v]) => <div key={l} className="panel p-3"><dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">{l}</dt><dd className="font-headline text-headline-sm font-bold text-white">{v}</dd></div>)}</dl>}
      <div role="tablist" aria-label="Booking status" className="mt-6 flex gap-1 border-b border-white/10 overflow-x-auto no-scrollbar">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-5 py-3 text-label-md font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === k ? 'border-primary-container text-white' : 'border-transparent text-on-surface-variant hover:text-white'}`}>{l}<span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${tab === k ? 'bg-primary-container text-white' : 'bg-white/10'}`}>{counts[k]}</span></button>)}</div>
      <div className="mt-6 space-y-4" role="tabpanel">
        {error ? <ErrorState onRetry={reload} /> : loading && !data ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />) : rows.length === 0 ? <EmptyState icon={TicketIcon} title={msg[0]} message={msg[1]} action={<Link to="/movies" className="btn-primary">Browse movies</Link>} /> : rows.map((b) => (
          <article key={b.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
            <Poster src={b.poster} title={b.movieTitle} className="w-24 shrink-0 hidden sm:block" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-headline text-headline-sm text-white">{b.movieTitle}</h2><p className="text-label-sm text-secondary font-bold uppercase tracking-wider">{b.format}</p></div><Badge tone={STATUS_TONE[b.status]} dot>{b.status === 'refunded' ? 'Refunded' : b.status[0].toUpperCase() + b.status.slice(1)}</Badge></div>
              <dl className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-body-sm"><div><dt className="text-on-surface-variant flex items-center gap-1"><Calendar className="w-3.5 h-3.5" aria-hidden />Date</dt><dd className="text-white">{formatDate(b.date, { weekday: true })}</dd></div><div><dt className="text-on-surface-variant flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden />Time</dt><dd className="text-white">{time12(b.start)}</dd></div><div><dt className="text-on-surface-variant flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden />Cinema</dt><dd className="text-white">{b.cinemaShort} • {b.auditoriumName}</dd></div><div><dt className="text-on-surface-variant">Seats • Total</dt><dd className="text-white">{b.seats.map((s) => s.id).join(', ')} • <b>{money(b.total)}</b></dd></div></dl>
              <p className="mt-2 text-label-sm text-on-surface-variant">Booking ID <b className="text-white font-mono">{b.id}</b>{b.status === 'refunded' && b.refund ? ` • Refunded ${money(b.refund.amount)} (demo)` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon={Eye} onClick={() => setView(b)}>View ticket</Button>
                {tab !== 'cancelled' && <Button size="sm" variant="ghost" icon={Download} onClick={() => { downloadTicket(b); toast.success('Ticket downloaded.'); }}>Download</Button>}
                {tab === 'upcoming' && canCancel(b) && <Button size="sm" variant="ghost" className="!text-error hover:!bg-error/10" icon={XCircle} onClick={() => setCancel(b)}>Cancel booking</Button>}</div>
            </div></article>))}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} size="xl" title="Your ticket" description={view && `Booking ${view.id}`} footer={view && <><Button variant="secondary" icon={Download} onClick={() => downloadTicket(view)}>Download ticket</Button><Button onClick={() => setView(null)}>Close</Button></>}>{view && <Ticket booking={view} />}</Modal>
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} onConfirm={doCancel} loading={busy} danger title="Cancel this booking?" confirmText={cancel && canRefund(cancel) ? 'Cancel & refund' : 'Cancel booking'} cancelText="Keep booking"
        message={cancel && (canRefund(cancel) ? `${cancel.movieTitle} on ${formatDate(cancel.date)} at ${time12(cancel.start)}. You’re inside the refund window, so ${money(cancel.total)} will be refunded (simulated).` : `${cancel.movieTitle} starts in under 2 hours, so this cancellation is not eligible for a refund. Your seats will be released.`)} />
    </div>
  );
}
