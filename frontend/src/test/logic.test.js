import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcPricing } from '../utils/pricing.js';
import { authService } from '../services/authService.js';
import { movieService } from '../services/movieService.js';
import { findConflictInList } from '../services/showtimeService.js';

describe('pricing', () => {
  it('sums only server-provided seat prices', () => {
    const p = calcPricing([
      { id: 'A1', tier: 'standard', price: 10.25 },
      { id: 'D4', tier: 'prime', price: 15.5 },
      { id: 'H2', tier: 'vip', price: 19.75 },
    ]);
    expect(p.ticketSubtotal).toBe(45.5);
    expect(p.serviceFee).toBe(0);
    expect(p.tax).toBe(0);
    expect(p.concessions).toBe(0);
    expect(p.total).toBe(45.5);
  });

  it('rejects missing or invalid server seat prices', () => {
    expect(() => calcPricing([{ id: 'A1', tier: 'standard' }])).toThrow('Invalid seat pricing data.');
  });
});

const json = (body, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });

describe('auth (API mocked)', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('wrong password is rejected with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ message: 'Invalid credentials' }, false, 401)));
    await expect(authService.login({ email: 'a@b.com', password: 'x', portal: 'customer' })).rejects.toMatchObject({ status: 401 });
  });

  it('staff cannot use the customer portal', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).endsWith('/login') ? json({ token: 't' }) : json({ data: { id: 1, name: 'Admin', userRole: 'admin' } }))));
    await expect(authService.login({ email: 'admin@cinebook.com', password: 'admin123', portal: 'customer' })).rejects.toMatchObject({ code: 'WRONG_PORTAL' });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('customer can sign in through the customer portal', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).endsWith('/login') ? json({ token: 't' }) : json({ data: { id: 2, name: 'Sam', userRole: 'customer' } }))));
    const u = await authService.login({ email: 'c@cinebook.com', password: 'password123', portal: 'customer' });
    expect(u.name).toBe('Sam');
    expect(u.password).toBeUndefined();
  });
});

describe('movies (API mocked)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('maps backend status to frontend status and hides ended movies from the public list', async () => {
    const rows = [
      { id: 1, title: 'A', runtime: 100, age_rating: 'PG', status: 'Now Showing', genres: [], formats: [] },
      { id: 2, title: 'B', runtime: 100, age_rating: 'PG', status: 'Coming Soon', genres: [], formats: [] },
      { id: 3, title: 'C', runtime: 100, age_rating: 'PG', status: 'Ended', genres: [], formats: [] },
    ];
    vi.stubGlobal('fetch', vi.fn(() => json({ allMovies: rows })));
    const pub = await movieService.list({ sort: 'title' });
    expect(pub.map((m) => [m.title, m.status])).toEqual([['A', 'now_showing'], ['B', 'coming_soon']]);
    const admin = await movieService.list({ scope: 'admin', sort: 'title' });
    expect(admin).toHaveLength(3);
  });
});


describe('showtime conflict preview', () => {
  it('detects an overnight conflict on the adjacent cinema-local date', () => {
    const existing = { id: 1, auditoriumId: 7, date: '2027-01-01', start: '22:00', end: '23:55' };
    const candidate = { id: 2, auditoriumId: 7, date: '2027-01-02', start: '00:05', end: '02:00' };
    expect(findConflictInList(candidate, [existing], candidate.id)).toEqual(existing);
  });

  it('allows exactly the full 15-minute turnaround', () => {
    const existing = { id: 1, auditoriumId: 7, date: '2027-01-01', start: '22:00', end: '23:45' };
    const candidate = { id: 2, auditoriumId: 7, date: '2027-01-02', start: '00:00', end: '02:00' };
    expect(findConflictInList(candidate, [existing], candidate.id)).toBeNull();
  });
});
