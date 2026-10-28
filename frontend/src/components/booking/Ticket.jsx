import { hash, formatDate, money, time12 } from '../../utils/format.js';

/** Deterministic QR-style placeholder (NOT scannable). A real QR encoder replaces this once the API issues signed ticket tokens. */
export function QRPlaceholder({ value, size = 132 }) {
  const n = 25; const cells = [];
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (hash(`${value}:${x}:${y}`) > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  const eye = (ox, oy) => (<g key={`${ox}${oy}`}><rect x={ox} y={oy} width="7" height="7" /><rect x={ox + 1} y={oy + 1} width="5" height="5" fill="#fff" /><rect x={ox + 2} y={oy + 2} width="3" height="3" /></g>);
  return (
    <svg role="img" aria-label={`Ticket QR placeholder for booking ${value}`} viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} fill="#0c0e14" className="bg-white rounded-lg p-0.5">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />{cells}{eye(0, 0)}{eye(n - 7, 0)}{eye(0, n - 7)}
    </svg>
  );
}

const Cut = ({ pos }) => <span aria-hidden className={`absolute w-4 h-4 rounded-full bg-background ${pos}`} />;
const Info = ({ label, value, accent }) => (<div><p className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">{label}</p><p className={`font-headline text-title-md font-bold ${accent ? 'text-secondary' : 'text-white'}`}>{value}</p></div>);

/** Digital boarding-pass ticket (DESIGN.md): info left, QR right, perforation with twin 16px notches. */
export default function Ticket({ booking, className = '' }) {
  const b = booking; const cancelled = ['cancelled', 'refunded'].includes(b.status);
  return (
    <div className={`relative rounded-2xl border border-white/10 bg-surface-container-low shadow-modal overflow-hidden ${className}`} data-testid="ticket">
      <div className="h-1.5 bg-gradient-to-r from-primary-container via-[#f43f5e] to-secondary-container" />
      <div className="grid md:grid-cols-[1fr_auto]">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="label-caps text-secondary">{b.format} • {b.cinemaShort}</span><span className={`chip ${cancelled ? 'bg-error-container/40 text-error' : 'bg-emerald-500/15 text-emerald-300'}`}>{b.status === 'refunded' ? 'Refunded' : b.status === 'cancelled' ? 'Cancelled' : b.status === 'pending' ? 'Pending' : 'Confirmed'}</span></div>
          <h2 className="mt-2 font-headline text-headline-md md:text-headline-lg font-extrabold text-white">{b.movieTitle}</h2>
          <p className="text-body-sm text-on-surface-variant">{b.cinemaName}</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-5">
            <Info label="Date" value={formatDate(b.date, { weekday: true })} /><Info label="Showtime" value={time12(b.start)} accent /><Info label="Screen" value={b.auditoriumName} /><Info label="Seats" value={b.seats.map((s) => s.id).join(', ')} accent />
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-white/10 pt-4"><Info label="Booking ID" value={b.id} /><Info label="Guest" value={b.customer.name} /><Info label="Total paid" value={money(b.total)} /></div>
        </div>
        <div className="relative flex md:flex-col items-center justify-center gap-3 p-6 md:p-8 border-t md:border-t-0 md:border-l border-dashed border-white/20 bg-surface-container-lowest/40">
          <Cut pos="-top-2 left-1/2 -translate-x-1/2 hidden md:block" /><Cut pos="-bottom-2 left-1/2 -translate-x-1/2 hidden md:block" /><Cut pos="-left-2 top-1/2 -translate-y-1/2 md:hidden" /><Cut pos="-right-2 top-1/2 -translate-y-1/2 md:hidden" />
          <QRPlaceholder value={b.id} /><div className="text-center"><p className="font-mono text-label-md text-white tracking-wider">{b.id}</p><p className="text-[10px] text-on-surface-variant">Demo QR • not scannable</p></div>
        </div>
      </div>
    </div>
  );
}
