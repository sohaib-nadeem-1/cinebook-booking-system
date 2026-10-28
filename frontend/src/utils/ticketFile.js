import { formatDate, money, time12, hash } from './format.js';

const qrSvg = (id) => {
  const n = 25; let r = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    if (!finder && hash(`${id}:${x}:${y}`) > 0.52) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  const eye = (ox, oy) => `<rect x="${ox}" y="${oy}" width="7" height="7"/><rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" fill="#fff"/><rect x="${ox + 2}" y="${oy + 2}" width="3" height="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 27 27" width="150" height="150"><rect x="-1" y="-1" width="27" height="27" fill="#fff"/>${r}${eye(0, 0)}${eye(18, 0)}${eye(0, 18)}</svg>`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Self-contained printable ticket (opens in any browser; "Print → Save as PDF" works). */
export function ticketHtml(b) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CineBook Ticket ${esc(b.id)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#0b0d13;color:#e2e2eb;font-family:Inter,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}
.t{width:760px;max-width:100%;background:#191b22;border:1px solid #2c344a;border-radius:20px;overflow:hidden;display:grid;grid-template-columns:1fr 220px}
.bar{height:6px;background:linear-gradient(90deg,#e50914,#f43f5e,#ee9800);grid-column:1/-1}.l{padding:28px}.r{border-left:2px dashed #3b4664;padding:28px;text-align:center;background:#0c0e14}
h1{font-size:30px;margin:6px 0 2px;color:#fff}.k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#a9a3b5}.v{font-size:16px;font-weight:700;margin-top:2px}.a{color:#ffb95f}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:22px}.f{margin-top:22px;border-top:1px dashed #3b4664;padding-top:14px;display:flex;justify-content:space-between;gap:12px}
.brand{font-weight:800;color:#fff}.brand b{color:#e50914}@media(max-width:640px){.t{grid-template-columns:1fr}.r{border-left:0;border-top:2px dashed #3b4664}}@media print{body{background:#fff}}</style></head><body>
<div class="t"><div class="bar"></div><div class="l"><div class="k a">${esc(b.format)} • ${esc(b.cinemaShort)}</div><h1>${esc(b.movieTitle)}</h1><div class="k">${esc(b.cinemaName)}</div>
<div class="g"><div><div class="k">Date</div><div class="v">${esc(formatDate(b.date, { weekday: true }))}</div></div><div><div class="k">Showtime</div><div class="v a">${esc(time12(b.start))}</div></div>
<div><div class="k">Screen</div><div class="v">${esc(b.auditoriumName)}</div></div><div><div class="k">Seats</div><div class="v a">${esc(b.seats.map((s) => s.id).join(', '))}</div></div></div>
<div class="f"><div><div class="k">Booking ID</div><div class="v">${esc(b.id)}</div></div><div><div class="k">Guest</div><div class="v">${esc(b.customer.name)}</div></div><div><div class="k">Total</div><div class="v">${esc(money(b.total))}</div></div></div></div>
<div class="r">${qrSvg(b.id)}<p class="v" style="font-family:monospace;margin-top:10px">${esc(b.id)}</p><p class="k">Demo QR • not scannable</p><p class="brand" style="margin-top:20px">Cine<b>Book</b></p></div></div></body></html>`;
}

export function downloadTicket(b) {
  const blob = new Blob([ticketHtml(b)], { type: 'text/html' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `CineBook-Ticket-${b.id}.html`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
