import { db } from './db.js';
import { simulate, ApiError } from './api.js';
import { store, sstore } from '../utils/storage.js';
import { isEmail, isPhone } from '../utils/validators.js';
import { uid, todayKey } from '../utils/format.js';

/**
 * Frontend-only auth simulation. NOT secure: credentials live in localStorage and there is no token.
 * Replace with POST /api/auth/login (httpOnly cookie or JWT) when the Express API lands.
 */
const strip = ({ password, ...u }) => u;
const KEYS = { customer: 'session', admin: 'adminSession' };

export const readSession = (kind) => {
  const s = sstore.get(KEYS[kind]) || store.get(KEYS[kind]);
  if (!s) return null;
  if (s.guest) return { id: 'guest', name: 'Guest', role: 'guest', guest: true };
  const u = db.users.all().find((x) => x.id === s.userId);
  return u && u.status === 'active' ? strip(u) : null;
};

const persist = (kind, payload, remember) => {
  store.remove(KEYS[kind]); sstore.remove(KEYS[kind]);
  (remember ? store : sstore).set(KEYS[kind], payload);
};

export const authService = {
  login: ({ email, password, remember = true, portal = 'customer' }) => simulate(() => {
    const user = db.users.all().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) throw new ApiError('Invalid email or password. Check the demo credentials and try again.', 'INVALID_CREDENTIALS');
    if (user.status !== 'active') throw new ApiError('This account has been deactivated. Contact a system administrator.', 'INACTIVE');
    const staff = ['system_admin', 'box_office'].includes(user.role);
    if (portal === 'admin' && !staff) throw new ApiError('This account does not have access to the admin console.', 'FORBIDDEN');
    if (portal === 'customer' && staff) throw new ApiError('Staff accounts sign in through the Admin Portal.', 'WRONG_PORTAL');
    persist(portal, { userId: user.id }, remember);
    return strip(user);
  }, 900),

  register: ({ name, email, phone, password }) => simulate(() => {
    if (db.users.all().some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) throw Object.assign(new ApiError('An account with this email already exists.', 'DUPLICATE'), { errors: { email: 'An account with this email already exists' } });
    const user = { id: uid('u'), name: name.trim(), handle: email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase(), email: email.trim(), password, phone: phone.trim(), role: 'customer', status: 'active', joinedAt: todayKey() };
    db.users.save([...db.users.all(), user]);
    return strip(user);
  }, 1000),

  continueAsGuest: () => { persist('customer', { guest: true }, false); return readSession('customer'); },
  logout: (kind) => { store.remove(KEYS[kind]); sstore.remove(KEYS[kind]); },

  forgotPassword: (email) => simulate(() => {
    if (!isEmail(email)) throw new ApiError('Enter a valid email address.', 'VALIDATION');
    return { sent: true }; // never reveal whether the address exists
  }, 800),

  updateProfile: (id, patch) => simulate(() => {
    const errors = {};
    if (!patch.name?.trim()) errors.name = 'Name is required';
    if (!isEmail(patch.email)) errors.email = 'Enter a valid email';
    if (patch.phone && !isPhone(patch.phone)) errors.phone = 'Enter a valid phone number';
    const all = db.users.all();
    if (all.some((u) => u.id !== id && u.email.toLowerCase() === patch.email?.toLowerCase())) errors.email = 'That email is already in use';
    if (Object.keys(errors).length) throw Object.assign(new ApiError('Please fix the highlighted fields.', 'VALIDATION'), { errors });
    const next = all.map((u) => (u.id === id ? { ...u, name: patch.name.trim(), email: patch.email.trim(), phone: patch.phone?.trim() || '', city: patch.city ?? u.city } : u));
    db.users.save(next); return strip(next.find((u) => u.id === id));
  }),

  changePassword: (id, { current, next }) => simulate(() => {
    const all = db.users.all(); const u = all.find((x) => x.id === id);
    if (!u || u.password !== current) throw Object.assign(new ApiError('Current password is incorrect.', 'INVALID_CREDENTIALS'), { errors: { current: 'Current password is incorrect' } });
    if (next.length < 8) throw Object.assign(new ApiError('New password must be at least 8 characters.', 'VALIDATION'), { errors: { next: 'Use at least 8 characters' } });
    db.users.save(all.map((x) => (x.id === id ? { ...x, password: next } : x))); return { ok: true };
  }),
};
