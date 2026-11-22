import { db } from './db.js';
import { api, simulate, ApiError } from './api.js';
import { isEmail, isPhone } from '../utils/validators.js';
import { slugify, todayKey, uid } from '../utils/format.js';

// Convert backend user data into the format expected by UsersPage.jsx
const normalizeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone || '',
  city: u.city || '',

  role:
    u.role === 'admin'
      ? 'system_admin'
      : u.role === 'Box Office Staff'
        ? 'box_office'
        : u.role,

  status: u.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',

  handle: slugify(u.name).replace(/-/g, '_'),

  joinedAt: u.created_at ? u.created_at.slice(0, 10) : '',

  // Booking statistics will be connected separately
  bookings: 0,
  spent: 0,
});

export const userService = {
  // GET real users from Neon PostgreSQL
  list: async ({ search = '', role, status } = {}) => {
    const response = await api.get('/admin/users');

    const users = (response.users || []).map(normalizeUser);
    const q = search.trim().toLowerCase();

    return users.filter((u) =>
      (!role || u.role === role) &&
      (!status || u.status === status) &&
      (
        !q ||
        `${u.name} ${u.email} ${u.handle} ${u.id}`
          .toLowerCase()
          .includes(q)
      )
    );
  },

  // GET summary using real backend users
  summary: async () => {
    const response = await api.get('/admin/users');
    const users = (response.users || []).map(normalizeUser);

    return {
      total: users.length,

      active: users.filter(
        (u) => u.status === 'active' && u.role === 'customer'
      ).length,

      // VIP role does not exist in the current backend schema
      vip: 0,

      admins: users.filter(
        (u) => u.role === 'system_admin'
      ).length,
    };
  },

  // TEMPORARY MOCK METHODS — backend APIs not implemented yet

  create: (d) => simulate(() => {
    const all = db.users.all();

    const errors = {};

    if (!d.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (!isEmail(d.email)) {
      errors.email = 'Enter a valid email';
    } else if (
      all.some(
        (u) =>
          u.email.toLowerCase() === d.email.toLowerCase()
      )
    ) {
      errors.email = 'That email is already in use';
    }

    if (d.phone && !isPhone(d.phone)) {
      errors.phone = 'Enter a valid phone number';
    }

    if (!d.role) {
      errors.role = 'Select a role';
    }

    if (Object.keys(errors).length) {
      throw Object.assign(
        new ApiError(
          'Please fix the highlighted fields.',
          'VALIDATION'
        ),
        { errors }
      );
    }

    const u = {
      id: uid('u'),
      handle: slugify(d.name).replace(/-/g, '_'),
      password: 'password123',
      status: 'active',
      joinedAt: todayKey(),
      phone: '',
      ...d,
    };

    db.users.save([...all, u]);

    return {
      ...u,
      bookings: 0,
      spent: 0,
    };
  }),

  update: (id, d) => simulate(() => {
    const all = db.users.all();

    const errors = {};

    if (!d.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (!isEmail(d.email)) {
      errors.email = 'Enter a valid email';
    } else if (
      all.some(
        (u) =>
          u.id !== id &&
          u.email.toLowerCase() === d.email.toLowerCase()
      )
    ) {
      errors.email = 'That email is already in use';
    }

    if (d.phone && !isPhone(d.phone)) {
      errors.phone = 'Enter a valid phone number';
    }

    if (!d.role) {
      errors.role = 'Select a role';
    }

    if (Object.keys(errors).length) {
      throw Object.assign(
        new ApiError(
          'Please fix the highlighted fields.',
          'VALIDATION'
        ),
        { errors }
      );
    }

    db.users.save(
      all.map((u) =>
        u.id === id
          ? {
              ...u,
              name: d.name.trim(),
              email: d.email.trim(),
              phone: d.phone?.trim() || '',
              role: d.role,
              status: d.status ?? u.status,
            }
          : u
      )
    );

    const updatedUser = db.users.all().find((u) => u.id === id);

    return {
      ...updatedUser,
      bookings: 0,
      spent: 0,
    };
  }),

  setStatus: (id, status) => simulate(() => {
    const all = db.users.all();

    db.users.save(
      all.map((u) =>
        u.id === id ? { ...u, status } : u
      )
    );

    const updatedUser = db.users.all().find((u) => u.id === id);

    return {
      ...updatedUser,
      bookings: 0,
      spent: 0,
    };
  }, 300),

  remove: (id) => simulate(() => {
    const all = db.users.all();

    if (!all.some((u) => u.id === id)) {
      throw new ApiError('User not found.', 'NOT_FOUND');
    }

    db.users.save(all.filter((u) => u.id !== id));

    return { id };
  }),
};